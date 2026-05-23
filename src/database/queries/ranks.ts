import { getDb } from '../db';
import { RankTierRow } from '../../types/db';

export function insertRankTier(roleId: string, name: string, minPoints: number, minDays: number): void {
    getDb().prepare(`
        INSERT INTO rank_tiers (role_id, name, min_points, min_days)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(role_id) DO UPDATE SET name = excluded.name, min_points = excluded.min_points, min_days = excluded.min_days
    `).run(roleId, name, minPoints, minDays);
}

export function deleteRankTier(roleId: string): boolean {
    const result = getDb().prepare('DELETE FROM rank_tiers WHERE role_id = ?').run(roleId);
    return result.changes > 0;
}

export function getAllRankTiers(): RankTierRow[] {
    return getDb()
        .prepare('SELECT * FROM rank_tiers ORDER BY min_points DESC')
        .all() as RankTierRow[];
}

export function getRankTierByRoleId(roleId: string): RankTierRow | null {
    return getDb().prepare('SELECT * FROM rank_tiers WHERE role_id = ?').get(roleId) as RankTierRow | null;
}
