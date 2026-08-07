import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';

/**
 * Key for the fake-salt HMAC, domain-separated from JWT_SECRET's signing duty so
 * the two uses can never interact.
 */
function fakeSaltKey(): Buffer {
    return crypto
        .createHmac('sha256', process.env.JWT_SECRET as string)
        .update('vault-fake-salt-v1')
        .digest();
}

/**
 * A real master_salt is whatever `bcrypt.genSaltSync(10)` produced on the register
 * page: literally "$2b$10$" followed by 22 characters of bcrypt's radix64 alphabet,
 * 29 characters total.
 *
 * The fake has to reproduce that shape exactly or it isn't a mitigation. The prior
 * version returned a raw base64 SHA-256 digest — 44 characters, standard alphabet —
 * so "does this account exist?" was answerable with one unauthenticated request and
 * a length check, which is precisely what the fake salt existed to prevent.
 *
 * Deterministic per username, so repeated probes for the same name stay consistent.
 */
function fakeSalt(user: string): string {
    const bytes = crypto
        .createHmac('sha256', fakeSaltKey())
        .update(user)
        .digest()
        .subarray(0, 16);
    return '$2b$10$' + bcrypt.encodeBase64(bytes, 16);
}

export async function GET(request: NextRequest) {
    const user = request.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ message: 'Username required' }, { status: 400 });

    try {
        const pool = getPool();
        const result = await pool.query('SELECT master_salt FROM users WHERE username = $1', [user]);

        if (result.rows.length === 0) {
            return NextResponse.json({ master_salt: fakeSalt(user) });
        }

        return NextResponse.json({ master_salt: result.rows[0].master_salt });
    } catch (err) {
        // Generic body: this endpoint is unauthenticated, and `String(err)` handed
        // back raw pg errors (failing SQL, table and column names, connection info).
        console.error('[GET /api/salt]', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
