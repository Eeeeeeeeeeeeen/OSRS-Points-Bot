import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/command';
import { getUserById, getRecentDropsForUser } from '../database/queries/users';
import { getAllRankTiers } from '../database/queries/ranks';
import { buildPointsEmbed } from '../embeds/pointsEmbed';
import { RankTierRow } from '../types/db';

export const points: Command = {
    data: new SlashCommandBuilder()
        .setName('points')
        .setDescription('Check your points and rank (or another user\'s)')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to check (defaults to yourself)')
                .setRequired(false),
        ),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        const target = interaction.options.getUser('user') ?? interaction.user;
        const guild = interaction.guild!;

        const user = getUserById(target.id);
        if (!user) {
            await interaction.editReply(`${target.username} hasn't submitted any drops yet.`);
            return;
        }

        const member = await guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            await interaction.editReply('That user is not in this server.');
            return;
        }

        const tiers = getAllRankTiers(); // sorted min_points DESC
        const daysInServer = (Date.now() - user.joined_at) / 86_400_000;

        const currentRank = tiers.find(
            (t: RankTierRow) => user.total_points >= t.min_points && daysInServer >= t.min_days,
        ) ?? null;

        const nextRank = tiers
            .slice()
            .reverse()
            .find((t: RankTierRow) => user.total_points < t.min_points) ?? null;

        const recentDrops = getRecentDropsForUser(target.id);

        await interaction.editReply({
            embeds: [buildPointsEmbed(member, user, currentRank, nextRank, recentDrops)],
        });
    },
};
