import { getDb } from '../db';

export interface TradeablePartRow {
    id: number;
    parent_ref: string;
    parent_name: string;
    ge_item_id: number;
    ge_item_name: string;
    created_at: number;
}

export function getTradeablePartsForParent(parentRef: string): TradeablePartRow[] {
    return getDb()
        .prepare('SELECT * FROM tradeable_parts WHERE parent_ref = ? ORDER BY ge_item_name ASC')
        .all(parentRef) as TradeablePartRow[];
}

export function getAllTradeableParts(): TradeablePartRow[] {
    return getDb()
        .prepare('SELECT * FROM tradeable_parts ORDER BY parent_ref, ge_item_name ASC')
        .all() as TradeablePartRow[];
}

export function addTradeablePart(parentRef: string, parentName: string, geItemId: number, geItemName: string): void {
    getDb().prepare(`
        INSERT INTO tradeable_parts (parent_ref, parent_name, ge_item_id, ge_item_name)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(parent_ref, ge_item_id) DO UPDATE SET
            parent_name  = excluded.parent_name,
            ge_item_name = excluded.ge_item_name
    `).run(parentRef, parentName, geItemId, geItemName);
}

export function removeTradeablePart(id: number): TradeablePartRow | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tradeable_parts WHERE id = ?').get(id) as TradeablePartRow | null;
    if (!row) return null;
    db.prepare('DELETE FROM tradeable_parts WHERE id = ?').run(id);
    return row;
}
