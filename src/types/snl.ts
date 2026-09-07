// Board definition — the shape an admin uploads as JSON to /snl setup.

export type SnlOvershoot = 'win' | 'bounce';

export interface SnlSquareItem {
    ref: string;   // "ge:<itemId>" or "custom:<id>" — same convention as custom_items.parent_ref
    name: string;  // display name, resolved at setup time
}

export interface SnlSquare {
    square: number;
    // Any combination of these items counts toward the quantity, including duplicates
    // of the same one — 3× the same item, or one each of three, both complete a "3".
    items: SnlSquareItem[];
    quantity: number;
}

export interface SnlTransition {
    id: string;
    start: number;
    end: number;
}

export interface SnlBoard {
    name: string;
    finalSquare: number;
    overshoot: SnlOvershoot;
    squares: SnlSquare[];
    ladders: SnlTransition[];
    snakes: SnlTransition[];
}

// Database rows

export type SnlGameStatus = 'setup' | 'active' | 'finished' | 'cancelled';

export interface SnlGameRow {
    id: number;
    status: SnlGameStatus;
    board_json: string;
    board_image_url: string | null;
    final_square: number;
    announce_channel_id: string;
    started_by: string;
    created_at: number;
    started_at: number | null;
    ended_at: number | null;
    winner_team_id: number | null;
}

export interface SnlTeamRow {
    id: number;
    game_id: number;
    name: string;
    role_id: string;
    position: number;      // 0 = not yet started
    arrived_at: number;
    finished_at: number | null;
}

export interface SnlProgressRow {
    id: number;
    team_id: number;
    square: number;
    drop_id: number;
    discord_id: string;
    credited_at: number;
}

export interface SnlMoveRow {
    id: number;
    team_id: number;
    roll: number | null;   // null = admin override
    from_square: number;
    landed_square: number;
    final_square: number;
    transition: 'snake' | 'ladder' | null;
    transition_id: string | null;
    created_at: number;
}

// A single resolved step of a turn: the roll, where it landed, and any snake/ladder taken.
export interface SnlHop {
    roll: number | null;
    from: number;
    landed: number;
    to: number;
    transition: 'snake' | 'ladder' | null;
    transitionId: string | null;
    bounced: boolean;
}
