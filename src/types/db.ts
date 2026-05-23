export interface UserRow {
    discord_id: string;
    username: string;
    total_points: number;
    joined_at: number;
    created_at: number;
}

export interface DropRow {
    id: number;
    submitter_id: string;
    item_name: string;
    item_id: number | null;
    gp_value: number;
    awarded_points: number;
    teammate_ids: string; // JSON array string
    screenshot_url: string;
    status: 'pending' | 'accepted' | 'rejected';
    review_channel_id: string | null;
    review_message_id: string | null;
    staff_id: string | null;
    submitted_at: number;
    reviewed_at: number | null;
}

export interface DropRecipientRow {
    drop_id: number;
    discord_id: string;
    points: number;
}

export interface RankTierRow {
    role_id: string;
    name: string;
    min_points: number;
    min_days: number;
    created_at: number;
}

export interface PointLogRow {
    id: number;
    discord_id: string;
    delta: number;
    reason: string;
    new_total: number;
    created_at: number;
}
