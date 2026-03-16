import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateMomentumDay, calculateMomentumTotal } from "@/lib/engines/patternEngine/momentum";
import {
    buildBehaviorProfile,
    buildEmptyBehaviorProfile,
    buildInsightCards,
    buildProfileSummary,
    deriveSessionAnalytics,
    getFocusWindowLabel,
} from "@/lib/engines/personalIntelligence";
import {
    BehaviorPatternRecord,
    BehaviorProfile,
    FocusSessionAnalytics,
    InsightsDashboardData,
} from "@/lib/types/behavior";
import { FocusInterventionRecord, FocusSession, FocusSessionEvent } from "@/lib/types/focus";
import { DailyMetric } from "@/lib/types/metrics";

type PersonalIntelligenceScope = "session" | "daily" | "weekly";
type ConsolidationBatchScope = Exclude<PersonalIntelligenceScope, "session">;
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

function asArray<T>(value: unknown) {
    return Array.isArray(value) ? value as T[] : [];
}

function asObject(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}

function mapFocusSessionRow(row: DbRow): FocusSession {
    return {
        id: asString(row.id),
        mode: asString(row.mode) as FocusSession["mode"],
        blockId: asNullableString(row.block_id) ?? undefined,
        blockType: (asNullableString(row.block_type) ?? undefined) as FocusSession["blockType"],
        initiatedAt: asNullableString(row.initiated_at) ?? undefined,
        consolidatedAt: asNullableString(row.consolidated_at) ?? undefined,
        startedAt: asString(row.started_at),
        endedAt: asNullableString(row.ended_at) ?? undefined,
        plannedDurationMs: row.planned_duration_ms == null ? undefined : asNumber(row.planned_duration_ms),
        isActive: asBoolean(row.is_active),
        isPaused: asBoolean(row.is_paused),
        pausedAt: asNullableString(row.paused_at) ?? undefined,
        totalPausedMs: asNumber(row.total_paused_ms),
        pauseCount: asNumber(row.pause_count),
        exitCount: asNumber(row.exit_count),
        restCount: asNumber(row.rest_count),
        lastPauseReason: (asNullableString(row.last_pause_reason) ?? null) as FocusSession["lastPauseReason"],
        pauseEvents: asArray<number>(row.pause_events),
        exitEvents: asArray<number>(row.exit_events),
        firstInteractionAt: asNullableString(row.first_interaction_at) ?? undefined,
        lastInteractionAt: asNullableString(row.last_interaction_at) ?? undefined,
        intention: asNullableString(row.intention) ?? undefined,
        nextStep: asNullableString(row.next_step) ?? undefined,
        minimumViable: asNullableString(row.minimum_viable) ?? undefined,
        energyBefore: row.energy_before == null ? undefined : asNumber(row.energy_before),
        moodBefore: row.mood_before == null ? undefined : asNumber(row.mood_before),
        moodAfter: row.mood_after == null ? undefined : asNumber(row.mood_after),
        progressFeelingAfter: row.progress_feeling_after == null ? undefined : asNumber(row.progress_feeling_after),
        difficulty: row.difficulty == null ? undefined : asNumber(row.difficulty),
        clarity: row.clarity == null ? undefined : asNumber(row.clarity),
        startDelayMs: row.start_delay_ms == null ? undefined : asNumber(row.start_delay_ms),
        previousContext: asNullableString(row.previous_context) ?? undefined,
        sessionQualityScore: row.session_quality_score == null ? undefined : asNumber(row.session_quality_score),
        activeLayer: (asObject(row.active_layer) ?? null) as FocusSession["activeLayer"],
        history: asArray<string>(row.history),
        cardMemory: (asObject(row.card_memory) ?? {}) as NonNullable<FocusSession["cardMemory"]>,
        closureBridgeShown: asBoolean(row.closure_bridge_shown),
        closureNote: (asObject(row.closure_note) ?? null) as FocusSession["closureNote"],
        entryRitual: (asObject(row.entry_ritual) ?? undefined) as FocusSession["entryRitual"],
        persistenceStatus: "persisted",
    };
}

