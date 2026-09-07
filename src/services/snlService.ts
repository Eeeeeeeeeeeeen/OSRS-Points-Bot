import { Client, Guild, TextChannel, EmbedBuilder } from 'discord.js';
import { DropRow } from '../types/db';
import { SnlBoard, SnlGameRow, SnlHop, SnlSquare, SnlTeamRow } from '../types/snl';
import { getDb } from '../database/db';
import {
    getActiveGame,
    getTeamForRoles,
    getTeamById,
    setTeamPosition,
    setTeamFinished,
    endGame,
    insertMove,
    insertProgress,
    countProgress,
    hasProgressForDrop,
    deleteProgressByDrop,
} from '../database/queries/snl';
import { getCustomItem } from '../database/queries/customItems';
import { loadBoard, squareRequirement, transitionFor } from './snlBoard';
import { buildMoveEmbed, buildProgressEmbed, buildWinEmbed } from '../embeds/snlEmbed';

// Guards against a pathological board (e.g. an all-free board) looping forever.
const MAX_HOPS_PER_TURN = 20;

function rollDie(): number {
    return 1 + Math.floor(Math.random() * 6);
}

async function announce(client: Client, game: SnlGameRow, embeds: EmbedBuilder[]): Promise<void> {
    const channel = await client.channels.fetch(game.announce_channel_id).catch(() => null) as TextChannel | null;
    if (!channel) {
        console.error(`S&L: announce channel ${game.announce_channel_id} not found.`);
        return;
    }
    await channel.send({ embeds });
}

/**
 * Rolls for a team and moves it, resolving snakes and ladders and re-rolling through
 * free squares, until it either owes an item or reaches the final square.
 * Persists every hop, then announces the result.
 */
export async function rollAndAdvance(
    client: Client,
    game: SnlGameRow,
    team: SnlTeamRow,
    board: SnlBoard,
): Promise<void> {
    const hops: SnlHop[] = [];
    let position = team.position;
    let won = false;

    for (let i = 0; i < MAX_HOPS_PER_TURN; i++) {
        const roll = rollDie();
        let landed = position + roll;
        let bounced = false;

        if (landed > board.finalSquare) {
            if (board.overshoot === 'bounce') {
                landed = Math.max(1, board.finalSquare - (landed - board.finalSquare));
                bounced = true;
            } else {
                landed = board.finalSquare;
            }
        }

        const jump = transitionFor(board, landed);
        const to = jump ? jump.transition.end : landed;

        hops.push({
            roll,
            from: position,
            landed,
            to,
            transition: jump?.kind ?? null,
            transitionId: jump?.transition.id ?? null,
            bounced,
        });

        position = to;

        if (position === board.finalSquare) {
            won = true;
            break;
        }
        // A square with no item requirement is a free square — roll again.
        if (squareRequirement(board, position)) break;
    }

    if (hops.length === MAX_HOPS_PER_TURN && !won && !squareRequirement(board, position)) {
        console.error(
            `S&L: team ${team.id} hit the ${MAX_HOPS_PER_TURN}-hop cap without landing on an item square. ` +
            'Check the board for too many free squares.',
        );
    }

    const now = Date.now();
    const finalPosition = position;

    getDb().transaction(() => {
        for (const hop of hops) {
            insertMove({
                teamId: team.id,
                roll: hop.roll,
                fromSquare: hop.from,
                landedSquare: hop.landed,
                finalSquare: hop.to,
                transition: hop.transition,
                transitionId: hop.transitionId,
            });
        }
        setTeamPosition(team.id, finalPosition, now);
        if (won) {
            setTeamFinished(team.id, now);
            endGame(game.id, 'finished', team.id);
        }
    })();

    const updated = getTeamById(team.id)!;
    const embeds = [buildMoveEmbed(game, updated, hops, squareRequirement(board, finalPosition), board)];
    if (won) embeds.push(buildWinEmbed(game, updated, board));

    await announce(client, game, embeds);
}

/**
 * Moves a team to a specific square by staff decision. No dice, no snake/ladder
 * resolution — the square the admin names is the square the team lands on.
 */
