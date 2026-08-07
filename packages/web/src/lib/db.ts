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

    // Recurring events are materialized: every occurrence is a real calendar_events row
    // sharing a series_id. That keeps drag-to-move, resize and delete working unchanged,
    // since all of them address a row by id. The rule is kept here so occurrences can be
    // regenerated and the horizon extended as the user navigates forward.
    //
    // timezone is load-bearing, not decorative: recurrence is defined in local wall-clock
    // time, so "every Tuesday 6pm" must stay 6pm across a DST boundary. Generation casts
    // through this zone rather than adding fixed offsets to an instant.
    pool.query(`
        CREATE TABLE IF NOT EXISTS calendar_series (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            freq TEXT NOT NULL,
            until DATE,
            timezone TEXT NOT NULL DEFAULT 'UTC',
            materialized_through DATE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(err => console.error('[db] calendar_series table error:', err));

    pool.query(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS series_id INTEGER REFERENCES calendar_series(id) ON DELETE CASCADE`)
        .catch(() => {});

    // Set when a single occurrence is edited on its own. "Edit this and following" skips
    // detached rows so a deliberate one-off change is never silently clobbered.
    pool.query(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS detached BOOLEAN NOT NULL DEFAULT FALSE`)
        .catch(() => {});

    pool.query(`CREATE INDEX IF NOT EXISTS calendar_events_series_idx ON calendar_events (series_id)`)
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
        CREATE TABLE IF NOT EXISTS idea_folders (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            sort_order INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(err => console.error('[db] idea_folders table error:', err));

    pool.query(`
        CREATE TABLE IF NOT EXISTS ideas (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            folder_id INTEGER REFERENCES idea_folders(id) ON DELETE CASCADE,
            title TEXT NOT NULL DEFAULT '',
            description TEXT DEFAULT '',
            sort_order INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(err => console.error('[db] ideas table error:', err));

    // Folder names are sealed too — a folder called "Pink Floyd" would leak as much
    // as a song title. Must be created before audio_tracks, which references it.
    pool.query(`
        CREATE TABLE IF NOT EXISTS audio_folders (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            name_enc TEXT NOT NULL,
            sort_order INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(err => console.error('[db] audio_folders table error:', err));

    // Only the song name is stored, and only as an encrypted blob. Everything else
    // here is required to fetch, decode, or order the track — no artist, no album.
    pool.query(`
        CREATE TABLE IF NOT EXISTS audio_tracks (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            folder_id INTEGER NOT NULL REFERENCES audio_folders(id) ON DELETE CASCADE,
            title_enc TEXT NOT NULL,
            duration_seconds INTEGER,
            r2_key TEXT NOT NULL UNIQUE,
            mime_type TEXT DEFAULT 'audio/mpeg',
            size_bytes BIGINT,
            sort_order INTEGER,
            enc_v SMALLINT NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(err => console.error('[db] audio_tracks table error:', err));

    // Per-user KDF salt + verifier. Never holds the passphrase or the derived key —
    // the verifier is just a known string sealed under that key so the client can
    // tell a wrong passphrase from a corrupt file.
    pool.query(`
        CREATE TABLE IF NOT EXISTS audio_keys (
            user_id TEXT PRIMARY KEY,
            kdf_salt TEXT NOT NULL,
            verifier TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(err => console.error('[db] audio_keys table error:', err));

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
