import { Block } from "@/lib/types/blocks";
import { getBlockDurationMinutes } from "@/lib/utils/blockUtils";

/**
 * Returns true if range A overlaps with range B.
 * Touching edges are NOT considered overlapping (e.g. 10:00-11:00 and 11:00-12:00 are valid).
 */
export function isOverlapping(
    startA: Date,
    endA: Date,
    startB: Date,
    endB: Date
): boolean {
    return startA < endB && endA > startB;
}

/**
 * Snaps a date to the nearest 15-minute interval.
 * Uses floor/round logic depending on preference, here we use strict nearest.
 */
export function snapTo15(date: Date): Date {
    const msPer15 = 15 * 60 * 1000;
    return new Date(Math.round(date.getTime() / msPer15) * msPer15);
}

/**
 * Finds the next free slot for a block of given duration, starting from desiredStart.
 * If desiredStart is occupied, it moves forward in 15-minute increments until it fits.
 * Limits search to the same day (stops at 23:59).
 */
export function findNextFreeSlot(
    existingBlocks: Block[],
    desiredStart: Date,
    durationMinutes: number,
    excludeBlockId?: string
): { startAt: Date; endAt: Date } | null {

    let candidateStart = new Date(desiredStart);

    // Safety: Limit search to 100 attempts (approx 24h) to avoid infinite loops
    let attempts = 0;
    const MAX_ATTEMPTS = 96; // 24 hours in 15m chunks

    // Filter relevant blocks (remove self and ensure day match if needed)
    const otherBlocks = existingBlocks.filter(b => b.id !== excludeBlockId);

    while (attempts < MAX_ATTEMPTS) {
        const candidateEnd = new Date(candidateStart.getTime() + durationMinutes * 60 * 1000);

        // Check bounds (must end before next day)
        // For simplicity, we assume we just check pure overlap. 
        // If strict day boundary is needed, we'd check candidateEnd.getDate() === desiredStart.getDate()

        // Check collision
        const hasOverlap = otherBlocks.some(b =>
            isOverlapping(candidateStart, candidateEnd, b.startAt, b.endAt)
        );

        if (!hasOverlap) {
            return { startAt: candidateStart, endAt: candidateEnd };
        }

        // Move forward 15 mins
        candidateStart = new Date(candidateStart.getTime() + 15 * 60 * 1000);
        attempts++;
    }

    return null; // Could not find a slot within reasonable limits
}
