import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth0';
import { getPool } from '@/lib/db';

/** Flips a pending upload to 'ready' once the browser's direct-to-R2 PUT succeeds. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const result = await pool.query(
        `UPDATE audio_tracks SET status='ready'
         WHERE id=$1 AND user_id=$2 AND status='pending'
         RETURNING id, folder_id, title_enc, duration_seconds, mime_type,
                   size_bytes, sort_order, enc_v, created_at`,
        [params.id, session.user.sub]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ track: result.rows[0] });
}
