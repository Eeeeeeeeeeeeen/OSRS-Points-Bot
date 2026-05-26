import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    PermissionFlagsBits,
    MessageFlags,
    TextChannel,
    ChannelType,
} from 'discord.js';
import { Command } from '../types/command';
import { getUserById, setUserPoints, adjustUserPoints, upsertUser } from '../database/queries/users';
import { getAllRankTiers, insertRankTier, deleteRankTier, getRankTierByRoleId } from '../database/queries/ranks';
import { getItemOverride, setItemOverride, removeItemOverride, getAllItemOverrides } from '../database/queries/itemOverrides';
import { getAllCustomItems, getCustomItem, searchCustomItems, upsertCustomItem, removeCustomItem, getPartCountForParent, CustomItemCategory } from '../database/queries/customItems';
import { getAllTradeableParts, addTradeablePart, removeTradeablePart, getTradeablePartsForParent, TradeablePartRow } from '../database/queries/tradeableParts';
import { getConfig, setConfig } from '../database/queries/botConfig';
import { getAcceptedDropsForUser } from '../database/queries/drops';
import { getItemMapping, searchItems, findItemById } from '../services/osrsApi';
import { checkAndNotifyRankUp, forceSetRank } from '../services/rankService';
import { config } from '../config';
import { hasAdminRole } from '../utils/permissions';
import { handleInductionSetup, handleInductionView } from './induction';

