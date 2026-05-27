import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from 'discord.js';
import { Command } from '../types/command';
import { hasStaffRole } from '../utils/permissions';
import { handleListItemPoints } from './admin';

export const listitempoints: Command = {
    data: new SlashCommandBuilder()
        .setName('listitempoints')
        .setDescription('List all item points overrides'),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!hasStaffRole(interaction)) {
            await interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
            return;
        }
        await handleListItemPoints(interaction);
    },
};
