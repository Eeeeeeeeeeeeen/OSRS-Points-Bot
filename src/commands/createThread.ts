import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    MessageFlags,
    TextChannel,
    ThreadAutoArchiveDuration,
    ChannelType,
} from 'discord.js';
import { Command } from '../types/command';
import { hasStaffRole } from '../utils/permissions';
import { getConfig } from '../database/queries/botConfig';
import { upsertUser } from '../database/queries/users';
import { insertTrial, getTrialById } from '../database/queries/trials';
import { buildTrialEmbed } from '../embeds/trialEmbed';
import { config } from '../config';

const DEFAULT_WELCOME =
    '{user} Welcome to Avid! If you have any questions feel free to {staff}. In the meantime have a read of the #rank-system channel to familiarise yourself on how to submit drops and how to rank up.';

export const createThread: Command = {
    data: new SlashCommandBuilder()
        .setName('create-thread')
        .setDescription('Create a trial membership thread for a user')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user to start a trial for')
                .setRequired(true)
        )
        .addUserOption(opt =>
            opt.setName('referral')
                .setDescription('The member who referred this user (receives points on approval)')
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!hasStaffRole(interaction)) {
            await interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
            return;
        }

        const channelId = getConfig('trial.channel_id');
        const trialRoleId = getConfig('trial.trial_role_id');
        const memberRoleId = getConfig('trial.member_role_id');
        const guestRoleId = getConfig('trial.guest_role_id');

        if (!channelId || !trialRoleId || !memberRoleId || !guestRoleId) {
            await interaction.reply({
                content: 'Induction is not configured. Ask an admin to run `/induction setup`.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const targetUser = interaction.options.getUser('user', true);
        const referralUser = interaction.options.getUser('referral');

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild!;
        const trialChannel = guild.channels.cache.get(channelId) as TextChannel | undefined;

        if (!trialChannel) {
            await interaction.editReply({ content: 'Trial channel not found. Please reconfigure via `/induction setup`.' });
            return;
        }

        let member;
        try {
            member = await guild.members.fetch(targetUser.id);
        } catch {
            await interaction.editReply({ content: `Could not find ${targetUser.username} in the server.` });
            return;
        }

        const thread = await trialChannel.threads.create({
            name: `Trial — ${targetUser.username}`,
            type: ChannelType.PrivateThread,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
            invitable: false,
        });

        if (member.roles.cache.has(guestRoleId)) await member.roles.remove(guestRoleId);
        await member.roles.add(trialRoleId);

        upsertUser(targetUser, member.joinedTimestamp ?? Date.now());

        const trialId = insertTrial(targetUser.id, referralUser?.id ?? null, thread.id, interaction.user.id);
        const trial = getTrialById(trialId)!;

        // Add trial member and all staff to the private thread
        const allMembers = await guild.members.fetch();
        const toAdd = [
            targetUser.id,
            ...allMembers
                .filter(m => m.roles.cache.has(config.staffRoleId) || m.roles.cache.has(config.adminRoleId))
                .map(m => m.id),
        ];
        await Promise.all(toAdd.map(id => thread.members.add(id)));

        const { embed, row } = buildTrialEmbed(trial, targetUser, referralUser ?? null, interaction.user);
        await thread.send({ embeds: [embed], components: [row] });

        const welcomeTemplate = getConfig('trial.welcome_message') ?? DEFAULT_WELCOME;
        const welcomeMessage = welcomeTemplate
            .replace('{user}', `<@${targetUser.id}>`)
            .replace('{staff}', `<@&${config.staffRoleId}>`);
        await thread.send(welcomeMessage);

        await interaction.editReply({ content: `Trial thread created: ${thread.url}` });
    },
};
