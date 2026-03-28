import type { SupabaseClient } from "@supabase/supabase-js";
import {
    buildBehaviorProfile,
    buildEmptyBehaviorProfile,
} from "@/lib/engines/personalIntelligence";
import { buildPlanningGuide } from "@/lib/engines/planningEngine";
import { fetchRecentActivityExperiences } from "@/lib/server/activityExperience";
import { ActivityExperience } from "@/lib/types/activity";
import { BehaviorProfile, FocusSessionAnalytics } from "@/lib/types/behavior";
import { Block } from "@/lib/types/blocks";
import {
    PersistedPlanningRecommendation,
    PlanningFeedbackSummary,
    PlanningGuideResult,
    PlanningPreferencesInput,
    PlanningRecommendation,
    PlanningRecommendationStatus,
} from "@/lib/types/planning";
import { AppLanguage } from "@/lib/i18n/messages";

type DbRow = Record<string, unknown>;

function getPlanningServerCopy(language: AppLanguage) {
    return language === "es"
        ? {
            recommendationNotFound: "Recomendacion no encontrada",
            overlapConflict: "Aplicar esta recomendacion generaria un conflicto con otro bloque",
            manualReviewRequired: "Esta recomendacion requiere revision manual",
            cannotAutoApply: "Esta recomendacion no se puede aplicar automaticamente",
            missingMoveTarget: "Falta el horario sugerido para mover el bloque",
            blockNotFound: "Bloque no encontrado",
            missingBreakStart: "Falta el inicio sugerido para el descanso",
        }
        : {
            recommendationNotFound: "Recommendation not found",
            overlapConflict: "Applying this recommendation would overlap another block",
            manualReviewRequired: "This recommendation requires manual review",
            cannotAutoApply: "This recommendation cannot be applied automatically",
            missingMoveTarget: "Missing move target",
            blockNotFound: "Block not found",
            missingBreakStart: "Missing break start",
        };
}

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

function startOfDay(date: string) {
    const value = new Date(`${date}T00:00:00`);
    value.setHours(0, 0, 0, 0);
    return value;
}

function addDays(date: string, amount: number) {
    const value = startOfDay(date);
    value.setDate(value.getDate() + amount);
    return value;
}

type RecommendationLocator = {
    scopedUserId: string | null;
    scope: "block" | "day" | "guided_plan";
    type: string;
    targetKey: string;
    variant: string;
};

export function parseRecommendationLocator(recommendationId: string): RecommendationLocator | null {
    const parts = recommendationId.split(":").filter(Boolean);
    if (parts.length < 4) return null;

    const knownScopes = new Set(["block", "day", "guided_plan"]);
    if (knownScopes.has(parts[0])) {
        const [scope, type, targetKey, ...variantParts] = parts;
        return {
            scopedUserId: null,
            scope: scope as RecommendationLocator["scope"],
            type,
            targetKey,
            variant: variantParts.join(":") || "default",
        };
    }

    if (parts.length < 5 || !knownScopes.has(parts[1])) return null;

    const [scopedUserId, scope, type, targetKey, ...variantParts] = parts;
    return {
        scopedUserId,
        scope: scope as RecommendationLocator["scope"],
        type,
        targetKey,
        variant: variantParts.join(":") || "default",
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
        contextualConsistencyScore: asNumber(row.consistency_score),
        behaviorScore: asNumber(row.behavior_score),
        timeWindow: asString(row.time_window) as FocusSessionAnalytics["timeWindow"],
        durationBucket: asString(row.duration_bucket) as FocusSessionAnalytics["durationBucket"],
        diagnostics: row.diagnostics as FocusSessionAnalytics["diagnostics"],
        computedAt: asNullableString(row.computed_at) ?? new Date().toISOString(),
        updatedAt: asNullableString(row.updated_at) ?? new Date().toISOString(),
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
        activitySignals: (row.activity_signals ?? {
            attendanceReliability: null,
            postMeetingFatigue: null,
            postClassResidualLoad: null,
            preferredLightExecutionWindows: [],
            postponeTendencies: [],
            energyImpactByEngagementMode: [],
            dominantReasons: [],
            patterns: [],
            lastActivityAt: null,
        }) as BehaviorProfile["activitySignals"],
        activityAnalytics: (row.activity_analytics ?? null) as BehaviorProfile["activityAnalytics"],
        activityPatterns: (row.activity_patterns ?? []) as BehaviorProfile["activityPatterns"],
        lastSessionAnalyticsAt: asNullableString(row.last_session_analytics_at),
        lastActivityAnalyticsAt: asNullableString(row.last_activity_analytics_at),
        lastDailyConsolidatedAt: asNullableString(row.last_daily_consolidated_at),
        lastWeeklyConsolidatedAt: asNullableString(row.last_weekly_consolidated_at),
        lastUpdatedAt: asNullableString(row.last_updated_at) ?? new Date().toISOString(),
        profileVersion: asNullableString(row.profile_version) ?? "v2",
    };
}

