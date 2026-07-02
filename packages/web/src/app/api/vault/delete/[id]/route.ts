import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyJWT } from '@/lib/jwt';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const userId = verifyJWT(request.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const pool = getPool();
        const result = await pool.query(
            'DELETE FROM vault WHERE user_id = $1 AND id = $2 RETURNING id',
            [userId, params.id]
        );
        if (result.rowCount === 0) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        return NextResponse.json({ message: 'Deleted successfully' });
    } catch (err) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
