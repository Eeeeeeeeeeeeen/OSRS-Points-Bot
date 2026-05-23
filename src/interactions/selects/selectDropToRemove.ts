import { StringSelectMenuInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { getDropById, getDropRecipients } from '../../database/queries/drops';
import { hasStaffRole } from '../../utils/permissions';

export async function handleSelectDropToRemove(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!hasStaffRole(interaction)) {
        await interaction.reply({ content: 'You do not have permission to do this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferUpdate();

    const dropId = parseInt(interaction.values[0], 10);
    const drop = getDropById(dropId);
    if (!drop) {
        await interaction.followUp({ content: 'Drop not found.', flags: MessageFlags.Ephemeral });
        return;
    }

    const recipients = getDropRecipients(dropId);
    const recipientList = recipients.map(r => `<@${r.discord_id}> (-${r.points} pts)`).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('Confirm Drop Removal')
        .setColor(0xFF4444)
        .setDescription('Are you sure you want to remove this drop? Points will be deducted from all recipients.')
        .addFields(
            { name: 'Item', value: drop.item_name, inline: true },
            { name: 'GP Value', value: drop.gp_value > 0 ? `${drop.gp_value.toLocaleString()} GP` : 'Override', inline: true },
            { name: 'Points Each', value: String(drop.awarded_points), inline: true },
            { name: 'Points Deducted From', value: recipientList || 'Unknown', inline: false },
        )
        .setFooter({ text: `Drop ID: ${drop.id}` })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`confirm_remove_drop:${dropId}`)
            .setLabel('Confirm Removal')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`cancel_remove_drop:${dropId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
}