function mapBlockRow(row: DbRow): Block {
    return {
        id: asString(row.id),
        title: asString(row.title),
        type: asString(row.type) as Block["type"],
        status: asString(row.status) as Block["status"],
        startAt: new Date(asString(row.start_at)),
        endAt: new Date(asString(row.end_at)),
        notes: asNullableString(row.notes) ?? undefined,
        tag: asNullableString(row.tag) ?? undefined,
        color: asNullableString(row.color) ?? undefined,
        priority: row.priority == null ? undefined : asNumber(row.priority) as Block["priority"],
        estimatedDurationMinutes: row.estimated_duration_minutes == null ? undefined : asNumber(row.estimated_duration_minutes),
        difficulty: row.difficulty == null ? undefined : asNumber(row.difficulty),
        flexibility: (asNullableString(row.flexibility) ?? undefined) as Block["flexibility"],
        intensity: (asNullableString(row.intensity) ?? undefined) as Block["intensity"],
        deadline: asNullableString(row.deadline) ? new Date(asString(row.deadline)) : undefined,
        cognitivelyHeavy: row.cognitively_heavy == null ? undefined : asBoolean(row.cognitively_heavy),
        splittable: row.splittable == null ? undefined : asBoolean(row.splittable),
        optional: row.optional == null ? undefined : asBoolean(row.optional),
        recurrenceId: asNullableString(row.recurrence_id) ?? undefined,
        recurrencePattern: (row.recurrence_pattern ?? undefined) as Block["recurrencePattern"],
        notifications: Array.isArray(row.notifications) ? row.notifications as number[] : undefined,
    };
}

function mapRecommendationRow(row: DbRow): PersistedPlanningRecommendation {
    const actionMode = asString(row.action_mode, "manual") as PersistedPlanningRecommendation["applyability"]["mode"];

    return {
        recommendationId: asString(row.recommendation_id),
        userId: asString(row.user_id),
        targetBlockId: asNullableString(row.target_block_id),
        targetDate: asNullableString(row.target_date),
        type: asString(row.type) as PersistedPlanningRecommendation["type"],
        scope: asString(row.scope) as PersistedPlanningRecommendation["scope"],
        status: asString(row.status) as PersistedPlanningRecommendation["status"],
        confidence: asNumber(row.confidence),
        priority: asString(row.priority) as PersistedPlanningRecommendation["priority"],
        title: asString(row.title),
        message: asString(row.message),
        reasonCode: asString(row.reason_code) as PersistedPlanningRecommendation["reasonCode"],
        reasonPayload: (row.reason_payload ?? {}) as PersistedPlanningRecommendation["reasonPayload"],
        evidence: (row.evidence ?? {}) as PersistedPlanningRecommendation["evidence"],
        applyability: {
            mode: actionMode,
            helperText: asString(
                (row.applyability as DbRow | undefined)?.helperText,
                actionMode === "auto"
                    ? "Agendo can apply this adjustment automatically."
                    : actionMode === "manual"
                        ? "This one is better reviewed manually."
                        : "This is guidance to keep in mind.",
            ),
        },
        suggestedAction: (row.suggested_action ?? {}) as PersistedPlanningRecommendation["suggestedAction"],
        dismissible: asBoolean(row.dismissible, true),
        reversible: asBoolean(row.reversible, false),
        createdAt: asNullableString(row.created_at) ?? new Date().toISOString(),
        expiresAt: asNullableString(row.expires_at),
        acceptedAt: asNullableString(row.accepted_at),
        appliedAt: asNullableString(row.applied_at),
        dismissedAt: asNullableString(row.dismissed_at),
        ignoredAt: asNullableString(row.ignored_at),
        firstSeenAt: asNullableString(row.first_seen_at),
        lastSeenAt: asNullableString(row.last_seen_at),
        seenCount: asNumber(row.seen_count, 0),
        acceptedCount: asNumber(row.accepted_count, 0),
        dismissedCount: asNumber(row.dismissed_count, 0),
        ignoredCount: asNumber(row.ignored_count, 0),
        appliedCount: asNumber(row.applied_count, 0),
    };
}