export const admin: Command = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin commands for managing clan points and ranks')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('setpoints')
                .setDescription('Override a user\'s total points')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('points').setDescription('New total points').setRequired(true).setMinValue(0),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('setrank')
                .setDescription('Force assign a rank role to a user (bypasses requirements)')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addRoleOption(opt => opt.setName('rank').setDescription('Rank role to assign').setRequired(true)),
        )
        .addSubcommand(sub =>
            sub.setName('addrank')
                .setDescription('Add or update a rank tier')
                .addRoleOption(opt => opt.setName('role').setDescription('Discord role for this rank').setRequired(true))
                .addStringOption(opt => opt.setName('name').setDescription('Display name for this rank').setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('min_points').setDescription('Minimum points required').setRequired(true).setMinValue(0),
                )
                .addIntegerOption(opt =>
                    opt.setName('min_days').setDescription('Minimum days in server (default: 0)').setRequired(false).setMinValue(0),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('removerank')
                .setDescription('Remove a rank tier from the configuration')
                .addRoleOption(opt => opt.setName('role').setDescription('Rank role to remove').setRequired(true)),
        )
        .addSubcommand(sub =>
            sub.setName('listranks')
                .setDescription('List all configured rank tiers'),
        )
        .addSubcommand(sub =>
            sub.setName('setitempoints')
                .setDescription('Set a fixed points override for an item')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('Item name — start typing to search')
                        .setRequired(true)
                        .setAutocomplete(true),
                )
                .addIntegerOption(opt =>
                    opt.setName('points')
                        .setDescription('Fixed points to award (total, before team split)')
                        .setRequired(true)
                        .setMinValue(1),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('removeitempoints')
                .setDescription('Remove a fixed points override for an item')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('Item name — start typing to search')
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('listitempoints')
                .setDescription('List all item points overrides'),
        )
        .addSubcommand(sub =>
            sub.setName('removedrops')
                .setDescription('Remove accepted drops from a user and deduct their points')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true)),
        )
        .addSubcommand(sub =>
            sub.setName('eventpoints')
                .setDescription('Add or deduct points for multiple members at once, e.g. event participation')
                .addStringOption(opt =>
                    opt.setName('mode')
                        .setDescription('Whether to add or deduct points')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Add', value: 'add' },
                            { name: 'Deduct', value: 'deduct' },
                        ),
                )
                .addIntegerOption(opt =>
                    opt.setName('points')
                        .setDescription('Points to add or deduct per member')
                        .setRequired(true)
                        .setMinValue(1),
                )
                .addStringOption(opt =>
                    opt.setName('reason')
                        .setDescription('Reason for the adjustment, e.g. "Castle Wars event"')
                        .setRequired(true),
                )
                .addUserOption(opt => opt.setName('user1').setDescription('Member').setRequired(true))
                .addUserOption(opt => opt.setName('user2').setDescription('Member').setRequired(false))
                .addUserOption(opt => opt.setName('user3').setDescription('Member').setRequired(false))
                .addUserOption(opt => opt.setName('user4').setDescription('Member').setRequired(false))
                .addUserOption(opt => opt.setName('user5').setDescription('Member').setRequired(false))
                .addUserOption(opt => opt.setName('user6').setDescription('Member').setRequired(false))
                .addUserOption(opt => opt.setName('user7').setDescription('Member').setRequired(false))
                .addUserOption(opt => opt.setName('user8').setDescription('Member').setRequired(false))
                .addUserOption(opt => opt.setName('user9').setDescription('Member').setRequired(false))
                .addUserOption(opt => opt.setName('user10').setDescription('Member').setRequired(false)),
        )
        .addSubcommand(sub =>
            sub.setName('addcustomitem')
                .setDescription('Add or update a custom item (pet, untradeable) with fixed points')
                .addStringOption(opt => opt.setName('name').setDescription('Item name').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('category')
                        .setDescription('Item category — determines which default applies if no points are set')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Pet', value: 'pet' },
                            { name: 'Untradeable', value: 'untradeable' },
                        ),
                )
                .addIntegerOption(opt =>
                    opt.setName('points')
                        .setDescription('Fixed pts to award (total, before team split) — leave blank to use category default')
                        .setRequired(false)
                        .setMinValue(1),
                )
                .addStringOption(opt =>
                    opt.setName('is_component_of')
                        .setDescription('Link this part to a composite item set (e.g. "Soulreaper Axe") — start typing to search')
                        .setRequired(false)
                        .setAutocomplete(true),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('removecustomitem')
                .setDescription('Remove a custom item from the list')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('Item to remove — start typing to search')
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('listcustomitems')
                .setDescription('List all custom items'),
        )
        .addSubcommand(sub =>
            sub.setName('setcategorypoints')
                .setDescription('Set the default points awarded for all pets without an individual override')
                .addStringOption(opt =>
                    opt.setName('category')
                        .setDescription('Item category')
                        .setRequired(true)
                        .addChoices({ name: 'Pet', value: 'pet' }),
                )
                .addIntegerOption(opt =>
                    opt.setName('points')
                        .setDescription('Default points to award (total, before team split)')
                        .setRequired(true)
                        .setMinValue(1),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('addtradeablecomponent')
                .setDescription('Register a tradeable GE component of a combined item (used for the untradeable price formula)')
                .addStringOption(opt =>
                    opt.setName('parent')
                        .setDescription('The combined/final item (GE item) — start typing to search')
                        .setRequired(true)
                        .setAutocomplete(true),
                )
                .addStringOption(opt =>
                    opt.setName('component')
                        .setDescription('The tradeable GE component — start typing to search')
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('removetradeablecomponent')
                .setDescription('Remove a registered tradeable component link')
                .addStringOption(opt =>
                    opt.setName('entry')
                        .setDescription('Entry to remove — start typing to search')
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        )
        .addSubcommandGroup(group =>
            group.setName('induction')
                .setDescription('Configure the trial membership induction system')
                .addSubcommand(sub =>
                    sub.setName('setup')
                        .setDescription('Set the trial channel, roles, and referral points')
                        .addChannelOption(opt =>
                            opt.setName('channel')
                                .setDescription('Channel where trial threads are created')
                                .addChannelTypes(ChannelType.GuildText)
                                .setRequired(true),
                        )
                        .addRoleOption(opt =>
                            opt.setName('trial-role')
                                .setDescription('Role applied when a trial starts')
                                .setRequired(true),
                        )
                        .addRoleOption(opt =>
                            opt.setName('member-role')
                                .setDescription('Role applied when trial is approved')
                                .setRequired(true),
                        )
                        .addRoleOption(opt =>
                            opt.setName('guest-role')
                                .setDescription('Role applied when trial is denied')
                                .setRequired(true),
                        )
                        .addIntegerOption(opt =>
                            opt.setName('referral-points')
                                .setDescription('Points awarded to referrer on approval (default: 20)')
                                .setMinValue(0),
                        ),
                )
                .addSubcommand(sub =>
                    sub.setName('view')
                        .setDescription('View current induction configuration'),
                ),
        ) as SlashCommandBuilder,

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!hasAdminRole(interaction)) {
            await interaction.reply({ content: 'You do not have permission to use admin commands.', flags: MessageFlags.Ephemeral });
            return;
        }

        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();

        if (group === 'induction') {
            switch (sub) {
                case 'setup': await handleInductionSetup(interaction); break;
                case 'view':  await handleInductionView(interaction);  break;
            }
            return;
        }

        switch (sub) {
            case 'eventpoints':      await handleEventPoints(interaction);     break;
            case 'setpoints':       await handleSetPoints(interaction);      break;
            case 'setrank':         await handleSetRank(interaction);        break;
            case 'addrank':         await handleAddRank(interaction);        break;
            case 'removerank':      await handleRemoveRank(interaction);     break;
            case 'listranks':       await handleListRanks(interaction);      break;
            case 'setitempoints':    await handleSetItemPoints(interaction);    break;
            case 'removeitempoints': await handleRemoveItemPoints(interaction); break;
            case 'listitempoints':   await handleListItemPoints(interaction);   break;
            case 'removedrops':      await handleRemoveDrops(interaction);      break;
            case 'addcustomitem':           await handleAddCustomItem(interaction);           break;
            case 'removecustomitem':        await handleRemoveCustomItem(interaction);        break;
            case 'listcustomitems':         await handleListCustomItems(interaction);         break;
            case 'setcategorypoints':       await handleSetCategoryPoints(interaction);       break;
            case 'addtradeablecomponent':   await handleAddTradeableComponent(interaction);   break;
            case 'removetradeablecomponent': await handleRemoveTradeableComponent(interaction); break;
        }
    },

    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const sub = interaction.options.getSubcommand();
        const newComponentSubs = ['addtradeablecomponent', 'removetradeablecomponent'];
        if (sub !== 'setitempoints' && sub !== 'removeitempoints' && sub !== 'removecustomitem' && sub !== 'addcustomitem' && !newComponentSubs.includes(sub)) return;

        if (sub === 'addtradeablecomponent') {
            const focusedOpt = interaction.options.getFocused(true);
            if (focusedOpt.value.length < 2) { await interaction.respond([]); return; }
            try {
                const items = await getItemMapping();
                const results = searchItems(focusedOpt.value, items).slice(0, 25).map(i => ({ name: i.name, value: String(i.id) }));
                await interaction.respond(results);
            } catch {
                await interaction.respond([]);
            }
            return;
        }

        if (sub === 'removetradeablecomponent') {
            const focusedVal = interaction.options.getFocused().toLowerCase();
            const all = getAllTradeableParts();
            const matches = all
                .filter(r =>
                    r.ge_item_name.toLowerCase().includes(focusedVal) ||
                    r.parent_name.toLowerCase().includes(focusedVal),
                )
                .slice(0, 25)
                .map(r => ({ name: `${r.ge_item_name} [component of ${r.parent_name}]`, value: String(r.id) }));
            await interaction.respond(matches);
            return;
        }

        const focused = interaction.options.getFocused();

        if (sub === 'addcustomitem') {
            if (focused.length < 2) { await interaction.respond([]); return; }
            try {
                const customParents = searchCustomItems(focused)
                    .filter(i => i.parent_ref === null)
                    .slice(0, 10)
                    .map(i => {
                        const tag = i.category === 'pet' ? '[Pet]' : i.category === 'untradeable' ? '[Untradeable]' : '[Custom]';
                        return { name: `${i.name} [${tag}]`, value: `custom:${i.id}` };
                    });
                const customNames = new Set(customParents.map(c => c.name.split(' [')[0].toLowerCase()));
                const geItems = await getItemMapping();
                const geParents = searchItems(focused, geItems)
                    .filter(i => !customNames.has(i.name.toLowerCase()))
                    .slice(0, 25 - customParents.length)
                    .map(i => ({ name: i.name, value: `ge:${i.id}` }));
                await interaction.respond([...customParents, ...geParents]);
            } catch {
                await interaction.respond([]);
            }
            return;
        }

        if (sub === 'removecustomitem') {
            const items = getAllCustomItems();
            const lower = focused.toLowerCase();
            const matches = items.filter(i => i.name.toLowerCase().includes(lower)).slice(0, 25);
            await interaction.respond(matches.map(i => {
                const tag = i.parent_name ? ` [Part of ${i.parent_name}]`
                    : i.category === 'pet' ? ' [Pet]'
                    : i.category === 'untradeable' ? ' [Untradeable]'
                    : '';
                const pts = i.parent_name ? '' : i.points !== null ? ` (${i.points} pts)` : ' (category default)';
                return { name: `${i.name}${tag}${pts}`, value: String(i.id) };
            }));
            return;
        }

        if (sub === 'removeitempoints') {
            const lower = focused.toLowerCase();
            const overrides = getAllItemOverrides();
            const geMatches = overrides
                .filter(o => o.item_name.toLowerCase().includes(lower))
                .slice(0, 20)
                .map(o => ({ name: `${o.item_name} (${o.points} pts)`, value: String(o.item_id) }));
            const petMatches = getAllCustomItems()
                .filter(i => i.category === 'pet' && i.points !== null && i.name.toLowerCase().includes(lower))
                .slice(0, 25 - geMatches.length)
                .map(i => ({ name: `${i.name} [Pet] (${i.points} pts)`, value: `custom:${i.id}` }));
            await interaction.respond([...geMatches, ...petMatches]);
            return;
        }

        // setitempoints — search pets first, then GE items
        if (focused.length < 2) {
            await interaction.respond([]);
            return;
        }
        try {
            const petMatches = searchCustomItems(focused).filter(i => i.category === 'pet');
            const petNames = new Set(petMatches.map(i => i.name.toLowerCase()));
            const petChoices = petMatches.map(i => ({ name: `${i.name} [Pet]`, value: `custom:${i.id}` }));

            const remaining = 25 - petChoices.length;
            const items = await getItemMapping();
            const geChoices = searchItems(focused, items)
                .filter(i => !petNames.has(i.name.toLowerCase()))
                .slice(0, remaining)
                .map(item => ({ name: item.name, value: String(item.id) }));

            await interaction.respond([...petChoices, ...geChoices]);
        } catch {
            await interaction.respond([]);
        }
    },
};

