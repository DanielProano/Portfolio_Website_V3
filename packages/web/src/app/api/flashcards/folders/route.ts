import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth0';
import { getPool } from '@/lib/db';

export async function GET() {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // card_count feeds the delete confirmation, which names how many cards the
    // folder's cascade will take with it.
    const pool = getPool();
    const result = await pool.query(
        `SELECT f.id, f.name, f.color,
                COUNT(c.id)::int AS card_count
         FROM flashcard_folders f
         LEFT JOIN flashcards c ON c.folder_id = f.id AND c.user_id = f.user_id
         WHERE f.user_id = $1
         GROUP BY f.id
         ORDER BY f.created_at ASC`,
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
        'INSERT INTO flashcard_folders (user_id, name, color) VALUES ($1, $2, $3) RETURNING id, name, color, 0 AS card_count',
        [session.user.sub, name.trim(), color ?? '#4a6fa5']
    );
    return NextResponse.json({ folder: result.rows[0] }, { status: 201 });
}
