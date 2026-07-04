import { NextRequest, NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth0';
import { getPool } from '@/lib/db';

export async function GET(request: NextRequest) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const folderId = new URL(request.url).searchParams.get('folder_id');
    if (!folderId) return NextResponse.json({ error: 'folder_id required' }, { status: 400 });

    const pool = getPool();
    const result = await pool.query(
        `SELECT id, folder_id, title, description, sort_order, created_at, updated_at
         FROM ideas WHERE user_id=$1 AND folder_id=$2
         ORDER BY sort_order ASC NULLS LAST, created_at ASC`,
        [session.user.sub, folderId]
    );
    return NextResponse.json({ ideas: result.rows });
}

export async function POST(request: NextRequest) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { folder_id, title, description } = await request.json();
    if (!folder_id) return NextResponse.json({ error: 'folder_id required' }, { status: 400 });

    const pool = getPool();
    const ownerCheck = await pool.query(
        'SELECT id FROM idea_folders WHERE id=$1 AND user_id=$2',
        [folder_id, session.user.sub]
    );
    if (ownerCheck.rows.length === 0) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

    const result = await pool.query(
        `INSERT INTO ideas (user_id, folder_id, title, description)
         VALUES ($1, $2, $3, $4)
         RETURNING id, folder_id, title, description, sort_order, created_at, updated_at`,
        [session.user.sub, folder_id, title ?? '', description ?? '']
    );
    return NextResponse.json({ idea: result.rows[0] }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { updates } = await request.json() as { updates: { id: number; sort_order?: number; folder_id?: number }[] };
    if (!Array.isArray(updates)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const pool = getPool();
    await Promise.all(
        updates.map(({ id, sort_order, folder_id }) =>
            pool.query(
                `UPDATE ideas SET
                    sort_order = COALESCE($1, sort_order),
                    folder_id = COALESCE($2, folder_id)
                 WHERE id=$3 AND user_id=$4`,
                [sort_order ?? null, folder_id ?? null, id, session.user.sub]
            )
        )
    );
    return NextResponse.json({ ok: true });
}
