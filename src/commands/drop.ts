import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    TextChannel,
    User,
    GuildMember,
    MessageFlags,
} from 'discord.js';
import { APIInteractionGuildMember } from 'discord-api-types/v10';
import { Command } from '../types/command';
import { getItemMapping, searchItems, getItemPrice, getBestPrice, findItemById } from '../services/osrsApi';
import { isEligibleDrop, calculatePoints } from '../services/pointsService';
import { upsertUser } from '../database/queries/users';
import { insertDrop, updateDropReviewMessage } from '../database/queries/drops';
import { getItemOverride } from '../database/queries/itemOverrides';
import { buildReviewEmbed } from '../embeds/reviewEmbed';
import { config } from '../config';

function getJoinedAt(member: GuildMember | APIInteractionGuildMember | null): number {
    if (!member) return Date.now();
    if (member instanceof GuildMember) return member.joinedTimestamp ?? Date.now();
    return member.joined_at ? new Date(member.joined_at).getTime() : Date.now();
}

export const drop: Command = {
    data: new SlashCommandBuilder()
        .setName('drop')
        .setDescription('Submit an item drop for clan points')
        .addStringOption(opt =>
            opt.setName('item')
                .setDescription('Item name — start typing to search')
                .setRequired(true)
                .setAutocomplete(true),
        )
        .addAttachmentOption(opt =>
            opt.setName('screenshot')
                .setDescription('Screenshot of the drop')
                .setRequired(true),
        )
        .addUserOption(opt => opt.setName('teammate1').setDescription('Team member').setRequired(false))
        .addUserOption(opt => opt.setName('teammate2').setDescription('Team member').setRequired(false))
        .addUserOption(opt => opt.setName('teammate3').setDescription('Team member').setRequired(false))
        .addUserOption(opt => opt.setName('teammate4').setDescription('Team member').setRequired(false))
        .addUserOption(opt => opt.setName('teammate5').setDescription('Team member').setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.guildId) {
            await interaction.editReply('This command can only be used in a server.');
            return;
        }

        const itemIdStr = interaction.options.getString('item', true);
        const itemId = parseInt(itemIdStr, 10);
        const screenshot = interaction.options.getAttachment('screenshot', true);

        if (isNaN(itemId)) {
            await interaction.editReply('Please select an item from the autocomplete list.');
            return;
        }

        const teammates: User[] = [];
        for (let i = 1; i <= 5; i++) {
            const tm = interaction.options.getUser(`teammate${i}`);
            if (tm && tm.id !== interaction.user.id && !teammates.find(t => t.id === tm.id)) {
                teammates.push(tm);
            }
        }

        const items = await getItemMapping().catch(() => []);
        const itemData = findItemById(itemId, items);
        const itemName = itemData?.name ?? `Unknown Item (ID: ${itemId})`;

        const teamSize = 1 + teammates.length;
        const override = getItemOverride(itemId);

        let gpValue: number;
        let awardedPoints: number;

        if (override) {
            // Fixed points override — skip price API and eligibility check
            gpValue = 0;
            awardedPoints = Math.max(1, Math.floor(override.points / teamSize));
        } else {
            let priceData;
            try {
                priceData = await getItemPrice(itemId);
            } catch {
                await interaction.editReply('Could not fetch item price. Please try again in a moment.');
                return;
            }

            const fetchedPrice = getBestPrice(priceData);
            if (fetchedPrice === null || !isEligibleDrop(fetchedPrice)) {
                await interaction.editReply('This item is worth less than 1,000,000 GP and does not qualify for points.');
                return;
            }

            gpValue = fetchedPrice;
            awardedPoints = calculatePoints(gpValue, teamSize);
        }

        // interaction.member already carries the submitter's join date — no guild fetch needed
        upsertUser(interaction.user, getJoinedAt(interaction.member));

        // For teammates, try fetching from guild if cached; otherwise default to now
        for (const tm of teammates) {
            const tmMember = interaction.guild
                ? await interaction.guild.members.fetch(tm.id).catch(() => null)
                : null;
            upsertUser(tm, tmMember?.joinedTimestamp ?? Date.now());
        }

        const drop = insertDrop({
            submitterId: interaction.user.id,
            itemName,
            itemId,
            gpValue,
            awardedPoints,
            teammateIds: teammates.map(t => t.id),
            screenshotUrl: screenshot.url,
        });

        const reviewChannel = await interaction.client.channels.fetch(config.staffReviewChannelId).catch(() => null) as TextChannel | null;
        if (!reviewChannel) {
            await interaction.editReply('Staff review channel not found. Please contact an admin.');
            return;
        }

        const { embed, row } = buildReviewEmbed(drop, interaction.user, teammates);
        const reviewMessage = await reviewChannel.send({ embeds: [embed], components: [row] });
        updateDropReviewMessage(drop.id, reviewChannel.id, reviewMessage.id);

        const priceDisplay = override
            ? `fixed override: ${override.points} pts total`
            : `${gpValue.toLocaleString()} GP`;

        await interaction.editReply(
            `Your drop of **${itemName}** (${priceDisplay}) has been submitted for review! ` +
            `Each team member will receive **${awardedPoints}** point(s) upon approval.`,
        );
    },

    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const focused = interaction.options.getFocused();
        if (focused.length < 2) {
            await interaction.respond([]);
            return;
        }
        try {
            const items = await getItemMapping();
            const matches = searchItems(focused, items);
            await interaction.respond(matches.map(item => ({ name: item.name, value: String(item.id) })));
        } catch {
            await interaction.respond([]);
        }
    },
};
