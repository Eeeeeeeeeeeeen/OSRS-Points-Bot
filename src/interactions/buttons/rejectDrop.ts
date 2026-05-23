import {
    ButtonInteraction,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from 'discord.js';
import { getDropById } from '../../database/queries/drops';
import { hasStaffRole } from '../../utils/permissions';

export async function handleRejectDrop(interaction: ButtonInteraction, dropId: number): Promise<void> {
    if (!hasStaffRole(interaction)) {
        await interaction.reply({ content: 'You do not have permission to do this.', flags: MessageFlags.Ephemeral });
        return;
    }

    const drop = getDropById(dropId);
    if (!drop || drop.status !== 'pending') {
        await interaction.reply({ content: 'This drop is no longer pending.', flags: MessageFlags.Ephemeral });
        return;
    }

    // showModal() IS the response — do not deferUpdate/reply before this
    const modal = new ModalBuilder()
        .setCustomId(`reject_drop_submit:${dropId}`)
        .setTitle('Reject Drop');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Reason for rejection')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setPlaceholder('Optional — will be shown in the log and sent to the submitter'),
        ),
    );

    await interaction.showModal(modal);
}