export function canAutoApplyRecommendation(
    recommendation: Pick<PersistedPlanningRecommendation | PlanningRecommendation, "applyability" | "suggestedAction" | "targetBlockId">,
) {
    if (recommendation.applyability.mode !== "auto") return false;

    if (recommendation.suggestedAction.kind === "move") {
        return Boolean(
            recommendation.targetBlockId
            && asNullableString(recommendation.suggestedAction.payload.suggestedStart)
            && asNullableString(recommendation.suggestedAction.payload.suggestedEnd)
        );
    }

    if (recommendation.suggestedAction.kind === "shorten" || recommendation.suggestedAction.kind === "split" || recommendation.suggestedAction.kind === "mark_optional") {
        return Boolean(recommendation.targetBlockId);
    }

    if (recommendation.suggestedAction.kind === "insert_break") {
        return Boolean(asNullableString(recommendation.suggestedAction.payload.suggestedStart));
    }

    return false;
}

export function summarizePlanningFeedback(rows: PersistedPlanningRecommendation[]): PlanningFeedbackSummary {
    return rows.reduce<PlanningFeedbackSummary>((summary, row) => {
        const existing = summary[row.type] ?? {
            type: row.type,
            shownCount: 0,
            acceptedCount: 0,
            dismissedCount: 0,
            ignoredCount: 0,
            appliedCount: 0,
            lastFeedbackAt: null,
        };

        const lastFeedbackAt = row.appliedAt ?? row.dismissedAt ?? row.acceptedAt ?? row.ignoredAt ?? existing.lastFeedbackAt;

        summary[row.type] = {
            ...existing,
            shownCount: existing.shownCount + row.seenCount,
            acceptedCount: existing.acceptedCount + row.acceptedCount,
            dismissedCount: existing.dismissedCount + row.dismissedCount,
            ignoredCount: existing.ignoredCount + row.ignoredCount,
            appliedCount: existing.appliedCount + row.appliedCount,
            lastFeedbackAt,
        };

        return summary;
    }, {});
}

export function serializeRecommendation(
    userId: string,
    recommendation: PlanningRecommendation,
    existingRow?: PersistedPlanningRecommendation,
    status: PlanningRecommendationStatus = "active",
) {
    const now = new Date().toISOString();
    const seenCount = Math.max(1, (existingRow?.seenCount ?? 0) + 1);
    const shouldMarkIgnored = status === "active" && seenCount >= 3 && (existingRow?.acceptedCount ?? 0) === 0 && (existingRow?.appliedCount ?? 0) === 0;
    const nextStatus = shouldMarkIgnored ? "ignored" : status;

    return {
        recommendation_id: recommendation.id,
        user_id: userId,
        target_block_id: recommendation.targetBlockId ?? null,
        target_date: recommendation.targetDate ?? null,
        type: recommendation.type,
        scope: recommendation.scope,
        status: nextStatus,
        confidence: recommendation.confidence,
        priority: recommendation.priority,
        title: recommendation.title,
        message: recommendation.message,
        reason_code: recommendation.reasonCode,
        reason_payload: recommendation.reasonPayload,
        evidence: recommendation.evidence,
        applyability: recommendation.applyability,
        action_mode: recommendation.applyability.mode,
        suggested_action: recommendation.suggestedAction,
        dismissible: recommendation.dismissible,
        reversible: recommendation.reversible,
        created_at: existingRow?.createdAt ?? recommendation.createdAt,
        updated_at: now,
        first_seen_at: existingRow?.firstSeenAt ?? now,
        last_seen_at: now,
        seen_count: seenCount,
        accepted_count: existingRow?.acceptedCount ?? 0,
        dismissed_count: existingRow?.dismissedCount ?? 0,
        ignored_count: (existingRow?.ignoredCount ?? 0) + (shouldMarkIgnored ? 1 : 0),
        applied_count: existingRow?.appliedCount ?? 0,
        accepted_at: existingRow?.acceptedAt ?? null,
        dismissed_at: nextStatus === "dismissed" ? now : existingRow?.dismissedAt ?? null,
        applied_at: nextStatus === "applied" ? now : existingRow?.appliedAt ?? null,
        ignored_at: shouldMarkIgnored ? now : existingRow?.ignoredAt ?? null,
        expires_at: null,
    };
}

