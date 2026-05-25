import Database from 'better-sqlite3';

const MIGRATIONS: string[] = [
    // 0 — initial schema
    `
    CREATE TABLE IF NOT EXISTS users (
        discord_id   TEXT PRIMARY KEY,
        username     TEXT NOT NULL,
        total_points INTEGER NOT NULL DEFAULT 0,
        joined_at    INTEGER NOT NULL,
        created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS drops (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        submitter_id      TEXT NOT NULL REFERENCES users(discord_id),
        item_name         TEXT NOT NULL,
        item_id           INTEGER,
        gp_value          INTEGER NOT NULL,
        awarded_points    INTEGER NOT NULL,
        teammate_ids      TEXT NOT NULL DEFAULT '[]',
        screenshot_url    TEXT NOT NULL,
        status            TEXT NOT NULL DEFAULT 'pending',
        review_channel_id TEXT,
        review_message_id TEXT,
        staff_id          TEXT,
        submitted_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        reviewed_at       INTEGER
    );

    CREATE TABLE IF NOT EXISTS drop_recipients (
        drop_id    INTEGER NOT NULL REFERENCES drops(id),
        discord_id TEXT NOT NULL REFERENCES users(discord_id),
        points     INTEGER NOT NULL,
        PRIMARY KEY (drop_id, discord_id)
    );

    CREATE TABLE IF NOT EXISTS rank_tiers (
        role_id    TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        min_points INTEGER NOT NULL,
        min_days   INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS user_point_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT NOT NULL REFERENCES users(discord_id),
        delta      INTEGER NOT NULL,
        reason     TEXT NOT NULL,
        new_total  INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    `,
    // 1 — item point overrides
    `
    CREATE TABLE IF NOT EXISTS item_overrides (
        item_id    INTEGER PRIMARY KEY,
        item_name  TEXT NOT NULL,
        points     INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    `,
    // 2 — staff note on drops
    `ALTER TABLE drops ADD COLUMN staff_note TEXT;`,
    // 3 — custom items (untradeables) and bot config
    `
    CREATE TABLE IF NOT EXISTS custom_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL UNIQUE,
        category   TEXT,
        points     INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS bot_config (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    `,
    // 4 — composite items (multi-part untradeables, e.g. Soulreaper Axe)
    `
    CREATE TABLE IF NOT EXISTS composite_items (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT NOT NULL UNIQUE,
        total_points INTEGER NOT NULL,
        created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS composite_parts (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        composite_id INTEGER NOT NULL REFERENCES composite_items(id) ON DELETE CASCADE,
        part_name    TEXT NOT NULL,
        created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        UNIQUE(composite_id, part_name)
    );
    `,
    // 5 — remove auto-synced pets; pet points now managed via item_overrides (setitempoints)
    `DELETE FROM custom_items WHERE category = 'pet' AND points IS NULL;`,
    // 6 — link custom items to composite item sets (superseded by migration 7, kept for ordering)
    `ALTER TABLE custom_items ADD COLUMN composite_id INTEGER REFERENCES composite_items(id) ON DELETE SET NULL;`,
    // 7 — direct parent-item reference (replaces composite_items workflow)
    `ALTER TABLE custom_items ADD COLUMN parent_ref TEXT;`,
    `ALTER TABLE custom_items ADD COLUMN parent_name TEXT;`,
    // 9 — trial membership threads
    `
    CREATE TABLE IF NOT EXISTS trials (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id   TEXT NOT NULL,
        referrer_id  TEXT,
        thread_id    TEXT NOT NULL UNIQUE,
        status       TEXT NOT NULL DEFAULT 'active',
        created_by   TEXT NOT NULL,
        created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        resolved_at  INTEGER,
        resolved_by  TEXT
    );
    `,
];

export function runMigrations(db: Database.Database): void {
    db.exec(`CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY)`);
    const applied = (db.prepare('SELECT id FROM migrations').all() as { id: number }[]).map(r => r.id);

    for (let i = 0; i < MIGRATIONS.length; i++) {
        if (!applied.includes(i)) {
            db.transaction(() => {
                db.exec(MIGRATIONS[i]);
                db.prepare('INSERT INTO migrations (id) VALUES (?)').run(i);
            })();
            console.log(`Applied migration ${i}`);
        }
    }
}
