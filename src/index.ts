import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config';
import { getDb } from './database/db';
import { loadCommands } from './commands';
import { registerReadyEvent } from './events/ready';
import { registerInteractionCreate } from './events/interactionCreate';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ],
});

const commands = loadCommands();

registerReadyEvent(client);
registerInteractionCreate(client, commands);

getDb(); // initialise DB and run migrations eagerly

client.login(config.discordToken).catch(err => {
    console.error('Failed to log in:', err);
    process.exit(1);
});
