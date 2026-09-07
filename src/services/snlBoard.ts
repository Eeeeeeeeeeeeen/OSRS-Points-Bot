import { SnlBoard, SnlSquare, SnlSquareItem, SnlTransition, SnlOvershoot } from '../types/snl';
import { getItemMapping, findItemById } from './osrsApi';
import { getCustomItem } from '../database/queries/customItems';

const MAX_FINAL_SQUARE = 500;

export type ParseResult =
    | { ok: true; board: SnlBoard }
    | { ok: false; errors: string[] };

interface RawTransition { id?: unknown; start?: unknown; end?: unknown }
interface RawSquare { square?: unknown; item?: unknown; items?: unknown; quantity?: unknown; label?: unknown }

const ITEM_REF = /^(ge|custom):\d+$/;

// Accepts "ge:11832" or { "item": "ge:11832", "name": "Display override" }.
function readItemEntry(entry: unknown): { ref: string; name?: string } | null {
    if (typeof entry === 'string') {
        return ITEM_REF.test(entry) ? { ref: entry } : null;
    }
    if (isPlainObject(entry) && typeof entry.item === 'string' && ITEM_REF.test(entry.item)) {
        const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : undefined;
        return { ref: entry.item, name };
    }
    return null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInt(v: unknown): v is number {
    return typeof v === 'number' && Number.isInteger(v);
}

/**
 * Parses and fully validates an uploaded board definition.
 * Every problem found is reported at once so an admin can fix the file in one pass.
 */
export async function parseBoard(raw: string): Promise<ParseResult> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        return { ok: false, errors: [`Not valid JSON: ${(err as Error).message}`] };
    }

    if (!isPlainObject(parsed)) {
        return { ok: false, errors: ['Top level of the file must be a JSON object.'] };
    }

    const errors: string[] = [];

    const name = typeof parsed.name === 'string' && parsed.name.trim()
        ? parsed.name.trim()
        : 'Snakes & Ladders';

    const finalSquare = parsed.finalSquare;
    if (!isInt(finalSquare) || finalSquare < 2 || finalSquare > MAX_FINAL_SQUARE) {
        errors.push(`"finalSquare" must be a whole number between 2 and ${MAX_FINAL_SQUARE}.`);
    }
    const lastSquare = isInt(finalSquare) ? finalSquare : 0;

    let overshoot: SnlOvershoot = 'win';
    if (parsed.overshoot !== undefined) {
        if (parsed.overshoot === 'win' || parsed.overshoot === 'bounce') {
            overshoot = parsed.overshoot;
        } else {
            errors.push('"overshoot" must be either "win" or "bounce".');
        }
    }

    // --- squares ---
    const squares: SnlSquare[] = [];
    const seenSquares = new Set<number>();
    const rawSquares = parsed.squares;
    if (!Array.isArray(rawSquares)) {
        errors.push('"squares" must be an array.');
    } else {
        rawSquares.forEach((entry: unknown, i: number) => {
            const label = `squares[${i}]`;
            if (!isPlainObject(entry)) {
                errors.push(`${label} must be an object.`);
                return;
            }
            const s = entry as RawSquare;

            if (!isInt(s.square) || s.square < 1 || (lastSquare && s.square > lastSquare)) {
                errors.push(`${label}: "square" must be a whole number between 1 and ${lastSquare || 'finalSquare'}.`);
                return;
            }
            if (seenSquares.has(s.square)) {
                errors.push(`${label}: square ${s.square} is defined more than once.`);
                return;
            }
            // Landing on the final square wins outright, so an item there could never be collected.
            if (lastSquare && s.square === lastSquare) {
                errors.push(`${label}: square ${s.square} is the final square and wins the game — it cannot require an item.`);
                return;
            }
            seenSquares.add(s.square);

            if (s.items === undefined && s.item !== undefined) {
                errors.push(`${label} (square ${s.square}): use "items" with a list of accepted items, not "item".`);
                return;
            }

            // A lone string is accepted as shorthand for a one-item list.
            const rawItems = typeof s.items === 'string' ? [s.items] : s.items;
            if (!Array.isArray(rawItems) || rawItems.length === 0) {
                errors.push(`${label} (square ${s.square}): "items" must be a non-empty array, e.g. ["ge:11832", "custom:14"].`);
                return;
            }

            const items: SnlSquareItem[] = [];
            const seenRefs = new Set<string>();
            let itemsOk = true;
            rawItems.forEach((rawItem: unknown, j: number) => {
                const parsedItem = readItemEntry(rawItem);
                if (!parsedItem) {
                    errors.push(`${label}.items[${j}] (square ${s.square}): must look like "ge:11832" or "custom:14".`);
                    itemsOk = false;
                    return;
                }
                if (seenRefs.has(parsedItem.ref)) {
                    errors.push(`${label}.items[${j}] (square ${s.square}): "${parsedItem.ref}" is listed twice. To require more than one, raise "quantity".`);
                    itemsOk = false;
                    return;
                }
                seenRefs.add(parsedItem.ref);
                items.push({ ref: parsedItem.ref, name: parsedItem.name ?? '' });
            });
            if (!itemsOk) return;

            let quantity = 1;
            if (s.quantity !== undefined) {
                if (!isInt(s.quantity) || s.quantity < 1) {
                    errors.push(`${label} (square ${s.square}): "quantity" must be a whole number of 1 or more.`);
                    return;
                }
                quantity = s.quantity;
            }

            let displayLabel: string | undefined;
            if (s.label !== undefined) {
                if (typeof s.label !== 'string' || !s.label.trim()) {
                    errors.push(`${label} (square ${s.square}): "label" must be a non-empty string, e.g. "Slayer Uniques".`);
                    return;
                }
                displayLabel = s.label.trim();
            }

            squares.push({ square: s.square, items, quantity, ...(displayLabel ? { label: displayLabel } : {}) });
        });
    }

    // --- snakes and ladders ---
    const readTransitions = (key: 'ladders' | 'snakes'): SnlTransition[] => {
        const out: SnlTransition[] = [];
        const rawList = parsed[key];
        if (rawList === undefined) return out;
        if (!Array.isArray(rawList)) {
            errors.push(`"${key}" must be an array.`);
            return out;
        }
        const isLadder = key === 'ladders';
        rawList.forEach((entry: unknown, i: number) => {
            const label = `${key}[${i}]`;
            if (!isPlainObject(entry)) {
                errors.push(`${label} must be an object.`);
                return;
            }
            const t = entry as RawTransition;
            const id = typeof t.id === 'string' && t.id.trim()
                ? t.id.trim()
                : `${isLadder ? 'ladder' : 'snake'}-${i + 1}`;

            if (!isInt(t.start) || t.start < 1 || (lastSquare && t.start > lastSquare)) {
                errors.push(`${label} (${id}): "start" must be between 1 and ${lastSquare || 'finalSquare'}.`);
                return;
            }
            if (!isInt(t.end) || t.end < 1 || (lastSquare && t.end > lastSquare)) {
                errors.push(`${label} (${id}): "end" must be between 1 and ${lastSquare || 'finalSquare'}.`);
                return;
            }
            if (isLadder && t.start >= t.end) {
                errors.push(`${label} (${id}): a ladder must go up — "start" (${t.start}) must be below "end" (${t.end}).`);
                return;
            }
            if (!isLadder && t.start <= t.end) {
                errors.push(`${label} (${id}): a snake must go down — "start" (${t.start}) must be above "end" (${t.end}).`);
                return;
            }
            if (lastSquare && isLadder && t.end === lastSquare) {
                errors.push(`${label} (${id}): a ladder cannot end on the final square.`);
                return;
            }
            // Reaching the final square wins, so nothing may be attached to it.
            if (lastSquare && t.start === lastSquare) {
                errors.push(`${label} (${id}): nothing can start on the final square — landing there wins the game.`);
                return;
            }
            out.push({ id, start: t.start, end: t.end });
        });
        return out;
    };

    const ladders = readTransitions('ladders');
    const snakes = readTransitions('snakes');

    // A square may only start one snake or ladder, and a start square is pass-through
    // (the team owes the item where they end up, not where they landed).
    const starts = new Map<number, string>();
    for (const t of [...ladders, ...snakes]) {
        const existing = starts.get(t.start);
        if (existing) {
            errors.push(`Square ${t.start} is the start of both "${existing}" and "${t.id}" — it may only start one.`);
            continue;
        }
        starts.set(t.start, t.id);
    }
    for (const [square, id] of starts) {
        if (seenSquares.has(square)) {
            errors.push(`Square ${square} starts "${id}", so it cannot also require an item — remove it from "squares".`);
        }
    }
    for (const t of [...ladders, ...snakes]) {
        if (starts.has(t.end)) {
            errors.push(`"${t.id}" ends on square ${t.end}, which starts "${starts.get(t.end)}" — chained snakes/ladders are not allowed.`);
        }
    }

    // --- item refs resolve ---
    if (squares.length > 0) {
        const needsMapping = squares.some(s => s.items.some(i => i.ref.startsWith('ge:')));

        let mapping: Awaited<ReturnType<typeof getItemMapping>> = [];
        if (needsMapping) {
            try {
                mapping = await getItemMapping();
            } catch {
                errors.push('Could not reach the OSRS price API to verify item IDs. Please try again in a moment.');
            }
        }

        for (const s of squares) {
            for (const item of s.items) {
                const [kind, idPart] = item.ref.split(':');
                const id = parseInt(idPart, 10);
                if (kind === 'ge') {
                    if (mapping.length === 0) continue; // API failure already reported
                    const geItem = findItemById(id, mapping);
                    if (!geItem) {
                        errors.push(`Square ${s.square}: no Grand Exchange item with ID ${id}.`);
                    } else if (!item.name) {
                        item.name = geItem.name;
                    }
                } else {
                    const custom = getCustomItem(id);
                    if (!custom) {
                        errors.push(`Square ${s.square}: no custom item with ID ${id}. Check \`/listcustomitems\`.`);
                    } else if (!item.name) {
                        item.name = custom.name;
                    }
                }
            }
        }
    }

    if (errors.length > 0) return { ok: false, errors };

    squares.sort((a, b) => a.square - b.square);
    return {
        ok: true,
        board: { name, finalSquare: lastSquare, overshoot, squares, ladders, snakes },
    };
}

