import { NextRequest, NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth0';
import { getPool } from '@/lib/db';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export async function GET() {
    const session = await getSessionSafe();
    if (!session || session.user.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const pool = getPool();
        const result = await pool.query(
            `SELECT * FROM tasks ORDER BY due_date ASC NULLS LAST, created_at DESC`
        );
        return NextResponse.json({ tasks: result.rows });
    } catch (err) {
        console.error('[GET /api/tasks]', err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getSessionSafe();
    if (!session || session.user.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description, status, priority, due_date, due_time } = await request.json();

    if (!title) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        const pool = getPool();
        const result = await pool.query(
            `INSERT INTO tasks (title, description, status, priority, due_date, due_time)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
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
