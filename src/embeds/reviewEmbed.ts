import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    User,
} from 'discord.js';
import { DropRow } from '../types/db';
import { formatGp } from '../utils/formatGp';
import { buildTeamDisplay } from '../utils/teamDisplay';

function itemThumbnail(itemId: number | null): string | null {
    return itemId ? `https://static.runelite.net/cache/item/icon/${itemId}.png` : null;
}

function valueDisplay(drop: DropRow, override?: string): string {
    if (override) return override;
    return drop.gp_value > 0 ? formatGp(drop.gp_value) : `${drop.awarded_points} pts`;
}

export function buildReviewEmbed(drop: DropRow, submitter: User, teammates: User[], priceDisplay?: string, itemSuffix?: string) {
    const team = buildTeamDisplay(submitter, teammates, drop.team_size);
    const itemDisplay = itemSuffix ? `${drop.item_name} (${itemSuffix})` : drop.item_name;
    const thumbnail = itemThumbnail(drop.item_id);

    const embed = new EmbedBuilder()
        .setTitle('Drop Submission — Pending Review')
        .setColor(0xFFAA00)
        .setImage(drop.screenshot_url)
        .addFields(
            { name: 'Item', value: itemDisplay, inline: true },
            { name: 'GP Value', value: valueDisplay(drop, priceDisplay), inline: true },
            { name: 'Points Each', value: String(drop.awarded_points), inline: true },
            { name: 'Team', value: team, inline: false },
        )
        .setFooter({ text: `Drop ID: ${drop.id}` })
        .setTimestamp();

    if (thumbnail) embed.setThumbnail(thumbnail);

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
    const thumbnail = itemThumbnail(drop.item_id);
    const embed = new EmbedBuilder()
        .setTitle('Drop Accepted')
        .setColor(0x00CC44)
        .setImage(drop.screenshot_url)
        .addFields(
            { name: 'Item', value: drop.item_name, inline: true },
            { name: 'GP Value', value: valueDisplay(drop), inline: true },
            { name: 'Points Each', value: String(drop.awarded_points), inline: true },
        )
        .setFooter({ text: `Accepted by ${staffUser.username} • Drop ID: ${drop.id}` })
        .setTimestamp();

    if (thumbnail) embed.setThumbnail(thumbnail);
    return embed;
}

export function buildRejectedEmbed(drop: DropRow, staffUser: User, reason?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle('Drop Rejected')
        .setColor(0xCC2222)
        .addFields(
            { name: 'Item', value: drop.item_name, inline: true },
            { name: 'GP Value', value: valueDisplay(drop), inline: true },
        );

    if (reason) {
        embed.addFields({ name: 'Reason', value: reason, inline: false });
    }

    return embed
        .setFooter({ text: `Rejected by ${staffUser.username} • Drop ID: ${drop.id}` })
        .setTimestamp();
}
