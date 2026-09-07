import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
} from 'discord.js';
import axios from 'axios';
import { Command } from '../types/command';
import {
    createGame,
    getCurrentGame,
    getLatestGame,
    getTeams,
    addTeam,
    startGame,
    endGame,
    setBoardImage,
} from '../database/queries/snl';
import { parseBoard, loadBoard } from '../services/snlBoard';
import { rollAndAdvance, forceMove } from '../services/snlService';
import { buildStatusEmbed, buildBoardPage } from '../embeds/snlEmbed';
import { hasAdminRole } from '../utils/permissions';

const MAX_BOARD_BYTES = 256 * 1024;

export const snl: Command = {
    data: new SlashCommandBuilder()
        .setName('snl')
        .setDescription('Snakes & Ladders clan game')
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Create a game from a board JSON file (admin only)')
                .addAttachmentOption(opt =>
                    opt.setName('board').setDescription('Board definition (.json)').setRequired(true),
                )
                .addRoleOption(opt =>
                    opt.setName('team1_role').setDescription('Discord role for team 1').setRequired(true),
                )
                .addRoleOption(opt =>
                    opt.setName('team2_role').setDescription('Discord role for team 2').setRequired(true),
                )
                .addStringOption(opt =>
                    opt.setName('team1_name').setDescription('Display name for team 1 (defaults to the role name)').setRequired(false),
                )
                .addStringOption(opt =>
                    opt.setName('team2_name').setDescription('Display name for team 2 (defaults to the role name)').setRequired(false),
                )
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel for game announcements (defaults to this channel)')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false),
                )
                .addStringOption(opt =>
                    opt.setName('image')
                        .setDescription('Link to a picture of the board (https://…)')
                        .setRequired(false),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('setimage')
                .setDescription('Set or clear the board picture for the current game (admin only)')
                .addStringOption(opt =>
                    opt.setName('image')
                        .setDescription('Link to a picture of the board — leave empty to remove it')
                        .setRequired(false),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Start the configured game and give both teams their first roll (admin only)'),
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Show where each team is and what they need'),
        )
        .addSubcommand(sub =>
            sub.setName('board')
                .setDescription('Show the board: squares, snakes and ladders'),
        )
        .addSubcommand(sub =>
            sub.setName('move')
                .setDescription('Manually move a team to a square (admin only)')
                .addRoleOption(opt =>
                    opt.setName('team').setDescription('The team role to move').setRequired(true),
                )
                .addIntegerOption(opt =>
                    opt.setName('square').setDescription('Square to move them to').setRequired(true).setMinValue(0),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('end')
                .setDescription('End and reset the current game (admin only)'),
        ) as SlashCommandBuilder,

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        switch (interaction.options.getSubcommand()) {
            case 'setup':  await handleSetup(interaction);  break;
            case 'start':  await handleStart(interaction);  break;
            case 'status': await handleStatus(interaction); break;
            case 'board':  await handleBoard(interaction);  break;
            case 'move':   await handleMove(interaction);   break;
            case 'end':    await handleEnd(interaction);    break;
            case 'setimage': await handleSetImage(interaction); break;
        }
    },
};

// Discord's own CDN signs attachment links with an expiry, so one pasted here will stop
// loading part-way through a game. Allowed, but the admin is told.
const EXPIRING_HOSTS = ['cdn.discordapp.com', 'media.discordapp.net'];

type UrlCheck =
    | { ok: true; url: string; warning?: string }
    | { ok: false; error: string };

function validateImageUrl(raw: string): UrlCheck {
    const trimmed = raw.trim();

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return { ok: false, error: 'That is not a valid link. It should start with `https://`.' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, error: 'The board image link must be an `http://` or `https://` URL.' };
    }

    const warning = EXPIRING_HOSTS.includes(parsed.hostname)
        ? 'That is a Discord attachment link — those expire after a while and the image will ' +
          'stop showing. Host it somewhere permanent (e.g. Imgur) and re-run `/snl setimage`.'
        : undefined;

    return { ok: true, url: trimmed, warning };
}

