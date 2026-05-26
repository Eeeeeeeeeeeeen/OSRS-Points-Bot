import { Guild, GuildMember, TextChannel } from 'discord.js';
import { getUserById } from '../database/queries/users';
import { getAllRankTiers } from '../database/queries/ranks';
import { RankTierRow } from '../types/db';
import { config } from '../config';
import { buildRankUpEmbed } from '../embeds/rankUpEmbed';

export async function checkAndNotifyRankUp(guild: Guild, discordId: string): Promise<void> {
    const user = getUserById(discordId);
    if (!user) return;

    let member: GuildMember;
    try {
        member = await guild.members.fetch(discordId);
    } catch {
        return;
    }

    const tiers = getAllRankTiers(); // sorted min_points DESC
    const qualifying = getQualifyingTier(user.total_points, user.joined_at, tiers);

    if (!qualifying) return;
    const atOrAbove = tiers.filter(t => t.min_points >= qualifying.min_points);
    if (atOrAbove.some(t => member.roles.cache.has(t.role_id))) return;

    const rankUpChannel = guild.channels.cache.get(config.rankUpChannelId) as TextChannel | undefined;
    if (!rankUpChannel) {
        console.error('Rank-up channel not found:', config.rankUpChannelId);
        return;
    }

    const { embed, row } = buildRankUpEmbed(member, qualifying);
    await rankUpChannel.send({ embeds: [embed], components: [row] });
}

export async function applyRankUp(guild: Guild, discordId: string, roleId: string): Promise<void> {
    let member: GuildMember;
    try {
        member = await guild.members.fetch(discordId);
    } catch {
        return;
    }

    const tiers = getAllRankTiers();
    const allTierRoleIds = tiers.map(t => t.role_id);

    const toRemove = member.roles.cache
        .filter(r => allTierRoleIds.includes(r.id) && r.id !== roleId)
        .map(r => r.id);

    if (toRemove.length > 0) await member.roles.remove(toRemove);
    if (!member.roles.cache.has(roleId)) await member.roles.add(roleId);
}

export async function forceSetRank(guild: Guild, discordId: string, roleId: string): Promise<void> {
    await applyRankUp(guild, discordId, roleId);
}

function getQualifyingTier(
    totalPoints: number,
    joinedAt: number,
    tiers: RankTierRow[],
): RankTierRow | undefined {
    const daysInServer = (Date.now() - joinedAt) / 86_400_000;
    return tiers.find(t => totalPoints >= t.min_points && daysInServer >= t.min_days);
}