function mapFocusEventRow(row: DbRow): FocusSessionEvent {
    return {
        id: asString(row.id),
        sessionId: asString(row.session_id),
        type: asString(row.event_type) as FocusSessionEvent["type"],
        runtimeState: asString(row.runtime_state) as FocusSessionEvent["runtimeState"],
        timestamp: asString(row.occurred_at),
        relativeMs: asNumber(row.relative_ms),
        payload: asObject(row.payload),
    };
}

function mapInterventionRow(row: DbRow): FocusInterventionRecord {
    return {
        id: asString(row.id),
        sessionId: asString(row.session_id),
        timestamp: new Date(asString(row.occurred_at)).getTime(),
        type: asString(row.type),
        sourceCard: asNullableString(row.source_card),
        sourceToast: asNullableString(row.source_toast),
        trigger: asNullableString(row.trigger),
        actionTaken: asNullableString(row.action_taken),
        result: asNullableString(row.result),
        payload: asObject(row.payload),
    };
}

function mapAnalyticsRow(row: DbRow): FocusSessionAnalytics {
    return {
        sessionId: asString(row.session_id),
        userId: asString(row.user_id),
        mode: asString(row.mode) as FocusSessionAnalytics["mode"],
        blockType: (asNullableString(row.block_type) ?? undefined) as FocusSessionAnalytics["blockType"],
        initiatedAt: asString(row.initiated_at),
        startedAt: asString(row.started_at),
        endedAt: asString(row.ended_at),
        entryDurationMs: asNumber(row.entry_duration_ms),
        plannedDurationMs: asNumber(row.planned_duration_ms),
        actualDurationMs: asNumber(row.actual_duration_ms),
        activeDurationMs: asNumber(row.active_duration_ms),
        pauseDurationMs: asNumber(row.pause_duration_ms),
        inactivityDurationMs: asNumber(row.inactivity_duration_ms),
        pauseCount: asNumber(row.pause_count),
        exitCount: asNumber(row.exit_count),
        taskChangeCount: asNumber(row.task_change_count),
        interventionCount: asNumber(row.intervention_count),
        interventionAcceptCount: asNumber(row.intervention_accept_count),
        interventionIgnoreCount: asNumber(row.intervention_ignore_count),
        inactivityCount: asNumber(row.inactivity_count),
        stabilityRecoveryCount: asNumber(row.stability_recovery_count),
        closureType: asString(row.closure_type) as FocusSessionAnalytics["closureType"],
        completionRatio: asNumber(row.completion_ratio),
        stabilityRatio: asNumber(row.stability_ratio),
        continuityRatio: asNumber(row.continuity_ratio),
        recoveryRatio: asNumber(row.recovery_ratio),
        startDelayMs: asNumber(row.start_delay_ms),
        progressScore: asNumber(row.progress_score),
        frictionScore: asNumber(row.friction_score),
        consistencyScore: asNumber(row.consistency_score),
        behaviorScore: asNumber(row.behavior_score),
        timeWindow: asString(row.time_window) as FocusSessionAnalytics["timeWindow"],
        durationBucket: asString(row.duration_bucket) as FocusSessionAnalytics["durationBucket"],
        diagnostics: row.diagnostics as FocusSessionAnalytics["diagnostics"],
        computedAt: asNullableString(row.computed_at) ?? asNullableString(row.updated_at) ?? new Date().toISOString(),
        updatedAt: asNullableString(row.updated_at) ?? asNullableString(row.computed_at) ?? new Date().toISOString(),
    };
}

