import { getDb } from '../db';
import { TrialRow } from '../../types/db';

export function insertTrial(
    discordId: string,
    referrerId: string | null,
    threadId: string,
    createdBy: string,
): number {
    const result = getDb().prepare(`
        INSERT INTO trials (discord_id, referrer_id, thread_id, created_by)
        VALUES (?, ?, ?, ?)
    `).run(discordId, referrerId, threadId, createdBy);
    return Number(result.lastInsertRowid);
}

export function getTrialById(id: number): TrialRow | null {
    return getDb().prepare('SELECT * FROM trials WHERE id = ?').get(id) as TrialRow | null;
}

export function getTrialByThreadId(threadId: string): TrialRow | null {
    return getDb().prepare('SELECT * FROM trials WHERE thread_id = ?').get(threadId) as TrialRow | null;
}

export function updateTrialStatus(id: number, status: 'approved' | 'denied', resolvedBy: string): void {
    getDb().prepare(`
        UPDATE trials
        SET status = ?, resolved_at = (unixepoch() * 1000), resolved_by = ?
        WHERE id = ?
    `).run(status, resolvedBy, id);
}

export function getReferralLeaderboard(limit = 10): { discord_id: string; count: number }[] {
    return getDb().prepare(`
        SELECT referrer_id as discord_id, COUNT(*) as count
        FROM trials
        WHERE status = 'approved' AND referrer_id IS NOT NULL
        GROUP BY referrer_id
        ORDER BY count DESC
        LIMIT ?
    `).all(limit) as { discord_id: string; count: number }[];
}
