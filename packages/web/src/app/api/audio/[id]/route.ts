import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth0';
import { getPool } from '@/lib/db';
import { deleteObject } from '@/lib/r2';

function validBlob(value: unknown): boolean {
    return typeof value === 'string' && value.length > 0 && value.length <= 8192;
}

/** Renames a track and/or moves it to another folder. The name arrives encrypted. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { title_enc, folder_id } = await request.json();
    if (!validBlob(title_enc)) {
        return NextResponse.json({ error: 'Encrypted title required' }, { status: 400 });
    }

    const pool = getPool();

    // A move must land in a folder this user owns, or it would smuggle a row across
    // accounts.
    if (folder_id != null) {
        const folder = await pool.query(
            'SELECT id FROM audio_folders WHERE id=$1 AND user_id=$2',
            [folder_id, session.user.sub]
        );
        if (folder.rows.length === 0) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
        }
    }

    const result = await pool.query(
        `UPDATE audio_tracks SET title_enc=$1, folder_id=COALESCE($2, folder_id)
         WHERE id=$3 AND user_id=$4
         RETURNING id, folder_id, title_enc, duration_seconds, mime_type,
                   size_bytes, sort_order, enc_v, created_at`,
        [title_enc, folder_id ?? null, params.id, session.user.sub]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ track: result.rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const result = await pool.query(
        'DELETE FROM audio_tracks WHERE id=$1 AND user_id=$2 RETURNING r2_key',
        [params.id, session.user.sub]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Row is already gone; a failed object delete only leaves an orphan blob, so
    // don't fail the request over it.
    try {
        await deleteObject(result.rows[0].r2_key);
    } catch (err) {
        console.error('[audio] failed to delete R2 object:', err);
    }

    return NextResponse.json({ ok: true });
}