async function denyIfNotAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (hasAdminRole(interaction)) return false;
    await interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
    });
    return true;
}

async function handleSetup(interaction: ChatInputCommandInteraction): Promise<void> {
    if (await denyIfNotAdmin(interaction)) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
        await interaction.editReply('This command can only be used in a server.');
        return;
    }

    const existing = getCurrentGame();
    if (existing) {
        await interaction.editReply(
            `A game is already ${existing.status === 'active' ? 'in progress' : 'set up'}. Run \`/snl end\` first.`,
        );
        return;
    }

    const attachment = interaction.options.getAttachment('board', true);
    if (attachment.size > MAX_BOARD_BYTES) {
        await interaction.editReply(`That file is too large (max ${MAX_BOARD_BYTES / 1024}KB).`);
        return;
    }

    let raw: string;
    try {
        const response = await axios.get<string>(attachment.url, {
            timeout: 10000,
            responseType: 'text',
            transformResponse: r => r, // keep the raw text so we control JSON parsing
        });
        raw = response.data;
    } catch {
        await interaction.editReply('Could not download the attached file. Please try again.');
        return;
    }

    const result = await parseBoard(raw);
    if (!result.ok) {
        const shown = result.errors.slice(0, 15).map(e => `• ${e}`).join('\n');
        const more = result.errors.length > 15 ? `\n…and ${result.errors.length - 15} more.` : '';
        await interaction.editReply(`**The board file has problems — nothing was saved:**\n${shown}${more}`);
        return;
    }

    const board = result.board;
    const team1Role = interaction.options.getRole('team1_role', true);
    const team2Role = interaction.options.getRole('team2_role', true);

    if (team1Role.id === team2Role.id) {
        await interaction.editReply('Both teams cannot use the same role.');
        return;
    }

    const channelId = interaction.options.getChannel('channel')?.id ?? interaction.channelId;
    if (!channelId) {
        await interaction.editReply('Could not resolve an announcement channel. Pass one with the `channel` option.');
        return;
    }

    let imageUrl: string | null = null;
    let imageWarning: string | undefined;
    const rawImage = interaction.options.getString('image');
    if (rawImage) {
        const check = validateImageUrl(rawImage);
        if (!check.ok) {
            await interaction.editReply(`${check.error} Nothing was saved.`);
            return;
        }
        imageUrl = check.url;
        imageWarning = check.warning;
    }

    const game = createGame({
        boardJson: JSON.stringify(board),
        boardImageUrl: imageUrl,
        finalSquare: board.finalSquare,
        announceChannelId: channelId,
        startedBy: interaction.user.id,
    });

    addTeam(game.id, interaction.options.getString('team1_name') ?? team1Role.name, team1Role.id);
    addTeam(game.id, interaction.options.getString('team2_name') ?? team2Role.name, team2Role.id);

    await interaction.editReply(
        `**${board.name}** is ready.\n` +
        `• Final square: **${board.finalSquare}**\n` +
        `• Item squares: **${board.squares.length}**\n` +
        `• Ladders: **${board.ladders.length}** · Snakes: **${board.snakes.length}**\n` +
        `• Overshooting the end: **${board.overshoot === 'win' ? 'wins' : 'bounces back'}**\n` +
        `• Announcements go to <#${channelId}>\n` +
        `• Board picture: ${imageUrl ? `[set](${imageUrl})` : 'none — add one with `/snl setimage`'}\n\n` +
        (imageWarning ? `⚠️ ${imageWarning}\n\n` : '') +
        'Run `/snl start` to roll both teams onto the board.',
    );
}

