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
