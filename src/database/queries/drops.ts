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
