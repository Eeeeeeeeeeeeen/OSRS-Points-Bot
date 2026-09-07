import { ButtonInteraction, MessageFlags } from 'discord.js';
import { getCurrentGame, getLatestGame } from '../../database/queries/snl';
import { loadBoard } from '../../services/snlBoard';
import { buildBoardPage } from '../../embeds/snlEmbed';

export async function handleSnlBoardNav(interaction: ButtonInteraction, page: number): Promise<void> {
    await interaction.deferUpdate();

    const game = getCurrentGame() ?? getLatestGame();
    if (!game) {
        await interaction.followUp({ content: 'That game no longer exists.', flags: MessageFlags.Ephemeral });
        return;
    }

    const { embed, row } = buildBoardPage(game, loadBoard(game.board_json), page);
    await interaction.message.edit({ embeds: [embed], components: [row] });
}
