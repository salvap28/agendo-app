import type { SupabaseClient } from "@supabase/supabase-js";
import { Block } from "@/lib/types/blocks";
import { FocusSession } from "@/lib/types/focus";
import {
    ActivityExperience,
    ActivityExperienceAnalytics,
    ActivityExperienceCheckoutInput,
    ActivityBehaviorSignals,
} from "@/lib/types/activity";
import { FocusSessionAnalytics } from "@/lib/types/behavior";
import {
    applyCheckoutToExperience,
    buildActivityBehaviorSignals,
    computeActivityExperienceAnalytics,
    inferActivityExperienceFromBlock,
    inferRescheduledActivityExperience,
    mapFocusSessionToActivityExperience,
} from "@/lib/engines/activityExperience";

type DbRow = Record<string, unknown>;

function asString(value: unknown, fallback = "") {
    return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
    return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
}

function asBoolean(value: unknown, fallback = false) {
    return typeof value === "boolean" ? value : fallback;
}

function asObject(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}

export function mapActivityExperienceRow(row: DbRow): ActivityExperience {
    return {
        id: asString(row.id),
        experienceKey: asNullableString(row.experience_key) ?? undefined,
        userId: asString(row.user_id),
        sourceBlockId: asNullableString(row.source_block_id),
        sourceFocusSessionId: asNullableString(row.source_focus_session_id),
        titleSnapshot: asNullableString(row.title_snapshot),
        blockTypeSnapshot: asNullableString(row.block_type_snapshot),
        tagSnapshot: asNullableString(row.tag_snapshot),
        engagementMode: asString(row.engagement_mode) as ActivityExperience["engagementMode"],
        outcome: asString(row.outcome) as ActivityExperience["outcome"],
        source: asString(row.source) as ActivityExperience["source"],
        scheduledStart: asNullableString(row.scheduled_start),
        scheduledEnd: asNullableString(row.scheduled_end),
        actualStart: asNullableString(row.actual_start),
        actualEnd: asNullableString(row.actual_end),
        actualDurationMin: row.actual_duration_min == null ? null : asNumber(row.actual_duration_min),
        energyImpact: asString(row.energy_impact) as ActivityExperience["energyImpact"],
        cognitiveLoad: asString(row.cognitive_load) as ActivityExperience["cognitiveLoad"],
        perceivedValue: asString(row.perceived_value) as ActivityExperience["perceivedValue"],
        socialDemand: asString(row.social_demand) as ActivityExperience["socialDemand"],
        outcomeReason: asString(row.outcome_reason) as ActivityExperience["outcomeReason"],
        locationMode: asNullableString(row.location_mode) as ActivityExperience["locationMode"],
        presenceMode: asNullableString(row.presence_mode) as ActivityExperience["presenceMode"],
        wasPlanned: asBoolean(row.was_planned, true),
        wasCompletedAsPlanned: asBoolean(row.was_completed_as_planned, false),
        wasUserConfirmed: asBoolean(row.was_user_confirmed, false),
        wasSystemInferred: asBoolean(row.was_system_inferred, false),
        confidence: row.confidence == null ? null : asNumber(row.confidence),
        notes: asNullableString(row.notes),
        metadataJson: asObject(row.metadata_json) ?? {},
        createdAt: asNullableString(row.created_at) ?? new Date().toISOString(),
        updatedAt: asNullableString(row.updated_at) ?? new Date().toISOString(),
    };
}

function serializeActivityExperience(experience: ActivityExperience) {
    return {
        id: experience.id,
        user_id: experience.userId,
        experience_key: experience.experienceKey,
        source_block_id: experience.sourceBlockId ?? null,
        source_focus_session_id: experience.sourceFocusSessionId ?? null,
        title_snapshot: experience.titleSnapshot ?? null,
        block_type_snapshot: experience.blockTypeSnapshot ?? null,
        tag_snapshot: experience.tagSnapshot ?? null,
        engagement_mode: experience.engagementMode,
        outcome: experience.outcome,
        source: experience.source,
        scheduled_start: experience.scheduledStart ?? null,
        scheduled_end: experience.scheduledEnd ?? null,
        actual_start: experience.actualStart ?? null,
        actual_end: experience.actualEnd ?? null,
        actual_duration_min: experience.actualDurationMin ?? null,
        energy_impact: experience.energyImpact,
        cognitive_load: experience.cognitiveLoad,
        perceived_value: experience.perceivedValue,
        social_demand: experience.socialDemand,
        outcome_reason: experience.outcomeReason,
        location_mode: experience.locationMode ?? null,
        presence_mode: experience.presenceMode ?? null,
        was_planned: experience.wasPlanned,
        was_completed_as_planned: experience.wasCompletedAsPlanned,
        was_user_confirmed: experience.wasUserConfirmed,
        was_system_inferred: experience.wasSystemInferred,
        confidence: experience.confidence ?? null,
        notes: experience.notes ?? null,
        metadata_json: experience.metadataJson ?? {},
        created_at: experience.createdAt,
        updated_at: experience.updatedAt,
    };
}

async function upsertActivityExperience(
    supabase: SupabaseClient,
    experience: ActivityExperience,
) {
    const payload = serializeActivityExperience(experience);
    const { data, error } = await supabase
        .from("activity_experiences")
        .upsert(payload, { onConflict: "user_id,experience_key" })
        .select("*")
        .maybeSingle();

    if (error) throw error;
    return data ? mapActivityExperienceRow(data as DbRow) : experience;
}

