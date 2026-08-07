import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth0';
import { getPool } from '@/lib/db';

function validBlob(value: unknown): boolean {
    return typeof value === 'string' && value.length > 0 && value.length <= 8192;
}

/**
 * Folder names come back sealed — the client opens them with the library key.
 * track_count is safe to compute server-side since it reveals nothing the row
 * listing wouldn't already.
 */
export async function GET() {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const result = await pool.query(
        `SELECT f.id, f.name_enc, f.sort_order, f.created_at,
                COUNT(t.id) FILTER (WHERE t.status = 'ready')::int AS track_count
         FROM audio_folders f
         LEFT JOIN audio_tracks t ON t.folder_id = f.id AND t.user_id = f.user_id
         WHERE f.user_id = $1
         GROUP BY f.id
         ORDER BY f.sort_order ASC NULLS LAST, f.created_at ASC`,
        [session.user.sub]
    );
    return NextResponse.json({ folders: result.rows });
}

export async function POST(request: NextRequest) {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name_enc } = await request.json();
    if (!validBlob(name_enc)) {
        return NextResponse.json({ error: 'Encrypted folder name required' }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query(
        `INSERT INTO audio_folders (user_id, name_enc) VALUES ($1, $2)
         RETURNING id, name_enc, sort_order, created_at, 0 AS track_count`,
        [session.user.sub, name_enc]
    );
    return NextResponse.json({ folder: result.rows[0] }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { updates } = await request.json() as { updates: { id: number; sort_order: number }[] };
    if (!Array.isArray(updates)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const pool = getPool();
    await Promise.all(
        updates.map(({ id, sort_order }) =>
            pool.query(
                'UPDATE audio_folders SET sort_order=$1 WHERE id=$2 AND user_id=$3',
                [sort_order, id, session.user.sub]
            )
        )
    );
    return NextResponse.json({ ok: true });
}
