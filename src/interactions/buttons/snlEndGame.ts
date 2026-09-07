import { ButtonInteraction, MessageFlags } from 'discord.js';
import { endCurrentGame } from '../../commands/snl';
import { hasAdminRole } from '../../utils/permissions';

export async function handleSnlConfirmEnd(interaction: ButtonInteraction, gameId: number): Promise<void> {
    if (!hasAdminRole(interaction)) {
        await interaction.reply({ content: 'You do not have permission to do this.', flags: MessageFlags.Ephemeral });
        return;
    }

    const ended = endCurrentGame(gameId);
    await interaction.update({
        content: ended
            ? 'Game ended. Run `/snl setup` to start a new one.'
            : 'That game is no longer the current game — nothing was changed.',
        components: [],
    });
}

export async function handleSnlCancelEnd(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({ content: 'Cancelled — the game is still running.', components: [] });
}
