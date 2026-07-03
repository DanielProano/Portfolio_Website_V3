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

    pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER`)
        .catch(() => {});

    pool.query(`
        CREATE TABLE IF NOT EXISTS flashcard_folders (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#4a6fa5',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(err => console.error('[db] flashcard_folders table error:', err));

    pool.query(`
        CREATE TABLE IF NOT EXISTS flashcards (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            folder_id INTEGER REFERENCES flashcard_folders(id) ON DELETE CASCADE,
            front_text TEXT NOT NULL DEFAULT '',
            back_text TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(err => console.error('[db] flashcards table error:', err));

    pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            hash TEXT NOT NULL,
            master_salt TEXT NOT NULL,
            enc_salt TEXT NOT NULL
        )
    `).catch(err => console.error('[db] users table error:', err));

    pool.query(`
        CREATE TABLE IF NOT EXISTS vault (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            service TEXT NOT NULL,
            login TEXT NOT NULL,
            password TEXT NOT NULL,
            notes TEXT DEFAULT ''
        )
    `).catch(err => console.error('[db] vault table error:', err));
}
