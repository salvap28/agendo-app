export type BlockType =
    | "deep_work"
    | "study"
    | "gym"
    | "meeting"
    | "admin"
    | "break"
    | "other";

export type BlockStatus =
    | "planned"
    | "active"
    | "completed"
    | "canceled";

export interface Block {
    id: string;
    title: string;
    type: BlockType;
    startAt: Date;
    endAt: Date;
    status: BlockStatus;

    // Optional Fields
    notes?: string;
    tag?: string; // or colorTag
    color?: string; // Hex or token

    // Recurrence
    recurrenceId?: string;
    recurrencePattern?: {
        type: 'daily' | 'weekly' | 'custom';
        days?: number[]; // 0-6 for Sun-Sat
        endDate?: Date;
    };
}

/**
 * For serialization contexts (e.g. JSON storage or client-server transfer)
 * where Dates are strings.
 */
export interface SerializableBlock extends Omit<Block, "startAt" | "endAt"> {
    startAt: string; // ISO String
    endAt: string;   // ISO String
}
