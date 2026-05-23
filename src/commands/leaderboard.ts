import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import { getLeaderboardPage, countUsersWithPoints } from '../database/queries/users';

const PAGE_SIZE = 10;

export const leaderboard: Command = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the clan points leaderboard')
        .addIntegerOption(opt =>
            opt.setName('page')
                .setDescription('Page number')
                .setRequired(false)
                .setMinValue(1),
        ),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        const page = interaction.options.getInteger('page') ?? 1;
        const offset = (page - 1) * PAGE_SIZE;

        const rows = getLeaderboardPage(offset, PAGE_SIZE);
        const total = countUsersWithPoints();
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

        if (page > totalPages) {
            await interaction.editReply(`Page ${page} doesn't exist. There are only ${totalPages} page(s).`);
            return;
        }

        const lines = rows.length
            ? rows.map((row, i) => `**${offset + i + 1}.** <@${row.discord_id}> — ${row.total_points} pts`)
            : ['No entries yet.'];

        const embed = new EmbedBuilder()
            .setTitle('Clan Leaderboard')
            .setColor(0x00AAFF)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Page ${page} of ${totalPages}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
