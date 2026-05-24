import { getDb } from '../db';

export type CustomItemCategory = 'pet' | 'untradeable';

export interface CustomItemRow {
    id: number;
    name: string;
    category: CustomItemCategory | null;
    points: number | null;
    created_at: number;
}

export function getCustomItem(id: number): CustomItemRow | null {
    return getDb().prepare('SELECT * FROM custom_items WHERE id = ?').get(id) as CustomItemRow | null;
}

export function getAllCustomItems(): CustomItemRow[] {
    return getDb().prepare('SELECT * FROM custom_items ORDER BY name ASC').all() as CustomItemRow[];
}

export function searchCustomItems(query: string): CustomItemRow[] {
    return getDb()
        .prepare('SELECT * FROM custom_items WHERE LOWER(name) LIKE ? ORDER BY name ASC LIMIT 25')
        .all(`%${query.toLowerCase()}%`) as CustomItemRow[];
}

export function upsertCustomItem(name: string, category: CustomItemCategory | null, points: number | null): CustomItemRow {
    const db = getDb();
    db.prepare(`
        INSERT INTO custom_items (name, category, points) VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET category = excluded.category, points = excluded.points
    `).run(name, category, points);
    return db.prepare('SELECT * FROM custom_items WHERE name = ?').get(name) as CustomItemRow;
}

export function insertCustomItemIfNew(name: string, category: CustomItemCategory): void {
    getDb().prepare('INSERT OR IGNORE INTO custom_items (name, category, points) VALUES (?, ?, NULL)').run(name, category);
}

export function removeCustomItem(id: number): CustomItemRow | null {
    const db = getDb();
    const item = getCustomItem(id);
    if (!item) return null;
    db.prepare('DELETE FROM custom_items WHERE id = ?').run(id);
    return item;
}
