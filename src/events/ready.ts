import { Client, Events } from 'discord.js';
import { getItemMapping, fetchPetNames } from '../services/osrsApi';
import { insertCustomItemIfNew } from '../database/queries/customItems';

export function registerReadyEvent(client: Client): void {
    client.once(Events.ClientReady, async (c) => {
        console.log(`Logged in as ${c.user.tag}`);

        try {
            const items = await getItemMapping();
            console.log(`Item cache warmed: ${items.length} items loaded`);
        } catch (err) {
            console.error('Failed to warm item cache:', err);
        }

        try {
            const petNames = await fetchPetNames();
            for (const name of petNames) {
                insertCustomItemIfNew(name, 'pet');
            }
            console.log(`Pet list synced: ${petNames.length} pets from OSRS Wiki`);
        } catch (err) {
            console.error('Failed to sync pet list from OSRS Wiki:', err);
        }
    });
}