function mapDailyMetricRow(row: DbRow): DailyMetric {
    return {
        id: asString(row.id),
        userId: asString(row.user_id),
        date: asString(row.date),
        progressScore: row.progress_score == null ? undefined : asNumber(row.progress_score),
        frictionScore: row.friction_score == null ? undefined : asNumber(row.friction_score),
        consistencyScore: row.consistency_score == null ? undefined : asNumber(row.consistency_score),
        emotionScore: row.emotion_score == null ? undefined : asNumber(row.emotion_score),
        behaviorScore: row.behavior_score == null ? undefined : asNumber(row.behavior_score),
        momentumDay: row.momentum_day == null ? undefined : asNumber(row.momentum_day),
        momentumTotal: row.momentum_total == null ? undefined : asNumber(row.momentum_total),
        sessionCount: row.session_count == null ? undefined : asNumber(row.session_count),
        completedSessions: row.completed_sessions == null ? undefined : asNumber(row.completed_sessions),
        abandonedSessions: row.abandoned_sessions == null ? undefined : asNumber(row.abandoned_sessions),
        activeDurationMs: row.active_duration_ms == null ? undefined : asNumber(row.active_duration_ms),
        pauseDurationMs: row.pause_duration_ms == null ? undefined : asNumber(row.pause_duration_ms),
        inactivityDurationMs: row.inactivity_duration_ms == null ? undefined : asNumber(row.inactivity_duration_ms),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
    };
}

function hydrateProfileRow(row: DbRow): BehaviorProfile {
    return {
        userId: asString(row.user_id),
        warmupStage: asString(row.warmup_stage) as BehaviorProfile["warmupStage"],
        bestFocusWindow: (row.best_focus_window ?? null) as BehaviorProfile["bestFocusWindow"],
        optimalSessionLength: (row.optimal_session_length ?? null) as BehaviorProfile["optimalSessionLength"],
        topFrictionSources: (row.top_friction_sources ?? []) as BehaviorProfile["topFrictionSources"],
        consistencyTrend: (row.consistency_trend ?? null) as BehaviorProfile["consistencyTrend"],
        recentImprovements: (row.recent_improvements ?? []) as BehaviorProfile["recentImprovements"],
        activePatterns: (row.active_patterns ?? []) as BehaviorProfile["activePatterns"],
        confidenceOverview: (row.confidence_overview ?? {
            bestFocusWindow: null,
            optimalSessionLength: null,
            frictionSource: null,
            consistencyTrend: null,
            recentImprovement: null,
            overall: 0,
        }) as BehaviorProfile["confidenceOverview"],
        lastSessionAnalyticsAt: asNullableString(row.last_session_analytics_at),
        lastDailyConsolidatedAt: asNullableString(row.last_daily_consolidated_at),
        lastWeeklyConsolidatedAt: asNullableString(row.last_weekly_consolidated_at),
        lastUpdatedAt: asNullableString(row.last_updated_at) ?? new Date().toISOString(),
        profileVersion: asNullableString(row.profile_version) ?? "v2",
    };
}

function serializeProfile(profile: BehaviorProfile) {
    return {
        user_id: profile.userId,
        warmup_stage: profile.warmupStage,
        best_focus_window: profile.bestFocusWindow,
        optimal_session_length: profile.optimalSessionLength,
        top_friction_sources: profile.topFrictionSources,
        consistency_trend: profile.consistencyTrend,
        recent_improvements: profile.recentImprovements,
        active_patterns: profile.activePatterns,
        confidence_overview: profile.confidenceOverview,
        last_session_analytics_at: profile.lastSessionAnalyticsAt,
        last_daily_consolidated_at: profile.lastDailyConsolidatedAt,
        last_weekly_consolidated_at: profile.lastWeeklyConsolidatedAt,
        last_updated_at: profile.lastUpdatedAt,
        profile_version: profile.profileVersion,
    };
}

