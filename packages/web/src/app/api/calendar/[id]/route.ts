import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth0';
import { getPool } from '@/lib/db';

async function getAuthenticatedUserId(): Promise<string | null> {
    const session = await getUserSession();
    return session?.user?.sub ?? null;
}

/**
 * Which occurrences an edit or delete applies to. Defaults to 'this', which is exactly
 * the pre-recurrence behaviour — so drag-to-move, resize and the notes autosave all keep
 * working without sending a scope at all.
 */
type Scope = 'this' | 'following' | 'all';

function parseScope(v: unknown): Scope {
    return v === 'following' || v === 'all' ? v : 'this';
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, description, start_time, end_time, color, scope } = await request.json();
    const applyTo = parseScope(scope);

    try {
        const pool = getPool();

        const existing = await pool.query(
            `SELECT id, series_id, start_time FROM calendar_events WHERE id=$1 AND user_id=$2`,
            [params.id, userId]
        );
        if (existing.rows.length === 0) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        const seriesId: number | null = existing.rows[0].series_id;

        // Single-occurrence edit. If it belongs to a series it becomes detached, so a
        // later "this and following" edit leaves this deliberate change alone.
        if (applyTo === 'this' || !seriesId) {
            const result = await pool.query(
                `UPDATE calendar_events
                 SET title=$1, description=$2, start_time=$3, end_time=$4, color=$5,
                     detached = CASE WHEN series_id IS NULL THEN detached ELSE TRUE END,
                     updated_at=NOW()
                 WHERE id=$6 AND user_id=$7
                 RETURNING id, title, description, start_time, end_time, color, series_id`,
                [title, description, start_time, end_time, color, params.id, userId]
            );
            return NextResponse.json({ event: result.rows[0] });
        }

        // Series edit. Each occurrence keeps its own date and takes the new time-of-day
        // and duration. The AT TIME ZONE round trip means a 6pm event stays 6pm on both
        // sides of a DST boundary instead of drifting an hour.
        const boundary = applyTo === 'following' ? existing.rows[0].start_time : null;

        const result = await pool.query(
            `UPDATE calendar_events e
             SET title = $1,
                 description = $2,
                 color = $3,
                 start_time = (
                     date_trunc('day', e.start_time AT TIME ZONE s.timezone)
                     + ($4::timestamptz AT TIME ZONE s.timezone)::time
                 ) AT TIME ZONE s.timezone,
                 end_time = (
                     date_trunc('day', e.start_time AT TIME ZONE s.timezone)
                     + ($4::timestamptz AT TIME ZONE s.timezone)::time
                     + ($5::timestamptz - $4::timestamptz)
                 ) AT TIME ZONE s.timezone,
                 updated_at = NOW()
             FROM calendar_series s
             WHERE e.series_id = s.id
               AND s.id = $6
               AND e.user_id = $7
               AND (NOT e.detached OR e.id = $8)
               AND ($9::timestamptz IS NULL OR e.start_time >= $9::timestamptz)
             RETURNING e.id`,
            [title, description, color, start_time, end_time, seriesId, userId, params.id, boundary]
        );

        return NextResponse.json({ updated: result.rowCount, series_id: seriesId });
    } catch (err) {
        console.error('[PUT /api/calendar/:id]', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const applyTo = parseScope(new URL(request.url).searchParams.get('scope'));

    try {
        const pool = getPool();

        const existing = await pool.query(
            `SELECT id, series_id, start_time FROM calendar_events WHERE id=$1 AND user_id=$2`,
            [params.id, userId]
        );
        if (existing.rows.length === 0) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        const seriesId: number | null = existing.rows[0].series_id;

        if (applyTo === 'this' || !seriesId) {
            await pool.query(
                `DELETE FROM calendar_events WHERE id=$1 AND user_id=$2`,
                [params.id, userId]
            );
            return NextResponse.json({ success: true, deleted: 1 });
        }

        if (applyTo === 'following') {
            const result = await pool.query(
                `DELETE FROM calendar_events
                 WHERE series_id=$1 AND user_id=$2 AND start_time >= $3`,
                [seriesId, userId, existing.rows[0].start_time]
            );
            // Stop the horizon from regrowing what was just removed. The boundary date is
            // resolved in the series timezone — casting the instant to date in the server's
            // zone can land a day off. Minus one day, since the boundary day itself is gone.
            await pool.query(
                `UPDATE calendar_series s
                 SET until = (($1::timestamptz AT TIME ZONE s.timezone)::date - 1),
                     materialized_through = (($1::timestamptz AT TIME ZONE s.timezone)::date - 1)
                 WHERE s.id=$2 AND s.user_id=$3`,
                [existing.rows[0].start_time, seriesId, userId]
            );
            return NextResponse.json({ success: true, deleted: result.rowCount });
        }

        // 'all' — the series row cascades to any remaining occurrences.
        const result = await pool.query(
            `DELETE FROM calendar_events WHERE series_id=$1 AND user_id=$2`,
            [seriesId, userId]
        );
        await pool.query(
            `DELETE FROM calendar_series WHERE id=$1 AND user_id=$2`,
            [seriesId, userId]
        );
        return NextResponse.json({ success: true, deleted: result.rowCount });
    } catch (err) {
        console.error('[DELETE /api/calendar/:id]', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
