import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth0';
import { getPool } from '@/lib/db';
import { presignPlayback, isR2Configured } from '@/lib/r2';

const EXPIRES_IN = 3600;

/**
 * Mints a short-lived presigned R2 URL. The audio bytes go browser <-> R2 directly
 * and never transit Vercel, which keeps this off Vercel's egress entirely.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isR2Configured()) {
        return NextResponse.json({ error: 'Audio storage is not configured' }, { status: 503 });
    }

    const pool = getPool();
    const result = await pool.query(
        `SELECT r2_key FROM audio_tracks
         WHERE id=$1 AND user_id=$2 AND status='ready'`,
        [params.id, session.user.sub]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const url = await presignPlayback(result.rows[0].r2_key, EXPIRES_IN);
    return NextResponse.json({ url, expires_in: EXPIRES_IN });
}
