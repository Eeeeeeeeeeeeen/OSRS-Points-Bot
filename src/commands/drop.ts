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
import { getCustomItem, searchCustomItems } from '../database/queries/customItems';
import { getConfig } from '../database/queries/botConfig';
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

        const itemValue = interaction.options.getString('item', true);
        const screenshot = interaction.options.getAttachment('screenshot', true);

        const teammates: User[] = [];
        for (let i = 1; i <= 5; i++) {
            const tm = interaction.options.getUser(`teammate${i}`);
            if (tm && tm.id !== interaction.user.id && !teammates.find(t => t.id === tm.id)) {
                teammates.push(tm);
            }
        }

        const teamSize = 1 + teammates.length;

        let itemName: string;
        let itemId: number | null;
        let gpValue: number;
        let awardedPoints: number;
        let priceDisplay: string;

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

            let basePoints = customItem.points;
            if (basePoints === null && customItem.category) {
                const configVal = getConfig(`category_points_${customItem.category}`);
                basePoints = configVal ? parseInt(configVal, 10) : null;
            }

            if (basePoints === null) {
                const hint = customItem.category === 'pet'
                    ? 'No Pet default is configured. Ask an admin to run `/admin setcategorypoints`.'
                    : 'Ask an admin to set explicit points via `/admin addcustomitem`.';
                await interaction.editReply(`**${customItem.name}** has no points set. ${hint}`);
                return;
            }

            itemId = null;
            itemName = customItem.name;
            gpValue = 0;
            awardedPoints = Math.max(1, Math.floor(basePoints / teamSize));
            priceDisplay = `custom item: ${basePoints} pts total`;
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
                awardedPoints = Math.max(1, Math.floor(override.points / teamSize));
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
                awardedPoints = calculatePoints(gpValue, teamSize);
                priceDisplay = `${gpValue.toLocaleString()} GP`;
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
            // Custom items first — they're explicitly configured and always valid
            const customMatches = searchCustomItems(focused);
            const customNames = new Set(customMatches.map(i => i.name.toLowerCase()));
            const customChoices = customMatches.map(item => {
                const tag = item.category === 'pet' ? ' [Pet]'
                    : item.category === 'untradeable' ? ' [Untradeable]'
                    : ' [Custom]';
                return { name: `${item.name}${tag}`, value: `custom:${item.id}` };
            });

            // Fill remaining slots with GE items, excluding any names already shown as custom
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
