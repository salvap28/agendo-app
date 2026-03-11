import { create } from 'zustand';
import { Block, BlockStatus, BlockType } from '@/lib/types/blocks';
import { roundTo15 } from '@/lib/utils/blockUtils';
import { createClient } from '@/lib/supabase/client';

interface BlocksState {
    blocks: Block[];
    isLoaded: boolean;

    // Actions
    fetchBlocks: () => Promise<void>;
    createBlock: (partial: Partial<Block> & Pick<Block, "startAt" | "endAt">) => Block | null;
    updateBlock: (id: string, patch: Partial<Block>) => Promise<void>;
    deleteBlock: (id: string) => Promise<void>;
    deleteBlockSeries: (recurrenceId: string) => Promise<void>;
    duplicateBlock: (id: string) => Promise<Block | null>;
    setStatus: (id: string, status: BlockStatus) => Promise<void>;
    applyRecurrence: (id: string, pattern: NonNullable<Block['recurrencePattern']>) => Promise<void>;
}

export const useBlocksStore = create<BlocksState>((set, get) => ({
    blocks: [],
    isLoaded: false,

    fetchBlocks: async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('blocks')
            .select('*')
            .order('start_at', { ascending: true });

        if (error) {
            console.error('Error fetching blocks:', error);
            return;
        }

        const formattedBlocks: Block[] = (data || []).map((b: any) => ({
            id: b.id,
            title: b.title,
            type: b.type,
            status: b.status,
            startAt: new Date(b.start_at),
            endAt: new Date(b.end_at),
            notes: b.notes,
            tag: b.tag,
            color: b.color,
            recurrenceId: b.recurrence_id,
            recurrencePattern: b.recurrence_pattern,
        }));

        set({ blocks: formattedBlocks, isLoaded: true });
    },

    createBlock: (partial) => {
        const supabase = createClient();
        // Fire DB insert in background without awaiting user session upfront in the UI thread


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

        // Optimistic update
        set((state) => ({
            blocks: [...state.blocks, ...newBlocks]
        }));

        // DB Insert (Fire and forget to keep UI snappy)
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;
            const blocksToInsert = newBlocks.map(b => {
                const payload: any = {
                    id: b.id,
                    user_id: user.id,
                    title: b.title,
                    type: b.type,
                    status: b.status,
                    start_at: b.startAt.toISOString(),
                    end_at: b.endAt.toISOString(),
                };
                if (b.notes) payload.notes = b.notes;
                if (b.tag) payload.tag = b.tag;
                if (b.color) payload.color = b.color;
                if (b.recurrenceId) payload.recurrence_id = b.recurrenceId;
                if (b.recurrencePattern) payload.recurrence_pattern = b.recurrencePattern;
                return payload;
            });

            supabase.from('blocks').insert(blocksToInsert).then(({ error }) => {
                if (error) {
                    console.error('Error inserting blocks:', JSON.stringify(error, null, 2));
                    // Optionally handle rollback of optimistic update here
                }
            });
        });

        return baseBlock;
    },

    updateBlock: async (id, patch) => {
        // Optimistic update
        set((state) => ({
            blocks: state.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))
        }));

        // DB Update
        const supabase = createClient();
        const updateData: any = {};
        if (patch.title !== undefined) updateData.title = patch.title;
        if (patch.type !== undefined) updateData.type = patch.type;
        if (patch.status !== undefined) updateData.status = patch.status;
        if (patch.startAt !== undefined) updateData.start_at = patch.startAt.toISOString();
        if (patch.endAt !== undefined) updateData.end_at = patch.endAt.toISOString();
        if (patch.notes !== undefined) updateData.notes = patch.notes;
        if (patch.tag !== undefined) updateData.tag = patch.tag;
        if (patch.color !== undefined) updateData.color = patch.color;

        const { error } = await supabase.from('blocks').update(updateData).eq('id', id);
        if (error) console.error('Error updating block:', error);
    },

    deleteBlock: async (id) => {
        // Optimistic update
        set((state) => ({
            blocks: state.blocks.filter((b) => b.id !== id)
        }));

        // DB Delete
        const supabase = createClient();
        const { error } = await supabase.from('blocks').delete().eq('id', id);
        if (error) console.error('Error deleting block:', error);
    },

    deleteBlockSeries: async (recurrenceId) => {
        // Optimistic update
        set((state) => ({
            blocks: state.blocks.filter((b) => b.recurrenceId !== recurrenceId)
        }));

        // DB Delete
        const supabase = createClient();
        const { error } = await supabase.from('blocks').delete().eq('recurrence_id', recurrenceId);
        if (error) console.error('Error deleting block series:', error);
    },

    duplicateBlock: async (id) => {
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

        // Optimistic update
        set((state) => ({
            blocks: [...state.blocks, copy]
        }));

        // DB Insert
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { error } = await supabase.from('blocks').insert({
                id: copy.id,
                user_id: user.id,
                title: copy.title,
                type: copy.type,
                status: copy.status,
                start_at: copy.startAt.toISOString(),
                end_at: copy.endAt.toISOString(),
                notes: copy.notes,
                tag: copy.tag,
                color: copy.color
            });
            if (error) console.error('Error duplicating block:', error);
        }

        return copy;
    },

    setStatus: async (id, status) => {
        await get().updateBlock(id, { status });
    },

    // NEW Action: Apply Recurrence to Existing Block
    applyRecurrence: async (id, pattern) => {
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

        // Optimistic update
        set(() => ({
            blocks: blocksToKeep.map(b => b.id === id ? updatedSource : b).concat(newBlocks)
        }));

        // DB Operations
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Delete old series first (excluding current block)
        if (block.recurrenceId) {
            await supabase.from('blocks').delete()
                .eq('recurrence_id', block.recurrenceId)
                .neq('id', id);
        }

        // Update source block
        await supabase.from('blocks').update({
            recurrence_id: recurrenceId,
            recurrence_pattern: pattern
        }).eq('id', id);

        // Insert new blocks
        if (newBlocks.length > 0) {
            const blocksToInsert = newBlocks.map(b => ({
                id: b.id,
                user_id: user.id,
                title: b.title,
                type: b.type,
                status: b.status,
                start_at: b.startAt.toISOString(),
                end_at: b.endAt.toISOString(),
                notes: b.notes,
                tag: b.tag,
                color: b.color,
                recurrence_id: b.recurrenceId,
                recurrence_pattern: b.recurrencePattern
            }));
            const { error } = await supabase.from('blocks').insert(blocksToInsert);
            if (error) console.error('Error inserting recurrenced blocks', error);
        }
    },
}));
