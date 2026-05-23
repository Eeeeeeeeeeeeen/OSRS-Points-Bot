import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandList } from './commands';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
    console.error('Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in .env');
    process.exit(1);
}

const rest = new REST().setToken(token);

(async () => {
    console.log(`Deploying ${commandList.length} slash command(s)...`);
    await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandList.map(cmd => cmd.data.toJSON()) },
    );
    console.log('Commands deployed successfully.');
})().catch(err => {
    console.error('Failed to deploy commands:', err);
    process.exit(1);
});
