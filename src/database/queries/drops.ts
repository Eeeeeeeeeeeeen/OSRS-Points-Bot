import { getDb } from '../db';
import { DropRow } from '../../types/db';

interface InsertDropParams {
    submitterId: string;
    itemName: string;
    itemId: number | null;
    gpValue: number;
    awardedPoints: number;
    teammateIds: string[];
    teamSize: number;
    screenshotUrl: string;
}

export function insertDrop(params: InsertDropParams): DropRow {
    const db = getDb();
    const result = db.prepare(`
        INSERT INTO drops (submitter_id, item_name, item_id, gp_value, awarded_points, teammate_ids, team_size, screenshot_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        params.submitterId,
        params.itemName,
        params.itemId,
        params.gpValue,
        params.awardedPoints,
        JSON.stringify(params.teammateIds),
        params.teamSize,
        params.screenshotUrl,
    );
    return getDropById(result.lastInsertRowid as number)!;
}

export function getDropById(id: number): DropRow | null {
    return getDb().prepare('SELECT * FROM drops WHERE id = ?').get(id) as DropRow | null;
}

export function updateDropReviewMessage(dropId: number, channelId: string, messageId: string): void {
    getDb().prepare(`
        UPDATE drops SET review_channel_id = ?, review_message_id = ? WHERE id = ?
    `).run(channelId, messageId, dropId);
}

export function updateDropStatus(dropId: number, status: 'accepted' | 'rejected', staffId: string, note?: string): void {
    getDb().prepare(`
        UPDATE drops SET status = ?, staff_id = ?, staff_note = ?, reviewed_at = (unixepoch() * 1000) WHERE id = ?
    `).run(status, staffId, note ?? null, dropId);
}

export function updateDrop(dropId: number, fields: { itemName: string; gpValue: number; awardedPoints: number }): void {
    getDb().prepare(`
        UPDATE drops SET item_name = ?, gp_value = ?, awarded_points = ? WHERE id = ?
    `).run(fields.itemName, fields.gpValue, fields.awardedPoints, dropId);
}

export function insertDropRecipient(dropId: number, discordId: string, points: number): void {
    getDb().prepare(`
        INSERT OR IGNORE INTO drop_recipients (drop_id, discord_id, points) VALUES (?, ?, ?)
    `).run(dropId, discordId, points);
}

export function getAcceptedDropsForUser(discordId: string, limit = 25): DropRow[] {
    return getDb().prepare(`
        SELECT d.* FROM drops d
        INNER JOIN drop_recipients dr ON dr.drop_id = d.id
        WHERE dr.discord_id = ? AND d.status = 'accepted'
        ORDER BY d.submitted_at DESC
        LIMIT ?
    `).all(discordId, limit) as DropRow[];
}

export function getDropRecipients(dropId: number): { discord_id: string; points: number }[] {
    return getDb().prepare('SELECT discord_id, points FROM drop_recipients WHERE drop_id = ?')
        .all(dropId) as { discord_id: string; points: number }[];
}

export interface ClanStats {
    // Overall
    totalDrops: number;
    totalGp: number;
    avgDropGp: number;
    activeMembers: number;
    totalPointsHeld: number;
    // This month
    pointsThisMonth: number;
    topPointsEarnerThisMonth: { discord_id: string; points: number } | null;
    topSoloDropperThisMonth: { discord_id: string; count: number } | null;
    // Highlights
    biggestSoloDrop: { item_name: string; gp_value: number; submitter_id: string } | null;
    biggestTeamDrop: { item_name: string; gp_value: number; submitter_id: string; member_count: number } | null;
    topItem: { item_name: string; count: number } | null;
    mostTeamed: { discord_id: string; count: number } | null;
    rarestDrop: { item_name: string; gp_value: number; submitter_id: string } | null;
}

export function getClanStats(): ClanStats {
    const db = getDb();

    // Totals
    const totals = db.prepare(`
        SELECT COUNT(*) as total_drops, COALESCE(SUM(gp_value), 0) as total_gp
        FROM drops WHERE status = 'accepted'
    `).get() as { total_drops: number; total_gp: number };

    const avgRow = db.prepare(`
        SELECT COALESCE(ROUND(AVG(gp_value)), 0) as avg_gp
        FROM drops WHERE status = 'accepted' AND gp_value > 0
    `).get() as { avg_gp: number };

    const activeMembers = (db.prepare(
        'SELECT COUNT(*) as cnt FROM users WHERE total_points > 0',
    ).get() as { cnt: number }).cnt;

    const totalPointsHeld = (db.prepare(
        'SELECT COALESCE(SUM(total_points), 0) as total FROM users',
    ).get() as { total: number }).total;

    // This month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const pointsThisMonth = (db.prepare(`
        SELECT COALESCE(SUM(delta), 0) as points
        FROM user_point_log WHERE delta > 0 AND created_at >= ?
    `).get(startOfMonth) as { points: number }).points;

    const topPointsEarnerThisMonth = db.prepare(`
        SELECT discord_id, SUM(delta) as points
        FROM user_point_log WHERE created_at >= ?
        GROUP BY discord_id HAVING SUM(delta) > 0
        ORDER BY points DESC LIMIT 1
    `).get(startOfMonth) as { discord_id: string; points: number } | undefined;

    const topSoloDropperThisMonth = db.prepare(`
        SELECT d.submitter_id as discord_id, COUNT(*) as count
        FROM drops d
        WHERE d.status = 'accepted' AND d.submitted_at >= ?
          AND d.id NOT IN (
              SELECT drop_id FROM drop_recipients GROUP BY drop_id HAVING COUNT(*) > 1
          )
        GROUP BY d.submitter_id ORDER BY count DESC LIMIT 1
    `).get(startOfMonth) as { discord_id: string; count: number } | undefined;

    // Highlights
    const biggestSoloDrop = db.prepare(`
        SELECT item_name, gp_value, submitter_id
        FROM drops
        WHERE status = 'accepted' AND gp_value > 0
          AND id NOT IN (SELECT drop_id FROM drop_recipients GROUP BY drop_id HAVING COUNT(*) > 1)
        ORDER BY gp_value DESC LIMIT 1
    `).get() as { item_name: string; gp_value: number; submitter_id: string } | undefined;

    const topItem = db.prepare(`
        SELECT item_name, COUNT(*) as count
        FROM drops WHERE status = 'accepted'
        GROUP BY LOWER(item_name) ORDER BY count DESC LIMIT 1
    `).get() as { item_name: string; count: number } | undefined;

    const mostTeamed = db.prepare(`
        SELECT dr.discord_id, COUNT(*) as count
        FROM drop_recipients dr
        WHERE dr.drop_id IN (
            SELECT drop_id FROM drop_recipients GROUP BY drop_id HAVING COUNT(*) > 1
        )
        GROUP BY dr.discord_id ORDER BY count DESC LIMIT 1
    `).get() as { discord_id: string; count: number } | undefined;

    const biggestTeamDrop = db.prepare(`
        SELECT d.item_name, d.gp_value, d.submitter_id, COUNT(dr.discord_id) as member_count
        FROM drops d
        JOIN drop_recipients dr ON dr.drop_id = d.id
        WHERE d.status = 'accepted' AND d.gp_value > 0
        GROUP BY d.id HAVING COUNT(dr.discord_id) > 1
        ORDER BY d.gp_value DESC LIMIT 1
    `).get() as { item_name: string; gp_value: number; submitter_id: string; member_count: number } | undefined;

    const rarestDrop = db.prepare(`
        SELECT item_name, gp_value, submitter_id
        FROM drops WHERE status = 'accepted'
        GROUP BY LOWER(item_name) HAVING COUNT(*) = 1
        ORDER BY gp_value DESC LIMIT 1
    `).get() as { item_name: string; gp_value: number; submitter_id: string } | undefined;

    return {
        totalDrops: totals.total_drops,
        totalGp: totals.total_gp,
        avgDropGp: avgRow.avg_gp,
        activeMembers,
        totalPointsHeld,
        pointsThisMonth,
        topPointsEarnerThisMonth: topPointsEarnerThisMonth ?? null,
        topSoloDropperThisMonth: topSoloDropperThisMonth ?? null,
        biggestSoloDrop: biggestSoloDrop ?? null,
        biggestTeamDrop: biggestTeamDrop ?? null,
        topItem: topItem ?? null,
        mostTeamed: mostTeamed ?? null,
        rarestDrop: rarestDrop ?? null,
    };
}

export function reverseDrop(dropId: number, staffId: string): void {
    const db = getDb();
    db.transaction(() => {
        const recipients = db.prepare('SELECT discord_id, points FROM drop_recipients WHERE drop_id = ?')
            .all(dropId) as { discord_id: string; points: number }[];

        for (const r of recipients) {
            db.prepare('UPDATE users SET total_points = MAX(0, total_points - ?) WHERE discord_id = ?')
                .run(r.points, r.discord_id);
            const row = db.prepare('SELECT total_points FROM users WHERE discord_id = ?')
                .get(r.discord_id) as { total_points: number };
            db.prepare(`
                INSERT INTO user_point_log (discord_id, delta, reason, new_total)
                VALUES (?, ?, ?, ?)
            `).run(r.discord_id, -r.points, `drop_reversed:${dropId}`, row.total_points);
        }

        db.prepare(`
            UPDATE drops SET status = 'reversed', staff_id = ?, reviewed_at = (unixepoch() * 1000) WHERE id = ?
        `).run(staffId, dropId);
    })();
}
