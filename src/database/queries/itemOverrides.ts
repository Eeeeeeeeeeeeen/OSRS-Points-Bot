import { getDb } from '../db';

export interface ItemOverrideRow {
    item_id: number;
    item_name: string;
    points: number;
    created_at: number;
}

export function getItemOverride(itemId: number): ItemOverrideRow | null {
    return getDb().prepare('SELECT * FROM item_overrides WHERE item_id = ?').get(itemId) as ItemOverrideRow | null;
}

export function setItemOverride(itemId: number, itemName: string, points: number): void {
    getDb().prepare(`
        INSERT INTO item_overrides (item_id, item_name, points)
        VALUES (?, ?, ?)
        ON CONFLICT(item_id) DO UPDATE SET item_name = excluded.item_name, points = excluded.points
    `).run(itemId, itemName, points);
}

export function removeItemOverride(itemId: number): boolean {
    const result = getDb().prepare('DELETE FROM item_overrides WHERE item_id = ?').run(itemId);
    return result.changes > 0;
}

export function getAllItemOverrides(): ItemOverrideRow[] {
    return getDb().prepare('SELECT * FROM item_overrides ORDER BY item_name ASC').all() as ItemOverrideRow[];
}
