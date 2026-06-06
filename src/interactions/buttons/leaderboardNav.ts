import { ButtonInteraction } from 'discord.js';
import { buildLeaderboardPage } from '../../embeds/leaderboardEmbed';

export async function handleLeaderboardNav(interaction: ButtonInteraction, page: number): Promise<void> {
    await interaction.deferUpdate();
    const { embed, row } = buildLeaderboardPage(page);
    await interaction.message.edit({ embeds: [embed], components: [row] });
}