async function handleSetImage(interaction: ChatInputCommandInteraction): Promise<void> {
    if (await denyIfNotAdmin(interaction)) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const game = getCurrentGame();
    if (!game) {
        await interaction.editReply('There is no game set up. Run `/snl setup` first.');
        return;
    }

    const rawImage = interaction.options.getString('image');
    if (!rawImage) {
        setBoardImage(game.id, null);
        await interaction.editReply('Board picture removed.');
        return;
    }

    const check = validateImageUrl(rawImage);
    if (!check.ok) {
        await interaction.editReply(`${check.error} The board picture was left unchanged.`);
        return;
    }

    setBoardImage(game.id, check.url);
    await interaction.editReply(
        `Board picture updated — [have a look](${check.url}). It shows in \`/snl status\`.` +
        (check.warning ? `\n\n⚠️ ${check.warning}` : ''),
    );
}

async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
    if (await denyIfNotAdmin(interaction)) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const game = getCurrentGame();
    if (!game) {
        await interaction.editReply('There is no game set up. Run `/snl setup` first.');
        return;
    }
    if (game.status === 'active') {
        await interaction.editReply('That game is already running.');
        return;
    }

    const teams = getTeams(game.id);
    if (teams.length === 0) {
        await interaction.editReply('That game has no teams configured. Run `/snl end` and set it up again.');
        return;
    }

    startGame(game.id);
    const started = { ...game, status: 'active' as const, started_at: Date.now() };
    const board = loadBoard(game.board_json);

    for (const team of teams) {
        // A very short board can be won on the opening roll — stop rolling once that happens.
        const current = getCurrentGame();
        if (!current || current.status !== 'active') break;
        await rollAndAdvance(interaction.client, started, team, board);
    }

    await interaction.editReply('Game started — both teams have their opening roll.');
}

async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const game = getCurrentGame() ?? getLatestGame();
    if (!game) {
        await interaction.editReply('No Snakes & Ladders game has been set up yet.');
        return;
    }

    const board = loadBoard(game.board_json);
    await interaction.editReply({ embeds: [buildStatusEmbed(game, getTeams(game.id), board)] });
}

async function handleBoard(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const game = getCurrentGame() ?? getLatestGame();
    if (!game) {
        await interaction.editReply('No Snakes & Ladders game has been set up yet.');
        return;
    }

    const { embed, row } = buildBoardPage(game, loadBoard(game.board_json), 1);
    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleMove(interaction: ChatInputCommandInteraction): Promise<void> {
    if (await denyIfNotAdmin(interaction)) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const game = getCurrentGame();
    if (!game || game.status !== 'active') {
        await interaction.editReply('There is no game in progress.');
        return;
    }

    const role = interaction.options.getRole('team', true);
    const team = getTeams(game.id).find(t => t.role_id === role.id);
    if (!team) {
        await interaction.editReply(`<@&${role.id}> is not one of the teams in this game.`);
        return;
    }

    const square = interaction.options.getInteger('square', true);
    const board = loadBoard(game.board_json);
    if (square > board.finalSquare) {
        await interaction.editReply(`The board only runs to square ${board.finalSquare}.`);
        return;
    }

    await forceMove(interaction.client, game, team, board, square);
    await interaction.editReply(`Moved **${team.name}** to square **${square}**.`);
}

async function handleEnd(interaction: ChatInputCommandInteraction): Promise<void> {
    if (await denyIfNotAdmin(interaction)) return;

    const game = getCurrentGame();
    if (!game) {
        await interaction.reply({
            content: 'There is no game to end.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const board = loadBoard(game.board_json);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`snl_confirm_end:${game.id}`)
            .setLabel('End game')
            .setEmoji('🛑')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('snl_cancel_end')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
        content:
            `End **${board.name}** and clear the board? Team positions and progress will stop counting, ` +
            'and a new game can be set up. This cannot be undone.',
        components: [row],
        flags: MessageFlags.Ephemeral,
    });
}

// Exported for the confirmation button handler.
export function endCurrentGame(gameId: number): boolean {
    const game = getCurrentGame();
    if (!game || game.id !== gameId) return false;
    endGame(gameId, 'cancelled');
    return true;
}
