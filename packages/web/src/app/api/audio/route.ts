import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth0';
import { getPool } from '@/lib/db';

const TRACK_COLUMNS = `id, folder_id, title_enc, duration_seconds, mime_type,
                       size_bytes, sort_order, enc_v, created_at`;

/** Scoped to one folder so the client can load contents lazily as folders expand. */
export async function GET(request: NextRequest) {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const folderId = new URL(request.url).searchParams.get('folder_id');
    if (!folderId) return NextResponse.json({ error: 'folder_id required' }, { status: 400 });

    const pool = getPool();
    const result = await pool.query(
        `SELECT ${TRACK_COLUMNS} FROM audio_tracks
         WHERE user_id=$1 AND folder_id=$2 AND status='ready'
         ORDER BY sort_order ASC NULLS LAST, created_at ASC`,
        [session.user.sub, folderId]
    );
    return NextResponse.json({ tracks: result.rows });
}

/** Bulk reorder, and/or move songs between folders (drag-and-drop). */
export async function PATCH(request: NextRequest) {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { updates } = await request.json() as {
        updates: { id: number; sort_order?: number; folder_id?: number }[];
    };
    if (!Array.isArray(updates)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const pool = getPool();

    // Every destination folder must belong to this user, or a drag could smuggle a
    // row into someone else's library.
    const targetFolderIds = Array.from(
        new Set(updates.map(u => u.folder_id).filter((f): f is number => f != null))
    );
    if (targetFolderIds.length > 0) {
        const owned = await pool.query(
            'SELECT id FROM audio_folders WHERE id = ANY($1) AND user_id = $2',
            [targetFolderIds, session.user.sub]
        );
        if (owned.rows.length !== targetFolderIds.length) {
            return NextResponse.json({ error: 'Invalid folder' }, { status: 403 });
        }
    }

    await Promise.all(
        updates.map(({ id, sort_order, folder_id }) =>
            pool.query(
                `UPDATE audio_tracks SET
                    sort_order = COALESCE($1, sort_order),
                    folder_id  = COALESCE($2, folder_id)
                 WHERE id=$3 AND user_id=$4`,
                [sort_order ?? null, folder_id ?? null, id, session.user.sub]
            )
        )
    );
    return NextResponse.json({ ok: true });
}
