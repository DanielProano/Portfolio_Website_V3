import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyJWT } from '@/lib/jwt';

export async function POST(request: NextRequest) {
    const userId = verifyJWT(request.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { service, login, password, notes } = await request.json();
    if (!service || !login || !password) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    try {
        const pool = getPool();
        await pool.query(
            'INSERT INTO vault (user_id, service, login, password, notes) VALUES ($1, $2, $3, $4, $5)',
            [userId, JSON.stringify(service), JSON.stringify(login), JSON.stringify(password), JSON.stringify(notes || {})]
        );
        return NextResponse.json({ message: 'Inserted password successfully' }, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: 'Problem saving password' }, { status: 500 });
    }
}