function serializeAnalytics(analytics: FocusSessionAnalytics) {
    return {
        session_id: analytics.sessionId,
        user_id: analytics.userId,
        mode: analytics.mode,
        block_type: analytics.blockType ?? null,
        time_window: analytics.timeWindow,
        duration_bucket: analytics.durationBucket,
        initiated_at: analytics.initiatedAt,
        started_at: analytics.startedAt,
        ended_at: analytics.endedAt,
        entry_duration_ms: analytics.entryDurationMs,
        planned_duration_ms: analytics.plannedDurationMs,
        actual_duration_ms: analytics.actualDurationMs,
        active_duration_ms: analytics.activeDurationMs,
        pause_duration_ms: analytics.pauseDurationMs,
        inactivity_duration_ms: analytics.inactivityDurationMs,
        pause_count: analytics.pauseCount,
        exit_count: analytics.exitCount,
        task_change_count: analytics.taskChangeCount,
        intervention_count: analytics.interventionCount,
        intervention_accept_count: analytics.interventionAcceptCount,
        intervention_ignore_count: analytics.interventionIgnoreCount,
        inactivity_count: analytics.inactivityCount,
        stability_recovery_count: analytics.stabilityRecoveryCount,
        closure_type: analytics.closureType,
        completion_ratio: analytics.completionRatio,
        stability_ratio: analytics.stabilityRatio,
        continuity_ratio: analytics.continuityRatio,
        recovery_ratio: analytics.recoveryRatio,
        start_delay_ms: analytics.startDelayMs,
        progress_score: analytics.progressScore,
        friction_score: analytics.frictionScore,
        consistency_score: analytics.consistencyScore,
        behavior_score: analytics.behaviorScore,
        diagnostics: analytics.diagnostics,
        computed_at: analytics.computedAt,
        updated_at: analytics.updatedAt,
    };
}

function startOfDayIso(value: string | Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
}

function endOfDayIso(value: string | Date) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date.toISOString();
}

function average(values: number[]) {
    if (values.length === 0) return 0;
    return values.reduce((total, value) => total + value, 0) / values.length;
}

function calculateFocusStreakFromAnalytics(analytics: FocusSessionAnalytics[], now = new Date()) {
    const dayKeys = new Set(analytics.map((item) => item.endedAt.slice(0, 10)));
    const cursor = new Date(now);
    let streak = 0;

    for (let offset = 0; offset < 30; offset += 1) {
        const day = new Date(cursor);
        day.setDate(cursor.getDate() - offset);
        const key = day.toISOString().slice(0, 10);

        if (dayKeys.has(key)) {
            streak += 1;
            continue;
        }

        if (offset === 0) {
            continue;
        }

        break;
    }

    return streak;
}

async function fetchProfileRow(supabase: SupabaseClient, userId: string) {
    const { data } = await supabase
        .from("user_behavior_profile")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    return data ? hydrateProfileRow(data) : null;
}

async function fetchRecentAnalytics(
    supabase: SupabaseClient,
    userId: string,
    options?: {
        sinceDays?: number;
        excludeSessionId?: string;
        limit?: number;
    }
) {
    const since = new Date();
    since.setDate(since.getDate() - (options?.sinceDays ?? 45));

    let query = supabase
        .from("focus_session_analytics")
        .select("*")
        .eq("user_id", userId)
        .gte("ended_at", since.toISOString())
        .order("ended_at", { ascending: false });

    if (options?.excludeSessionId) {
        query = query.neq("session_id", options.excludeSessionId);
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data } = await query;
    return (data ?? []).map(mapAnalyticsRow);
}

