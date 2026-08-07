import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getUserSession } from '@/lib/auth0';
import { getPool } from '@/lib/db';

/**
 * Returns the per-user PBKDF2 salt and the passphrase verifier. Creates the salt
 * on first call so the client always has one to derive against. The salt is not a
 * secret; the verifier is a known string sealed under the derived key, which lets
 * the client distinguish "wrong passphrase" from "corrupt file" without the server
 * ever learning the key.
 */
export async function GET() {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const salt = randomBytes(24).toString('base64');
    await pool.query(
        `INSERT INTO audio_keys (user_id, kdf_salt) VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [session.user.sub, salt]
    );

    const result = await pool.query(
        'SELECT kdf_salt, verifier FROM audio_keys WHERE user_id=$1',
        [session.user.sub]
    );
    const row = result.rows[0];
    return NextResponse.json({ salt: row.kdf_salt, verifier: row.verifier ?? null });
}

/**
 * Records the verifier the first time a passphrase is set. Deliberately refuses to
 * overwrite an existing one — re-keying would silently orphan every file already
 * encrypted under the old passphrase.
 */
export async function POST(request: NextRequest) {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { verifier } = await request.json();
    if (typeof verifier !== 'string' || verifier.length === 0 || verifier.length > 4096) {
        return NextResponse.json({ error: 'Invalid verifier' }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query(
        `UPDATE audio_keys SET verifier=$1
         WHERE user_id=$2 AND verifier IS NULL
         RETURNING user_id`,
        [verifier, session.user.sub]
    );
    if (result.rows.length === 0) {
        return NextResponse.json({ error: 'A passphrase is already set' }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
}
