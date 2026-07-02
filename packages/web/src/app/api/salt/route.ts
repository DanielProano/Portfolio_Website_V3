import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPool } from '@/lib/db';

export async function GET(request: NextRequest) {
    const user = request.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ message: 'Username required' }, { status: 400 });

    try {
        const pool = getPool();
        const result = await pool.query('SELECT master_salt FROM users WHERE username = $1', [user]);

        if (result.rows.length === 0) {
            // Deterministic fake salt — prevents username enumeration via response differential
            const fakeSalt = crypto
                .createHmac('sha256', process.env.JWT_SECRET as string)
                .update(user)
                .digest('base64');
            return NextResponse.json({ master_salt: fakeSalt });
        }

        return NextResponse.json({ master_salt: result.rows[0].master_salt });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