async function recomputeDailyMetricsFromAnalytics(
    supabase: SupabaseClient,
    userId: string,
    targetDate: string | Date
) {
    const targetDateObj = new Date(targetDate);
    const targetDateStr = targetDateObj.toISOString().slice(0, 10);
    const dayStart = startOfDayIso(targetDateObj);
    const dayEnd = endOfDayIso(targetDateObj);

    const { data: analyticsRows } = await supabase
        .from("focus_session_analytics")
        .select("*")
        .eq("user_id", userId)
        .gte("ended_at", dayStart)
        .lte("ended_at", dayEnd);

    const dayAnalytics = (analyticsRows ?? []).map(mapAnalyticsRow);
    const progressScore = Math.round(average(dayAnalytics.map((item) => item.progressScore)));
    const frictionScore = Math.round(average(dayAnalytics.map((item) => item.frictionScore)));
    const consistencyScore = Math.round(average(dayAnalytics.map((item) => item.consistencyScore)));
    const behaviorScore = Math.round(average(dayAnalytics.map((item) => item.behaviorScore)));
    const sessionCount = dayAnalytics.length;
    const completedSessions = dayAnalytics.filter((item) => item.closureType === "completed").length;
    const abandonedSessions = dayAnalytics.filter((item) => item.closureType === "abandoned").length;
    const activeDurationMs = dayAnalytics.reduce((total, item) => total + item.activeDurationMs, 0);
    const pauseDurationMs = dayAnalytics.reduce((total, item) => total + item.pauseDurationMs, 0);
    const inactivityDurationMs = dayAnalytics.reduce((total, item) => total + item.inactivityDurationMs, 0);
    const momentumDay = calculateMomentumDay(progressScore, consistencyScore, frictionScore, behaviorScore);

    const since = new Date(targetDateObj);
    since.setDate(since.getDate() - 30);
    const { data: pastMetricsRows } = await supabase
        .from("daily_metrics")
        .select("date, momentum_day")
        .eq("user_id", userId)
        .gte("date", since.toISOString().slice(0, 10))
        .lte("date", targetDateStr)
        .order("date", { ascending: false });

    const pastMetrics = (pastMetricsRows ?? [])
        .filter((metric: { date: string; momentum_day?: number | null }) => metric.date !== targetDateStr)
        .map((metric: { date: string; momentum_day?: number | null }) => ({
            date: metric.date,
            momentum_day: Number(metric.momentum_day ?? 0),
        }));

    pastMetrics.unshift({ date: targetDateStr, momentum_day: momentumDay });
    const momentumTotal = calculateMomentumTotal(pastMetrics);

    const payload = {
        user_id: userId,
        date: targetDateStr,
        progress_score: progressScore,
        friction_score: frictionScore,
        consistency_score: consistencyScore,
        emotion_score: behaviorScore,
        behavior_score: behaviorScore,
        momentum_day: momentumDay,
        momentum_total: momentumTotal,
        session_count: sessionCount,
        completed_sessions: completedSessions,
        abandoned_sessions: abandonedSessions,
        active_duration_ms: activeDurationMs,
        pause_duration_ms: pauseDurationMs,
        inactivity_duration_ms: inactivityDurationMs,
        updated_at: new Date().toISOString(),
    };

    await supabase.from("daily_metrics").upsert(payload, { onConflict: "user_id,date" });
}

async function syncPatternHistory(
    supabase: SupabaseClient,
    userId: string,
    patterns: BehaviorPatternRecord[],
    nowIso: string
) {
    const { data: existingRows } = await supabase
        .from("behavior_pattern_history")
        .select("pattern_key, first_detected_at")
        .eq("user_id", userId);

    const existingMap = new Map(
        (existingRows ?? []).map((row: { pattern_key: string; first_detected_at: string }) => [row.pattern_key, row.first_detected_at])
    );
    const activeKeys = new Set(patterns.map((pattern) => pattern.patternKey));

    if (patterns.length > 0) {
        const payload = patterns.map((pattern) => ({
            user_id: userId,
            pattern_key: pattern.patternKey,
            pattern_type: pattern.patternType,
            status: pattern.status,
            window_kind: pattern.windowKind,
            confidence: pattern.confidence,
            sample_size: pattern.sampleSize,
            pattern_data: pattern.data,
            evidence: pattern.evidence,
            first_detected_at: existingMap.get(pattern.patternKey) ?? nowIso,
            last_confirmed_at: nowIso,
            updated_at: nowIso,
        }));

        await supabase
            .from("behavior_pattern_history")
            .upsert(payload, { onConflict: "user_id,pattern_key" });
    }

    const staleKeys = [...existingMap.keys()].filter((patternKey) => !activeKeys.has(patternKey));
    if (staleKeys.length > 0) {
        await supabase
            .from("behavior_pattern_history")
            .update({
                status: "stale",
                updated_at: nowIso,
            })
            .eq("user_id", userId)
            .in("pattern_key", staleKeys);
    }
}

