import { EmbedBuilder, User } from 'discord.js';
import { DropRow } from '../types/db';
import { formatGp } from '../utils/formatGp';

export function buildDropLogEmbed(drop: DropRow, submitter: User, teammates: User[]): EmbedBuilder {
    const team = [submitter, ...teammates].map(u => `<@${u.id}>`).join(', ');
    const gpValue = drop.gp_value > 0 ? formatGp(drop.gp_value) : `${drop.awarded_points} pts`;

    const embed = new EmbedBuilder()
        .setTitle(`New Drop: ${drop.item_name}`)
        .setColor(0x00AAFF)
        .setAuthor({ name: submitter.username, iconURL: submitter.displayAvatarURL() })
        .setImage(drop.screenshot_url)
        .addFields(
            { name: 'Item', value: drop.item_name, inline: true },
            { name: 'GP Value', value: gpValue, inline: true },
            { name: 'Points Each', value: String(drop.awarded_points), inline: true },
            { name: 'Received by', value: team, inline: false },
        )
        .setTimestamp();

    if (drop.item_id) {
        embed.setThumbnail(`https://static.runelite.net/cache/item/icon/${drop.item_id}.png`);
    }

    return embed;
}
