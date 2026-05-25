import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, User } from 'discord.js';
import { TrialRow } from '../types/db';

export function buildTrialEmbed(
    trial: TrialRow,
    user: User,
    referrer: User | null,
    staffUser: User,
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
    const embed = new EmbedBuilder()
        .setTitle('Trial Member — Pending Review')
        .setColor(0xFFAA00)
        .addFields(
            { name: 'Trial Member', value: `<@${user.id}>`, inline: true },
            { name: 'Started By', value: `<@${staffUser.id}>`, inline: true },
        );

    if (referrer) {
        embed.addFields({ name: 'Referral', value: `<@${referrer.id}>`, inline: true });
    }

    embed.addFields({ name: 'Started At', value: `<t:${Math.floor(trial.created_at / 1000)}:F>`, inline: false });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`approve_trial:${trial.id}`)
            .setLabel('Approve')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`deny_trial:${trial.id}`)
            .setLabel('Deny')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger),
    );

    return { embed, row };
}

export function buildApprovedTrialEmbed(trial: TrialRow, user: User, staffUser: User): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle('Trial Member — Approved')
        .setColor(0x57F287)
        .addFields(
            { name: 'Trial Member', value: `<@${user.id}>`, inline: true },
            { name: 'Approved By', value: `<@${staffUser.id}>`, inline: true },
            { name: 'Approved At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
        );
}

export function buildDeniedTrialEmbed(
    trial: TrialRow,
    user: User,
    staffUser: User,
    reason: string,
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle('Trial Member — Denied')
        .setColor(0xED4245)
        .addFields(
            { name: 'Trial Member', value: `<@${user.id}>`, inline: true },
            { name: 'Denied By', value: `<@${staffUser.id}>`, inline: true },
            { name: 'Denied At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
        );

    if (reason) {
        embed.addFields({ name: 'Reason', value: reason, inline: false });
    }

    return embed;
}
