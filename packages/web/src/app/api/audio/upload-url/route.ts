import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth0';
import { getPool } from '@/lib/db';
import { buildObjectKey, presignUpload, isR2Configured } from '@/lib/r2';

// Ciphertext is ~0.1% larger than plaintext (12-byte IV + 4-byte length + 16-byte
// tag per 1 MiB chunk), so the cap is on the encrypted blob we actually store.
const MAX_BYTES = 220 * 1024 * 1024;

// The real container type is kept in the DB, not on the R2 object — the object is
// uploaded as opaque octet-stream so the bucket never reveals what format it is.
const ALLOWED_TYPES = new Set([
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/flac',
    'audio/x-flac',
    'audio/ogg',
    'audio/opus',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
]);

const CIPHERTEXT_CONTENT_TYPE = 'application/octet-stream';

function validBlob(value: unknown): boolean {
    return typeof value === 'string' && value.length > 0 && value.length <= 8192;
}

export async function POST(request: NextRequest) {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isR2Configured()) {
        return NextResponse.json({ error: 'Audio storage is not configured' }, { status: 503 });
    }

    const { content_type, size_bytes, duration_seconds, title_enc, folder_id } = await request.json();

    if (!ALLOWED_TYPES.has(content_type)) {
        return NextResponse.json({ error: `Unsupported audio type: ${content_type}` }, { status: 400 });
    }
    if (typeof size_bytes !== 'number' || size_bytes <= 0 || size_bytes > MAX_BYTES) {
        return NextResponse.json({ error: 'File too large (200 MB max)' }, { status: 400 });
    }
    if (!validBlob(title_enc)) {
        return NextResponse.json({ error: 'Encrypted title required' }, { status: 400 });
    }
    if (!folder_id) return NextResponse.json({ error: 'folder_id required' }, { status: 400 });

    const pool = getPool();
    const folder = await pool.query(
        'SELECT id FROM audio_folders WHERE id=$1 AND user_id=$2',
        [folder_id, session.user.sub]
    );
    if (folder.rows.length === 0) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

    const key = buildObjectKey();

    // Row is created up front in 'pending' so ownership of the key is recorded
    // before any bytes exist. The client flips it to 'ready' once the PUT lands;
    // rows that never get there are simply never listed.
    const result = await pool.query(
        `INSERT INTO audio_tracks
            (user_id, folder_id, title_enc, duration_seconds, r2_key, mime_type, size_bytes, enc_v, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'pending')
         RETURNING id`,
        [
            session.user.sub,
            folder_id,
            title_enc,
            Number.isFinite(duration_seconds) ? Math.round(duration_seconds) : null,
            key,
            content_type,
            size_bytes,
        ]
    );

    const uploadUrl = await presignUpload(key, CIPHERTEXT_CONTENT_TYPE);

    return NextResponse.json({
        upload_url: uploadUrl,
        track_id: result.rows[0].id,
        content_type: CIPHERTEXT_CONTENT_TYPE,
    });
}
