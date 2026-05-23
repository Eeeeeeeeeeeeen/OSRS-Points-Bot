import { ModalSubmitInteraction, GuildMember, User, MessageFlags } from 'discord.js';
import { getDropById, updateDrop } from '../../database/queries/drops';
import { calculatePoints } from '../../services/pointsService';
import { buildReviewEmbed } from '../../embeds/reviewEmbed';

export async function handleModifyDropSubmit(
    interaction: ModalSubmitInteraction,
    dropId: number,
): Promise<void> {
    await interaction.deferUpdate();

    const drop = getDropById(dropId);
    if (!drop || drop.status !== 'pending') {
        await interaction.followUp({ content: 'This drop is no longer pending.', flags: MessageFlags.Ephemeral });
        return;
    }

    const rawItemName = interaction.fields.getTextInputValue('item_name').trim();
    const rawGpValue = interaction.fields.getTextInputValue('gp_value').trim();

    const newItemName = rawItemName || drop.item_name;
    const newGpValue = rawGpValue
        ? parseInt(rawGpValue.replace(/[,\s]/g, ''), 10)
        : drop.gp_value;

    if (isNaN(newGpValue) || newGpValue < 0) {
        await interaction.followUp({ content: 'Invalid GP value. Please enter a positive number.', flags: MessageFlags.Ephemeral });
        return;
    }

    const teammateIds: string[] = JSON.parse(drop.teammate_ids);
    const teamSize = 1 + teammateIds.length;
    const newPoints = calculatePoints(newGpValue, teamSize);

    updateDrop(dropId, { itemName: newItemName, gpValue: newGpValue, awardedPoints: newPoints });

    const updatedDrop = getDropById(dropId)!;
    const guild = interaction.guild!;

    const submitter = await guild.members.fetch(updatedDrop.submitter_id).catch(() => null);
    const teammates = await Promise.all(
        teammateIds.map(id => guild.members.fetch(id).catch(() => null)),
    );

    const submitterUser: User = submitter?.user ?? interaction.user;
    const teammateUsers: User[] = teammates.filter(Boolean).map(m => m!.user);

    const { embed, row } = buildReviewEmbed(updatedDrop, submitterUser, teammateUsers);
    await interaction.message!.edit({ embeds: [embed], components: [row] });
}
