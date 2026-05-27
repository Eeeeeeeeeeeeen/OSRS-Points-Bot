import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from 'discord.js';
import { Command } from '../types/command';
import { hasStaffRole } from '../utils/permissions';
import { handleSetPoints } from './admin';

export const setpoints: Command = {
    data: new SlashCommandBuilder()
        .setName('setpoints')
        .setDescription('Override a user\'s total points')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt =>
            opt.setName('points').setDescription('New total points').setRequired(true).setMinValue(0),
        ),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!hasStaffRole(interaction)) {
            await interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
            return;
        }
        await handleSetPoints(interaction);
    },
};
