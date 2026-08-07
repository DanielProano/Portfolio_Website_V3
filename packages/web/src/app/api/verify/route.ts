import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';

/**
 * A throwaway cost-12 hash of a random string, matching the cost used at
 * registration. Nothing verifies against it — it exists so the unknown-user path
 * spends the same ~450 ms in bcrypt as a real comparison.
 *
 * Without it, an unknown username returns in about a millisecond while a real one
 * pays a full comparison, which enumerates accounts by stopwatch even after the
 * /api/salt response was made uniform.
 */
const DUMMY_HASH = '$2b$12$EbhfeVeM6D7HyfZnM02KKulY7BkdPiA1WfMnIHbFkV04Vzw4UXMDS';

export async function POST(request: NextRequest) {
    try {
        const { user, hash } = await request.json();

        // Burn the same work on malformed input, so a type error isn't a fast path.
        if (typeof user !== 'string' || typeof hash !== 'string') {
            await bcrypt.compare('x', DUMMY_HASH);
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const pool = getPool();
        const result = await pool.query(
            'SELECT id, hash, enc_salt FROM users WHERE username = $1',
            [user]
        );

        const row = result.rows[0];
        // Always compare — against the real hash if the user exists, the dummy if not.
        const valid = await bcrypt.compare(hash, row?.hash ?? DUMMY_HASH);
        if (!row || !valid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const token = jwt.sign(
            { user_id: row.id },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        );

        return NextResponse.json({ message: 'Authentication successful', token, salt: row.enc_salt });
    } catch (err) {
        console.error('[POST /api/verify]', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
