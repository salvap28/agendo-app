import { create } from 'zustand';
import { Block, BlockStatus } from '@/lib/types/blocks';
import { roundTo15 } from '@/lib/utils/blockUtils';
import { getBlockEffectiveStatus } from '@/lib/utils/blockState';
import { createClient, getClientUser } from '@/lib/supabase/client';

interface BlockRow {
    id: string;
    title: string;
    type: Block["type"];
    status: BlockStatus;
    start_at: string;
    end_at: string;
    notes: string | null;
    tag: string | null;
    color: string | null;
    recurrence_id: string | null;
    recurrence_pattern: Block["recurrencePattern"] | null;
    notifications: number[] | null;
}

type BlockInsertPayload = {
    id: string;
    user_id: string;
    title: string;
    type: Block["type"];
    status: BlockStatus;
    start_at: string;
    end_at: string;
    notes?: string;
    tag?: string;
    color?: string;
    recurrence_id?: string;
    recurrence_pattern?: Block["recurrencePattern"];
    notifications?: number[];
};

type BlockUpdatePayload = Partial<{
    title: string;
    type: Block["type"];
    status: BlockStatus;
    start_at: string;
    end_at: string;
    notes: string | null;
    tag: string | null;
    color: string | null;
    notifications: number[] | null;
}>;

interface BlocksState {
    blocks: Block[];
    isLoaded: boolean;

    // Actions
    fetchBlocks: () => Promise<void>;
    syncStatusesWithCurrentTime: () => Promise<void>;
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
        const user = await getClientUser(supabase);
        if (!user) return;

        const { data, error } = await supabase
            .from('blocks')
            .select('*')
            .order('start_at', { ascending: true });

        if (error) {
            console.error('Error fetching blocks:', error);
            return;
        }

        const formattedBlocks: Block[] = ((data || []) as BlockRow[]).map((b) => ({
            id: b.id,
            title: b.title,
            type: b.type,
            status: b.status,
            startAt: new Date(b.start_at),
            endAt: new Date(b.end_at),
            notes: b.notes ?? undefined,
            tag: b.tag ?? undefined,
            color: b.color ?? undefined,
            recurrenceId: b.recurrence_id ?? undefined,
            recurrencePattern: b.recurrence_pattern ?? undefined,
            notifications: b.notifications || [5],
        }));

        set({ blocks: formattedBlocks, isLoaded: true });
    },

    syncStatusesWithCurrentTime: async () => {
        const { blocks } = get();
        const now = new Date();
        const statusUpdates = blocks
            .filter((block) => block.status !== "canceled")
            .map((block) => {
                const nextStatus = getBlockEffectiveStatus(block, now);

                return {
                    id: block.id,
                    nextStatus,
                    changed: block.status !== nextStatus,
                };
            })
            .filter((entry) => entry.changed);

        if (statusUpdates.length === 0) return;

        const updatesById = new Map(statusUpdates.map((entry) => [entry.id, entry.nextStatus]));

        set((state) => ({
            blocks: state.blocks.map((block) => {
                const nextStatus = updatesById.get(block.id);
                return nextStatus ? { ...block, status: nextStatus } : block;
            })
        }));

        const supabase = createClient();
        const groupedUpdates: Record<Exclude<BlockStatus, "canceled">, string[]> = {
            planned: [],
            active: [],
            completed: [],
        };

        statusUpdates.forEach(({ id, nextStatus }) => {
            if (nextStatus === "canceled") return;
            groupedUpdates[nextStatus].push(id);
        });

        await Promise.all(
            (Object.entries(groupedUpdates) as Array<[Exclude<BlockStatus, "canceled">, string[]]>)
                .filter(([, ids]) => ids.length > 0)
                .map(async ([status, ids]) => {
                    const { error } = await supabase
                        .from('blocks')
                        .update({ status })
                        .in('id', ids);

                    if (error) {
                        console.error(`Error syncing ${status} block statuses:`, error);
                    }
                })
        );
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
            notifications: partial.notifications || [5],
        };

        newBlocks.push(baseBlock);

        // Handle Recurrence Generation (Simple Implementation: Generate for next 90 days)
        if (partial.recurrencePattern) {
            const { type, days, endDate } = partial.recurrencePattern;
            const limitDate = endDate || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days max default
            const currentDate = new Date(baseBlock.startAt);

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
        getClientUser(supabase).then((user) => {
            if (!user) return;
            const blocksToInsert: BlockInsertPayload[] = newBlocks.map((b) => {
                const payload: BlockInsertPayload = {
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
                if (b.notifications) payload.notifications = b.notifications;
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
        const updateData: BlockUpdatePayload = {};
        if (patch.title !== undefined) updateData.title = patch.title;
        if (patch.type !== undefined) updateData.type = patch.type;
        if (patch.status !== undefined) updateData.status = patch.status;
        if (patch.startAt !== undefined) updateData.start_at = patch.startAt.toISOString();
        if (patch.endAt !== undefined) updateData.end_at = patch.endAt.toISOString();
        if (patch.notes !== undefined) updateData.notes = patch.notes ?? null;
        if (patch.tag !== undefined) updateData.tag = patch.tag ?? null;
        if (patch.color !== undefined) updateData.color = patch.color ?? null;
        if (patch.notifications !== undefined) updateData.notifications = patch.notifications ?? null;

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
            recurrencePattern: undefined, // Strip pattern to avoid generating 100s of copies
            notifications: original.notifications || [5]
        };

        // Optimistic update
        set((state) => ({
            blocks: [...state.blocks, copy]
        }));

        // DB Insert
        const supabase = createClient();
        const user = await getClientUser(supabase);
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
                color: copy.color,
                notifications: copy.notifications
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

        const currentDate = new Date(updatedSource.startAt);
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
        const user = await getClientUser(supabase);
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
                recurrence_pattern: b.recurrencePattern,
                notifications: b.notifications
            }));
            const { error } = await supabase.from('blocks').insert(blocksToInsert);
            if (error) console.error('Error inserting recurrenced blocks', error);
        }
    },
}));
