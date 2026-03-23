import { Block } from "@/lib/types/blocks";
import { isOverlapping } from "./scheduling";

export function resolveOverlapBySlicingUnderlying(
    newBlock: Partial<Block> & Pick<Block, "startAt" | "endAt">,
    overlappingBlocks: Block[],
    updateBlock: (id: string, patch: Partial<Block>) => Promise<void> | void,
    createBlock: (partial: Partial<Block> & Pick<Block, "startAt" | "endAt">) => Block | null
) {
    // 1. First, save the block exactly as requested
    let resultingBlock: Block | null = null;
    if (newBlock.id) {
        updateBlock(newBlock.id, { startAt: newBlock.startAt, endAt: newBlock.endAt });
        resultingBlock = newBlock as Block;
    } else {
        resultingBlock = createBlock(newBlock);
    }
    
    if (!resultingBlock) return null;

    // 2. Adjust overlapping blocks
    overlappingBlocks.forEach((b) => {
        const aStart = newBlock.startAt.getTime();
        const aEnd = newBlock.endAt.getTime();
        const bStart = b.startAt.getTime();
        const bEnd = b.endAt.getTime();

        if (aStart <= bStart && aEnd >= bEnd) {
            // New block completely covers B. Delete B? Or just shrink B to 0? 
            // We'll update B to be 1 ms just to avoid deleting user data unpredictably, or maybe cancel it.
            // Actually, let's just push it to the end of A.
            updateBlock(b.id, { startAt: newBlock.endAt, endAt: new Date(newBlock.endAt.getTime() + (bEnd - bStart)) });
        } 
        else if (aStart > bStart && aEnd < bEnd) {
            // The hardest case: New block is entirely INSIDE B. We must SPLIT B.
            // B becomes: bStart -> aStart
            // B_split becomes: aEnd -> bEnd
            
            // 1. Shrink original B
            updateBlock(b.id, { endAt: newBlock.startAt });

            // 2. Create the second half of B
            const secondHalf: Partial<Block> & Pick<Block, "startAt" | "endAt"> = {
                ...b,
                id: undefined, // Let the store generate a new ID
                startAt: newBlock.endAt,
                endAt: b.endAt,
            };
            createBlock(secondHalf);
        }
        else if (aStart <= bStart && aEnd > bStart) {
            // New block overlaps the START of B. So B must start when A ends.
            // E.g. A: 9-11, B: 10-12 => B becomes 11-12
            updateBlock(b.id, { startAt: newBlock.endAt });
        }
        else if (aStart < bEnd && aEnd >= bEnd) {
            // New block overlaps the END of B. So B must end when A starts.
            // E.g. B: 9-11, A: 10-12 => B becomes 9-10
            updateBlock(b.id, { endAt: newBlock.startAt });
        }
    });

    return resultingBlock;
}

export function resolveOverlapByShrinkingNew(
    newBlock: Partial<Block> & Pick<Block, "startAt" | "endAt">,
    overlappingBlocks: Block[],
    createBlock: (partial: Partial<Block> & Pick<Block, "startAt" | "endAt">) => Block | null,
    updateBlock?: (id: string, patch: Partial<Block>) => Promise<void> | void
) {
    // We want to shrink the new block to fit into the gap without overlapping.
    // Assuming the user dragged it, it usually overlaps mainly with ONE block.
    // If it overlaps multiple, we find the tightest bounds.

    let bestStart = newBlock.startAt.getTime();
    let bestEnd = newBlock.endAt.getTime();

    overlappingBlocks.forEach(b => {
        const bStart = b.startAt.getTime();
        const bEnd = b.endAt.getTime();

        // If new block overlaps end of B, shift start of new block forward
        if (bestStart < bEnd && bestEnd > bEnd) {
            bestStart = Math.max(bestStart, bEnd);
        }
        // If new block overlaps start of B, shift end of new block backward
        else if (bestStart < bStart && bestEnd > bStart) {
            bestEnd = Math.min(bestEnd, bStart);
        }
    });

    // If it ended up inverted or completely squashed, fallback to original or set to 15 min
    if (bestEnd <= bestStart) {
        bestEnd = bestStart + 15 * 60000; 
    }

    if (newBlock.id && updateBlock) {
        updateBlock(newBlock.id, { startAt: new Date(bestStart), endAt: new Date(bestEnd) });
        return { ...newBlock, startAt: new Date(bestStart), endAt: new Date(bestEnd) } as Block;
    } else {
        return createBlock({
            ...newBlock,
            startAt: new Date(bestStart),
            endAt: new Date(bestEnd),
        });
    }
}
