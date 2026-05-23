import { User } from 'discord.js';
import { getDb } from '../db';
import { UserRow } from '../../types/db';

export function upsertUser(user: User, joinedAt: number): void {
    const db = getDb();
    db.prepare(`
        INSERT INTO users (discord_id, username, joined_at)
        VALUES (?, ?, ?)
        ON CONFLICT(discord_id) DO UPDATE SET username = excluded.username
    `).run(user.id, user.username, joinedAt);
}

export function getUserById(discordId: string): UserRow | null {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId) as UserRow | null;
}

export function addUserPoints(discordId: string, delta: number, reason: string): void {
    const db = getDb();
    db.prepare(`
        UPDATE users SET total_points = total_points + ? WHERE discord_id = ?
    `).run(delta, discordId);
    const row = db.prepare('SELECT total_points FROM users WHERE discord_id = ?').get(discordId) as { total_points: number };
    db.prepare(`
        INSERT INTO user_point_log (discord_id, delta, reason, new_total)
        VALUES (?, ?, ?, ?)
    `).run(discordId, delta, reason, row.total_points);
}

export function setUserPoints(discordId: string, points: number): void {
    const db = getDb();
    const current = getUserById(discordId);
    const delta = points - (current?.total_points ?? 0);
    db.prepare('UPDATE users SET total_points = ? WHERE discord_id = ?').run(points, discordId);
    db.prepare(`
        INSERT INTO user_point_log (discord_id, delta, reason, new_total)
        VALUES (?, ?, 'admin_override', ?)
    `).run(discordId, delta, points);
}

export function getLeaderboardPage(offset: number, limit: number): UserRow[] {
    return getDb()
        .prepare('SELECT * FROM users WHERE total_points > 0 ORDER BY total_points DESC LIMIT ? OFFSET ?')
        .all(limit, offset) as UserRow[];
}

export function countUsersWithPoints(): number {
    const row = getDb().prepare('SELECT COUNT(*) as cnt FROM users WHERE total_points > 0').get() as { cnt: number };
    return row.cnt;
}

export function getRecentDropsForUser(discordId: string, limit = 5) {
    return getDb().prepare(`
        SELECT d.item_name, d.gp_value, d.awarded_points, d.submitted_at
        FROM drop_recipients dr
        JOIN drops d ON d.id = dr.drop_id
        WHERE dr.discord_id = ? AND d.status = 'accepted'
        ORDER BY d.submitted_at DESC
        LIMIT ?
    `).all(discordId, limit) as { item_name: string; gp_value: number; awarded_points: number; submitted_at: number }[];
}
