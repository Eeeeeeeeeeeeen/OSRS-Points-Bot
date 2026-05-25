import { ModalSubmitInteraction, MessageFlags } from 'discord.js';
import { setConfig } from '../../database/queries/botConfig';

export async function handleInductionDenySubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const message = interaction.fields.getTextInputValue('message').trim();
    setConfig('trial.deny_message', message);
    await interaction.reply({ content: 'Denial DM message updated.', flags: MessageFlags.Ephemeral });
}
