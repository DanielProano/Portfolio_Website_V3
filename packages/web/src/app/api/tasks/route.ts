import { NextRequest, NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth0';
import { getPool } from '@/lib/db';

export async function GET() {
    const session = await getSessionSafe();
    if (!session?.user?.sub) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.sub;

    try {
        const pool = getPool();
        const result = await pool.query(
            `SELECT id, title, description, status, priority, due_date, due_time, created_at
             FROM tasks WHERE user_id = $1 ORDER BY due_date ASC NULLS LAST, created_at DESC`,
            [userId]
        );
        return NextResponse.json({ tasks: result.rows });
    } catch (err) {
        console.error('[GET /api/tasks]', err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getSessionSafe();
    if (!session?.user?.sub) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.sub;

    const { title, description, status, priority, due_date, due_time } = await request.json();

    if (!title) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        const pool = getPool();
        const result = await pool.query(
            `INSERT INTO tasks (user_id, title, description, status, priority, due_date, due_time)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, title, description, status, priority, due_date, due_time, created_at`,
            [
                userId,
                title,
                description ?? '',
                status ?? 'todo',
                priority ?? 'medium',
                due_date ?? null,
                due_time ?? null,
            ]
        );
        return NextResponse.json({ task: result.rows[0] }, { status: 201 });
    } catch (err) {
        console.error('[POST /api/tasks]', err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