async function consolidateBehaviorProfile(
    supabase: SupabaseClient,
    userId: string,
    scope: PersonalIntelligenceScope
) {
    const currentProfile = await fetchProfileRow(supabase, userId);
    const analytics = await fetchRecentAnalytics(supabase, userId, { sinceDays: 45 });
    const now = new Date();
    const nowIso = now.toISOString();

    const profile = analytics.length === 0
        ? buildEmptyBehaviorProfile(userId, nowIso)
        : buildBehaviorProfile(userId, analytics, {
            now,
            lastDailyConsolidatedAt: scope === "daily"
                ? nowIso
                : currentProfile?.lastDailyConsolidatedAt ?? null,
            lastWeeklyConsolidatedAt: scope === "weekly"
                ? nowIso
                : currentProfile?.lastWeeklyConsolidatedAt ?? null,
        });

    if (scope === "session") {
        profile.lastDailyConsolidatedAt = currentProfile?.lastDailyConsolidatedAt ?? null;
        profile.lastWeeklyConsolidatedAt = currentProfile?.lastWeeklyConsolidatedAt ?? null;
    }

    await supabase
        .from("user_behavior_profile")
        .upsert(serializeProfile(profile), { onConflict: "user_id" });

    await syncPatternHistory(supabase, userId, profile.activePatterns, nowIso);
    return profile;
}