export async function forceMove(
    client: Client,
    game: SnlGameRow,
    team: SnlTeamRow,
    board: SnlBoard,
    square: number,
): Promise<void> {
    const now = Date.now();
    const won = square === board.finalSquare;

    getDb().transaction(() => {
        insertMove({
            teamId: team.id,
            roll: null,
            fromSquare: team.position,
            landedSquare: square,
            finalSquare: square,
            transition: null,
            transitionId: null,
        });
        setTeamPosition(team.id, square, now);
        if (won) {
            setTeamFinished(team.id, now);
            endGame(game.id, 'finished', team.id);
        }
    })();

    const updated = getTeamById(team.id)!;
    const hop: SnlHop = {
        roll: null,
        from: team.position,
        landed: square,
        to: square,
        transition: null,
        transitionId: null,
        bounced: false,
    };

    const embeds = [buildMoveEmbed(game, updated, [hop], squareRequirement(board, square), board)];
    if (won) embeds.push(buildWinEmbed(game, updated, board));

    await announce(client, game, embeds);
}

/**
 * The square a member's team is currently sitting on, but only if that square accepts
 * `itemRef`. Lets /drop admit an item that is below the GP threshold while the game
 * needs it — see src/commands/drop.ts. Returns null when the item has no bearing on
 * the member's current square (or there is no game, team or square at all).
 */
export function activeSquareForItem(
    memberRoleIds: string[],
    itemRef: string,
): { team: SnlTeamRow; requirement: SnlSquare } | null {
    const game = getActiveGame();
    if (!game) return null;

    const team = getTeamForRoles(game.id, memberRoleIds);
    if (!team || team.finished_at !== null || team.position === 0) return null;

    const requirement = squareRequirement(loadBoard(game.board_json), team.position);
    if (!requirement) return null;

    return requirement.items.some(item => item.ref === itemRef) ? { team, requirement } : null;
}

function dropMatchesRef(drop: DropRow, itemRef: string): boolean {
    const [kind, idPart] = itemRef.split(':');
    const id = parseInt(idPart, 10);

    if (kind === 'ge') {
        return drop.item_id === id;
    }

    // Custom items are stored on the drop by name with a null item_id — see src/commands/drop.ts.
    const custom = getCustomItem(id);
    if (!custom) return false;
    return drop.item_name.toLowerCase() === custom.name.toLowerCase();
}

// A square accepts any of its listed items, and the same item may be submitted repeatedly
// — every accepted drop counts as one toward the square's quantity.
function dropMatchesSquare(drop: DropRow, requirement: SnlSquare): boolean {
    return requirement.items.some(item => dropMatchesRef(drop, item.ref));
}

/**
 * Called after a drop is accepted. Credits it to the submitter's team if it satisfies
 * that team's current square, and auto-rolls once the square is complete.
 * Returns silently whenever the drop has nothing to do with the game.
 */
export async function creditDropToGame(guild: Guild, drop: DropRow): Promise<void> {
    const game = getActiveGame();
    if (!game) return;

    const member = await guild.members.fetch(drop.submitter_id).catch(() => null);
    if (!member) return;

    const team = getTeamForRoles(game.id, [...member.roles.cache.keys()]);
    if (!team || team.finished_at !== null) return;

    // Not on the board yet — the game hasn't rolled for this team.
    if (team.position === 0) return;

    // Already counted (e.g. a drop accepted, reversed and re-accepted).
    if (hasProgressForDrop(team.id, drop.id)) return;

    const board = loadBoard(game.board_json);
    const requirement = squareRequirement(board, team.position);
    if (!requirement) return;

    // Only drops submitted after the team arrived on this square count — no hoarding.
    if (drop.submitted_at < team.arrived_at) return;

    if (!dropMatchesSquare(drop, requirement)) return;

    insertProgress(team.id, team.position, drop.id, drop.submitter_id);
    const have = countProgress(team.id, team.position);

    if (have < requirement.quantity) {
        await announce(guild.client, game, [
            buildProgressEmbed(game, team, requirement, have, drop.submitter_id, drop.item_name),
        ]);
        return;
    }

    await rollAndAdvance(guild.client, game, team, board);
}

// Drop reversed by staff — it no longer counts toward the square it was credited to.
export function uncreditDrop(dropId: number): void {
    deleteProgressByDrop(dropId);
}
