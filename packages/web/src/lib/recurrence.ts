import type { Pool } from 'pg';

export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const FREQS: Freq[] = ['daily', 'weekly', 'monthly', 'yearly'];

export function isFreq(v: unknown): v is Freq {
    return typeof v === 'string' && (FREQS as string[]).includes(v);
}

/**
 * Postgres interval per frequency. generate_series computes `start + step * n`
 * rather than accumulating, so month/year steps clamp against the original day:
 * Jan 31 yields Feb 28 then Mar 31, not Feb 28 then Mar 28. Feb 29 yearly lands
 * on Feb 28 in common years and back on Feb 29 in the next leap year.
 */
const STEP: Record<Freq, string> = {
    daily: '1 day',
    weekly: '1 week',
    monthly: '1 month',
    yearly: '1 year',
};

/** How far ahead open-ended series are generated, and how far each extension reaches. */
const HORIZON_YEARS = 2;

export function defaultHorizon(from: Date = new Date()): Date {
    return new Date(from.getFullYear() + HORIZON_YEARS, from.getMonth(), from.getDate());
}

function toDateOnly(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Insert every occurrence of `seriesId` falling in (after, through].
 *
 * The whole query works in local wall-clock time and only converts to an instant at
 * the very end. `start_time AT TIME ZONE tz` turns the stored instant into a naive
 * local timestamp; generate_series steps through those in calendar terms; then
 * `g AT TIME ZONE tz` converts back. That round trip is what keeps a 6pm event at
 * 6pm across a DST change — stepping the instant directly would drift by an hour.
 *
 * `after` is null on first materialization (the template row already exists and must
 * not be duplicated, so it falls back to the template's own start).
 */
async function generateOccurrences(
    pool: Pool,
    opts: {
        userId: string;
        seriesId: number;
        freq: Freq;
        timezone: string;
        through: string;
        after: string | null;
    },
): Promise<void> {
    await pool.query(
        `WITH tpl AS (
             SELECT title, description, color,
                    (start_time AT TIME ZONE $3) AS s_local,
                    (end_time   AT TIME ZONE $3) AS e_local
             FROM calendar_events
             WHERE series_id = $2 AND user_id = $1
             ORDER BY start_time
             LIMIT 1
         )
         INSERT INTO calendar_events
             (user_id, title, description, start_time, end_time, color, series_id)
         SELECT $1, tpl.title, tpl.description,
                g AT TIME ZONE $3,
                (g + (tpl.e_local - tpl.s_local)) AT TIME ZONE $3,
                tpl.color, $2
         FROM tpl,
              generate_series(tpl.s_local, $4::timestamp, $5::interval) AS g
         WHERE g > COALESCE($6::timestamp, tpl.s_local)`,
        [opts.userId, opts.seriesId, opts.timezone, opts.through, STEP[opts.freq], opts.after],
    );
}

/**
 * Create a series for an event that already exists, and fill in its later occurrences.
 * Returns the new series id, or null if the write failed.
 */
export async function createSeries(
    pool: Pool,
    opts: {
        userId: string;
        eventId: number;
        freq: Freq;
        timezone: string;
        until: string | null;
    },
): Promise<number | null> {
    const horizon = toDateOnly(defaultHorizon());
    const through = opts.until && opts.until < horizon ? opts.until : horizon;

    const series = await pool.query(
        `INSERT INTO calendar_series (user_id, freq, until, timezone, materialized_through)
         VALUES ($1, $2, $3, $4, $5::date)
         RETURNING id`,
        [opts.userId, opts.freq, opts.until, opts.timezone, through],
    );
    const seriesId: number | undefined = series.rows[0]?.id;
    if (!seriesId) return null;

    await pool.query(
        `UPDATE calendar_events SET series_id = $1 WHERE id = $2 AND user_id = $3`,
        [seriesId, opts.eventId, opts.userId],
    );

    await generateOccurrences(pool, {
        userId: opts.userId,
        seriesId,
        freq: opts.freq,
        timezone: opts.timezone,
        through: `${through} 23:59:59`,
        after: null,
    });

    return seriesId;
}

/**
 * Push every series far enough forward to cover `windowEnd`, so navigating into a
 * future month materializes what that month needs. This rides along on the month GET,
 * which is why open-ended recurrence needs no cron job — it grows only as far as the
 * user actually looks.
 */
export async function extendSeriesForWindow(
    pool: Pool,
    userId: string,
    windowEnd: Date,
): Promise<void> {
    const due = await pool.query(
        `SELECT id, freq, timezone, until, materialized_through
         FROM calendar_series
         WHERE user_id = $1
           AND materialized_through < $2::date
           AND (until IS NULL OR materialized_through < until)`,
        [userId, toDateOnly(windowEnd)],
    );
    if (due.rows.length === 0) return;

    const horizonBase = defaultHorizon();
    const target = windowEnd > horizonBase ? windowEnd : horizonBase;
    const targetStr = toDateOnly(target);

    for (const s of due.rows) {
        if (!isFreq(s.freq)) continue;
        const untilStr: string | null = s.until ? toDateOnly(new Date(s.until)) : null;
        const through = untilStr && untilStr < targetStr ? untilStr : targetStr;
        const prev = toDateOnly(new Date(s.materialized_through));
        if (through <= prev) continue;

        await generateOccurrences(pool, {
            userId,
            seriesId: s.id,
            freq: s.freq,
            timezone: s.timezone,
            through: `${through} 23:59:59`,
            after: `${prev} 23:59:59`,
        });

        await pool.query(
            `UPDATE calendar_series SET materialized_through = $1::date WHERE id = $2 AND user_id = $3`,
            [through, s.id, userId],
        );
    }
}
