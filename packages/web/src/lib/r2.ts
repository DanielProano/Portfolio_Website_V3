import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 is S3-API-compatible, so the AWS SDK talks to it directly —
// only the endpoint and `region: 'auto'` differ from real S3.
let client: S3Client | null = null;

export const R2_BUCKET = process.env.R2_BUCKET ?? '';

export function isR2Configured(): boolean {
    return !!(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET
    );
}

function getR2(): S3Client {
    if (!client) {
        if (!isR2Configured()) throw new Error('R2 environment variables are not configured');
        client = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
            },
        });
    }
    return client;
}

/**
 * Fully opaque object key — no filename, no user identifier, no extension.
 * Anyone with bucket access sees `audio/<uuid>` and nothing else. Ownership is
 * enforced by the audio_tracks row that holds the key, not by the key's shape.
 */
export function buildObjectKey(): string {
    return `audio/${crypto.randomUUID()}`;
}

/**
 * Presigned PUT so the browser uploads straight to R2. Necessary because Vercel
 * serverless functions cap request bodies at 4.5 MB — most audio files exceed that.
 * The client MUST send the identical Content-Type or the signature check fails.
 */
export function presignUpload(key: string, contentType: string, expiresIn = 900) {
    return getSignedUrl(
        getR2(),
        new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
        { expiresIn }
    );
}

/**
 * Presigned GET for playback. The client issues a single plain GET for the whole
 * object — no Range requests. Ciphertext can't be fed to <audio> progressively, so
 * it is downloaded in full, decrypted, and played from a Blob URL; seeking then
 * happens locally against that Blob.
 *
 * R2 does honour Range on these URLs, which would allow chunk-by-chunk fetching
 * (each 1 MiB chunk is independently decryptable), but that buys resumability and
 * lower peak memory rather than earlier playback.
 */
export function presignPlayback(key: string, expiresIn = 3600) {
    return getSignedUrl(
        getR2(),
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
        { expiresIn }
    );
}

export async function deleteObject(key: string): Promise<void> {
    await getR2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
