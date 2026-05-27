import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from 'discord.js';
import { Command } from '../types/command';
import { hasStaffRole } from '../utils/permissions';
import { handleEventPoints } from './admin';

export const eventpoints: Command = {
    data: new SlashCommandBuilder()
        .setName('eventpoints')
        .setDescription('Add or deduct points for multiple members at once, e.g. event participation')
        .addStringOption(opt =>
            opt.setName('mode')
                .setDescription('Whether to add or deduct points')
                .setRequired(true)
                .addChoices(
                    { name: 'Add', value: 'add' },
                    { name: 'Deduct', value: 'deduct' },
                ),
        )
        .addIntegerOption(opt =>
            opt.setName('points')
                .setDescription('Points to add or deduct per member')
                .setRequired(true)
                .setMinValue(1),
        )
        .addStringOption(opt =>
            opt.setName('reason')
                .setDescription('Reason for the adjustment, e.g. "Castle Wars event"')
                .setRequired(true),
        )
        .addUserOption(opt => opt.setName('user1').setDescription('Member').setRequired(true))
        .addUserOption(opt => opt.setName('user2').setDescription('Member').setRequired(false))
        .addUserOption(opt => opt.setName('user3').setDescription('Member').setRequired(false))
        .addUserOption(opt => opt.setName('user4').setDescription('Member').setRequired(false))
        .addUserOption(opt => opt.setName('user5').setDescription('Member').setRequired(false))
        .addUserOption(opt => opt.setName('user6').setDescription('Member').setRequired(false))
        .addUserOption(opt => opt.setName('user7').setDescription('Member').setRequired(false))
        .addUserOption(opt => opt.setName('user8').setDescription('Member').setRequired(false))
        .addUserOption(opt => opt.setName('user9').setDescription('Member').setRequired(false))
        .addUserOption(opt => opt.setName('user10').setDescription('Member').setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!hasStaffRole(interaction)) {
            await interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
            return;
        }
        await handleEventPoints(interaction);
    },
};
