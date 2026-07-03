import { NextRequest, NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth0';
import { getPool } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { front_text, back_text } = await request.json();
    const pool = getPool();
    const result = await pool.query(
        `UPDATE flashcards SET front_text=$1, back_text=$2, updated_at=NOW()
         WHERE id=$3 AND user_id=$4
         RETURNING id, folder_id, front_text, back_text`,
        [front_text ?? '', back_text ?? '', params.id, session.user.sub]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ card: result.rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const result = await pool.query(
        'DELETE FROM flashcards WHERE id=$1 AND user_id=$2 RETURNING id',
        [params.id, session.user.sub]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}
