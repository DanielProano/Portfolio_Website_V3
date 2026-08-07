import { NextRequest, NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth0';
import { getPool } from '@/lib/db';

/** Renames an idea and/or moves it to another folder. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, description, folder_id } = await request.json();
    const pool = getPool();

    // A move must land in a folder this user owns, or it would smuggle a row across
    // accounts.
    if (folder_id != null) {
        const folder = await pool.query(
            'SELECT id FROM idea_folders WHERE id=$1 AND user_id=$2',
            [folder_id, session.user.sub]
        );
        if (folder.rows.length === 0) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
        }
    }

    // description is COALESCEd rather than defaulted to '' — a rename-only request
    // omits it, and must not wipe what's already stored.
    const result = await pool.query(
        `UPDATE ideas SET
            title = $1,
            description = COALESCE($2, description),
            folder_id = COALESCE($3, folder_id),
            updated_at = NOW()
         WHERE id=$4 AND user_id=$5
         RETURNING id, folder_id, title, description, sort_order, created_at, updated_at`,
        [title ?? '', description ?? null, folder_id ?? null, params.id, session.user.sub]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ idea: result.rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const result = await pool.query(
        'DELETE FROM ideas WHERE id=$1 AND user_id=$2 RETURNING id',
        [params.id, session.user.sub]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
}
