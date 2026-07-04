import { NextRequest, NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth0';
import { getPool } from '@/lib/db';

export async function GET() {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const result = await pool.query(
        'SELECT id, name, sort_order, created_at FROM idea_folders WHERE user_id=$1 ORDER BY sort_order ASC NULLS LAST, created_at ASC',
        [session.user.sub]
    );
    return NextResponse.json({ folders: result.rows });
}

export async function POST(request: NextRequest) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const pool = getPool();
    const result = await pool.query(
        'INSERT INTO idea_folders (user_id, name) VALUES ($1, $2) RETURNING id, name, sort_order, created_at',
        [session.user.sub, name.trim()]
    );
    return NextResponse.json({ folder: result.rows[0] }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { updates } = await request.json() as { updates: { id: number; sort_order: number }[] };
    if (!Array.isArray(updates)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const pool = getPool();
    await Promise.all(
        updates.map(({ id, sort_order }) =>
            pool.query(
                'UPDATE idea_folders SET sort_order=$1 WHERE id=$2 AND user_id=$3',
                [sort_order, id, session.user.sub]
            )
        )
    );
    return NextResponse.json({ ok: true });
}