export async function syncSessionPersonalIntelligence(
    supabase: SupabaseClient,
    userId: string,
    sessionId: string
) {
    const { data: sessionRow } = await supabase
        .from("focus_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("id", sessionId)
        .maybeSingle();

    if (!sessionRow) {
        throw new Error("Session not found for personal intelligence sync.");
    }

    const session = mapFocusSessionRow(sessionRow);
    if (!session.endedAt) {
        return { status: "skipped", reason: "session_not_finished" as const };
    }

    const [{ data: eventRows }, { data: interventionRows }, recentAnalytics] = await Promise.all([
        supabase
            .from("focus_session_events")
            .select("*")
            .eq("user_id", userId)
            .eq("session_id", sessionId)
            .order("occurred_at", { ascending: true }),
        supabase
            .from("focus_session_interventions")
            .select("*")
            .eq("user_id", userId)
            .eq("session_id", sessionId)
            .order("occurred_at", { ascending: true }),
        fetchRecentAnalytics(supabase, userId, {
            sinceDays: 30,
            excludeSessionId: sessionId,
        }),
    ]);

    const analytics = deriveSessionAnalytics({
        userId,
        session,
        events: (eventRows ?? []).map(mapFocusEventRow),
        interventions: (interventionRows ?? []).map(mapInterventionRow),
        recentAnalytics,
    });

    await supabase
        .from("focus_session_analytics")
        .upsert(serializeAnalytics(analytics), { onConflict: "session_id" });

    await recomputeDailyMetricsFromAnalytics(supabase, userId, analytics.endedAt);
    const profile = await consolidateBehaviorProfile(supabase, userId, "session");

    return {
        status: "synced" as const,
        analytics,
        profile,
    };
}

export async function runDailyPersonalIntelligenceConsolidation(
    supabase: SupabaseClient,
    userId: string
) {
    const analytics = await fetchRecentAnalytics(supabase, userId, { sinceDays: 7 });
    const affectedDates = [...new Set(analytics.map((item) => item.endedAt.slice(0, 10)))];

    await Promise.all(
        affectedDates.map((date) => recomputeDailyMetricsFromAnalytics(supabase, userId, date))
    );

    const profile = await consolidateBehaviorProfile(supabase, userId, "daily");
    return {
        status: "synced" as const,
        profile,
        affectedDates,
    };
}

export async function runWeeklyPersonalIntelligenceConsolidation(
    supabase: SupabaseClient,
    userId: string
) {
    const analytics = await fetchRecentAnalytics(supabase, userId, { sinceDays: 30 });
    const affectedDates = [...new Set(analytics.map((item) => item.endedAt.slice(0, 10)))];

    await Promise.all(
        affectedDates.map((date) => recomputeDailyMetricsFromAnalytics(supabase, userId, date))
    );

    const profile = await consolidateBehaviorProfile(supabase, userId, "weekly");
    return {
        status: "synced" as const,
        profile,
        affectedDates,
    };
}

async function fetchCandidateUserIdsForBatch(
    supabase: SupabaseClient,
    scope: ConsolidationBatchScope,
    limit: number
) {
    const since = new Date();
    since.setDate(since.getDate() - (scope === "daily" ? 3 : 21));

    const [{ data: analyticsRows }, { data: profileRows }] = await Promise.all([
        supabase
            .from("focus_session_analytics")
            .select("user_id")
            .gte("ended_at", since.toISOString())
            .order("ended_at", { ascending: false })
            .limit(Math.max(limit * 4, 100)),
        supabase
            .from("user_behavior_profile")
            .select("user_id")
            .order("last_updated_at", { ascending: false })
            .limit(limit),
    ]);

    const ids = new Set<string>();

    for (const row of analyticsRows ?? []) {
        const userId = asString((row as DbRow).user_id);
        if (userId) ids.add(userId);
        if (ids.size >= limit) break;
    }

    if (ids.size < limit) {
        for (const row of profileRows ?? []) {
            const userId = asString((row as DbRow).user_id);
            if (userId) ids.add(userId);
            if (ids.size >= limit) break;
        }
    }

    return [...ids];
}

async function runBatchInChunks<TInput, TResult>(
    items: TInput[],
    chunkSize: number,
    worker: (item: TInput) => Promise<TResult>
) {
    const results: PromiseSettledResult<TResult>[] = [];

    for (let index = 0; index < items.length; index += chunkSize) {
        const chunk = items.slice(index, index + chunkSize);
        const chunkResults = await Promise.allSettled(chunk.map((item) => worker(item)));
        results.push(...chunkResults);
    }

    return results;
}

export async function runPersonalIntelligenceBatchConsolidation(
    supabase: SupabaseClient,
    scope: ConsolidationBatchScope,
    options?: {
        userIds?: string[];
        limit?: number;
    }
) {
    const requestedUserIds = (options?.userIds ?? [])
        .map((userId) => userId.trim())
        .filter(Boolean);
    const limit = Math.max(1, Math.min(options?.limit ?? 200, 500));
    const candidateUserIds = requestedUserIds.length > 0
        ? requestedUserIds.slice(0, limit)
        : await fetchCandidateUserIdsForBatch(supabase, scope, limit);

    if (candidateUserIds.length === 0) {
        return {
            status: "idle" as const,
            scope,
            candidateUsers: 0,
            processedUsers: 0,
            failedUsers: [] as Array<{ userId: string; error: string }>,
        };
    }

    const runner = scope === "daily"
        ? runDailyPersonalIntelligenceConsolidation
        : runWeeklyPersonalIntelligenceConsolidation;
    const results = await runBatchInChunks(candidateUserIds, 8, async (userId) => {
        await runner(supabase, userId);
        return userId;
    });

    const failedUsers = results.flatMap((result, index) => {
        if (result.status === "fulfilled") return [];
        const reason = result.reason instanceof Error
            ? result.reason.message
            : "Unknown consolidation error";

        return [{
            userId: candidateUserIds[index] ?? "unknown",
            error: reason,
        }];
    });

    return {
        status: failedUsers.length === 0 ? "synced" as const : "partial" as const,
        scope,
        candidateUsers: candidateUserIds.length,
        processedUsers: candidateUserIds.length - failedUsers.length,
        failedUsers,
    };
}

export async function getInsightsDashboardData(
    supabase: SupabaseClient,
    userId: string
): Promise<InsightsDashboardData> {
    let profile = await fetchProfileRow(supabase, userId);
    const recentAnalytics = await fetchRecentAnalytics(supabase, userId, { sinceDays: 30 });

    if (!profile) {
        profile = recentAnalytics.length > 0
            ? await consolidateBehaviorProfile(supabase, userId, "daily")
            : buildEmptyBehaviorProfile(userId);
    }

    const { data: metricRows } = await supabase
        .from("daily_metrics")
        .select("*")
        .eq("user_id", userId)
        .gte("date", new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10))
        .order("date", { ascending: true });

    const timeline = (metricRows ?? []).map(mapDailyMetricRow).map((metric) => ({
        date: metric.date,
        progressScore: metric.progressScore ?? null,
        frictionScore: metric.frictionScore ?? null,
        consistencyScore: metric.consistencyScore ?? null,
        behaviorScore: metric.behaviorScore ?? metric.emotionScore ?? null,
        momentumTotal: metric.momentumTotal ?? null,
    }));

    const latestMetric = [...timeline].reverse()[0];
    const sevenDayReference = [...timeline].reverse().find((metric, index) => index >= 6);
    const weeklyAnalytics = recentAnalytics.filter((item) => {
        return Date.now() - new Date(item.endedAt).getTime() <= (7 * 24 * 60 * 60 * 1000);
    });

    return {
        profile,
        cards: buildInsightCards(profile),
        timeline,
        weeklySessions: weeklyAnalytics.length,
        completionRate: weeklyAnalytics.length === 0
            ? 0
            : Math.round((weeklyAnalytics.filter((item) => item.closureType === "completed").length / weeklyAnalytics.length) * 100),
        averageStability: weeklyAnalytics.length === 0
            ? 0
            : Math.round(average(weeklyAnalytics.map((item) => item.stabilityRatio * 100))),
        momentumCurrent: latestMetric?.momentumTotal ?? 0,
        momentumDeltaWeek: latestMetric?.momentumTotal && sevenDayReference?.momentumTotal
            ? Math.round((latestMetric.momentumTotal ?? 0) - (sevenDayReference.momentumTotal ?? 0))
            : 0,
    };
}

