import { ModalSubmitInteraction, MessageFlags } from 'discord.js';
import { getTrialById, updateTrialStatus } from '../../database/queries/trials';
import { getConfig } from '../../database/queries/botConfig';
import { buildDeniedTrialEmbed } from '../../embeds/trialEmbed';

const DEFAULT_DENY =
    'Hi {user}, unfortunately your trial with Avid has been unsuccessful.\n**Reason:** {reason}';

export async function handleDenyTrialSubmit(
    interaction: ModalSubmitInteraction,
    trialId: number,
): Promise<void> {
    await interaction.deferUpdate();

    const trial = getTrialById(trialId);
    if (!trial || trial.status !== 'active') {
        await interaction.followUp({ content: 'This trial is no longer active.', flags: MessageFlags.Ephemeral });
        return;
    }

    const reason = interaction.fields.getTextInputValue('reason').trim();

    const trialRoleId = getConfig('trial.trial_role_id');
    const guestRoleId = getConfig('trial.guest_role_id');

    const guild = interaction.guild!;

    let member;
    try {
        member = await guild.members.fetch(trial.discord_id);
    } catch {
        await interaction.followUp({ content: 'Could not find the trial member in the server.', flags: MessageFlags.Ephemeral });
        return;
    }

    if (trialRoleId) await member.roles.remove(trialRoleId);
    if (guestRoleId) await member.roles.add(guestRoleId);

    updateTrialStatus(trialId, 'denied', interaction.user.id);

    const dmTemplate = getConfig('trial.deny_message') ?? DEFAULT_DENY;
    const dmMessage = dmTemplate
        .replace('{user}', member.user.username)
        .replace('{reason}', reason || 'No reason provided');

    try {
        await member.send(dmMessage);
    } catch {
        // DMs disabled — ignore
    }

    const deniedEmbed = buildDeniedTrialEmbed(trial, member.user, interaction.user, reason);
    await interaction.message!.edit({ embeds: [deniedEmbed], components: [] });

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
