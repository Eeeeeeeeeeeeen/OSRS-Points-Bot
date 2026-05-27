import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import { getClanStats } from '../database/queries/drops';
import { formatGp } from '../utils/formatGp';

export const stats: Command = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View clan drop statistics'),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        const s = getClanStats();
        const monthName = new Date().toLocaleString('default', { month: 'long' });

        const embed = new EmbedBuilder()
            .setTitle('Clan Stats')
            .setColor(0x00AAFF)
            .addFields(
                // ── Overall ──────────────────────────────────────────
                // ── Overall ──────────────────────────────────────────
                { name: 'Total Drops',                   value: s.totalDrops.toLocaleString(),                     inline: true },
                { name: 'Total GP Logged',               value: formatGp(s.totalGp),                               inline: true },
                { name: 'Average Drop Value',            value: s.avgDropGp > 0 ? formatGp(s.avgDropGp) : 'N/A',   inline: true },
                { name: 'Active Members',                value: s.activeMembers.toLocaleString(),                   inline: true },
                { name: 'Total Points Held',             value: s.totalPointsHeld.toLocaleString(),                 inline: true },
                { name: `Points Awarded (${monthName})`, value: s.pointsThisMonth.toLocaleString(),                 inline: true },
                // ── This Month ────────────────────────────────────────
                {
                    name: `Top Earner (${monthName})`,
                    value: s.topPointsEarnerThisMonth
                        ? `<@${s.topPointsEarnerThisMonth.discord_id}> — ${s.topPointsEarnerThisMonth.points} pts`
                        : 'No activity yet',
                    inline: true,
                },
                {
                    name: `Most Solo Drops (${monthName})`,
                    value: s.topSoloDropperThisMonth
                        ? `<@${s.topSoloDropperThisMonth.discord_id}> — ${s.topSoloDropperThisMonth.count} drop${s.topSoloDropperThisMonth.count === 1 ? '' : 's'}`
                        : 'No solo drops this month',
                    inline: true,
                },
                {
                    name: 'Most Teamed',
                    value: s.mostTeamed
                        ? `<@${s.mostTeamed.discord_id}> — ${s.mostTeamed.count} drop${s.mostTeamed.count === 1 ? '' : 's'}`
                        : 'None yet',
                    inline: true,
                },
                // ── Highlights ────────────────────────────────────────
                // Filler fields (invisible) pad each pair to a full row of 3,
                // keeping the two pairs on separate rows.
                {
                    name: 'Biggest Solo Drop',
                    value: s.biggestSoloDrop
                        ? `**${s.biggestSoloDrop.item_name}** (${formatGp(s.biggestSoloDrop.gp_value)}) by <@${s.biggestSoloDrop.submitter_id}>`
                        : 'None yet',
                    inline: true,
                },
                {
                    name: 'Biggest Team Drop',
                    value: s.biggestTeamDrop
                        ? `**${s.biggestTeamDrop.item_name}** (${formatGp(s.biggestTeamDrop.gp_value)}) — ${s.biggestTeamDrop.member_count} members`
                        : 'None yet',
                    inline: true,
                },
                { name: '​', value: '​', inline: true },
                {
                    name: 'Most Common Drop',
                    value: s.topItem
                        ? `**${s.topItem.item_name}** (${s.topItem.count}×)`
                        : 'None yet',
                    inline: true,
                },
                {
                    name: 'Rarest Drop',
                    value: s.rarestDrop
                        ? `**${s.rarestDrop.item_name}** (${s.rarestDrop.gp_value > 0 ? formatGp(s.rarestDrop.gp_value) : 'custom'}) by <@${s.rarestDrop.submitter_id}>`
                        : 'None yet',
                    inline: true,
                },
                { name: '​', value: '​', inline: true },
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