const LEGACY_RECOMMENDATION_COLUMNS = [
    "recommendation_id",
    "user_id",
    "target_block_id",
    "target_date",
    "type",
    "scope",
    "status",
    "confidence",
    "priority",
    "title",
    "message",
    "reason_code",
    "reason_payload",
    "evidence",
    "suggested_action",
    "dismissible",
    "reversible",
    "created_at",
    "expires_at",
    "applied_at",
    "dismissed_at",
    "updated_at",
] as const;

function isPlanningPersistenceCompatibilityError(error: unknown) {
    if (!error || typeof error !== "object") return false;

    const code = "code" in error ? asString((error as DbRow).code) : "";
    const message = "message" in error ? asString((error as DbRow).message) : "";
    const details = "details" in error ? asString((error as DbRow).details) : "";
    const combined = `${message} ${details}`.toLowerCase();

    return (
        code === "42703"
        || combined.includes("column")
        || combined.includes("applyability")
        || combined.includes("action_mode")
        || combined.includes("accepted_at")
        || combined.includes("ignored_at")
        || combined.includes("first_seen_at")
        || combined.includes("last_seen_at")
        || combined.includes("seen_count")
        || combined.includes("accepted_count")
        || combined.includes("dismissed_count")
        || combined.includes("ignored_count")
        || combined.includes("applied_count")
    );
}

function toLegacyRecommendationPayload(payload: Record<string, unknown>) {
    return LEGACY_RECOMMENDATION_COLUMNS.reduce<Record<string, unknown>>((legacyPayload, key) => {
        legacyPayload[key] = payload[key];
        return legacyPayload;
    }, {});
}

function buildLegacyStatusPayload(
    status: Extract<PlanningRecommendationStatus, "accepted" | "dismissed" | "applied">,
    now: string,
) {
    return {
        status,
        updated_at: now,
        dismissed_at: status === "dismissed" ? now : null,
        applied_at: status === "applied" ? now : null,
    };
}

export function isSuppressed(row: PersistedPlanningRecommendation) {
    const reference = row.dismissedAt ?? row.appliedAt ?? row.acceptedAt ?? row.ignoredAt ?? row.createdAt;
    const ageHours = (Date.now() - new Date(reference).getTime()) / (60 * 60 * 1000);

    if (row.status === "dismissed") return ageHours <= 36;
    if (row.status === "accepted") return ageHours <= 24;
    if (row.status === "applied") return ageHours <= 72;
    if (row.status === "ignored") return ageHours <= 48;
    return false;
}

async function fetchBehaviorProfile(
    supabase: SupabaseClient,
    userId: string,
    analytics: FocusSessionAnalytics[],
    activityExperiences: ActivityExperience[] = [],
) {
    const { data } = await supabase
        .from("user_behavior_profile")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (data) return hydrateProfileRow(data as DbRow);
    if (analytics.length > 0 || activityExperiences.length > 0) {
        return buildBehaviorProfile(userId, [...analytics].reverse(), {
            now: new Date(),
            activityExperiences,
        });
    }
    return buildEmptyBehaviorProfile(userId);
}

async function fetchRecentAnalytics(supabase: SupabaseClient, userId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 45);

    const { data } = await supabase
        .from("focus_session_analytics")
        .select("*")
        .eq("user_id", userId)
        .gte("ended_at", since.toISOString())
        .order("ended_at", { ascending: false })
        .limit(80);

    return (data ?? []).map((row) => mapAnalyticsRow(row as DbRow));
}

async function fetchPlanningFeedbackSummary(supabase: SupabaseClient, userId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 60);

    const { data } = await supabase
        .from("planning_recommendations")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", since.toISOString())
        .order("updated_at", { ascending: false })
        .limit(160);

    return summarizePlanningFeedback((data ?? []).map((row) => mapRecommendationRow(row as DbRow)));
}

async function fetchCalendarBlocks(
    supabase: SupabaseClient,
    userId: string,
    targetDate: string,
    blockIds?: string[],
) {
    let query = supabase
        .from("blocks")
        .select("*")
        .eq("user_id", userId)
        .gte("start_at", addDays(targetDate, -1).toISOString())
        .lte("start_at", addDays(targetDate, 2).toISOString())
        .order("start_at", { ascending: true });

    if (blockIds && blockIds.length > 0) {
        query = query.in("id", blockIds);
    }

    const { data } = await query;
    return (data ?? []).map((row) => mapBlockRow(row as DbRow));
}

