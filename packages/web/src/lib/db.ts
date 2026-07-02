import { Pool } from 'pg';

let pool: Pool;
let initialized = false;

export function getPool(): Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });
        initSchema(pool);
    }
    return pool;
}

function initSchema(pool: Pool) {
    if (initialized) return;
    initialized = true;

    pool.query(`
        CREATE TABLE IF NOT EXISTS calendar_events (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT '',
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            start_time TIMESTAMPTZ NOT NULL,
            end_time TIMESTAMPTZ NOT NULL,
            color TEXT DEFAULT '#64b5f6',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(err => console.error('[db] calendar_events table error:', err));

    pool.query(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT ''`)
        .catch(() => {});

    pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT '',
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'todo',
            priority TEXT DEFAULT 'medium',
            due_date DATE,
            due_time TIME,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(err => console.error('[db] tasks table error:', err));

    pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT ''`)
        .catch(() => {});
}
