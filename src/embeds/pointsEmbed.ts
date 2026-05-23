import { EmbedBuilder, GuildMember } from 'discord.js';
import { UserRow } from '../types/db';
import { RankTierRow } from '../types/db';

export function buildPointsEmbed(
    member: GuildMember,
    user: UserRow,
    currentRank: RankTierRow | null,
    nextRank: RankTierRow | null,
    recentDrops: { item_name: string; gp_value: number; awarded_points: number; submitted_at: number }[],
): EmbedBuilder {
    const dropLines = recentDrops.length
        ? recentDrops.map(d =>
            `**${d.item_name}** — ${d.gp_value.toLocaleString()} GP (+${d.awarded_points} pts)`
          ).join('\n')
        : 'No accepted drops yet.';

    const embed = new EmbedBuilder()
        .setTitle(`${member.displayName}'s Points`)
        .setThumbnail(member.user.displayAvatarURL())
        .setColor(0x00AAFF)
        .addFields(
            { name: 'Total Points', value: String(user.total_points), inline: true },
            { name: 'Current Rank', value: currentRank ? currentRank.name : 'Unranked', inline: true },
        );

    if (nextRank) {
        const needed = nextRank.min_points - user.total_points;
        embed.addFields({ name: 'Next Rank', value: `${nextRank.name} (${needed} pts away)`, inline: true });
    }

    embed.addFields({ name: 'Recent Drops', value: dropLines, inline: false });
    embed.setTimestamp();

    return embed;
}
