import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth0';
import { getPool } from '@/lib/db';
import { deleteObject } from '@/lib/r2';

function validBlob(value: unknown): boolean {
    return typeof value === 'string' && value.length > 0 && value.length <= 8192;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name_enc } = await request.json();
    if (!validBlob(name_enc)) {
        return NextResponse.json({ error: 'Encrypted folder name required' }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query(
        `UPDATE audio_folders SET name_enc=$1 WHERE id=$2 AND user_id=$3
         RETURNING id, name_enc, sort_order, created_at`,
        [name_enc, params.id, session.user.sub]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ folder: result.rows[0] });
}

/**
 * Deleting a folder deletes the songs inside it. The DB cascade would leave the R2
 * objects orphaned, so the keys are collected and deleted first — the row is the
 * only record of where the bytes live.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const owned = await pool.query(
        'SELECT id FROM audio_folders WHERE id=$1 AND user_id=$2',
        [params.id, session.user.sub]
    );
    if (owned.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const keys = await pool.query(
        'SELECT r2_key FROM audio_tracks WHERE folder_id=$1 AND user_id=$2',
        [params.id, session.user.sub]
    );

    // Best-effort: a failed object delete only leaves an orphan blob, and must not
    // block removing the folder.
    const results = await Promise.allSettled(keys.rows.map(r => deleteObject(r.r2_key)));
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) console.error(`[audio] ${failed} R2 object(s) survived folder delete`);

    // ON DELETE CASCADE removes the audio_tracks rows.
    await pool.query('DELETE FROM audio_folders WHERE id=$1 AND user_id=$2', [params.id, session.user.sub]);

    return NextResponse.json({ ok: true, deleted_tracks: keys.rows.length });
}
