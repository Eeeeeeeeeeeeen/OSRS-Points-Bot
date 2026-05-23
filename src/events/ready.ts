import { Client, Events } from 'discord.js';
import { getItemMapping } from '../services/osrsApi';

export function registerReadyEvent(client: Client): void {
    client.once(Events.ClientReady, async (c) => {
        console.log(`Logged in as ${c.user.tag}`);
        try {
            const items = await getItemMapping();
            console.log(`Item cache warmed: ${items.length} items loaded`);
        } catch (err) {
            console.error('Failed to warm item cache:', err);
        }
    });
}
