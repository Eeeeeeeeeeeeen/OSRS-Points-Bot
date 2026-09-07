import { ButtonInteraction, TextChannel, MessageFlags } from 'discord.js';
import { getDropById, updateDropStatus, insertDropRecipient } from '../../database/queries/drops';
import { addUserPoints } from '../../database/queries/users';
import { getDb } from '../../database/db';
import { checkAndNotifyRankUp } from '../../services/rankService';
import { creditDropToGame } from '../../services/snlService';
import { buildAcceptedEmbed } from '../../embeds/reviewEmbed';
import { buildDropLogEmbed } from '../../embeds/dropLogEmbed';
import { config } from '../../config';
import { hasStaffRole } from '../../utils/permissions';

export async function handleAcceptDrop(interaction: ButtonInteraction, dropId: number): Promise<void> {
    if (!hasStaffRole(interaction)) {
        await interaction.reply({ content: 'You do not have permission to do this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferUpdate();

    const drop = getDropById(dropId);
    if (!drop || drop.status !== 'pending') {
        await interaction.followUp({ content: 'This drop is no longer pending.', flags: MessageFlags.Ephemeral });
        return;
    }

    const guild = interaction.guild!;
    const teammateIds: string[] = JSON.parse(drop.teammate_ids);
    const allRecipients = [drop.submitter_id, ...teammateIds];

    getDb().transaction(() => {
        updateDropStatus(dropId, 'accepted', interaction.user.id);
        for (const userId of allRecipients) {
            addUserPoints(userId, drop.awarded_points, `drop_accepted:${dropId}`);
            insertDropRecipient(dropId, userId, drop.awarded_points);
        }
    })();

    for (const userId of allRecipients) {
        await checkAndNotifyRankUp(guild, userId);
    }

    // Snakes & Ladders credit — never let a game error break drop approval.
    try {
        await creditDropToGame(guild, drop);
    } catch (err) {
        console.error('S&L credit failed:', err);
    }

    await interaction.message.edit({
        embeds: [buildAcceptedEmbed(drop, interaction.user)],
        components: [],
    });

    const [submitter, ...teammates] = await Promise.all(
        allRecipients.map(id => guild.members.fetch(id).catch(() => null)),
    );

    const logChannel = guild.channels.cache.get(config.dropLogChannelId) as TextChannel | undefined;
    if (logChannel && submitter) {
        await logChannel.send({
            embeds: [buildDropLogEmbed(drop, submitter.user, teammates.filter(Boolean).map(m => m!.user))],
        });
    }

    try {
        const submitterMember = await guild.members.fetch(drop.submitter_id);
        await submitterMember.send(
            drop.awarded_points > 0
                ? `Your drop of **${drop.item_name}** was accepted! You earned **${drop.awarded_points}** points.`
                : `Your drop of **${drop.item_name}** was accepted! It awards no points, but it counts toward your Snakes & Ladders square.`,
        );
    } catch {
        // DMs disabled — ignore
    }
}

