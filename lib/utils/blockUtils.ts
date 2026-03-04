import { Block, SerializableBlock } from "@/lib/types/blocks";

// --- Time Helpers ---

export function roundTo15(date: Date): Date {
    const ms = 1000 * 60 * 15;
    return new Date(Math.round(date.getTime() / ms) * ms);
}

export function minutesBetween(a: Date, b: Date): number {
    const diffMs = b.getTime() - a.getTime();
    return Math.round(diffMs / (1000 * 60));
}

export function getBlockDurationMinutes(block: Pick<Block, "startAt" | "endAt">): number {
    return minutesBetween(block.startAt, block.endAt);
}

// --- Validation ---

export interface ValidationResult {
    ok: boolean;
    errors: string[];
}

export function validateBlock(block: Pick<Block, "title" | "startAt" | "endAt">): ValidationResult {
    const errors: string[] = [];

    // 1. Title
    if (!block.title.trim()) {
        errors.push("Title cannot be empty.");
    }

    // 2. Chronology
    if (block.endAt <= block.startAt) {
        errors.push("End time must be after start time.");
    }

    // 3. Duration (min 15m)
    const duration = getBlockDurationMinutes(block);
    if (duration < 15) {
        errors.push("Block duration must be at least 15 minutes.");
    }

    return {
        ok: errors.length === 0,
        errors,
    };
}

// --- Serialization ---

export function serializeBlock(block: Block): SerializableBlock {
    return {
        ...block,
        startAt: block.startAt.toISOString(),
        endAt: block.endAt.toISOString(),
    };
}

export function deserializeBlock(sBlock: SerializableBlock): Block {
    return {
        ...sBlock,
        startAt: new Date(sBlock.startAt),
        endAt: new Date(sBlock.endAt),
    };
}
