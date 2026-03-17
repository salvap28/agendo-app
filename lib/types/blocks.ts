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

export type BlockPriority = 1 | 2 | 3 | 4 | 5;
export type BlockFlexibility = "fixed" | "moderate" | "flexible";
export type BlockIntensity = "light" | "medium" | "high";

export interface RecurrencePattern {
    type: 'daily' | 'weekly' | 'custom';
    days?: number[]; // 0-6 for Sun-Sat
    endDate?: Date;
}

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
    notifications?: number[]; // Minutes before start (e.g., [5, 15, 60])
    priority?: BlockPriority;
    estimatedDurationMinutes?: number;
    difficulty?: number;
    flexibility?: BlockFlexibility;
    intensity?: BlockIntensity;
    deadline?: Date;
    cognitivelyHeavy?: boolean;
    splittable?: boolean;
    optional?: boolean;

    // Recurrence
    recurrenceId?: string;
    recurrencePattern?: RecurrencePattern;
}

/**
 * For serialization contexts (e.g. JSON storage or client-server transfer)
 * where Dates are strings.
 */
export interface SerializableBlock extends Omit<Block, "startAt" | "endAt"> {
    startAt: string; // ISO String
    endAt: string;   // ISO String
}
