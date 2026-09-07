import { getDb } from '../db';
import { SnlGameRow, SnlTeamRow, SnlProgressRow, SnlMoveRow, SnlGameStatus } from '../../types/snl';

// Games

export function createGame(params: {
    boardJson: string;
    boardImageUrl: string | null;
    finalSquare: number;
    announceChannelId: string;
    startedBy: string;
}): SnlGameRow {
    const db = getDb();
    const result = db.prepare(`
        INSERT INTO snl_games (board_json, board_image_url, final_square, announce_channel_id, started_by)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        params.boardJson,
        params.boardImageUrl,
        params.finalSquare,
        params.announceChannelId,
        params.startedBy,
    );
    return getGameById(result.lastInsertRowid as number)!;
}

export function setBoardImage(gameId: number, url: string | null): void {
    getDb().prepare('UPDATE snl_games SET board_image_url = ? WHERE id = ?').run(url, gameId);
}

export function getGameById(id: number): SnlGameRow | null {
    return getDb().prepare('SELECT * FROM snl_games WHERE id = ?').get(id) as SnlGameRow | null;
}

// The one game currently being set up or played. Only one may exist at a time.
export function getCurrentGame(): SnlGameRow | null {
    return getDb().prepare(`
        SELECT * FROM snl_games WHERE status IN ('setup', 'active') ORDER BY id DESC LIMIT 1
    `).get() as SnlGameRow | null;
}

export function getActiveGame(): SnlGameRow | null {
    return getDb().prepare(`
        SELECT * FROM snl_games WHERE status = 'active' ORDER BY id DESC LIMIT 1
    `).get() as SnlGameRow | null;
}

export function startGame(gameId: number): void {
    getDb().prepare(`
        UPDATE snl_games SET status = 'active', started_at = (unixepoch() * 1000) WHERE id = ?
    `).run(gameId);
}

export function endGame(gameId: number, status: Extract<SnlGameStatus, 'finished' | 'cancelled'>, winnerTeamId?: number): void {
    getDb().prepare(`
        UPDATE snl_games SET status = ?, ended_at = (unixepoch() * 1000), winner_team_id = ? WHERE id = ?
    `).run(status, winnerTeamId ?? null, gameId);
}

// Teams

export function addTeam(gameId: number, name: string, roleId: string): SnlTeamRow {
    const db = getDb();
    const result = db.prepare(
        'INSERT INTO snl_teams (game_id, name, role_id) VALUES (?, ?, ?)',
    ).run(gameId, name, roleId);
    return db.prepare('SELECT * FROM snl_teams WHERE id = ?').get(result.lastInsertRowid as number) as SnlTeamRow;
}

export function getTeams(gameId: number): SnlTeamRow[] {
    return getDb().prepare('SELECT * FROM snl_teams WHERE game_id = ? ORDER BY id ASC')
        .all(gameId) as SnlTeamRow[];
}

export function getTeamById(teamId: number): SnlTeamRow | null {
    return getDb().prepare('SELECT * FROM snl_teams WHERE id = ?').get(teamId) as SnlTeamRow | null;
}

// Finds the team whose role the member holds. Returns null if they hold none.
export function getTeamForRoles(gameId: number, roleIds: string[]): SnlTeamRow | null {
    if (roleIds.length === 0) return null;
    const placeholders = roleIds.map(() => '?').join(', ');
    return getDb().prepare(
        `SELECT * FROM snl_teams WHERE game_id = ? AND role_id IN (${placeholders}) LIMIT 1`,
    ).get(gameId, ...roleIds) as SnlTeamRow | null;
}

export function setTeamPosition(teamId: number, square: number, arrivedAt: number): void {
    getDb().prepare('UPDATE snl_teams SET position = ?, arrived_at = ? WHERE id = ?')
        .run(square, arrivedAt, teamId);
}

export function setTeamFinished(teamId: number, finishedAt: number): void {
    getDb().prepare('UPDATE snl_teams SET finished_at = ? WHERE id = ?').run(finishedAt, teamId);
}

// Progress

export function insertProgress(teamId: number, square: number, dropId: number, discordId: string): void {
    getDb().prepare(`
        INSERT OR IGNORE INTO snl_progress (team_id, square, drop_id, discord_id) VALUES (?, ?, ?, ?)
    `).run(teamId, square, dropId, discordId);
}

export function countProgress(teamId: number, square: number): number {
    const row = getDb().prepare(
        'SELECT COUNT(*) AS count FROM snl_progress WHERE team_id = ? AND square = ?',
    ).get(teamId, square) as { count: number };
    return row.count;
}

export function getProgressForSquare(teamId: number, square: number): SnlProgressRow[] {
    return getDb().prepare(
        'SELECT * FROM snl_progress WHERE team_id = ? AND square = ? ORDER BY credited_at ASC',
    ).all(teamId, square) as SnlProgressRow[];
}

export function deleteProgressByDrop(dropId: number): void {
    getDb().prepare('DELETE FROM snl_progress WHERE drop_id = ?').run(dropId);
}

// Moves

export function insertMove(params: {
    teamId: number;
    roll: number | null;
    fromSquare: number;
    landedSquare: number;
    finalSquare: number;
    transition: 'snake' | 'ladder' | null;
    transitionId: string | null;
}): void {
    getDb().prepare(`
        INSERT INTO snl_moves (team_id, roll, from_square, landed_square, final_square, transition, transition_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        params.teamId,
        params.roll,
        params.fromSquare,
        params.landedSquare,
        params.finalSquare,
        params.transition,
        params.transitionId,
    );
}

export function getMoves(teamId: number, limit = 10): SnlMoveRow[] {
    return getDb().prepare(
        'SELECT * FROM snl_moves WHERE team_id = ? ORDER BY id DESC LIMIT ?',
    ).all(teamId, limit) as SnlMoveRow[];
}

export function hasProgressForDrop(teamId: number, dropId: number): boolean {
    const row = getDb().prepare(
        'SELECT 1 AS found FROM snl_progress WHERE team_id = ? AND drop_id = ?',
    ).get(teamId, dropId) as { found: number } | undefined;
    return row !== undefined;
}

export function getLatestGame(): SnlGameRow | null {
    return getDb().prepare('SELECT * FROM snl_games ORDER BY id DESC LIMIT 1').get() as SnlGameRow | null;
}
