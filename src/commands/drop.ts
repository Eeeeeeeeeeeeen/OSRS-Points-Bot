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
import { getCustomItem, searchCustomItems, getPartCountForParent } from '../database/queries/customItems';
import { getTradeablePartsForParent } from '../database/queries/tradeableParts';
import { getConfig } from '../database/queries/botConfig';
import { buildReviewEmbed } from '../embeds/reviewEmbed';
import { formatGp } from '../utils/formatGp';
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
        .addUserOption(opt => opt.setName('teammate5').setDescription('Team member').setRequired(false))
        .addUserOption(opt => opt.setName('teammate6').setDescription('Team member').setRequired(false))
        .addUserOption(opt => opt.setName('teammate7').setDescription('Team member').setRequired(false))
        .addUserOption(opt => opt.setName('teammate8').setDescription('Team member').setRequired(false))
        .addUserOption(opt => opt.setName('teammate9').setDescription('Team member').setRequired(false))
        .addIntegerOption(opt =>
            opt.setName('team_size')
                .setDescription('Total team size including non-clan members (used to split the drop value)')
                .setRequired(false)
                .setMinValue(1),
        ),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.guildId) {
            await interaction.editReply('This command can only be used in a server.');
            return;
        }

        const itemValue = interaction.options.getString('item', true);
        const screenshot = interaction.options.getAttachment('screenshot', true);

        const teammates: User[] = [];
        for (let i = 1; i <= 9; i++) {
            const tm = interaction.options.getUser(`teammate${i}`);
            if (tm && tm.id !== interaction.user.id && !teammates.find(t => t.id === tm.id)) {
                teammates.push(tm);
            }
        }

        const registeredCount = 1 + teammates.length;
        const teamSizeOption = interaction.options.getInteger('team_size');

        if (teamSizeOption !== null && teamSizeOption < registeredCount) {
            await interaction.editReply(
                `Team size (${teamSizeOption}) cannot be less than the number of tagged team members (${registeredCount}).`,
            );
            return;
        }

        const effectiveTeamSize = teamSizeOption ?? registeredCount;

        let itemName: string;
        let itemId: number | null;
        let gpValue: number;
        let awardedPoints: number;
        let priceDisplay: string;
        let itemSuffix: string | undefined;

        if (itemValue.startsWith('custom:')) {
            const customId = parseInt(itemValue.split(':')[1], 10);
            if (isNaN(customId)) {
                await interaction.editReply('Please select an item from the autocomplete list.');
                return;
            }

            const customItem = getCustomItem(customId);
            if (!customItem) {
                await interaction.editReply('This item no longer exists. Please select another item from the list.');
                return;
            }

            itemId = null;
            itemName = customItem.name;
            gpValue = 0;

            if (customItem.parent_ref !== null) {
                const parentName = customItem.parent_name ?? 'Unknown item';
                const partCount = Math.max(1, getPartCountForParent(customItem.parent_ref));

                if (customItem.parent_ref.startsWith('ge:')) {
                    const geId = parseInt(customItem.parent_ref.split(':')[1], 10);
                    const override = getItemOverride(geId);
                    if (override) {
                        // Admin-set fixed points: divide points then split by team
                        const perPartPoints = Math.floor(override.points / partCount);
                        awardedPoints = Math.max(1, Math.floor(perPartPoints / effectiveTeamSize));
                        itemSuffix = `part of ${parentName}`;
                        priceDisplay = `${perPartPoints} pts`;
                    } else {
                        // Live GE price: divide GP first so the cap applies per-part
                        let rawGp: number | null = null;
                        try {
                            const priceData = await getItemPrice(geId);
                            rawGp = getBestPrice(priceData);
                        } catch { /* handled below */ }
                        if (rawGp === null) {
                            await interaction.editReply(`Could not fetch the price for **${parentName}**. Please try again.`);
                            return;
                        }
                        const tradeableComponents = getTradeablePartsForParent(customItem.parent_ref!);
                        let sumTradeableGp = 0;
                        const tpResults = await Promise.allSettled(
                            tradeableComponents.map(tc => getItemPrice(tc.ge_item_id)),
                        );
                        for (const r of tpResults) {
                            if (r.status === 'fulfilled') {
                                const best = getBestPrice(r.value);
                                if (best !== null) sumTradeableGp += best;
                            }
                        }
                        const perPartGp = Math.floor(Math.max(0, rawGp - sumTradeableGp) / partCount);
                        awardedPoints = calculatePoints(perPartGp, effectiveTeamSize);
                        itemSuffix = `part of ${parentName}`;
                        priceDisplay = formatGp(perPartGp);
                    }
                } else if (customItem.parent_ref.startsWith('custom:')) {
                    const parentId = parseInt(customItem.parent_ref.split(':')[1], 10);
                    const parentItem = getCustomItem(parentId);
                    const parentPts = parentItem?.points ?? null;
                    if (parentPts === null) {
                        await interaction.editReply(
                            `**${parentName}** has no points configured. Ask an admin to set points via \`/admin setitempoints\`.`,
                        );
                        return;
                    }
                    const perPartPoints = Math.floor(parentPts / partCount);
                    awardedPoints = Math.max(1, Math.floor(perPartPoints / effectiveTeamSize));
                    itemSuffix = `part of ${parentName}`;
                    priceDisplay = `${perPartPoints} pts`;
                } else {
                    await interaction.editReply('Invalid parent item reference. Please contact an admin.');
                    return;
                }
            } else {
                let basePoints = customItem.points;
                if (basePoints === null && customItem.category) {
                    const configVal = getConfig(`category_points_${customItem.category}`);
                    basePoints = configVal ? parseInt(configVal, 10) : null;
                }
                if (basePoints === null) {
                    const hint = customItem.category === 'pet'
                        ? 'No Pet default is set. Ask an admin to run `/admin setcategorypoints`.'
                        : 'Ask an admin to set explicit points via `/admin addcustomitem`.';
                    await interaction.editReply(`**${customItem.name}** has no points set. ${hint}`);
                    return;
                }
                awardedPoints = Math.max(1, Math.floor(basePoints / effectiveTeamSize));
                priceDisplay = `custom item: ${basePoints} pts total`;
            }
        } else {
            const parsedId = parseInt(itemValue, 10);
            if (isNaN(parsedId)) {
                await interaction.editReply('Please select an item from the autocomplete list.');
                return;
            }
            itemId = parsedId;

            const items = await getItemMapping().catch(() => []);
            const itemData = findItemById(itemId, items);
            itemName = itemData?.name ?? `Unknown Item (ID: ${itemId})`;

            const override = getItemOverride(itemId);

            if (override) {
                gpValue = 0;
                awardedPoints = Math.max(1, Math.floor(override.points / effectiveTeamSize));
                priceDisplay = `fixed override: ${override.points} pts total`;
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
                awardedPoints = calculatePoints(gpValue, effectiveTeamSize);
                priceDisplay = formatGp(gpValue);
            }
        }

        upsertUser(interaction.user, getJoinedAt(interaction.member));

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
            teamSize: effectiveTeamSize,
            screenshotUrl: screenshot.url,
        });

        const reviewChannel = await interaction.client.channels.fetch(config.staffReviewChannelId).catch(() => null) as TextChannel | null;
        if (!reviewChannel) {
            await interaction.editReply('Staff review channel not found. Please contact an admin.');
            return;
        }

        const { embed, row } = buildReviewEmbed(drop, interaction.user, teammates, priceDisplay, itemSuffix);
        const reviewMessage = await reviewChannel.send({ embeds: [embed], components: [row] });
        updateDropReviewMessage(drop.id, reviewChannel.id, reviewMessage.id);

        const fullPriceDisplay = itemSuffix ? `${itemSuffix}: ${priceDisplay}` : priceDisplay;
        const anonymousCount = effectiveTeamSize - registeredCount;
        const teamSuffix = anonymousCount > 0
            ? ` Split across ${effectiveTeamSize} total (${anonymousCount} anonymous).`
            : '';
        await interaction.editReply(
            `Your drop of **${itemName}** (${fullPriceDisplay}) has been submitted for review! ` +
            `Each team member will receive **${awardedPoints}** point(s) upon approval.${teamSuffix}`,
        );
    },

    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const focused = interaction.options.getFocused();
        if (focused.length < 2) {
            await interaction.respond([]);
            return;
        }
        try {
            // Custom items first (pets, untradeables, and composite parts)
            const customMatches = searchCustomItems(focused);
            const customNames = new Set(customMatches.map(i => i.name.toLowerCase()));
            const customChoices = customMatches.map(item => {
                const tag = item.parent_name ? ` [Part of ${item.parent_name}]`
                    : item.category === 'pet' ? ' [Pet]'
                    : item.category === 'untradeable' ? ' [Untradeable]'
                    : ' [Custom]';
                return { name: `${item.name}${tag}`, value: `custom:${item.id}` };
            });

            // Fill remaining slots with GE items, deduplicating against custom item names
            const remaining = 25 - customChoices.length;
            let geChoices: { name: string; value: string }[] = [];
            if (remaining > 0) {
                const items = await getItemMapping();
                geChoices = searchItems(focused, items)
                    .filter(i => !customNames.has(i.name.toLowerCase()))
                    .slice(0, remaining)
                    .map(item => ({ name: item.name, value: String(item.id) }));
            }

            await interaction.respond([...customChoices, ...geChoices]);
        } catch {
            await interaction.respond([]);
        }
    },
};
