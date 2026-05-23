import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    User,
} from 'discord.js';
import { DropRow } from '../types/db';

export function buildReviewEmbed(drop: DropRow, submitter: User, teammates: User[]) {
    const team = [submitter, ...teammates].map(u => `<@${u.id}>`).join(', ');
    const gpFormatted = drop.gp_value.toLocaleString();

    const embed = new EmbedBuilder()
        .setTitle('Drop Submission — Pending Review')
        .setColor(0xFFAA00)
        .setImage(drop.screenshot_url)
        .addFields(
            { name: 'Item', value: drop.item_name, inline: true },
            { name: 'GP Value', value: `${gpFormatted} GP`, inline: true },
            { name: 'Points Each', value: String(drop.awarded_points), inline: true },
            { name: 'Team', value: team, inline: false },
        )
        .setFooter({ text: `Drop ID: ${drop.id}` })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`accept_drop:${drop.id}`)
            .setLabel('Accept')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`reject_drop:${drop.id}`)
            .setLabel('Reject')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`modify_drop:${drop.id}`)
            .setLabel('Modify')
            .setEmoji('✏️')
            .setStyle(ButtonStyle.Secondary),
    );

    return { embed, row };
}

export function buildAcceptedEmbed(drop: DropRow, staffUser: User): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle('Drop Accepted')
        .setColor(0x00CC44)
        .setImage(drop.screenshot_url)
        .addFields(
            { name: 'Item', value: drop.item_name, inline: true },
            { name: 'GP Value', value: `${drop.gp_value.toLocaleString()} GP`, inline: true },
            { name: 'Points Each', value: String(drop.awarded_points), inline: true },
        )
        .setFooter({ text: `Accepted by ${staffUser.username} • Drop ID: ${drop.id}` })
        .setTimestamp();
}

export function buildRejectedEmbed(drop: DropRow, staffUser: User, reason?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle('Drop Rejected')
        .setColor(0xCC2222)
        .addFields(
            { name: 'Item', value: drop.item_name, inline: true },
            { name: 'GP Value', value: drop.gp_value > 0 ? `${drop.gp_value.toLocaleString()} GP` : 'Override', inline: true },
        );

    if (reason) {
        embed.addFields({ name: 'Reason', value: reason, inline: false });
    }

    return embed
        .setFooter({ text: `Rejected by ${staffUser.username} • Drop ID: ${drop.id}` })
        .setTimestamp();
}
