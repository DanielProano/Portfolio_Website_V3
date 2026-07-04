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
        'SELECT id, folder_id, front_text, back_text FROM flashcards WHERE user_id=$1 AND folder_id=$2 ORDER BY created_at ASC',
        [session.user.sub, folderId]
    );
    return NextResponse.json({ cards: result.rows });
}

export async function POST(request: NextRequest) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { folder_id, front_text, back_text } = await request.json();
    if (!folder_id) return NextResponse.json({ error: 'folder_id required' }, { status: 400 });

    const pool = getPool();
    const ownerCheck = await pool.query(
        'SELECT id FROM flashcard_folders WHERE id=$1 AND user_id=$2',
        [folder_id, session.user.sub]
    );
    if (ownerCheck.rows.length === 0) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

    const result = await pool.query(
        `INSERT INTO flashcards (user_id, folder_id, front_text, back_text)
         VALUES ($1, $2, $3, $4)
         RETURNING id, folder_id, front_text, back_text`,
        [session.user.sub, folder_id, front_text ?? '', back_text ?? '']
    );
    return NextResponse.json({ card: result.rows[0] }, { status: 201 });
}
