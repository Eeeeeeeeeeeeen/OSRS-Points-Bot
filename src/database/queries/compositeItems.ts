import { getDb } from '../db';

export interface CompositeItemRow {
    id: number;
    name: string;
    total_points: number;
    created_at: number;
}

export interface CompositeWithParts extends CompositeItemRow {
    parts: { id: number; name: string }[];
    part_count: number;
}

function buildCompositeWithParts(composite: CompositeItemRow): CompositeWithParts {
    const parts = getDb()
        .prepare('SELECT id, name FROM custom_items WHERE composite_id = ? ORDER BY name ASC')
        .all(composite.id) as { id: number; name: string }[];
    return { ...composite, parts, part_count: parts.length };
}

export function getCompositeById(id: number): CompositeWithParts | null {
    const row = getDb().prepare('SELECT * FROM composite_items WHERE id = ?').get(id) as CompositeItemRow | null;
    return row ? buildCompositeWithParts(row) : null;
}

export function getAllComposites(): CompositeWithParts[] {
    const rows = getDb().prepare('SELECT * FROM composite_items ORDER BY name ASC').all() as CompositeItemRow[];
    return rows.map(buildCompositeWithParts);
}

export function searchComposites(query: string): CompositeItemRow[] {
    return getDb()
        .prepare('SELECT * FROM composite_items WHERE LOWER(name) LIKE ? ORDER BY name ASC LIMIT 25')
        .all(`%${query.toLowerCase()}%`) as CompositeItemRow[];
}

export function getPartCountForComposite(compositeId: number): number {
    const row = getDb()
        .prepare('SELECT COUNT(*) AS count FROM custom_items WHERE composite_id = ?')
        .get(compositeId) as { count: number };
    return row.count;
}

export function upsertComposite(name: string, totalPoints: number): CompositeWithParts {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM composite_items WHERE name = ?').get(name) as { id: number } | null;
    if (existing) {
        db.prepare('UPDATE composite_items SET total_points = ? WHERE id = ?').run(totalPoints, existing.id);
        return getCompositeById(existing.id)!;
    }
    const result = db.prepare('INSERT INTO composite_items (name, total_points) VALUES (?, ?)').run(name, totalPoints);
    return getCompositeById(result.lastInsertRowid as number)!;
}

export function removeComposite(id: number): CompositeWithParts | null {
    const db = getDb();
    const composite = getCompositeById(id);
    if (!composite) return null;
    // ON DELETE SET NULL clears composite_id on linked custom_items
    db.prepare('DELETE FROM composite_items WHERE id = ?').run(id);
    return composite;
}
