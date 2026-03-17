import { create } from 'zustand';
import { Block, BlockStatus } from '@/lib/types/blocks';
import { roundTo15 } from '@/lib/utils/blockUtils';
import { getBlockEffectiveStatus } from '@/lib/utils/blockState';
import { createClient, getClientUser } from '@/lib/supabase/client';
import {
    resolveBlockEngagementMode,
    resolveBlockLocationMode,
    resolveBlockPresenceMode,
    resolveBlockRequiresFocusMode,
    resolveBlockSocialDemand,
} from '@/lib/engines/activityExperience';
import {
    inferBlockActivityExperience,
    recordBlockRescheduleActivity,
} from '@/lib/services/activityExperienceService';

function canSyncActivityExperiences() {
    return typeof window !== "undefined" && process.env.NODE_ENV !== "test";
}

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
    priority: number | null;
    estimated_duration_minutes: number | null;
    difficulty: number | null;
    flexibility: Block["flexibility"] | null;
    intensity: Block["intensity"] | null;
    deadline: string | null;
    cognitively_heavy: boolean | null;
    splittable: boolean | null;
    optional: boolean | null;
    engagement_mode: Block["engagementMode"] | null;
    requires_focus_mode: boolean | null;
    generates_experience_record: boolean | null;
    social_demand_hint: Block["socialDemandHint"] | null;
    location_mode: Block["locationMode"] | null;
    presence_mode: Block["presenceMode"] | null;
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
    priority?: number;
    estimated_duration_minutes?: number;
    difficulty?: number;
    flexibility?: Block["flexibility"];
    intensity?: Block["intensity"];
    deadline?: string;
    cognitively_heavy?: boolean;
    splittable?: boolean;
    optional?: boolean;
    engagement_mode?: Block["engagementMode"];
    requires_focus_mode?: boolean;
    generates_experience_record?: boolean;
    social_demand_hint?: Block["socialDemandHint"];
    location_mode?: Block["locationMode"];
    presence_mode?: Block["presenceMode"];
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
    priority: number | null;
    estimated_duration_minutes: number | null;
    difficulty: number | null;
    flexibility: Block["flexibility"] | null;
    intensity: Block["intensity"] | null;
    deadline: string | null;
    cognitively_heavy: boolean | null;
    splittable: boolean | null;
    optional: boolean | null;
    engagement_mode: Block["engagementMode"] | null;
    requires_focus_mode: boolean | null;
    generates_experience_record: boolean | null;
    social_demand_hint: Block["socialDemandHint"] | null;
    location_mode: Block["locationMode"] | null;
    presence_mode: Block["presenceMode"] | null;
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
            priority: b.priority == null ? undefined : b.priority as Block["priority"],
            estimatedDurationMinutes: b.estimated_duration_minutes ?? undefined,
            difficulty: b.difficulty ?? undefined,
            flexibility: b.flexibility ?? undefined,
            intensity: b.intensity ?? undefined,
            deadline: b.deadline ? new Date(b.deadline) : undefined,
            cognitivelyHeavy: b.cognitively_heavy ?? undefined,
            splittable: b.splittable ?? undefined,
            optional: b.optional ?? undefined,
            engagementMode: b.engagement_mode ?? undefined,
            requiresFocusMode: b.requires_focus_mode ?? undefined,
            generatesExperienceRecord: b.generates_experience_record ?? undefined,
            socialDemandHint: b.social_demand_hint ?? undefined,
            locationMode: b.location_mode ?? undefined,
            presenceMode: b.presence_mode ?? undefined,
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

        if (canSyncActivityExperiences()) {
            await Promise.all(
                statusUpdates
                    .filter((entry) => entry.nextStatus === "completed")
                    .map(async (entry) => {
                        try {
                            await inferBlockActivityExperience(entry.id);
                        } catch (error) {
                            console.error("Failed to infer auto-completed block activity experience", error);
                        }
                    })
            );
        }
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
            priority: partial.priority,
            estimatedDurationMinutes: partial.estimatedDurationMinutes ?? Math.round((partial.endAt.getTime() - partial.startAt.getTime()) / 60000),
            difficulty: partial.difficulty,
            flexibility: partial.flexibility,
            intensity: partial.intensity,
            deadline: partial.deadline,
            cognitivelyHeavy: partial.cognitivelyHeavy,
            splittable: partial.splittable,
            optional: partial.optional,
            engagementMode: partial.engagementMode,
            requiresFocusMode: partial.requiresFocusMode,
            generatesExperienceRecord: partial.generatesExperienceRecord,
            socialDemandHint: partial.socialDemandHint,
            locationMode: partial.locationMode,
            presenceMode: partial.presenceMode,
            recurrenceId,
            recurrencePattern: partial.recurrencePattern,
            notifications: partial.notifications || [5],
        };

        baseBlock.engagementMode = baseBlock.engagementMode ?? resolveBlockEngagementMode(baseBlock);
        baseBlock.requiresFocusMode = baseBlock.requiresFocusMode ?? resolveBlockRequiresFocusMode(baseBlock);
        baseBlock.generatesExperienceRecord = baseBlock.generatesExperienceRecord ?? true;
        baseBlock.socialDemandHint = baseBlock.socialDemandHint ?? resolveBlockSocialDemand(baseBlock);
        baseBlock.locationMode = baseBlock.locationMode ?? resolveBlockLocationMode(baseBlock);
        baseBlock.presenceMode = baseBlock.presenceMode ?? resolveBlockPresenceMode(baseBlock);

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
                if (b.priority != null) payload.priority = b.priority;
                if (b.estimatedDurationMinutes != null) payload.estimated_duration_minutes = b.estimatedDurationMinutes;
                if (b.difficulty != null) payload.difficulty = b.difficulty;
                if (b.flexibility) payload.flexibility = b.flexibility;
                if (b.intensity) payload.intensity = b.intensity;
                if (b.deadline) payload.deadline = b.deadline.toISOString();
                if (b.cognitivelyHeavy != null) payload.cognitively_heavy = b.cognitivelyHeavy;
                if (b.splittable != null) payload.splittable = b.splittable;
                if (b.optional != null) payload.optional = b.optional;
                if (b.engagementMode) payload.engagement_mode = b.engagementMode;
                if (b.requiresFocusMode != null) payload.requires_focus_mode = b.requiresFocusMode;
                if (b.generatesExperienceRecord != null) payload.generates_experience_record = b.generatesExperienceRecord;
                if (b.socialDemandHint) payload.social_demand_hint = b.socialDemandHint;
                if (b.locationMode) payload.location_mode = b.locationMode;
                if (b.presenceMode) payload.presence_mode = b.presenceMode;
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
        const previousBlock = get().blocks.find((b) => b.id === id);
        if (!previousBlock) return;
        const nextBlock: Block = { ...previousBlock, ...patch };

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
        if (patch.priority !== undefined) updateData.priority = patch.priority ?? null;
        if (patch.estimatedDurationMinutes !== undefined) updateData.estimated_duration_minutes = patch.estimatedDurationMinutes ?? null;
        if (patch.difficulty !== undefined) updateData.difficulty = patch.difficulty ?? null;
        if (patch.flexibility !== undefined) updateData.flexibility = patch.flexibility ?? null;
        if (patch.intensity !== undefined) updateData.intensity = patch.intensity ?? null;
        if (patch.deadline !== undefined) updateData.deadline = patch.deadline ? patch.deadline.toISOString() : null;
        if (patch.cognitivelyHeavy !== undefined) updateData.cognitively_heavy = patch.cognitivelyHeavy ?? null;
        if (patch.splittable !== undefined) updateData.splittable = patch.splittable ?? null;
        if (patch.optional !== undefined) updateData.optional = patch.optional ?? null;
        if (patch.engagementMode !== undefined) updateData.engagement_mode = patch.engagementMode ?? null;
        if (patch.requiresFocusMode !== undefined) updateData.requires_focus_mode = patch.requiresFocusMode ?? null;
        if (patch.generatesExperienceRecord !== undefined) updateData.generates_experience_record = patch.generatesExperienceRecord ?? null;
        if (patch.socialDemandHint !== undefined) updateData.social_demand_hint = patch.socialDemandHint ?? null;
        if (patch.locationMode !== undefined) updateData.location_mode = patch.locationMode ?? null;
        if (patch.presenceMode !== undefined) updateData.presence_mode = patch.presenceMode ?? null;
        if (patch.notifications !== undefined) updateData.notifications = patch.notifications ?? null;

        const { error } = await supabase.from('blocks').update(updateData).eq('id', id);
        if (error) {
            console.error('Error updating block:', error);
            return;
        }

        const scheduleChanged = (
            patch.startAt instanceof Date
            || patch.endAt instanceof Date
        ) && (
            previousBlock.startAt.getTime() !== nextBlock.startAt.getTime()
            || previousBlock.endAt.getTime() !== nextBlock.endAt.getTime()
        );

        if (scheduleChanged && canSyncActivityExperiences()) {
            void recordBlockRescheduleActivity(previousBlock, nextBlock).catch((activityError) => {
                console.error("Failed to record rescheduled activity experience", activityError);
            });
        }

        const shouldInferActivity = (
            (patch.status === "completed" || patch.status === "canceled")
            || nextBlock.endAt.getTime() <= Date.now()
        );

        if (shouldInferActivity && canSyncActivityExperiences()) {
            void inferBlockActivityExperience(id).catch((activityError) => {
                console.error("Failed to infer block activity experience", activityError);
            });
        }
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
                priority: copy.priority ?? null,
                estimated_duration_minutes: copy.estimatedDurationMinutes ?? null,
                difficulty: copy.difficulty ?? null,
                flexibility: copy.flexibility ?? null,
                intensity: copy.intensity ?? null,
                deadline: copy.deadline?.toISOString() ?? null,
                cognitively_heavy: copy.cognitivelyHeavy ?? null,
                splittable: copy.splittable ?? null,
                optional: copy.optional ?? null,
                engagement_mode: copy.engagementMode ?? null,
                requires_focus_mode: copy.requiresFocusMode ?? null,
                generates_experience_record: copy.generatesExperienceRecord ?? null,
                social_demand_hint: copy.socialDemandHint ?? null,
                location_mode: copy.locationMode ?? null,
                presence_mode: copy.presenceMode ?? null,
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
                priority: b.priority ?? null,
                estimated_duration_minutes: b.estimatedDurationMinutes ?? null,
                difficulty: b.difficulty ?? null,
                flexibility: b.flexibility ?? null,
                intensity: b.intensity ?? null,
                deadline: b.deadline?.toISOString() ?? null,
                cognitively_heavy: b.cognitivelyHeavy ?? null,
                splittable: b.splittable ?? null,
                optional: b.optional ?? null,
                engagement_mode: b.engagementMode ?? null,
                requires_focus_mode: b.requiresFocusMode ?? null,
                generates_experience_record: b.generatesExperienceRecord ?? null,
                social_demand_hint: b.socialDemandHint ?? null,
                location_mode: b.locationMode ?? null,
                presence_mode: b.presenceMode ?? null,
                recurrence_id: b.recurrenceId,
                recurrence_pattern: b.recurrencePattern,
                notifications: b.notifications
            }));
            const { error } = await supabase.from('blocks').insert(blocksToInsert);
            if (error) console.error('Error inserting recurrenced blocks', error);
        }
    },
}));
