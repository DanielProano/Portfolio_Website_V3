'use client';

import { encrypt, decrypt } from '@/context/Encrypt';

/**
 * Chunked AES-GCM for audio payloads.
 *
 * Why chunked rather than one big encrypt(): a single GCM operation over a 60 MB
 * FLAC needs the whole plaintext AND ciphertext resident at once, which is a real
 * problem on mobile. Chunking bounds peak memory to ~2x CHUNK_SIZE, lets us report
 * progress, and leaves a path open to range-fetching individual chunks later.
 *
 * Wire format (all integers big-endian):
 *
 *   magic      4 bytes  "DPA1"
 *   version    1 byte   = 1
 *   chunkSize  4 bytes  plaintext bytes per chunk
 *   reserved   3 bytes  zero
 *   ---------- 12 byte header ----------
 *   per chunk: iv (12 bytes) || ctLen (4 bytes) || ciphertext (ctLen, tag included)
 *
 * Each chunk's AAD binds it to its own index AND the total chunk count, so
 * reordering, duplicating, or truncating chunks all fail authentication rather
 * than silently producing shorter/scrambled audio.
 */

const MAGIC = 'DPA1';
const VERSION = 1;
const HEADER_BYTES = 12;
const IV_BYTES = 12;
const LEN_BYTES = 4;
export const CHUNK_SIZE = 1024 * 1024; // 1 MiB of plaintext per chunk

/** Known string sealed under the derived key so a wrong passphrase fails loudly. */
export const VERIFIER_PLAINTEXT = 'dp-audio-v1';

// Return types are pinned to Uint8Array<ArrayBuffer>: since TS 5.7 a bare
// Uint8Array widens to Uint8Array<ArrayBufferLike>, which BlobPart/BufferSource
// reject because it could be backed by a SharedArrayBuffer.
function chunkAad(index: number, total: number): Uint8Array<ArrayBuffer> {
    const aad = new Uint8Array(4 + 8);
    aad.set(new TextEncoder().encode(MAGIC), 0);
    const view = new DataView(aad.buffer);
    view.setUint32(4, index, false);
    view.setUint32(8, total, false);
    return aad;
}

function buildHeader(chunkSize: number): Uint8Array<ArrayBuffer> {
    const header = new Uint8Array(HEADER_BYTES);
    header.set(new TextEncoder().encode(MAGIC), 0);
    header[4] = VERSION;
    new DataView(header.buffer).setUint32(5, chunkSize, false);
    return header;
}

/** Encrypts a File into a Blob of ciphertext, ready to PUT straight to R2. */
export async function encryptFile(
    file: File,
    key: CryptoKey,
    onProgress?: (fraction: number) => void
): Promise<Blob> {
    const total = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const parts: BlobPart[] = [buildHeader(CHUNK_SIZE)];

    for (let i = 0; i < total; i++) {
        const slice = file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size));
        const plaintext = await slice.arrayBuffer();
        const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

        const ct = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, additionalData: chunkAad(i, total) },
            key,
            plaintext
        );

        const lenField = new Uint8Array(LEN_BYTES);
        new DataView(lenField.buffer).setUint32(0, ct.byteLength, false);
        parts.push(iv, lenField, ct);

        onProgress?.((i + 1) / total);
    }

    return new Blob(parts, { type: 'application/octet-stream' });
}

/** Reverses encryptFile, producing a Blob the <audio> element can play. */
export async function decryptToBlob(
    ciphertext: ArrayBuffer,
    key: CryptoKey,
    mimeType: string,
    onProgress?: (fraction: number) => void
): Promise<Blob> {
    const bytes = new Uint8Array(ciphertext);
    if (bytes.byteLength < HEADER_BYTES) throw new Error('Encrypted file is truncated');

    const view = new DataView(ciphertext);
    const magic = new TextDecoder().decode(bytes.subarray(0, 4));
    if (magic !== MAGIC) throw new Error('Not a recognised encrypted audio file');
    if (bytes[4] !== VERSION) throw new Error(`Unsupported encryption version ${bytes[4]}`);

    // Count chunks up front — the AAD binds the total, so we must know it before
    // decrypting even the first chunk.
    const offsets: { iv: Uint8Array<ArrayBuffer>; start: number; len: number }[] = [];
    let cursor = HEADER_BYTES;
    while (cursor < bytes.byteLength) {
        if (cursor + IV_BYTES + LEN_BYTES > bytes.byteLength) throw new Error('Encrypted file is truncated');
        const iv = bytes.subarray(cursor, cursor + IV_BYTES);
        const len = view.getUint32(cursor + IV_BYTES, false);
        const start = cursor + IV_BYTES + LEN_BYTES;
        if (start + len > bytes.byteLength) throw new Error('Encrypted file is truncated');
        offsets.push({ iv, start, len });
        cursor = start + len;
    }

    const parts: BlobPart[] = [];
    for (let i = 0; i < offsets.length; i++) {
        const { iv, start, len } = offsets[i];
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, additionalData: chunkAad(i, offsets.length) },
            key,
            bytes.subarray(start, start + len)
        );
        parts.push(plaintext);
        onProgress?.((i + 1) / offsets.length);
    }

    return new Blob(parts, { type: mimeType || 'audio/mpeg' });
}

