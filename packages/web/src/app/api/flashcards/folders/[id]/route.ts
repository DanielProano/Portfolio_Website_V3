import { NextRequest, NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth0';
import { getPool } from '@/lib/db';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const result = await pool.query(
        'DELETE FROM flashcard_folders WHERE id=$1 AND user_id=$2 RETURNING id',
        [params.id, session.user.sub]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}
