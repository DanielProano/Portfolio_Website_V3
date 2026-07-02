import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.on('connect', () => {
    console.log('Connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('PostgreSQL error:', err);
});

pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        color TEXT DEFAULT '#64b5f6',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
`).then(() => console.log('Calendar table access successful'))
  .catch(err => console.error('Calendar table error:', err));

// Backfill for existing tables created before user isolation was added
pool.query(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT ''`)
  .catch(() => {});

pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'todo',
        priority TEXT DEFAULT 'medium',
        due_date DATE,
        due_time TIME,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
`).then(() => console.log('Tasks table access successful'))
  .catch(err => console.error('Tasks table error:', err));

// Backfill for existing tables created before user isolation was added
pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT ''`)
  .catch(() => {});

export default pool;