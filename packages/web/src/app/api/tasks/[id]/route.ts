import { NextRequest, NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth0';
import { getPool } from '@/lib/db';

async function getAuthenticatedUserId(): Promise<string | null> {
    const session = await getSessionSafe();
    return session?.user?.sub ?? null;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, description, status, priority, due_date, due_time } = await request.json();
    try {
        const pool = getPool();
        const result = await pool.query(
            `UPDATE tasks SET title=$1, description=$2, status=$3, priority=$4, due_date=$5, due_time=$6, updated_at=NOW()
             WHERE id=$7 AND user_id=$8
             RETURNING id, title, description, status, priority,
              TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
              TO_CHAR(due_time, 'HH24:MI') AS due_time,
              created_at`,
            [title, description, status, priority, due_date ?? null, due_time ?? null, params.id, userId]
        );
        if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ task: result.rows[0] });
    } catch (err) {
        console.error('[PUT /api/tasks/:id]', err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const result = await pool.query(
        `DELETE FROM tasks WHERE id=$1 AND user_id=$2 RETURNING id`,
        [params.id, userId]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}