/**
 * Same output as decryptToBlob, but decrypts each chunk as its bytes arrive from
 * `response.body` instead of waiting for the whole file to download first — so
 * decryption overlaps the remaining download instead of running after it.
 *
 * The catch: each chunk's AAD binds the total chunk count, which normally isn't
 * knowable until the last chunk's length prefix has been read — i.e. until the
 * whole file has arrived. This works around that without any wire-format change:
 * every chunk but the last is exactly `chunkSize` plaintext bytes (see
 * encryptFile), so the total is recoverable arithmetically from the response's
 * Content-Length and the header's chunkSize alone. If Content-Length is missing
 * (some proxies strip it), this falls back to buffering the whole response first.
 */
export async function decryptResponseStream(
    response: Response,
    key: CryptoKey,
    mimeType: string,
    onProgress?: (fraction: number) => void
): Promise<Blob> {
    const contentLength = Number(response.headers.get('content-length'));
    if (!response.body || !Number.isFinite(contentLength) || contentLength <= 0) {
        return decryptToBlob(await response.arrayBuffer(), key, mimeType, onProgress);
    }

    const reader = response.body.getReader();
    const pending: Uint8Array[] = [];
    let pendingLength = 0;

    async function fill(): Promise<boolean> {
        const { value, done } = await reader.read();
        if (done) return false;
        pending.push(value);
        pendingLength += value.byteLength;
        return true;
    }

    async function need(n: number): Promise<void> {
        while (pendingLength < n) {
            if (!(await fill())) throw new Error('Encrypted file is truncated');
        }
    }

    function take(n: number): Uint8Array<ArrayBuffer> {
        const out = new Uint8Array(n);
        let filled = 0;
        while (filled < n) {
            const head = pending[0];
            const remaining = n - filled;
            if (head.byteLength <= remaining) {
                out.set(head, filled);
                filled += head.byteLength;
                pending.shift();
            } else {
                out.set(head.subarray(0, remaining), filled);
                pending[0] = head.subarray(remaining);
                filled += remaining;
            }
        }
        pendingLength -= n;
        return out;
    }

    await need(HEADER_BYTES);
    const header = take(HEADER_BYTES);
    const magic = new TextDecoder().decode(header.subarray(0, 4));
    if (magic !== MAGIC) throw new Error('Not a recognised encrypted audio file');
    if (header[4] !== VERSION) throw new Error(`Unsupported encryption version ${header[4]}`);
    const chunkSize = new DataView(header.buffer).getUint32(5, false);
    const total = Math.max(1, Math.ceil((contentLength - HEADER_BYTES) / (chunkSize + IV_BYTES + LEN_BYTES + 16)));

    const parts: BlobPart[] = [];
    for (let index = 0; index < total; index++) {
        await need(IV_BYTES + LEN_BYTES);
        const chunkHeader = take(IV_BYTES + LEN_BYTES);
        const iv = chunkHeader.slice(0, IV_BYTES);
        const ctLen = new DataView(chunkHeader.buffer).getUint32(IV_BYTES, false);

        await need(ctLen);
        const ct = take(ctLen);

        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, additionalData: chunkAad(index, total) },
            key,
            ct
        );
        parts.push(plaintext);
        onProgress?.((index + 1) / total);
    }

    // Defense in depth against the arithmetic total ever under- or over-shooting:
    // confirm the stream is exactly exhausted rather than silently returning a
    // truncated or trailing-garbage blob.
    if (pendingLength > 0) throw new Error('Encrypted file has unexpected trailing data');
    const { done } = await reader.read();
    if (!done) throw new Error('Encrypted file has unexpected trailing data');

    return new Blob(parts, { type: mimeType || 'audio/mpeg' });
}

/**
 * Metadata helpers — reuse the vault's {iv, data} JSON shape so both features
 * store encrypted text identically.
 */
export async function sealText(key: CryptoKey, text: string): Promise<string> {
    return JSON.stringify(await encrypt(key, text));
}

export async function openText(key: CryptoKey, blob: string | null): Promise<string> {
    if (!blob) return '';
    try {
        const { iv, data } = JSON.parse(blob) as { iv: number[]; data: number[] };
        return await decrypt(key, iv, data);
    } catch {
        return '';
    }
}
