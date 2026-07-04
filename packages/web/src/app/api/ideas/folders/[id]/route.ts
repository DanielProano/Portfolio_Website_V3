import { NextRequest, NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth0';
import { getPool } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const pool = getPool();
    const result = await pool.query(
        'UPDATE idea_folders SET name=$1 WHERE id=$2 AND user_id=$3 RETURNING id, name, sort_order, created_at',
        [name.trim(), params.id, session.user.sub]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ folder: result.rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const result = await pool.query(
        'DELETE FROM idea_folders WHERE id=$1 AND user_id=$2 RETURNING id',
        [params.id, session.user.sub]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
}
