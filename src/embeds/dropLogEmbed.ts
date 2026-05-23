import { EmbedBuilder, User } from 'discord.js';
import { DropRow } from '../types/db';

export function buildDropLogEmbed(drop: DropRow, submitter: User, teammates: User[]): EmbedBuilder {
    const team = [submitter, ...teammates].map(u => `<@${u.id}>`).join(', ');

    return new EmbedBuilder()
        .setTitle(`New Drop: ${drop.item_name}`)
        .setColor(0x00AAFF)
        .setImage(drop.screenshot_url)
        .addFields(
            { name: 'Item', value: drop.item_name, inline: true },
            { name: 'GP Value', value: `${drop.gp_value.toLocaleString()} GP`, inline: true },
            { name: 'Points Each', value: String(drop.awarded_points), inline: true },
            { name: 'Received by', value: team, inline: false },
        )
        .setTimestamp();
}