export async function fetchActivityExperienceByKey(
    supabase: SupabaseClient,
    userId: string,
    experienceKey: string,
) {
    const { data, error } = await supabase
        .from("activity_experiences")
        .select("*")
        .eq("user_id", userId)
        .eq("experience_key", experienceKey)
        .maybeSingle();

    if (error) throw error;
    return data ? mapActivityExperienceRow(data as DbRow) : null;
}

export async function fetchActivityExperienceForBlock(
    supabase: SupabaseClient,
    userId: string,
    blockId: string,
) {
    const { data, error } = await supabase
        .from("activity_experiences")
        .select("*")
        .eq("user_id", userId)
        .eq("source_block_id", blockId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data ? mapActivityExperienceRow(data as DbRow) : null;
}

export async function fetchRecentActivityExperiences(
    supabase: SupabaseClient,
    userId: string,
    options?: {
        sinceDays?: number;
        startDate?: string;
        endDate?: string;
        limit?: number;
        blockId?: string;
    },
) {
    let query = supabase
        .from("activity_experiences")
        .select("*")
        .eq("user_id", userId)
        .order("scheduled_start", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false });

    if (options?.sinceDays) {
        const since = new Date();
        since.setDate(since.getDate() - options.sinceDays);
        query = query.gte("updated_at", since.toISOString());
    }

    if (options?.startDate) {
        query = query.gte("scheduled_start", `${options.startDate}T00:00:00.000Z`);
    }

    if (options?.endDate) {
        query = query.lte("scheduled_start", `${options.endDate}T23:59:59.999Z`);
    }

    if (options?.blockId) {
        query = query.eq("source_block_id", options.blockId);
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => mapActivityExperienceRow(row as DbRow));
}

export async function syncFocusSessionToActivityExperience(
    supabase: SupabaseClient,
    userId: string,
    session: FocusSession,
    analytics?: FocusSessionAnalytics | null,
) {
    const experienceKey = `focus:${session.id}`;
    const existing = await fetchActivityExperienceByKey(supabase, userId, experienceKey);
    const mapped = mapFocusSessionToActivityExperience({
        userId,
        session,
        analytics,
        existing,
    });
    return upsertActivityExperience(supabase, mapped);
}

export async function inferActivityExperienceForBlock(
    supabase: SupabaseClient,
    userId: string,
    block: Block,
    options?: {
        source?: ActivityExperience["source"];
        markUserConfirmed?: boolean;
        checkout?: Partial<ActivityExperienceCheckoutInput> | null;
    },
) {
    const existing = await fetchActivityExperienceForBlock(supabase, userId, block.id);
    const inferred = inferActivityExperienceFromBlock({
        userId,
        block,
        existing,
        source: options?.source,
        markUserConfirmed: options?.markUserConfirmed,
        checkout: options?.checkout,
    });

    if (!inferred) return existing;
    return upsertActivityExperience(supabase, inferred);
}

export async function recordActivityCheckout(
    supabase: SupabaseClient,
    userId: string,
    args: {
        block: Block;
        checkout: ActivityExperienceCheckoutInput;
    },
) {
    const existing = await fetchActivityExperienceForBlock(supabase, userId, args.block.id);
    const base = existing ?? inferActivityExperienceFromBlock({
        userId,
        block: args.block,
        checkout: {
            outcome: args.checkout.outcome,
        },
    });

    if (!base) {
        throw new Error("This block cannot create an activity experience.");
    }

    const updated = applyCheckoutToExperience(base, args.checkout);
    return upsertActivityExperience(supabase, updated);
}

export async function recordBlockRescheduleExperience(
    supabase: SupabaseClient,
    userId: string,
    previousBlock: Block,
    nextBlock: Block,
) {
    const existing = await fetchActivityExperienceForBlock(supabase, userId, previousBlock.id);
    const inferred = inferRescheduledActivityExperience({
        userId,
        previousBlock,
        nextBlock,
        existing,
    });

    if (!inferred) return existing;
    return upsertActivityExperience(supabase, inferred);
}

export async function computeActivityExperienceAnalyticsForUser(
    supabase: SupabaseClient,
    userId: string,
    options?: { sinceDays?: number; limit?: number },
) {
    const experiences = await fetchRecentActivityExperiences(supabase, userId, options);
    return computeActivityExperienceAnalytics(experiences);
}

export async function computeActivityBehaviorSignalsForUser(
    supabase: SupabaseClient,
    userId: string,
    focusAnalytics: FocusSessionAnalytics[],
    options?: { sinceDays?: number; limit?: number },
) {
    const experiences = await fetchRecentActivityExperiences(supabase, userId, options);
    return buildActivityBehaviorSignals(experiences, focusAnalytics);
}

export async function backfillActivityExperiences(
    supabase: SupabaseClient,
    userId: string,
    options?: {
        blocks?: Block[];
        focusSessions?: FocusSession[];
        focusAnalytics?: FocusSessionAnalytics[];
        sinceDays?: number;
    },
) {
    const experiences: ActivityExperience[] = [];
    const focusSessions = options?.focusSessions ?? [];
    const focusAnalyticsMap = new Map((options?.focusAnalytics ?? []).map((item) => [item.sessionId, item]));

    for (const session of focusSessions) {
        if (!session.endedAt) continue;
        experiences.push(await syncFocusSessionToActivityExperience(
            supabase,
            userId,
            session,
            focusAnalyticsMap.get(session.id) ?? null,
        ));
    }

    for (const block of options?.blocks ?? []) {
        const synced = await inferActivityExperienceForBlock(supabase, userId, block);
        if (synced) experiences.push(synced);
    }

    return experiences;
}

export function mergeActivitySignals(
    analytics: ActivityExperienceAnalytics | null,
    signals: ActivityBehaviorSignals,
) {
    return {
        analytics,
        signals,
    };
}
