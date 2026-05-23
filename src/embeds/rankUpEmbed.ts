import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    GuildMember,
    User,
} from 'discord.js';
import { RankTierRow } from '../types/db';

export function buildRankUpEmbed(member: GuildMember, tier: RankTierRow) {
    const embed = new EmbedBuilder()
        .setTitle('Rank-Up Eligible')
        .setColor(0xFFD700)
        .setThumbnail(member.user.displayAvatarURL())
        .setDescription(`<@${member.id}> is eligible for a rank-up!`)
        .addFields(
            { name: 'User', value: member.displayName, inline: true },
            { name: 'New Rank', value: tier.name, inline: true },
            { name: 'Required Points', value: String(tier.min_points), inline: true },
        )
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`approve_rankup:${member.id}:${tier.role_id}`)
            .setLabel('Approve Rank-Up')
            .setEmoji('⬆️')
            .setStyle(ButtonStyle.Success),
    );

    return { embed, row };
}

export function buildRankUpApprovedEmbed(member: GuildMember, tier: RankTierRow, approver: User): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle('Rank-Up Approved')
        .setColor(0x00CC44)
        .setDescription(`<@${member.id}> has been promoted to **${tier.name}**!`)
        .setFooter({ text: `Approved by ${approver.username}` })
        .setTimestamp();
}
