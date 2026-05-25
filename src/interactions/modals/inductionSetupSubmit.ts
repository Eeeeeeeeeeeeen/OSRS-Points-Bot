import { ModalSubmitInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { setConfig } from '../../database/queries/botConfig';

export async function handleInductionSetupSubmit(
    interaction: ModalSubmitInteraction,
    channelId: string,
    trialRoleId: string,
    memberRoleId: string,
    guestRoleId: string,
): Promise<void> {
    const referralPointsRaw = interaction.fields.getTextInputValue('referral_points').trim();
    const referralPoints = parseInt(referralPointsRaw, 10);
    const welcomeMessage = interaction.fields.getTextInputValue('welcome_message').trim();
    const denyMessage = interaction.fields.getTextInputValue('deny_message').trim();

    if (isNaN(referralPoints) || referralPoints < 0) {
        await interaction.reply({ content: 'Referral points must be a whole number (0 or more).', flags: MessageFlags.Ephemeral });
        return;
    }

    setConfig('trial.channel_id', channelId);
    setConfig('trial.trial_role_id', trialRoleId);
    setConfig('trial.member_role_id', memberRoleId);
    setConfig('trial.guest_role_id', guestRoleId);
    setConfig('trial.referral_points', String(referralPoints));
    setConfig('trial.welcome_message', welcomeMessage);
    setConfig('trial.deny_message', denyMessage);

    const embed = new EmbedBuilder()
        .setTitle('Induction Configuration Updated')
        .setColor(0x57F287)
        .addFields(
            { name: 'Trial Channel', value: `<#${channelId}>`, inline: true },
            { name: 'Trial Role', value: `<@&${trialRoleId}>`, inline: true },
            { name: 'Member Role (Approve)', value: `<@&${memberRoleId}>`, inline: true },
            { name: 'Guest Role (Deny)', value: `<@&${guestRoleId}>`, inline: true },
            { name: 'Referral Points', value: String(referralPoints), inline: true },
        );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
