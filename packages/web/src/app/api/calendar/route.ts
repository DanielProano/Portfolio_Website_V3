import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getPool } from '@/lib/db';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1));

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const session = await auth0.getSession();
    const isAdmin = session?.user?.email === ADMIN_EMAIL;

    const pool = getPool();

    const columns = isAdmin
        ? 'id, title, description, start_time, end_time, color'
        : 'id, title, start_time, end_time, color';

    const result = await pool.query(
        `SELECT ${columns} FROM calendar_events WHERE start_time >= $1 AND start_time < $2 ORDER BY start_time`,
        [start, end]
    );

    return NextResponse.json({ events: result.rows });
}

export async function POST(request: NextRequest) {
    const session = await auth0.getSession();
    if (!session || session.user.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description, start_time, end_time, color } = await request.json();

    if (!title || !start_time || !end_time) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query(
        `INSERT INTO calendar_events (title, description, start_time, end_time, color)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [title, description ?? '', start_time, end_time, color ?? '#64b5f6']
    );

    return NextResponse.json({ event: result.rows[0] }, { status: 201 });
}
