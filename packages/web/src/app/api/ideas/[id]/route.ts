import { NextRequest, NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth0';
import { getPool } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, description } = await request.json();
    const pool = getPool();
    const result = await pool.query(
        `UPDATE ideas SET title=$1, description=$2, updated_at=NOW()
         WHERE id=$3 AND user_id=$4
         RETURNING id, folder_id, title, description, sort_order, created_at, updated_at`,
        [title ?? '', description ?? '', params.id, session.user.sub]
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
