import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import { getReferralLeaderboard } from '../database/queries/trials';

export const referrals: Command = {
    data: new SlashCommandBuilder()
        .setName('referrals')
        .setDescription('View the top clan member referrers'),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        const rows = getReferralLeaderboard();

        const lines = rows.length
            ? rows.map((row, i) => `**${i + 1}.** <@${row.discord_id}> — ${row.count} referral${row.count === 1 ? '' : 's'}`)
            : ['No approved referrals yet.'];

        const embed = new EmbedBuilder()
            .setTitle('Referral Leaderboard')
            .setColor(0x00AAFF)
            .setDescription(lines.join('\n'))
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
