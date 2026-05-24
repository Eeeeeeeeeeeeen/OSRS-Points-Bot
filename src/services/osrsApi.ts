import axios from 'axios';
import { OsrsItem, PriceData } from '../types/osrs';

const USER_AGENT = 'OSRS-Clan-Bot/1.0 (Discord clan drop tracker; contact: ian.thomson@codewizards.co.uk)';
const MAPPING_URL = 'https://prices.runescape.wiki/api/v1/osrs/mapping';
const PRICE_URL = 'https://prices.runescape.wiki/api/v1/osrs/latest';
const WIKI_API_URL = 'https://oldschool.runescape.wiki/api.php';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let itemCache: OsrsItem[] | null = null;
let itemCacheTimestamp = 0;

export async function getItemMapping(): Promise<OsrsItem[]> {
    const now = Date.now();
    if (itemCache && now - itemCacheTimestamp < CACHE_TTL_MS) {
        return itemCache;
    }
    const response = await axios.get<OsrsItem[]>(MAPPING_URL, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000,
    });
    itemCache = response.data;
    itemCacheTimestamp = now;
    return itemCache;
}

export function searchItems(query: string, items: OsrsItem[]): OsrsItem[] {
    const lower = query.toLowerCase();
    return items
        .filter(item => item.name.toLowerCase().includes(lower))
        .slice(0, 25);
}

export function findItemById(id: number, items: OsrsItem[]): OsrsItem | undefined {
    return items.find(item => item.id === id);
}

export async function getItemPrice(itemId: number): Promise<PriceData | null> {
    const response = await axios.get<{ data: Record<string, PriceData> }>(
        `${PRICE_URL}?id=${itemId}`,
        {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000,
        },
    );
    return response.data?.data?.[String(itemId)] ?? null;
}

export async function fetchPetNames(): Promise<string[]> {
    const response = await axios.get<{ query: { categorymembers: { title: string }[] } }>(WIKI_API_URL, {
        params: {
            action: 'query',
            list: 'categorymembers',
            cmtitle: 'Category:Pets',
            cmlimit: 500,
            cmtype: 'page',
            cmnamespace: 0,
            format: 'json',
        },
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000,
    });
    return (response.data?.query?.categorymembers ?? []).map(m => m.title);
}

export function getBestPrice(price: PriceData | null): number | null {
    if (!price) return null;
    return price.high ?? price.low ?? null;
}
