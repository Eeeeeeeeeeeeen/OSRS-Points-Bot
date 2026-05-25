import {
    ButtonInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
} from 'discord.js';
import { hasStaffRole } from '../../utils/permissions';
import { getTrialById } from '../../database/queries/trials';

export async function handleDenyTrial(interaction: ButtonInteraction, trialId: number): Promise<void> {
    if (!hasStaffRole(interaction)) {
        await interaction.reply({ content: 'You do not have permission to do this.', flags: MessageFlags.Ephemeral });
        return;
    }

    const trial = getTrialById(trialId);
    if (!trial || trial.status !== 'active') {
        await interaction.reply({ content: 'This trial is no longer active.', flags: MessageFlags.Ephemeral });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId(`deny_trial_submit:${trialId}`)
        .setTitle('Deny Trial');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Reason (sent to the user via DM)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(1000),
        ),
    );

    await interaction.showModal(modal);
}
