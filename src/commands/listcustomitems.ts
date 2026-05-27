import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from 'discord.js';
import { Command } from '../types/command';
import { hasStaffRole } from '../utils/permissions';
import { handleListCustomItems } from './admin';

export const listcustomitems: Command = {
    data: new SlashCommandBuilder()
        .setName('listcustomitems')
        .setDescription('List all custom items'),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!hasStaffRole(interaction)) {
            await interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
            return;
        }
        await handleListCustomItems(interaction);
    },
};
