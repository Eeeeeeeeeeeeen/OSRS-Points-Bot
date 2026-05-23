import { ButtonInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { getDropById, getDropRecipients, reverseDrop } from '../../database/queries/drops';
import { hasClanRole } from '../../utils/permissions';

export async function handleConfirmRemoveDrop(interaction: ButtonInteraction, dropId: number): Promise<void> {
    if (!hasClanRole(interaction)) {
        await interaction.reply({ content: 'You do not have permission to do this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferUpdate();

    const drop = getDropById(dropId);
    if (!drop || drop.status !== 'accepted') {
        await interaction.followUp({ content: 'This drop cannot be reversed (already reversed or not accepted).', flags: MessageFlags.Ephemeral });
        return;
    }

    const recipients = getDropRecipients(dropId);
    reverseDrop(dropId, interaction.user.id);

    // Silently remove rank roles if users no longer qualify
    if (interaction.guild) {
        const { getAllRankTiers } = await import('../../database/queries/ranks');
        const { getUserById } = await import('../../database/queries/users');
        const tiers = getAllRankTiers();
        const allTierRoleIds = tiers.map(t => t.role_id);

        for (const r of recipients) {
            const user = getUserById(r.discord_id);
            if (!user) continue;

            const member = await interaction.guild.members.fetch(r.discord_id).catch(() => null);
            if (!member) continue;

            const daysInServer = (Date.now() - user.joined_at) / 86_400_000;
            const qualifying = tiers.find(t => user.total_points >= t.min_points && daysInServer >= t.min_days);

            // Remove any rank roles they no longer qualify for
            const toRemove = member.roles.cache
                .filter(role => allTierRoleIds.includes(role.id) && role.id !== qualifying?.role_id)
                .map(role => role.id);

            if (toRemove.length > 0) await member.roles.remove(toRemove);
        }
    }

    const recipientList = recipients.map(r => `<@${r.discord_id}> (-${r.points} pts)`).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('Drop Removed')
        .setColor(0x888888)
        .addFields(
            { name: 'Item', value: drop.item_name, inline: true },
            { name: 'Points Deducted From', value: recipientList || 'Unknown', inline: false },
        )
        .setFooter({ text: `Removed by ${interaction.user.username} • Drop ID: ${drop.id}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed], components: [] });
}

export async function handleCancelRemoveDrop(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({
        content: 'Drop removal cancelled.',
        embeds: [],
        components: [],
    });
}
