import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPool } from '@/lib/db';
import { getSessionSafe } from '@/lib/auth0';

export async function POST(request: NextRequest) {
    const session = await getSessionSafe();
    if (session?.user?.email !== process.env.ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user, hash, master_salt } = await request.json();

    if (!user || !hash || !master_salt) {
        return NextResponse.json({ error: 'Need a user, pass, or salt' }, { status: 400 });
    }

    try {
        const pool = getPool();
        const vault_salt = crypto.randomBytes(16).toString('base64');
        await pool.query(
            'INSERT INTO users (username, hash, master_salt, enc_salt) VALUES ($1, $2, $3, $4)',
            [user, hash, master_salt, vault_salt]
        );
        return NextResponse.json({ message: 'User registered successfully' }, { status: 201 });
    } catch (err: any) {
        if (err.code === '23505') {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
