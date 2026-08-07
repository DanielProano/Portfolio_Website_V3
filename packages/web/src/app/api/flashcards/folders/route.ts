import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth0';
import { getPool } from '@/lib/db';

export async function GET() {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const result = await pool.query(
        'SELECT id, name, color FROM flashcard_folders WHERE user_id=$1 ORDER BY created_at ASC',
        [session.user.sub]
    );
    return NextResponse.json({ folders: result.rows });
}

export async function POST(request: NextRequest) {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, color } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const pool = getPool();
    const result = await pool.query(
        'INSERT INTO flashcard_folders (user_id, name, color) VALUES ($1, $2, $3) RETURNING id, name, color',
        [session.user.sub, name.trim(), color ?? '#4a6fa5']
    );
    return NextResponse.json({ folder: result.rows[0] }, { status: 201 });
}
