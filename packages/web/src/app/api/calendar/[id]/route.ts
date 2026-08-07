import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth0';
import { getPool } from '@/lib/db';

async function getAuthenticatedUserId(): Promise<string | null> {
    const session = await getUserSession();
    return session?.user?.sub ?? null;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, description, start_time, end_time, color } = await request.json();
    try {
        const pool = getPool();
        const result = await pool.query(
            `UPDATE calendar_events
             SET title=$1, description=$2, start_time=$3, end_time=$4, color=$5, updated_at=NOW()
             WHERE id=$6 AND user_id=$7
             RETURNING id, title, description, start_time, end_time, color`,
            [title, description, start_time, end_time, color, params.id, userId]
        );
        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        return NextResponse.json({ event: result.rows[0] });
    } catch (err) {
        console.error('[PUT /api/calendar/:id]', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const pool = getPool();
        const result = await pool.query(
            `DELETE FROM calendar_events WHERE id=$1 AND user_id=$2 RETURNING id`,
            [params.id, userId]
        );
        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/calendar/:id]', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
