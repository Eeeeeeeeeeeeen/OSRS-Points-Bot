export interface OsrsItem {
    id: number;
    name: string;
    examine?: string;
    members?: boolean;
    lowalch?: number;
    highalch?: number;
    limit?: number;
    value?: number;
}

export interface PriceData {
    high: number | null;
    highTime: number | null;
    low: number | null;
    lowTime: number | null;
}
