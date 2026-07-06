import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPool } from '@/lib/db';

export async function POST(request: NextRequest) {
    const { user, hash } = await request.json();

    try {
        const pool = getPool();
        const result = await pool.query(
            'SELECT id, hash, enc_salt FROM users WHERE username = $1',
            [user]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const row = result.rows[0];
        if (hash !== row.hash) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const token = jwt.sign(
            { user_id: row.id },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        );

        return NextResponse.json({ message: 'Authentication successful', token, salt: row.enc_salt });
    } catch (err) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
