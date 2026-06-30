import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getPool } from '@/lib/db';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

async function requireAdmin() {
    const session = await auth0.getSession();
    return session?.user?.email === ADMIN_EMAIL;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    if (!await requireAdmin()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description, start_time, end_time, color } = await request.json();
    const pool = getPool();

    const result = await pool.query(
        `UPDATE calendar_events
         SET title=$1, description=$2, start_time=$3, end_time=$4, color=$5, updated_at=NOW()
         WHERE id=$6 RETURNING *`,
        [title, description, start_time, end_time, color, params.id]
    );

    if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ event: result.rows[0] });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
    if (!await requireAdmin()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const result = await pool.query(
        `DELETE FROM calendar_events WHERE id=$1 RETURNING id`,
        [params.id]
    );

    if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
