import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { SnlBoard, SnlGameRow, SnlHop, SnlSquare, SnlTeamRow } from '../types/snl';
import { squareRequirement, requirementIcon, describeRequirement } from '../services/snlBoard';
import { countProgress } from '../database/queries/snl';

const PAGE_SIZE = 10;

// The full board picture only appears in /snl status. Everywhere else gets a link, so the
// image doesn't repeat down the announce channel on every roll.
function boardLink(game: SnlGameRow): string {
    return game.board_image_url ? `\n\n[📋 View the board](${game.board_image_url})` : '';
}

function hopLine(hop: SnlHop): string {
    const roll = hop.roll === null ? 'Moved by staff' : `🎲 Rolled a **${hop.roll}**`;
    const bounce = hop.bounced ? ' (bounced back off the final square)' : '';
    if (hop.transition === 'ladder') {
        return `${roll} → square ${hop.landed}${bounce} — 🪜 **Ladder!** Climbed to square **${hop.to}**`;
    }
    if (hop.transition === 'snake') {
        return `${roll} → square ${hop.landed}${bounce} — 🐍 **Snake!** Slid down to square **${hop.to}**`;
    }
    return `${roll} → square **${hop.to}**${bounce}`;
}

export function buildMoveEmbed(
    game: SnlGameRow,
    team: SnlTeamRow,
    hops: SnlHop[],
    requirement: SnlSquare | null,
    board: SnlBoard,
): EmbedBuilder {
    const finalPosition = hops.length > 0 ? hops[hops.length - 1].to : team.position;

    const embed = new EmbedBuilder()
        .setTitle(`${team.name} — Square ${finalPosition}`)
        .setColor(0x00AAFF)
        .setDescription((hops.map(hopLine).join('\n') || 'No movement.') + boardLink(game))
        .setFooter({ text: `${board.name} • ${finalPosition} of ${board.finalSquare}` })
        .setTimestamp();

    if (requirement) {
        embed.addFields({
            name: 'Next target',
            value: `Collect ${describeRequirement(requirement)} and submit it with \`/drop\` as normal.`,
            inline: false,
        });
        const icon = requirementIcon(requirement);
        if (icon) embed.setThumbnail(icon);
    } else {
        embed.addFields({ name: 'Next target', value: 'Nothing required here.', inline: false });
    }

    return embed;
}

export function buildProgressEmbed(
    game: SnlGameRow,
    team: SnlTeamRow,
    requirement: SnlSquare,
    have: number,
    contributorId: string,
    itemName: string,
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(`${team.name} — Progress on square ${team.position}`)
        .setColor(0xFFD700)
        .setDescription(
            `<@${contributorId}> submitted **${itemName}**.\n` +
            `**${have}/${requirement.quantity}** collected for this square.\n` +
            `Still needed: ${describeRequirement({ ...requirement, quantity: requirement.quantity - have })}` +
            boardLink(game),
        )
        .setTimestamp();

    const icon = requirementIcon(requirement);
    if (icon) embed.setThumbnail(icon);
    return embed;
}

export function buildWinEmbed(game: SnlGameRow, team: SnlTeamRow, board: SnlBoard): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle(`🏆 ${team.name} wins!`)
        .setColor(0x00CC44)
        .setDescription(
            `<@&${team.role_id}> reached square **${board.finalSquare}** and has won **${board.name}**.\n\n` +
            'The game is now over. Congratulations!' + boardLink(game),
        )
        .setTimestamp();
}

export function buildStatusEmbed(game: SnlGameRow, teams: SnlTeamRow[], board: SnlBoard): EmbedBuilder {
    const statusLabel = {
        setup: 'Not started yet — an admin needs to run `/snl start`.',
        active: 'In progress',
        finished: 'Finished',
        cancelled: 'Cancelled',
    }[game.status];

    const embed = new EmbedBuilder()
        .setTitle(`${board.name} — Status`)
        .setColor(game.status === 'active' ? 0x00AAFF : 0x888888)
        .setDescription(`${statusLabel}\nBoard runs from square 1 to **${board.finalSquare}**.`)
        .setTimestamp();

    for (const team of teams) {
        if (team.position === 0) {
            embed.addFields({
                name: team.name,
                value: `<@&${team.role_id}>\nNot on the board yet.`,
                inline: true,
            });
            continue;
        }

        const req = squareRequirement(board, team.position);
        const lines = [`<@&${team.role_id}>`, `Square **${team.position}** of ${board.finalSquare}`];

        if (team.finished_at) {
            lines.push('🏆 **Finished!**');
        } else if (req) {
            const have = countProgress(team.id, team.position);
            lines.push(`Needs ${describeRequirement(req)}`);
            lines.push(`Progress: **${have}/${req.quantity}**`);
        } else {
            lines.push('Free square — awaiting roll.');
        }

        embed.addFields({ name: team.name, value: lines.join('\n'), inline: true });
    }

    if (teams.length === 0) {
        embed.addFields({ name: 'Teams', value: 'No teams configured.', inline: false });
    }

    // /snl status is the one place the board picture is shown in full.
    if (game.board_image_url) embed.setImage(game.board_image_url);

    return embed;
}

export function buildBoardPage(
    game: SnlGameRow,
    board: SnlBoard,
    page: number,
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
    const totalPages = Math.max(1, Math.ceil(board.squares.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const offset = (safePage - 1) * PAGE_SIZE;
    const slice = board.squares.slice(offset, offset + PAGE_SIZE);

    const squareLines = slice.length
        ? slice.map(s => `**${s.square}.** ${describeRequirement(s)}`)
        : ['No item squares defined.'];

    const embed = new EmbedBuilder()
        .setTitle(`${board.name} — Board`)
        .setColor(0x00AAFF)
        .setDescription(squareLines.join('\n') + boardLink(game))
        .setFooter({ text: `Page ${safePage} of ${totalPages} • Final square: ${board.finalSquare}` })
        .setTimestamp();

    if (safePage === 1) {
        const ladders = board.ladders.length
            ? board.ladders.map(l => `🪜 ${l.start} → ${l.end}`).join('\n')
            : 'None';
        const snakes = board.snakes.length
            ? board.snakes.map(s => `🐍 ${s.start} → ${s.end}`).join('\n')
            : 'None';
        embed.addFields(
            { name: 'Ladders', value: ladders, inline: true },
            { name: 'Snakes', value: snakes, inline: true },
        );
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`snl_board_nav:${safePage - 1}`)
            .setLabel('◀ Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage <= 1),
        new ButtonBuilder()
            .setCustomId(`snl_board_nav:${safePage + 1}`)
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage >= totalPages),
    );

    return { embed, row };
}
