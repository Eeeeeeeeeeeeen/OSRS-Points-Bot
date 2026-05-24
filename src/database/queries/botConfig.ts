import { getDb } from '../db';

export function getConfig(key: string): string | null {
    const row = getDb().prepare('SELECT value FROM bot_config WHERE key = ?').get(key) as { value: string } | null;
    return row?.value ?? null;
}

export function setConfig(key: string, value: string): void {
    getDb().prepare(`
        INSERT INTO bot_config (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = (unixepoch() * 1000)
    `).run(key, value);
}
