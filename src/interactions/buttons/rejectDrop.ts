import { ButtonInteraction, MessageFlags } from 'discord.js';
import { getDropById, updateDropStatus } from '../../database/queries/drops';
import { buildRejectedEmbed } from '../../embeds/reviewEmbed';
import { config } from '../../config';
import { hasClanRole } from '../../utils/permissions';

export async function handleRejectDrop(interaction: ButtonInteraction, dropId: number): Promise<void> {
    if (!hasClanRole(interaction)) {
        await interaction.reply({ content: 'You do not have permission to do this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferUpdate();

    const drop = getDropById(dropId);
    if (!drop || drop.status !== 'pending') {
        await interaction.followUp({ content: 'This drop is no longer pending.', flags: MessageFlags.Ephemeral });
        return;
    }

    updateDropStatus(dropId, 'rejected', interaction.user.id);

    await interaction.message.edit({
        embeds: [buildRejectedEmbed(drop, interaction.user)],
        components: [],
    });

    try {
        const submitter = await interaction.guild!.members.fetch(drop.submitter_id);
        await submitter.send(`Your drop of **${drop.item_name}** was rejected.`);
    } catch {
        // DMs disabled — ignore
    }
}

