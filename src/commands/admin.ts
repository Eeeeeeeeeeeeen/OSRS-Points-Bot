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
} from 'discord.js';
import { Command } from '../types/command';
import { getUserById, setUserPoints, adjustUserPoints, upsertUser } from '../database/queries/users';
import { getAllRankTiers, insertRankTier, deleteRankTier, getRankTierByRoleId } from '../database/queries/ranks';
import { getItemOverride, setItemOverride, removeItemOverride, getAllItemOverrides } from '../database/queries/itemOverrides';
import { getAllCustomItems, getCustomItem, upsertCustomItem, removeCustomItem, CustomItemCategory } from '../database/queries/customItems';
import { getConfig, setConfig } from '../database/queries/botConfig';
import { getAcceptedDropsForUser } from '../database/queries/drops';
import { getItemMapping, searchItems, findItemById } from '../services/osrsApi';
import { checkAndNotifyRankUp, forceSetRank } from '../services/rankService';
import { config } from '../config';
import { hasAdminRole } from '../utils/permissions';

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
                .setDescription('List all custom items and category defaults'),
        )
        .addSubcommand(sub =>
            sub.setName('setcategorypoints')
                .setDescription('Set the default points awarded for a category of custom items (e.g. all pets)')
                .addStringOption(opt =>
                    opt.setName('category')
                        .setDescription('Category to configure')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Pet', value: 'pet' },
                        ),
                )
                .addIntegerOption(opt =>
                    opt.setName('points')
                        .setDescription('Default pts to award for this category (total, before team split)')
                        .setRequired(true)
                        .setMinValue(1),
                ),
        ) as SlashCommandBuilder,

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!hasAdminRole(interaction)) {
            await interaction.reply({ content: 'You do not have permission to use admin commands.', flags: MessageFlags.Ephemeral });
            return;
        }

        const sub = interaction.options.getSubcommand();

        switch (sub) {
            case 'eventpoints':     await handleEventPoints(interaction);    break;
            case 'setpoints':       await handleSetPoints(interaction);      break;
            case 'setrank':         await handleSetRank(interaction);        break;
            case 'addrank':         await handleAddRank(interaction);        break;
            case 'removerank':      await handleRemoveRank(interaction);     break;
            case 'listranks':       await handleListRanks(interaction);      break;
            case 'setitempoints':    await handleSetItemPoints(interaction);    break;
            case 'removeitempoints': await handleRemoveItemPoints(interaction); break;
            case 'listitempoints':   await handleListItemPoints(interaction);   break;
            case 'removedrops':      await handleRemoveDrops(interaction);      break;
            case 'addcustomitem':    await handleAddCustomItem(interaction);    break;
            case 'removecustomitem': await handleRemoveCustomItem(interaction); break;
            case 'listcustomitems':  await handleListCustomItems(interaction);  break;
            case 'setcategorypoints': await handleSetCategoryPoints(interaction); break;
        }
    },

    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const sub = interaction.options.getSubcommand();
        if (sub !== 'setitempoints' && sub !== 'removeitempoints' && sub !== 'removecustomitem') return;

        const focused = interaction.options.getFocused();

        if (sub === 'removecustomitem') {
            const items = getAllCustomItems();
            const lower = focused.toLowerCase();
            const matches = items.filter(i => i.name.toLowerCase().includes(lower)).slice(0, 25);
            await interaction.respond(matches.map(i => {
                const tag = i.category === 'pet' ? ' [Pet]' : i.category === 'untradeable' ? ' [Untradeable]' : '';
                const pts = i.points !== null ? ` (${i.points} pts)` : ' (category default)';
                return { name: `${i.name}${tag}${pts}`, value: String(i.id) };
            }));
            return;
        }

        if (sub === 'removeitempoints') {
            const overrides = getAllItemOverrides();
            const lower = focused.toLowerCase();
            const matches = overrides.filter(o => o.item_name.toLowerCase().includes(lower)).slice(0, 25);
            await interaction.respond(matches.map(o => ({ name: `${o.item_name} (${o.points} pts)`, value: String(o.item_id) })));
            return;
        }

        // setitempoints — search all OSRS items
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
    const itemIdStr = interaction.options.getString('item', true);
    const itemId = parseInt(itemIdStr, 10);
    const points = interaction.options.getInteger('points', true);

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
    const itemIdStr = interaction.options.getString('item', true);
    const itemId = parseInt(itemIdStr, 10);

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

    upsertCustomItem(name, category, points);

    const categoryLabel = category === 'pet' ? 'Pet' : category === 'untradeable' ? 'Untradeable' : null;
    const tagStr = categoryLabel ? ` [${categoryLabel}]` : '';

    let msg: string;
    if (points !== null) {
        msg = `Saved **${name}**${tagStr} with a fixed **${points}** pts.`;
    } else if (category === 'pet') {
        const defaultVal = getConfig('category_points_pet');
        msg = defaultVal
            ? `Saved **${name}** [Pet]. It will use the Pet default of **${defaultVal}** pts when submitted.`
            : `Saved **${name}** [Pet]. No Pet default is configured yet — use \`/admin setcategorypoints\` to set one.`;
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

async function handleListCustomItems(interaction: ChatInputCommandInteraction): Promise<void> {
    const items = getAllCustomItems();
    const petDefault = getConfig('category_points_pet');

    const embed = new EmbedBuilder()
        .setTitle('Custom Items')
        .setColor(0x00AAFF)
        .setTimestamp();

    embed.addFields({ name: 'Pet Default', value: petDefault ? `**${petDefault} pts**` : 'not set — use `/admin setcategorypoints`' });

    if (items.length === 0) {
        embed.setDescription('No custom items added yet. Use `/admin addcustomitem` to add pets and untradeables.');
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const pets = items.filter(i => i.category === 'pet');
    const untradeables = items.filter(i => i.category === 'untradeable');
    const other = items.filter(i => !i.category);

    if (pets.length > 0) {
        const lines = pets.map(i => {
            const pts = i.points !== null
                ? `${i.points} pts (fixed)`
                : petDefault ? `${petDefault} pts (default)` : 'no pts set';
            return `• ${i.name} — ${pts}`;
        });
        embed.addFields({ name: 'Pets', value: lines.join('\n') });
    }

    if (untradeables.length > 0) {
        const lines = untradeables.map(i => {
            const pts = i.points !== null ? `${i.points} pts` : 'no pts set';
            return `• ${i.name} — ${pts}`;
        });
        embed.addFields({ name: 'Untradeables', value: lines.join('\n') });
    }

    if (other.length > 0) {
        const lines = other.map(i => `• ${i.name} — ${i.points !== null ? `${i.points} pts` : 'no pts set'}`);
        embed.addFields({ name: 'Other', value: lines.join('\n') });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleSetCategoryPoints(interaction: ChatInputCommandInteraction): Promise<void> {
    const category = interaction.options.getString('category', true) as CustomItemCategory;
    const points = interaction.options.getInteger('points', true);
    const label = category === 'pet' ? 'Pet' : 'Untradeable';

    setConfig(`category_points_${category}`, String(points));

    await interaction.reply({
        content: `Set **${label}** default to **${points}** pts. Items in this category without fixed points will award **${points}** pts total when submitted.`,
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
