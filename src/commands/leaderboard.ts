import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/command';
import { buildLeaderboardPage } from '../embeds/leaderboardEmbed';

export const leaderboard: Command = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the clan points leaderboard'),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        const { embed, row } = buildLeaderboardPage(1);
        await interaction.editReply({ embeds: [embed], components: [row] });
    },
};
