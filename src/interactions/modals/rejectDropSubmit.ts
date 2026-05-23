import { ModalSubmitInteraction, TextChannel, User } from 'discord.js';
import { getDropById, updateDropStatus } from '../../database/queries/drops';
import { buildRejectedEmbed } from '../../embeds/reviewEmbed';
import { config } from '../../config';

export async function handleRejectDropSubmit(
    interaction: ModalSubmitInteraction,
    dropId: number,
): Promise<void> {
    await interaction.deferUpdate();

    const drop = getDropById(dropId);
    if (!drop || drop.status !== 'pending') {
        await interaction.followUp({ content: 'This drop is no longer pending.' });
        return;
    }

    const reason = interaction.fields.getTextInputValue('reason').trim() || undefined;

    updateDropStatus(dropId, 'rejected', interaction.user.id, reason);

    // Update the staff review message
    await interaction.message!.edit({
        embeds: [buildRejectedEmbed(drop, interaction.user, reason)],
        components: [],
    });

    // Post to drop log channel with red embed
    const logChannel = await interaction.client.channels.fetch(config.dropLogChannelId).catch(() => null) as TextChannel | null;
    if (logChannel) {
        await logChannel.send({ embeds: [buildRejectedEmbed(drop, interaction.user, reason)] });
    }

    // DM the submitter with the reason
    try {
        const guild = interaction.guild;
        if (guild) {
            const submitter = await guild.members.fetch(drop.submitter_id);
            const dmMessage = reason
                ? `Your drop of **${drop.item_name}** was rejected.\n**Reason:** ${reason}`
                : `Your drop of **${drop.item_name}** was rejected.`;
            await submitter.send(dmMessage);
        }
    } catch {
        // DMs disabled — ignore
    }
}
