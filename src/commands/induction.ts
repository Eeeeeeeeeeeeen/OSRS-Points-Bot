import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from 'discord.js';
import { getConfig } from '../database/queries/botConfig';

const DEFAULT_WELCOME =
    '{user} Welcome to Avid! If you have any questions feel free to {staff}. In the meantime have a read of the #rank-system channel to familiarise yourself on how to submit drops and how to rank up.';

const DEFAULT_DENY =
    'Hi {user}, unfortunately your trial with Avid has been unsuccessful.\n**Reason:** {reason}';

export async function handleInductionSetup(interaction: ChatInputCommandInteraction): Promise<void> {
    const channel = interaction.options.getChannel('channel', true);
    const trialRole = interaction.options.getRole('trial-role', true);
    const memberRole = interaction.options.getRole('member-role', true);
    const guestRole = interaction.options.getRole('guest-role', true);

    const modal = new ModalBuilder()
        .setCustomId(`ind_setup:${channel.id}:${trialRole.id}:${memberRole.id}:${guestRole.id}`)
        .setTitle('Induction Setup')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('referral_points')
                    .setLabel('Referral points awarded on approval')
                    .setStyle(TextInputStyle.Short)
                    .setValue(getConfig('trial.referral_points') ?? '20')
                    .setRequired(true)
                    .setMaxLength(4),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('welcome_message')
                    .setLabel('Welcome message ({user}, {staff} supported)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(getConfig('trial.welcome_message') ?? DEFAULT_WELCOME)
                    .setRequired(true)
                    .setMaxLength(1000),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('deny_message')
                    .setLabel('Denial DM ({user}, {reason} supported)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(getConfig('trial.deny_message') ?? DEFAULT_DENY)
                    .setRequired(true)
                    .setMaxLength(1000),
            ),
        );

    await interaction.showModal(modal);
}

export async function handleInductionView(interaction: ChatInputCommandInteraction): Promise<void> {
    const channelId = getConfig('trial.channel_id');
    const trialRoleId = getConfig('trial.trial_role_id');
    const memberRoleId = getConfig('trial.member_role_id');
    const guestRoleId = getConfig('trial.guest_role_id');
    const referralPoints = getConfig('trial.referral_points') ?? '20 (default)';
    const welcomeMsg = getConfig('trial.welcome_message') ?? '*(using default)*';
    const denyMsg = getConfig('trial.deny_message') ?? '*(using default)*';

    const truncate = (s: string) => s.length > 200 ? s.slice(0, 200) + '…' : s;

    const embed = new EmbedBuilder()
        .setTitle('Induction Configuration')
        .setColor(0x5865F2)
        .addFields(
            { name: 'Trial Channel', value: channelId ? `<#${channelId}>` : 'Not configured', inline: true },
            { name: 'Trial Role', value: trialRoleId ? `<@&${trialRoleId}>` : 'Not configured', inline: true },
            { name: 'Member Role (Approve)', value: memberRoleId ? `<@&${memberRoleId}>` : 'Not configured', inline: true },
            { name: 'Guest Role (Deny)', value: guestRoleId ? `<@&${guestRoleId}>` : 'Not configured', inline: true },
            { name: 'Referral Points', value: referralPoints, inline: true },
            { name: 'Welcome Message', value: truncate(welcomeMsg), inline: false },
            { name: 'Denial DM Message', value: truncate(denyMsg), inline: false },
        );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
