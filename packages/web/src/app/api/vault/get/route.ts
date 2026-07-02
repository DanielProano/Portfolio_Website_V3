import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyJWT } from '@/lib/jwt';

export async function GET(request: NextRequest) {
    const userId = verifyJWT(request.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const pool = getPool();
        const result = await pool.query('SELECT * FROM vault WHERE user_id = $1', [userId]);
        return NextResponse.json({ vault: result.rows });
    } catch (err) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
