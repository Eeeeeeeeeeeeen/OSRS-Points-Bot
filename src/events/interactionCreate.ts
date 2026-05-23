import { Client, Events, Interaction } from 'discord.js';
import { Command } from '../types/command';
import { handleAcceptDrop } from '../interactions/buttons/acceptDrop';
import { handleRejectDrop } from '../interactions/buttons/rejectDrop';
import { handleModifyDrop } from '../interactions/buttons/modifyDrop';
import { handleApproveRankup } from '../interactions/buttons/approveRankup';
import { handleConfirmRemoveDrop, handleCancelRemoveDrop } from '../interactions/buttons/confirmRemoveDrop';
import { handleModifyDropSubmit } from '../interactions/modals/modifyDropSubmit';
import { handleRejectDropSubmit } from '../interactions/modals/rejectDropSubmit';
import { handleSelectDropToRemove } from '../interactions/selects/selectDropToRemove';

export function registerInteractionCreate(client: Client, commands: Map<string, Command>): void {
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        try {
            if (interaction.isChatInputCommand()) {
                const command = commands.get(interaction.commandName);
                if (!command) return;
                await command.execute(interaction);
                return;
            }

            if (interaction.isAutocomplete()) {
                const command = commands.get(interaction.commandName);
                if (command?.autocomplete) {
                    await command.autocomplete(interaction);
                }
                return;
            }

            if (interaction.isButton()) {
                const parts = interaction.customId.split(':');
                const action = parts[0];

                switch (action) {
                    case 'accept_drop':
                        await handleAcceptDrop(interaction, parseInt(parts[1], 10));
                        break;
                    case 'reject_drop':
                        await handleRejectDrop(interaction, parseInt(parts[1], 10));
                        break;
                    case 'modify_drop':
                        await handleModifyDrop(interaction, parseInt(parts[1], 10));
                        break;
                    case 'approve_rankup':
                        await handleApproveRankup(interaction, parts[1], parts[2]);
                        break;
                    case 'confirm_remove_drop':
                        await handleConfirmRemoveDrop(interaction, parseInt(parts[1], 10));
                        break;
                    case 'cancel_remove_drop':
                        await handleCancelRemoveDrop(interaction);
                        break;
                }
                return;
            }

            if (interaction.isStringSelectMenu()) {
                const parts = interaction.customId.split(':');
                const action = parts[0];

                if (action === 'select_drop_remove') {
                    await handleSelectDropToRemove(interaction);
                }
                return;
            }

            if (interaction.isModalSubmit()) {
                const parts = interaction.customId.split(':');
                const action = parts[0];

                if (action === 'modify_drop_submit') {
                    await handleModifyDropSubmit(interaction, parseInt(parts[1], 10));
                } else if (action === 'reject_drop_submit') {
                    await handleRejectDropSubmit(interaction, parseInt(parts[1], 10));
                }
                return;
            }
        } catch (err) {
            console.error('Unhandled interaction error:', err);
        }
    });
}