async function handleEventPoints(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const mode = interaction.options.getString('mode', true) as 'add' | 'deduct';
    const points = interaction.options.getInteger('points', true);
    const reason = interaction.options.getString('reason', true);
    const delta = mode === 'add' ? points : -points;

    // Collect unique, non-null users
    const seen = new Set<string>();
    const users: { id: string; username: string }[] = [];
    for (let i = 1; i <= 10; i++) {
        const u = interaction.options.getUser(`user${i}`);
        if (u && !seen.has(u.id)) {
            seen.add(u.id);
            users.push({ id: u.id, username: u.username });
        }
    }

    const guild = interaction.guild;

    // Ensure all users exist in the DB, then apply delta
    const results: { userId: string; newTotal: number }[] = [];
    for (const u of users) {
        const member = guild ? await guild.members.fetch(u.id).catch(() => null) : null;
        upsertUser({ id: u.id, username: u.username } as any, member?.joinedTimestamp ?? Date.now());
        const newTotal = adjustUserPoints(u.id, delta, `event:${reason}`);
        results.push({ userId: u.id, newTotal });
    }

    // Check rank-ups for additions
    if (guild && mode === 'add') {
        for (const u of users) {
            await checkAndNotifyRankUp(guild, u.id);
        }
    }

    // Post notification to drop log channel
    const logChannel = await interaction.client.channels.fetch(config.dropLogChannelId).catch(() => null) as TextChannel | null;
    if (logChannel) {
        const recipientLines = results.map(r => `<@${r.userId}> — now **${r.newTotal}** pts`).join('\n');
        const embed = new EmbedBuilder()
            .setTitle(mode === 'add' ? 'Points Awarded' : 'Points Deducted')
            .setColor(mode === 'add' ? 0x00CC66 : 0xFF4444)
            .setDescription(`**Reason:** ${reason}`)
            .addFields(
                { name: 'Awarded by', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Points', value: `${mode === 'add' ? '+' : '-'}${points} each`, inline: true },
                { name: 'Recipients', value: recipientLines },
            )
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }

    await interaction.editReply(
        `${mode === 'add' ? 'Awarded' : 'Deducted'} **${points}** pts ${mode === 'add' ? 'to' : 'from'} ` +
        `${users.length} member(s) for: ${reason}.`,
    );
}

async function handleSetPoints(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('user', true);
    const points = interaction.options.getInteger('points', true);
    const guild = interaction.guild;

    let existing = getUserById(target.id);
    if (!existing) {
        const member = guild ? await guild.members.fetch(target.id).catch(() => null) : null;
        upsertUser(target, member?.joinedTimestamp ?? Date.now());
    }

    setUserPoints(target.id, points);
    if (guild) await checkAndNotifyRankUp(guild, target.id);

    await interaction.editReply(`Set <@${target.id}>'s points to **${points}**.`);
}

async function handleSetRank(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('rank', true);
    const guild = interaction.guild;

    const tier = getRankTierByRoleId(role.id);
    if (!tier) {
        await interaction.editReply(`<@&${role.id}> is not a configured rank tier. Use \`/admin addrank\` first.`);
        return;
    }

    if (guild) await forceSetRank(guild, target.id, role.id);
    await interaction.editReply(`Assigned **${tier.name}** to <@${target.id}>.`);
}

async function handleAddRank(interaction: ChatInputCommandInteraction): Promise<void> {
    const role = interaction.options.getRole('role', true);
    const name = interaction.options.getString('name', true);
    const minPoints = interaction.options.getInteger('min_points', true);
    const minDays = interaction.options.getInteger('min_days') ?? 0;

    insertRankTier(role.id, name, minPoints, minDays);

    await interaction.reply({
        content: `Rank tier **${name}** saved: <@&${role.id}> — ${minPoints} pts required, ${minDays} day(s) minimum.`,
        flags: MessageFlags.Ephemeral,
    });
}

async function handleRemoveRank(interaction: ChatInputCommandInteraction): Promise<void> {
    const role = interaction.options.getRole('role', true);
    const removed = deleteRankTier(role.id);

    await interaction.reply({
        content: removed
            ? `Rank tier for <@&${role.id}> has been removed.`
            : `No rank tier found for <@&${role.id}>.`,
        flags: MessageFlags.Ephemeral,
    });
}

async function handleListRanks(interaction: ChatInputCommandInteraction): Promise<void> {
    const tiers = getAllRankTiers();

    if (tiers.length === 0) {
        await interaction.reply({ content: 'No rank tiers configured yet. Use `/admin addrank` to add one.', flags: MessageFlags.Ephemeral });
        return;
    }

    const lines = tiers.map(t =>
        `<@&${t.role_id}> **${t.name}** — ${t.min_points} pts` + (t.min_days > 0 ? `, ${t.min_days}d in server` : ''),
    );

    const embed = new EmbedBuilder()
        .setTitle('Configured Rank Tiers')
        .setColor(0x00AAFF)
        .setDescription(lines.join('\n'))
        .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleSetItemPoints(interaction: ChatInputCommandInteraction): Promise<void> {
    const itemValue = interaction.options.getString('item', true);
    const points = interaction.options.getInteger('points', true);

    if (itemValue.startsWith('custom:')) {
        const customId = parseInt(itemValue.split(':')[1], 10);
        if (isNaN(customId)) {
            await interaction.reply({ content: 'Please select an item from the autocomplete list.', flags: MessageFlags.Ephemeral });
            return;
        }
        const customItem = getCustomItem(customId);
        if (!customItem) {
            await interaction.reply({ content: 'That item no longer exists.', flags: MessageFlags.Ephemeral });
            return;
        }
        upsertCustomItem(customItem.name, customItem.category, points);
        await interaction.reply({
            content: `**${customItem.name}** [Pet] will now always award **${points}** point(s) (split between team members).`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const itemId = parseInt(itemValue, 10);
    if (isNaN(itemId)) {
        await interaction.reply({ content: 'Please select an item from the autocomplete list.', flags: MessageFlags.Ephemeral });
        return;
    }

    const items = await getItemMapping().catch(() => []);
    const itemData = findItemById(itemId, items);
    const itemName = itemData?.name ?? `Unknown Item (ID: ${itemId})`;

    setItemOverride(itemId, itemName, points);

    await interaction.reply({
        content: `**${itemName}** will now always award **${points}** point(s) (split between team members).`,
        flags: MessageFlags.Ephemeral,
    });
}

async function handleRemoveItemPoints(interaction: ChatInputCommandInteraction): Promise<void> {
    const itemValue = interaction.options.getString('item', true);

    if (itemValue.startsWith('custom:')) {
        const customId = parseInt(itemValue.split(':')[1], 10);
        if (isNaN(customId)) {
            await interaction.reply({ content: 'Please select an item from the autocomplete list.', flags: MessageFlags.Ephemeral });
            return;
        }
        const customItem = getCustomItem(customId);
        if (!customItem) {
            await interaction.reply({ content: 'That item no longer exists.', flags: MessageFlags.Ephemeral });
            return;
        }
        upsertCustomItem(customItem.name, customItem.category, null);
        await interaction.reply({
            content: `Removed points override for **${customItem.name}**. It will now use the Pet default.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const itemId = parseInt(itemValue, 10);
    if (isNaN(itemId)) {
        await interaction.reply({ content: 'Please select an item from the autocomplete list.', flags: MessageFlags.Ephemeral });
        return;
    }

    const override = getItemOverride(itemId);
    const removed = removeItemOverride(itemId);

    await interaction.reply({
        content: removed
            ? `Removed points override for **${override?.item_name ?? itemId}**. It will now use the live price.`
            : `No override found for that item.`,
        flags: MessageFlags.Ephemeral,
    });
}

async function handleListItemPoints(interaction: ChatInputCommandInteraction): Promise<void> {
    const overrides = getAllItemOverrides();

    if (overrides.length === 0) {
        await interaction.reply({ content: 'No item overrides configured yet. Use `/admin setitempoints` to add one.', flags: MessageFlags.Ephemeral });
        return;
    }

    const lines = overrides.map(o => `**${o.item_name}** — ${o.points} pts`);

    const embed = new EmbedBuilder()
        .setTitle('Item Points Overrides')
        .setColor(0x00AAFF)
        .setDescription(lines.join('\n'))
        .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleAddCustomItem(interaction: ChatInputCommandInteraction): Promise<void> {
    const name = interaction.options.getString('name', true).trim();
    const category = (interaction.options.getString('category') ?? null) as CustomItemCategory | null;
    const points = interaction.options.getInteger('points') ?? null;
    const parentStr = interaction.options.getString('is_component_of');

    let parentRef: string | undefined;
    let parentName: string | undefined;

    if (parentStr !== null) {
        if (parentStr.startsWith('ge:')) {
            const geId = parseInt(parentStr.split(':')[1], 10);
            if (isNaN(geId)) {
                await interaction.reply({ content: 'Please select a parent item from the autocomplete list.', flags: MessageFlags.Ephemeral });
                return;
            }
            const geItems = await getItemMapping().catch(() => []);
            const itemData = findItemById(geId, geItems);
            if (!itemData) {
                await interaction.reply({ content: 'Could not find that item. Please select from the autocomplete list.', flags: MessageFlags.Ephemeral });
                return;
            }
            parentRef = parentStr;
            parentName = itemData.name;
        } else if (parentStr.startsWith('custom:')) {
            const customId = parseInt(parentStr.split(':')[1], 10);
            if (isNaN(customId)) {
                await interaction.reply({ content: 'Please select a parent item from the autocomplete list.', flags: MessageFlags.Ephemeral });
                return;
            }
            const parentItem = getCustomItem(customId);
            if (!parentItem) {
                await interaction.reply({ content: 'That custom item no longer exists.', flags: MessageFlags.Ephemeral });
                return;
            }
            parentRef = parentStr;
            parentName = parentItem.name;
        } else {
            await interaction.reply({ content: 'Please select a parent item from the autocomplete list.', flags: MessageFlags.Ephemeral });
            return;
        }
    }

    const finalCategory = category ?? (parentRef !== undefined ? 'untradeable' : null);
    const saved = upsertCustomItem(name, finalCategory, points, parentRef ?? null, parentName ?? null);

    const tagStr = saved.parent_name ? ` [Part of ${saved.parent_name}]`
        : finalCategory === 'pet' ? ' [Pet]'
        : finalCategory === 'untradeable' ? ' [Untradeable]'
        : '';

    let msg: string;
    if (saved.parent_name && saved.parent_ref) {
        const partCount = getPartCountForParent(saved.parent_ref);
        // Look up parent points for display
        let parentPts: number | null = null;
        if (saved.parent_ref.startsWith('ge:')) {
            parentPts = getItemOverride(parseInt(saved.parent_ref.split(':')[1], 10))?.points ?? null;
        } else if (saved.parent_ref.startsWith('custom:')) {
            parentPts = getCustomItem(parseInt(saved.parent_ref.split(':')[1], 10))?.points ?? null;
        }
        const perPart = parentPts !== null ? Math.floor(parentPts / partCount) : null;
        const ptsInfo = perPart !== null ? ` (${partCount} part(s) total → **${perPart}** pts each)` : '';
        msg = `Saved **${name}**${tagStr}${ptsInfo}.`;
    } else if (points !== null) {
        msg = `Saved **${name}**${tagStr} with a fixed **${points}** pts.`;
    } else {
        msg = `Saved **${name}**${tagStr}. No points configured — set explicit points via \`/admin addcustomitem name:${name} points:<value>\`.`;
    }

    await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
}

async function handleRemoveCustomItem(interaction: ChatInputCommandInteraction): Promise<void> {
    const idStr = interaction.options.getString('item', true);
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
        await interaction.reply({ content: 'Please select an item from the autocomplete list.', flags: MessageFlags.Ephemeral });
        return;
    }

    const removed = removeCustomItem(id);
    await interaction.reply({
        content: removed
            ? `Removed **${removed.name}** from the custom items list.`
            : 'No custom item found with that ID.',
        flags: MessageFlags.Ephemeral,
    });
}

async function handleSetCategoryPoints(interaction: ChatInputCommandInteraction): Promise<void> {
    const category = interaction.options.getString('category', true);
    const points = interaction.options.getInteger('points', true);
    setConfig(`category_points_${category}`, String(points));
    const label = category === 'pet' ? 'Pet' : category;
    await interaction.reply({
        content: `Default points for **${label}** category set to **${points}** pts (applied to any pet without an individual override).`,
        flags: MessageFlags.Ephemeral,
    });
}

function addChunkedFields(embed: EmbedBuilder, heading: string, lines: string[]): void {
    const chunks: string[] = [];
    let current = '';
    for (const line of lines) {
        const appended = current ? `${current}\n${line}` : line;
        if (appended.length > 1024) {
            chunks.push(current);
            current = line;
        } else {
            current = appended;
        }
    }
    if (current) chunks.push(current);

    chunks.forEach((chunk, i) => {
        embed.addFields({ name: i === 0 ? heading : `${heading} (cont.)`, value: chunk });
    });
}

async function handleListCustomItems(interaction: ChatInputCommandInteraction): Promise<void> {
    const items = getAllCustomItems();

    const embed = new EmbedBuilder()
        .setTitle('Custom Items')
        .setColor(0x00AAFF)
        .setTimestamp();

    if (items.length === 0) {
        embed.setDescription('No custom items added yet. Use `/admin addcustomitem` to add untradeables.');
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const petDefault = getConfig('category_points_pet');
    const pets = items.filter(i => i.category === 'pet' && i.parent_ref === null);
    const untradeables = items.filter(i => i.category === 'untradeable' && i.parent_ref === null);
    const other = items.filter(i => !i.category && i.parent_ref === null);
    const parts = items.filter(i => i.parent_ref !== null);

    if (pets.length > 0) {
        const defaultStr = petDefault ? `Default: **${petDefault} pts**` : 'No default set — use `/admin setcategorypoints`';
        const lines = [defaultStr, ...pets.map(i => `• ${i.name} — ${i.points !== null ? `${i.points} pts` : 'uses default'}`)];
        addChunkedFields(embed, 'Pets', lines);
    }

    if (untradeables.length > 0) {
        const lines = untradeables.map(i => `• ${i.name} — ${i.points !== null ? `${i.points} pts` : 'no pts set'}`);
        addChunkedFields(embed, 'Untradeables', lines);
    }

    if (parts.length > 0) {
        // Group by parent_name for display
        const grouped = new Map<string, { ref: string; names: string[] }>();
        for (const p of parts) {
            const key = p.parent_name ?? 'Unknown';
            if (!grouped.has(key)) grouped.set(key, { ref: p.parent_ref!, names: [] });
            grouped.get(key)!.names.push(p.name);
        }
        for (const [parentDisplayName, { ref, names }] of grouped) {
            let parentPts: number | null = null;
            if (ref.startsWith('ge:')) {
                parentPts = getItemOverride(parseInt(ref.split(':')[1], 10))?.points ?? null;
            } else if (ref.startsWith('custom:')) {
                parentPts = getCustomItem(parseInt(ref.split(':')[1], 10))?.points ?? null;
            }
            const tradeableComponents = ref.startsWith('ge:') ? getTradeablePartsForParent(ref) : [];
            const perPart = parentPts !== null ? Math.floor(parentPts / names.length) : null;
            const tradeableStr = tradeableComponents.length > 0 ? `, ${tradeableComponents.length} tradeable component(s)` : '';
            const heading = perPart !== null
                ? `Parts of ${parentDisplayName} (${names.length} untradeable${tradeableStr}, ${perPart} pts each)`
                : `Parts of ${parentDisplayName} (${names.length} untradeable${tradeableStr}, pts from GE formula)`;
            const lines = [
                ...names.map(n => `• ${n}`),
                ...tradeableComponents.map(tc => `• ${tc.ge_item_name} [tradeable GE component]`),
            ];
            addChunkedFields(embed, heading, lines);
        }
    }

    if (other.length > 0) {
        const lines = other.map(i => `• ${i.name} — ${i.points !== null ? `${i.points} pts` : 'no pts set'}`);
        addChunkedFields(embed, 'Other', lines);
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleAddTradeableComponent(interaction: ChatInputCommandInteraction): Promise<void> {
    const parentStr = interaction.options.getString('parent', true);
    const componentStr = interaction.options.getString('component', true);

    const parentId = parseInt(parentStr, 10);
    const componentId = parseInt(componentStr, 10);
    if (isNaN(parentId) || isNaN(componentId)) {
        await interaction.reply({ content: 'Please select items from the autocomplete list.', flags: MessageFlags.Ephemeral });
        return;
    }

    const items = await getItemMapping().catch(() => []);
    const parentData = findItemById(parentId, items);
    const componentData = findItemById(componentId, items);

    if (!parentData || !componentData) {
        await interaction.reply({ content: 'Could not find one or both items. Please select from the autocomplete list.', flags: MessageFlags.Ephemeral });
        return;
    }

    addTradeablePart(`ge:${parentId}`, parentData.name, componentId, componentData.name);

    await interaction.reply({
        content: `**${componentData.name}** registered as a tradeable component of **${parentData.name}**. Its GE price will be subtracted when calculating untradeable part values.`,
        flags: MessageFlags.Ephemeral,
    });
}

async function handleRemoveTradeableComponent(interaction: ChatInputCommandInteraction): Promise<void> {
    const idStr = interaction.options.getString('entry', true);
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
        await interaction.reply({ content: 'Please select an entry from the autocomplete list.', flags: MessageFlags.Ephemeral });
        return;
    }

    const removed = removeTradeablePart(id);
    await interaction.reply({
        content: removed
            ? `Removed **${removed.ge_item_name}** as a tradeable component of **${removed.parent_name}**.`
            : 'No entry found with that ID.',
        flags: MessageFlags.Ephemeral,
    });
}

async function handleRemoveDrops(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('user', true);
    const drops = getAcceptedDropsForUser(target.id, 25);

    if (drops.length === 0) {
        await interaction.editReply(`<@${target.id}> has no accepted drops to remove.`);
        return;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_drop_remove:${target.id}`)
        .setPlaceholder('Select a drop to remove...')
        .addOptions(
            drops.map(d => {
                const date = new Date(d.submitted_at).toLocaleDateString('en-GB');
                const gpDisplay = d.gp_value > 0 ? `${Math.round(d.gp_value / 1_000_000)}m` : 'override';
                return new StringSelectMenuOptionBuilder()
                    .setLabel(`${d.item_name} — ${d.awarded_points} pts each`)
                    .setDescription(`${gpDisplay} • Submitted ${date} • Drop #${d.id}`)
                    .setValue(String(d.id));
            }),
        );

    const embed = new EmbedBuilder()
        .setTitle(`Drops for ${target.username}`)
        .setColor(0xFF4444)
        .setDescription(`Showing last ${drops.length} accepted drop(s). Select one to remove it and deduct its points.`)
        .setTimestamp();

    await interaction.editReply({
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
    });
}
