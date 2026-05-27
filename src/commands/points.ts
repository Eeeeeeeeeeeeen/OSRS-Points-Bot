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

        // Current rank is whichever tier role the member actually holds on Discord,
        // not what their points alone would qualify them for — this respects force-set ranks.
        const currentRank = tiers.find(t => member.roles.cache.has(t.role_id)) ?? null;

        // Next rank is the tier immediately above the one they currently hold.
        // If unranked, it's the lowest configured tier.
        let nextRank: RankTierRow | null = null;
        if (currentRank) {
            const idx = tiers.findIndex(t => t.role_id === currentRank.role_id);
            nextRank = idx > 0 ? tiers[idx - 1] : null;
        } else {
            nextRank = tiers.length > 0 ? tiers[tiers.length - 1] : null;
        }

        const recentDrops = getRecentDropsForUser(target.id);

        await interaction.editReply({
            embeds: [buildPointsEmbed(member, user, currentRank, nextRank, recentDrops)],
        });
    },
};
