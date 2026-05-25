import { ButtonInteraction, MessageFlags } from 'discord.js';
import { hasStaffRole } from '../../utils/permissions';
import { getTrialById, updateTrialStatus } from '../../database/queries/trials';
import { getConfig } from '../../database/queries/botConfig';
import { getUserById, upsertUser, addUserPoints } from '../../database/queries/users';
import { checkAndNotifyRankUp } from '../../services/rankService';
import { buildApprovedTrialEmbed } from '../../embeds/trialEmbed';

export async function handleApproveTrial(interaction: ButtonInteraction, trialId: number): Promise<void> {
    if (!hasStaffRole(interaction)) {
        await interaction.reply({ content: 'You do not have permission to do this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferUpdate();

    const trial = getTrialById(trialId);
    if (!trial || trial.status !== 'active') {
        await interaction.followUp({ content: 'This trial is no longer active.', flags: MessageFlags.Ephemeral });
        return;
    }

    const trialRoleId = getConfig('trial.trial_role_id');
    const memberRoleId = getConfig('trial.member_role_id');
    const referralPoints = parseInt(getConfig('trial.referral_points') ?? '20', 10);

    if (!trialRoleId || !memberRoleId) {
        await interaction.followUp({ content: 'Induction is not fully configured.', flags: MessageFlags.Ephemeral });
        return;
    }

    const guild = interaction.guild!;

    let member;
    try {
        member = await guild.members.fetch(trial.discord_id);
    } catch {
        await interaction.followUp({ content: 'Could not find the trial member in the server.', flags: MessageFlags.Ephemeral });
        return;
    }

    await member.roles.remove(trialRoleId);
    await member.roles.add(memberRoleId);

    if (trial.referrer_id) {
        try {
            const referrerMember = await guild.members.fetch(trial.referrer_id);
            upsertUser(referrerMember.user, referrerMember.joinedTimestamp ?? Date.now());
        } catch {
            // Referrer may have left the server; only award points if they exist in DB
        }
        if (getUserById(trial.referrer_id)) {
            addUserPoints(trial.referrer_id, referralPoints, `trial:referral:${trialId}`);
            await checkAndNotifyRankUp(guild, trial.referrer_id);
        }
    }

    updateTrialStatus(trialId, 'approved', interaction.user.id);

    const approvedEmbed = buildApprovedTrialEmbed(trial, member.user, interaction.user);
    await interaction.message.edit({ embeds: [approvedEmbed], components: [] });

    const thread = interaction.channel;
    if (thread?.isThread()) {
        try {
            await thread.setLocked(true);
            await thread.setArchived(true);
        } catch {
            // Bot lacks MANAGE_THREADS — thread must be closed manually
        }
    }
}
