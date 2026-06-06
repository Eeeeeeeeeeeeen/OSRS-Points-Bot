import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getLeaderboardPage, countUsersWithPoints } from '../database/queries/users';

const PAGE_SIZE = 10;

export function buildLeaderboardPage(page: number): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
    const offset = (page - 1) * PAGE_SIZE;
    const rows = getLeaderboardPage(offset, PAGE_SIZE);
    const total = countUsersWithPoints();
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const lines = rows.length
        ? rows.map((row, i) => `**${offset + i + 1}.** <@${row.discord_id}> — ${row.total_points} pts`)
        : ['No entries yet.'];

    const embed = new EmbedBuilder()
        .setTitle('Clan Leaderboard')
        .setColor(0x00AAFF)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Page ${page} of ${totalPages}` })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`leaderboard_nav:${page - 1}`)
            .setLabel('◀ Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 1),
        new ButtonBuilder()
            .setCustomId(`leaderboard_nav:${page + 1}`)
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages),
    );

    return { embed, row };
}