export async function getHomeSummaryData(supabase: SupabaseClient, userId: string) {
    const dashboard = await getInsightsDashboardData(supabase, userId);
    const recentAnalytics = await fetchRecentAnalytics(supabase, userId, { sinceDays: 30, limit: 40 });
    const summary = buildProfileSummary(dashboard.profile, recentAnalytics);
    const mainCard = dashboard.cards[0];
    const latestTimelinePoint = [...dashboard.timeline].reverse()[0];
    const progressSignal = dashboard.weeklySessions === 0
        ? "quiet"
        : (latestTimelinePoint?.progressScore ?? 0) >= 65
            ? "positive"
            : "neutral";

    let softRecommendation = "Seguí sumando sesiones para que el perfil pueda acompañarte con más claridad.";
    if (dashboard.profile.bestFocusWindow) {
        softRecommendation = `Si podés, cuidá un bloque importante en la ${getFocusWindowLabel(dashboard.profile.bestFocusWindow.data.window)}.`;
    } else if (dashboard.profile.optimalSessionLength) {
        softRecommendation = `Probá sostener tus bloques ${dashboard.profile.optimalSessionLength.data.bucket === "medium" ? "en sesiones medias" : "dentro del rango que hoy te viene funcionando mejor"}.`;
    } else if (dashboard.profile.topFrictionSources[0]) {
        softRecommendation = `Cuando aparece ${dashboard.profile.topFrictionSources[0].data.label}, puede ayudarte entrar con un primer paso más chico.`;
    }

    return {
        momentum_current: dashboard.momentumCurrent,
        momentum_delta_week: dashboard.momentumDeltaWeek,
        main_insight: mainCard?.description ?? summary,
        progress_signal: progressSignal,
        soft_recommendation: softRecommendation,
        focus_streak: calculateFocusStreakFromAnalytics(recentAnalytics),
        weekly_sessions_count: dashboard.weeklySessions,
        best_focus_window: dashboard.profile.bestFocusWindow?.data.window ?? null,
    };
}
