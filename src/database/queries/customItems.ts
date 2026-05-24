import { getDb } from '../db';

export type CustomItemCategory = 'pet' | 'untradeable';

export interface CustomItemRow {
    id: number;
    name: string;
    category: CustomItemCategory | null;
    points: number | null;
    parent_ref: string | null;   // "ge:<itemId>" or "custom:<id>"
    parent_name: string | null;  // denormalised display name of the parent item
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

// Pass parentRef/parentName to update those columns; omit both to leave them unchanged.
export function upsertCustomItem(
    name: string,
    category: CustomItemCategory | null,
    points: number | null,
    parentRef?: string | null,
    parentName?: string | null,
): CustomItemRow {
    const db = getDb();
    if (parentRef !== undefined) {
        db.prepare(`
            INSERT INTO custom_items (name, category, points, parent_ref, parent_name) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                category    = excluded.category,
                points      = excluded.points,
                parent_ref  = excluded.parent_ref,
                parent_name = excluded.parent_name
        `).run(name, category, points, parentRef, parentName ?? null);
    } else {
        db.prepare(`
            INSERT INTO custom_items (name, category, points) VALUES (?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                category = excluded.category,
                points   = excluded.points
        `).run(name, category, points);
    }
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

export function getPartCountForParent(parentRef: string): number {
    const row = getDb()
        .prepare('SELECT COUNT(*) AS count FROM custom_items WHERE parent_ref = ?')
        .get(parentRef) as { count: number };
    return row.count;
}
