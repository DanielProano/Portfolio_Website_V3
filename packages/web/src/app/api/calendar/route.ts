import { NextRequest, NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth0';
import { getPool } from '@/lib/db';

export async function GET(request: NextRequest) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.sub;

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1));

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    try {
        const pool = getPool();

        const result = await pool.query(
            `SELECT id, title, description, start_time, end_time, color
             FROM calendar_events
             WHERE user_id = $1 AND start_time >= $2 AND start_time < $3
             ORDER BY start_time`,
            [userId, start, end]
        );

        let tasks: unknown[] = [];
        try {
            const taskResult = await pool.query(
                `SELECT id, title, status, priority, due_date, due_time
                 FROM tasks
                 WHERE user_id = $1 AND due_date >= $2::date AND due_date < $3::date
                 ORDER BY due_date, due_time NULLS LAST`,
                [userId, start, end]
            );
            tasks = taskResult.rows;
        } catch {
            // tasks table may not exist yet
        }

        return NextResponse.json({ events: result.rows, tasks });
    } catch {
        return NextResponse.json({ events: [], tasks: [] });
    }
}

export async function POST(request: NextRequest) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.sub;

    const { title, description, start_time, end_time, color } = await request.json();

    if (!title || !start_time || !end_time) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        const pool = getPool();
        const result = await pool.query(
            `INSERT INTO calendar_events (user_id, title, description, start_time, end_time, color)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, title, description, start_time, end_time, color`,
            [userId, title, description ?? '', start_time, end_time, color ?? '#64b5f6']
        );
        return NextResponse.json({ event: result.rows[0] }, { status: 201 });
    } catch (err) {
        console.error('[POST /api/calendar]', err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
