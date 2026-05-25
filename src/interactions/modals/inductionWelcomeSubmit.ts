import { ModalSubmitInteraction, MessageFlags } from 'discord.js';
import { setConfig } from '../../database/queries/botConfig';

export async function handleInductionWelcomeSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const message = interaction.fields.getTextInputValue('message').trim();
    setConfig('trial.welcome_message', message);
    await interaction.reply({ content: 'Welcome message updated.', flags: MessageFlags.Ephemeral });
}