async function fetchExistingRecommendations(
    supabase: SupabaseClient,
    userId: string,
    targetDate: string,
    targetBlockId?: string,
) {
    let query = supabase
        .from("planning_recommendations")
        .select("*")
        .eq("user_id", userId);

    if (targetBlockId) {
        query = query.or(`target_date.eq.${targetDate},target_block_id.eq.${targetBlockId}`);
    } else {
        query = query.eq("target_date", targetDate);
    }

    const { data } = await query;
    return (data ?? []).map((row) => mapRecommendationRow(row as DbRow));
}

async function persistRecommendations(
    supabase: SupabaseClient,
    userId: string,
    targetDate: string,
    targetBlockId: string | undefined,
    recommendations: PlanningRecommendation[],
    existingRows: PersistedPlanningRecommendation[],
) {
    const rowsToPersist = recommendations
        .filter((recommendation) => {
            const existing = existingRows.find((row) => row.recommendationId === recommendation.id);
            return existing ? !isSuppressed(existing) : true;
        })
        .map((recommendation) => {
            const existing = existingRows.find((row) => row.recommendationId === recommendation.id);
            return serializeRecommendation(userId, recommendation, existing);
        });

    if (rowsToPersist.length > 0) {
        let { error } = await supabase
            .from("planning_recommendations")
            .upsert(rowsToPersist, { onConflict: "recommendation_id" });

        if (error && isPlanningPersistenceCompatibilityError(error)) {
            ({ error } = await supabase
                .from("planning_recommendations")
                .upsert(rowsToPersist.map((row) => toLegacyRecommendationPayload(row)), { onConflict: "recommendation_id" }));
        }

        if (error) throw error;
    }

    const visibleRecommendations = recommendations.filter((recommendation) => {
        const existing = existingRows.find((row) => row.recommendationId === recommendation.id);
        if (existing && isSuppressed(existing)) return false;
        const persisted = rowsToPersist.find((row) => asString(row.recommendation_id) === recommendation.id);
        return persisted ? asString(persisted.status) === "active" : true;
    });

    const staleRows = existingRows.filter((row) => {
        if (row.status !== "active") return false;
        if (targetBlockId && row.targetBlockId !== targetBlockId && row.targetDate !== targetDate) return false;
        if (!targetBlockId && row.targetDate !== targetDate) return false;
        return !visibleRecommendations.some((recommendation) => recommendation.id === row.recommendationId);
    });

    if (staleRows.length > 0) {
        const { error } = await supabase
            .from("planning_recommendations")
            .update({
                status: "expired",
                expires_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .in("recommendation_id", staleRows.map((row) => row.recommendationId));

        if (error) throw error;
    }

    return visibleRecommendations.map((recommendation) => {
        const persisted = rowsToPersist.find((row) => asString(row.recommendation_id) === recommendation.id);
        return {
            ...recommendation,
            status: "active" as PlanningRecommendationStatus,
            firstSeenAt: asNullableString(persisted?.first_seen_at),
            lastSeenAt: asNullableString(persisted?.last_seen_at),
            seenCount: asNumber(persisted?.seen_count, 1),
        };
    });
}

export async function getPlanningGuideData(
    supabase: SupabaseClient,
    userId: string,
    options: {
        targetDate: string;
        targetBlockId?: string;
        preferences?: PlanningPreferencesInput;
        language?: AppLanguage;
    },
): Promise<PlanningGuideResult> {
    const recentAnalytics = await fetchRecentAnalytics(supabase, userId);
    const activityExperiences = await fetchRecentActivityExperiences(supabase, userId, {
        startDate: options.targetDate,
        endDate: options.targetDate,
        sinceDays: 45,
        limit: 240,
    });
    const profile = await fetchBehaviorProfile(supabase, userId, recentAnalytics, activityExperiences);
    const feedbackSummary = await fetchPlanningFeedbackSummary(supabase, userId);
    const blocks = await fetchCalendarBlocks(
        supabase,
        userId,
        options.targetDate,
        options.preferences?.blockIds,
    );

    const guide = buildPlanningGuide({
        userId,
        profile,
        recentAnalytics,
        activityExperiences,
        blocks,
        targetDate: options.targetDate,
        targetBlockId: options.targetBlockId,
        preferences: options.preferences,
        feedbackSummary,
    }, options.language ?? "en");

    const existingRows = await fetchExistingRecommendations(
        supabase,
        userId,
        options.targetDate,
        options.targetBlockId,
    );

    const recommendations = await persistRecommendations(
        supabase,
        userId,
        options.targetDate,
        options.targetBlockId,
        guide.recommendations,
        existingRows,
    );

    return {
        ...guide,
        recommendations,
    };
}

export async function updateRecommendationStatus(
    supabase: SupabaseClient,
    userId: string,
    recommendationId: string,
    status: Extract<PlanningRecommendationStatus, "accepted" | "dismissed">,
    language: AppLanguage = "en",
) {
    const existing = await fetchRecommendationForApply(supabase, userId, recommendationId);
    if (!existing) {
        throw new Error(getPlanningServerCopy(language).recommendationNotFound);
    }

    const now = new Date().toISOString();
    const payload = {
        status,
        updated_at: now,
        accepted_at: status === "accepted" ? now : existing.acceptedAt,
        dismissed_at: status === "dismissed" ? now : existing.dismissedAt,
        accepted_count: existing.acceptedCount + (status === "accepted" ? 1 : 0),
        dismissed_count: existing.dismissedCount + (status === "dismissed" ? 1 : 0),
    };

    let { data, error } = await supabase
        .from("planning_recommendations")
        .update(payload)
        .eq("user_id", userId)
        .eq("recommendation_id", recommendationId)
        .select("*")
        .maybeSingle();

    if (error && isPlanningPersistenceCompatibilityError(error)) {
        ({ data, error } = await supabase
            .from("planning_recommendations")
            .update(buildLegacyStatusPayload(status, now))
            .eq("user_id", userId)
            .eq("recommendation_id", recommendationId)
            .select("*")
            .maybeSingle());
    }

    if (error) throw error;
    return data ? mapRecommendationRow(data as DbRow) : null;
}

async function fetchRecommendationForApply(
    supabase: SupabaseClient,
    userId: string,
    recommendationId: string,
) {
    const { data, error } = await supabase
        .from("planning_recommendations")
        .select("*")
        .eq("user_id", userId)
        .eq("recommendation_id", recommendationId)
        .maybeSingle();

    if (error) throw error;
    if (data) return mapRecommendationRow(data as DbRow);

    const locator = parseRecommendationLocator(recommendationId);
    if (!locator) return null;
    if (locator.scopedUserId && locator.scopedUserId !== userId) return null;

    let targetDate: string | null = null;
    let targetBlockId: string | undefined;

    if (locator.scope === "day" || locator.scope === "guided_plan") {
        targetDate = locator.targetKey;
    } else if (locator.scope === "block") {
        targetBlockId = locator.targetKey;

        const { data: blockRow, error: blockError } = await supabase
            .from("blocks")
            .select("start_at")
            .eq("user_id", userId)
            .eq("id", targetBlockId)
            .maybeSingle();

        if (blockError) throw blockError;
        if (!blockRow) return null;

        targetDate = asString((blockRow as DbRow).start_at).slice(0, 10);
    }

    if (!targetDate) return null;

    const guide = await getPlanningGuideData(supabase, userId, {
        targetDate,
        targetBlockId,
    });

    if (!guide.recommendations.some((recommendation) => recommendation.id === recommendationId)) {
        return null;
    }

    const { data: recoveredRow, error: recoveredError } = await supabase
        .from("planning_recommendations")
        .select("*")
        .eq("user_id", userId)
        .eq("recommendation_id", recommendationId)
        .maybeSingle();

    if (recoveredError) throw recoveredError;
    return recoveredRow ? mapRecommendationRow(recoveredRow as DbRow) : null;
}

async function assertNoCalendarConflict(
    supabase: SupabaseClient,
    userId: string,
    startIso: string,
    endIso: string,
    language: AppLanguage,
    excludeBlockId?: string,
) {
    let query = supabase
        .from("blocks")
        .select("id,start_at,end_at")
        .eq("user_id", userId)
        .lt("start_at", endIso)
        .gt("end_at", startIso);

    if (excludeBlockId) {
        query = query.neq("id", excludeBlockId);
    }

    const { data, error } = await query.limit(1);
    if (error) throw error;
    if ((data ?? []).length > 0) {
        throw new Error(getPlanningServerCopy(language).overlapConflict);
    }
}

export async function applyPlanningRecommendation(
    supabase: SupabaseClient,
    userId: string,
    recommendationId: string,
    language: AppLanguage = "en",
) {
    const serverCopy = getPlanningServerCopy(language);
    const recommendation = await fetchRecommendationForApply(supabase, userId, recommendationId);
    if (!recommendation) {
        throw new Error(serverCopy.recommendationNotFound);
    }
    if (!canAutoApplyRecommendation(recommendation)) {
        throw new Error(serverCopy.manualReviewRequired);
    }

    const now = new Date().toISOString();
    const action = recommendation.suggestedAction;
    const changedBlockIds: string[] = [];
    const createdBlockIds: string[] = [];

    if (action.kind === "move") {
        if (!recommendation.targetBlockId) throw new Error(serverCopy.cannotAutoApply);
        const suggestedStart = asNullableString(action.payload.suggestedStart);
        const suggestedEnd = asNullableString(action.payload.suggestedEnd);
        if (!suggestedStart || !suggestedEnd) throw new Error(serverCopy.missingMoveTarget);
        await assertNoCalendarConflict(supabase, userId, suggestedStart, suggestedEnd, language, recommendation.targetBlockId);

        const { error } = await supabase
            .from("blocks")
            .update({
                start_at: suggestedStart,
                end_at: suggestedEnd,
                estimated_duration_minutes: Math.round((new Date(suggestedEnd).getTime() - new Date(suggestedStart).getTime()) / 60000),
                updated_at: now,
            })
            .eq("id", recommendation.targetBlockId)
            .eq("user_id", userId);

        if (error) throw error;
        changedBlockIds.push(recommendation.targetBlockId);
    } else if (action.kind === "shorten") {
        if (!recommendation.targetBlockId) throw new Error(serverCopy.cannotAutoApply);
        const { data: blockRow, error: blockError } = await supabase
            .from("blocks")
            .select("*")
            .eq("id", recommendation.targetBlockId)
            .eq("user_id", userId)
            .maybeSingle();

        if (blockError) throw blockError;
        const block = blockRow ? mapBlockRow(blockRow as DbRow) : null;
        if (!block) throw new Error(serverCopy.blockNotFound);

        const recommendedDuration = asNumber(action.payload.recommendedDurationMinutes, 0)
            || Math.max(15, Math.round(((block.endAt.getTime() - block.startAt.getTime()) / 60000) - asNumber(action.payload.reduceByMinutes, 30)));
        const nextEnd = new Date(block.startAt.getTime() + (recommendedDuration * 60000));

        const { error } = await supabase
            .from("blocks")
            .update({
                end_at: nextEnd.toISOString(),
                estimated_duration_minutes: recommendedDuration,
                updated_at: now,
            })
            .eq("id", block.id)
            .eq("user_id", userId);

        if (error) throw error;
        changedBlockIds.push(block.id);
    } else if (action.kind === "split") {
        if (!recommendation.targetBlockId) throw new Error(serverCopy.cannotAutoApply);
        const { data: blockRow, error: blockError } = await supabase
            .from("blocks")
            .select("*")
            .eq("id", recommendation.targetBlockId)
            .eq("user_id", userId)
            .maybeSingle();

        if (blockError) throw blockError;
        const block = blockRow ? mapBlockRow(blockRow as DbRow) : null;
        if (!block) throw new Error(serverCopy.blockNotFound);

        const firstDurationMinutes = asNumber(action.payload.firstDurationMinutes, Math.max(25, Math.round((block.endAt.getTime() - block.startAt.getTime()) / 120000)));
        const secondDurationMinutes = asNumber(action.payload.secondDurationMinutes, Math.max(15, firstDurationMinutes));
        const firstEnd = new Date(block.startAt.getTime() + (firstDurationMinutes * 60000));
        const secondStart = new Date(firstEnd.getTime() + (15 * 60000));
        const secondEnd = new Date(secondStart.getTime() + (secondDurationMinutes * 60000));
        const secondId = crypto.randomUUID();
        await assertNoCalendarConflict(supabase, userId, firstEnd.toISOString(), secondEnd.toISOString(), language, block.id);

        const { error: updateError } = await supabase
            .from("blocks")
            .update({
                end_at: firstEnd.toISOString(),
                estimated_duration_minutes: firstDurationMinutes,
                updated_at: now,
            })
            .eq("id", block.id)
            .eq("user_id", userId);

        if (updateError) throw updateError;

        const { error: insertError } = await supabase
            .from("blocks")
            .insert({
                id: secondId,
                user_id: userId,
                title: language === "es" ? `${block.title} - Parte 2` : `${block.title} - Part 2`,
                type: block.type,
                status: "planned",
                start_at: secondStart.toISOString(),
                end_at: secondEnd.toISOString(),
                notes: block.notes ?? null,
                tag: block.tag ?? null,
                color: block.color ?? null,
                priority: block.priority ?? null,
                estimated_duration_minutes: secondDurationMinutes,
                difficulty: block.difficulty ?? null,
                flexibility: block.flexibility ?? null,
                intensity: block.intensity ?? null,
                deadline: block.deadline?.toISOString() ?? null,
                cognitively_heavy: block.cognitivelyHeavy ?? null,
                splittable: block.splittable ?? null,
                optional: block.optional ?? null,
                notifications: block.notifications ?? [5],
            });

        if (insertError) throw insertError;
        
        const breakId = crypto.randomUUID();
        const { error: breakError } = await supabase
            .from("blocks")
            .insert({
                id: breakId,
                user_id: userId,
                title: language === "es" ? "Descanso" : "Break",
                type: "break",
                status: "planned",
                start_at: firstEnd.toISOString(),
                end_at: secondStart.toISOString(),
                priority: 1,
                estimated_duration_minutes: 15,
                flexibility: "moderate",
                intensity: "light",
                cognitively_heavy: false,
                splittable: false,
                optional: false,
                notifications: [5]
            });

        if (breakError) console.warn("Could not insert break in split", breakError);
        else createdBlockIds.push(breakId);

        changedBlockIds.push(block.id);
        createdBlockIds.push(secondId);
    } else if (action.kind === "insert_break") {
        const suggestedStart = asNullableString(action.payload.suggestedStart);
        const durationMinutes = asNumber(action.payload.durationMinutes, 15);
        if (!suggestedStart) throw new Error(serverCopy.missingBreakStart);
        const breakId = crypto.randomUUID();
        const endAt = new Date(new Date(suggestedStart).getTime() + (durationMinutes * 60000));
        await assertNoCalendarConflict(supabase, userId, suggestedStart, endAt.toISOString(), language);

        const { error } = await supabase
            .from("blocks")
            .insert({
                id: breakId,
                user_id: userId,
                title: language === "es" ? "Descanso protegido" : "Protected break",
                type: "break",
                status: "planned",
                start_at: suggestedStart,
                end_at: endAt.toISOString(),
                priority: 1,
                estimated_duration_minutes: durationMinutes,
                flexibility: "moderate",
                intensity: "light",
                cognitively_heavy: false,
                splittable: false,
                optional: false,
                notifications: [5],
            });

        if (error) throw error;
        createdBlockIds.push(breakId);
    } else if (action.kind === "mark_optional") {
        if (!recommendation.targetBlockId) throw new Error(serverCopy.cannotAutoApply);
        const { error } = await supabase
            .from("blocks")
            .update({
                optional: true,
                updated_at: now,
            })
            .eq("id", recommendation.targetBlockId)
            .eq("user_id", userId);

        if (error) throw error;
        changedBlockIds.push(recommendation.targetBlockId);
    } else {
        throw new Error(serverCopy.manualReviewRequired);
    }

    let { data: updatedRow, error: updateRecommendationError } = await supabase
        .from("planning_recommendations")
        .update({
            status: "applied",
            applied_at: now,
            updated_at: now,
            applied_count: recommendation.appliedCount + 1,
        })
        .eq("user_id", userId)
        .eq("recommendation_id", recommendationId)
        .select("*")
        .maybeSingle();

    if (updateRecommendationError && isPlanningPersistenceCompatibilityError(updateRecommendationError)) {
        ({ data: updatedRow, error: updateRecommendationError } = await supabase
            .from("planning_recommendations")
            .update(buildLegacyStatusPayload("applied", now))
            .eq("user_id", userId)
            .eq("recommendation_id", recommendationId)
            .select("*")
            .maybeSingle());
    }

    if (updateRecommendationError) throw updateRecommendationError;

    return {
        recommendation: updatedRow ? mapRecommendationRow(updatedRow as DbRow) : recommendation,
        changedBlockIds,
        createdBlockIds,
    };
}
