import { create } from 'zustand';
import { Block, BlockStatus, BlockType } from '@/lib/types/blocks';
import { roundTo15 } from '@/lib/utils/blockUtils';

interface BlocksState {
    blocks: Block[];

    // Actions
    createBlock: (partial: Partial<Block> & Pick<Block, "startAt" | "endAt">) => Block;
    updateBlock: (id: string, patch: Partial<Block>) => void;
    deleteBlock: (id: string) => void;
    deleteBlockSeries: (recurrenceId: string) => void;
    duplicateBlock: (id: string) => Block | null;
    setStatus: (id: string, status: BlockStatus) => void;
    applyRecurrence: (id: string, pattern: NonNullable<Block['recurrencePattern']>) => void;
}

export const useBlocksStore = create<BlocksState>((set, get) => ({
    blocks: [],

    createBlock: (partial) => {
        const now = new Date();
        const recurrenceId = partial.recurrencePattern ? crypto.randomUUID() : undefined;
        const newBlocks: Block[] = [];

        // Base Block Data
        const baseBlock: Block = {
            id: crypto.randomUUID(),
            title: partial.title?.trim() || "New block",
            type: partial.type || "other",
            status: partial.status || "planned",
            startAt: roundTo15(partial.startAt),
            endAt: roundTo15(partial.endAt),
            notes: partial.notes,
            tag: partial.tag,
            color: partial.color,
            recurrenceId,
            recurrencePattern: partial.recurrencePattern,
        };

        newBlocks.push(baseBlock);

        // Handle Recurrence Generation (Simple Implementation: Generate for next 90 days)
        if (partial.recurrencePattern) {
            const { type, days, endDate } = partial.recurrencePattern;
            const limitDate = endDate || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days max default
            let currentDate = new Date(baseBlock.startAt);

            // Advance to next occurrence
            currentDate.setDate(currentDate.getDate() + 1);

            while (currentDate <= limitDate) {
                let shouldCreate = false;

                if (type === 'daily') {
                    shouldCreate = true;
                } else if (type === 'weekly') {
                    if (currentDate.getDay() === baseBlock.startAt.getDay()) {
                        shouldCreate = true;
                    }
                } else if (type === 'custom' && days) {
                    if (days.includes(currentDate.getDay())) {
                        shouldCreate = true;
                    }
                }

                if (shouldCreate) {
                    const duration = baseBlock.endAt.getTime() - baseBlock.startAt.getTime();
                    const newStart = new Date(currentDate);
                    newStart.setHours(baseBlock.startAt.getHours(), baseBlock.startAt.getMinutes());
                    const newEnd = new Date(newStart.getTime() + duration);

                    newBlocks.push({
                        ...baseBlock,
                        id: crypto.randomUUID(),
                        startAt: newStart,
                        endAt: newEnd,
                    });
                }

                // Advance
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        set((state) => ({
            blocks: [...state.blocks, ...newBlocks]
        }));

        return baseBlock;
    },

    updateBlock: (id, patch) => {
        set((state) => ({
            blocks: state.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))
        }));
    },

    deleteBlock: (id) => {
        set((state) => ({
            blocks: state.blocks.filter((b) => b.id !== id)
        }));
    },

    deleteBlockSeries: (recurrenceId) => {
        set((state) => ({
            blocks: state.blocks.filter((b) => b.recurrenceId !== recurrenceId)
        }));
    },

    duplicateBlock: (id) => {
        const { blocks } = get();
        const original = blocks.find((b) => b.id === id);
        if (!original) return null;

        const copy: Block = {
            ...original,
            id: crypto.randomUUID(),
            title: `${original.title} (copy)`,
            status: "planned", // Reset status on duplicate? Usually safe.
            recurrenceId: undefined, // Do not copy the series ID, it's a new independent block
            recurrencePattern: undefined // Strip pattern to avoid generating 100s of copies
        };

        set((state) => ({
            blocks: [...state.blocks, copy]
        }));

        return copy;
    },

    setStatus: (id, status) => {
        get().updateBlock(id, { status });
    },

    // NEW Action: Apply Recurrence to Existing Block
    applyRecurrence: (id, pattern) => {
        const { blocks } = get();
        const block = blocks.find(b => b.id === id);
        if (!block) return;

        let recurrenceId = block.recurrenceId;
        let blocksToKeep = blocks;

        // 1. Clean up old series if it exists
        // If the block already has a recurrenceId, we assume we are updating the series.
        // We should remove all OTHER blocks in this series to regenerate them.
        if (recurrenceId) {
            blocksToKeep = blocks.filter(b => b.recurrenceId !== recurrenceId || b.id === id);
        } else {
            // New series
            recurrenceId = crypto.randomUUID();
        }

        // 2. Update the source block
        const updatedSource: Block = {
            ...block,
            recurrenceId,
            recurrencePattern: pattern
        };

        // 3. Generate future blocks
        const newBlocks: Block[] = [];
        const now = new Date();
        const { type, days, endDate } = pattern;
        const limitDate = endDate || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days max

        let currentDate = new Date(updatedSource.startAt);
        currentDate.setDate(currentDate.getDate() + 1); // Start checking from tomorrow

        while (currentDate <= limitDate) {
            let shouldCreate = false;

            if (type === 'daily') {
                shouldCreate = true;
            } else if (type === 'weekly') {
                if (currentDate.getDay() === updatedSource.startAt.getDay()) {
                    shouldCreate = true;
                }
            } else if (type === 'custom' && days) {
                if (days.includes(currentDate.getDay())) {
                    shouldCreate = true;
                }
            }

            if (shouldCreate) {
                const duration = updatedSource.endAt.getTime() - updatedSource.startAt.getTime();
                const newStart = new Date(currentDate);
                newStart.setHours(updatedSource.startAt.getHours(), updatedSource.startAt.getMinutes());
                const newEnd = new Date(newStart.getTime() + duration);

                newBlocks.push({
                    ...updatedSource,
                    id: crypto.randomUUID(),
                    recurrenceId, // Link to same series
                    startAt: newStart,
                    endAt: newEnd,
                });
            }

            // Advance
            currentDate.setDate(currentDate.getDate() + 1);
        }

        set(() => ({
            blocks: blocksToKeep.map(b => b.id === id ? updatedSource : b).concat(newBlocks)
        }));
    },
}));