export function loadBoard(boardJson: string): SnlBoard {
    return JSON.parse(boardJson) as SnlBoard;
}

export function squareRequirement(board: SnlBoard, square: number): SnlSquare | null {
    return board.squares.find(s => s.square === square) ?? null;
}

export function transitionFor(board: SnlBoard, square: number): { transition: SnlTransition; kind: 'snake' | 'ladder' } | null {
    const ladder = board.ladders.find(l => l.start === square);
    if (ladder) return { transition: ladder, kind: 'ladder' };
    const snake = board.snakes.find(s => s.start === square);
    if (snake) return { transition: snake, kind: 'snake' };
    return null;
}

// Thumbnail for a square — the first GE item on it, since custom items have no icon.
export function requirementIcon(req: SnlSquare): string | null {
    const ge = req.items.find(i => i.ref.startsWith('ge:'));
    if (!ge) return null;
    return `https://static.runelite.net/cache/item/icon/${ge.ref.split(':')[1]}.png`;
}

export function describeRequirement(req: SnlSquare): string {
    // A label replaces the item list outright — squares that accept dozens of drops would
    // otherwise blow past Discord's field limits.
    if (req.label) {
        return req.quantity > 1 ? `${req.quantity}× **${req.label}**` : `**${req.label}**`;
    }
    const names = req.items.map(i => `**${i.name || i.ref}**`);
    const list = names.length === 1 ? names[0] : `any of ${names.join(', ')}`;
    return req.quantity > 1 ? `${req.quantity}× ${list}` : list;
}
