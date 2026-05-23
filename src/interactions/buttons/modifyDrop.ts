import {
    ButtonInteraction,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from 'discord.js';
import { getDropById } from '../../database/queries/drops';
import { config } from '../../config';
import { hasClanRole } from '../../utils/permissions';

export async function handleModifyDrop(interaction: ButtonInteraction, dropId: number): Promise<void> {
    if (!hasClanRole(interaction)) {
        await interaction.reply({ content: 'You do not have permission to do this.', flags: MessageFlags.Ephemeral });
        return;
    }

    const drop = getDropById(dropId);
    if (!drop || drop.status !== 'pending') {
        await interaction.reply({ content: 'This drop is no longer pending.', flags: MessageFlags.Ephemeral });
        return;
    }

    // showModal() IS the response — do not deferUpdate/reply before this
    const modal = new ModalBuilder()
        .setCustomId(`modify_drop_submit:${dropId}`)
        .setTitle('Modify Drop');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('item_name')
                .setLabel('Item Name')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(drop.item_name)
                .setPlaceholder('Leave blank to keep current'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('gp_value')
                .setLabel('GP Value Override')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(String(drop.gp_value))
                .setPlaceholder('Leave blank to keep current'),
        ),
    );

    await interaction.showModal(modal);
}

