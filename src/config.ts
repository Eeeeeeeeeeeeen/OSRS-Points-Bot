import 'dotenv/config';

function required(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required environment variable: ${key}`);
    return val;
}

export const config = {
    discordToken:          required('DISCORD_TOKEN'),
    clientId:              required('CLIENT_ID'),
    guildId:               required('GUILD_ID'),
    clanRoleId:            required('CLAN_ROLE_ID'),
    staffReviewChannelId:  required('STAFF_REVIEW_CHANNEL_ID'),
    dropLogChannelId:      required('DROP_LOG_CHANNEL_ID'),
    rankUpChannelId:       required('RANK_UP_CHANNEL_ID'),
    dbPath:                process.env.DB_PATH ?? './data/clan.db',
} as const;
