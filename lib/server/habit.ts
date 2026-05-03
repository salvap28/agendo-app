import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppLanguage } from "@/lib/i18n/messages";
import type { BehaviorProfile, FocusSessionAnalytics } from "@/lib/types/behavior";
import type { ActivityExperience } from "@/lib/types/activity";
import type { Block } from "@/lib/types/blocks";
import type {
    HabitEventPayload,
    HabitHomeData,
    HabitPreferences,
} from "@/lib/types/habit";
import {
    buildHabitBehaviorSnapshot,
    buildHabitDayState,
    buildRescuePlan,
    buildWeeklyConsistencyState,
    countMeaningfulDays,
    getNextRelevantBlock,
} from "@/lib/engines/habit";
import {
    calculateProfileCalibrationProgress,
    getInsightsDashboardData,
} from "@/lib/server/personalIntelligence";
import { fetchRecentActivityExperiences } from "@/lib/server/activityExperience";

type DbRow = Record<string, unknown>;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function asStringArray(value: unknown) {
    if (!Array.isArray(value)) return null;

    const normalized = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);

    return normalized.length > 0 ? [...new Set(normalized)] : [];
}

function asObject(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}

function isHabitEventSchemaMissing(error: unknown) {
    if (!error || typeof error !== "object") return false;
    const candidate = error as { code?: string; message?: string; hint?: string };
    return candidate.code === "PGRST205"
        || candidate.code === "42P01"
        || candidate.message?.includes("habit_event_logs") === true
        || candidate.hint?.includes("habit_event_logs") === true;
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
        engagementMode: (asNullableString(row.engagement_mode) ?? undefined) as Block["engagementMode"],
        requiresFocusMode: row.requires_focus_mode == null ? undefined : asBoolean(row.requires_focus_mode),
        generatesExperienceRecord: row.generates_experience_record == null ? undefined : asBoolean(row.generates_experience_record),
        socialDemandHint: (asNullableString(row.social_demand_hint) ?? undefined) as Block["socialDemandHint"],
        locationMode: (asNullableString(row.location_mode) ?? undefined) as Block["locationMode"],
        presenceMode: (asNullableString(row.presence_mode) ?? undefined) as Block["presenceMode"],
        recurrenceId: asNullableString(row.recurrence_id) ?? undefined,
        recurrencePattern: (row.recurrence_pattern ?? undefined) as Block["recurrencePattern"],
        notifications: Array.isArray(row.notifications) ? row.notifications as number[] : undefined,
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
        diagnostics: (row.diagnostics ?? {}) as FocusSessionAnalytics["diagnostics"],
        computedAt: asNullableString(row.computed_at) ?? new Date().toISOString(),
        updatedAt: asNullableString(row.updated_at) ?? new Date().toISOString(),
    };
}

function normalizeHabitPreferences(value: unknown): HabitPreferences {
    const source = asObject(value)?.habit && asObject(asObject(value)?.habit)
        ? asObject(asObject(value)?.habit)
        : asObject(value);
    const primaryUseCase = (asNullableString(source?.primaryUseCase) ?? null) as HabitPreferences["primaryUseCase"];
    const hardestStartMoment = (asNullableString(source?.hardestStartMoment) ?? null) as HabitPreferences["hardestStartMoment"];
    const desiredHelp = (asNullableString(source?.desiredHelp) ?? null) as HabitPreferences["desiredHelp"];
    const primaryUseCaseSelections = asStringArray(source?.primaryUseCaseSelections)
        ?? (primaryUseCase ? [primaryUseCase] : null);
    const hardestStartMomentSelections = asStringArray(source?.hardestStartMomentSelections)
        ?? (hardestStartMoment ? [hardestStartMoment] : null);
    const desiredHelpSelections = asStringArray(source?.desiredHelpSelections)
        ?? (desiredHelp ? [desiredHelp] : null);

    return {
        primaryUseCase,
        hardestStartMoment,
        desiredHelp,
        primaryUseCaseSelections: primaryUseCaseSelections as HabitPreferences["primaryUseCaseSelections"],
        hardestStartMomentSelections: hardestStartMomentSelections as HabitPreferences["hardestStartMomentSelections"],
        desiredHelpSelections: desiredHelpSelections as HabitPreferences["desiredHelpSelections"],
        onboardingCompletedAt: asNullableString(source?.onboardingCompletedAt),
        firstMeaningfulActionAt: asNullableString(source?.firstMeaningfulActionAt),
        lastMeaningfulActionAt: asNullableString(source?.lastMeaningfulActionAt),
        lastDailyRitualShownOn: asNullableString(source?.lastDailyRitualShownOn),
        lastDailyRitualConfirmedAt: asNullableString(source?.lastDailyRitualConfirmedAt),
        ignoredNotificationCount: source?.ignoredNotificationCount == null ? 0 : asNumber(source.ignoredNotificationCount),
        notificationCooldownUntil: asNullableString(source?.notificationCooldownUntil),
    };
}

function mergeHabitPreferences(existing: Record<string, unknown> | undefined, patch: Partial<HabitPreferences>) {
    return {
        ...(existing ?? {}),
        habit: {
            ...normalizeHabitPreferences(existing),
            ...patch,
        },
    };
}

export async function fetchHabitPreferences(
    supabase: SupabaseClient,
    userId: string,
) {
    const { data, error } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .maybeSingle();

    if (error) throw error;
    return {
        rawPreferences: asObject(data?.preferences),
        habit: normalizeHabitPreferences(data?.preferences),
    };
}

export async function patchHabitPreferences(
    supabase: SupabaseClient,
    userId: string,
    patch: Partial<HabitPreferences>,
) {
    const { rawPreferences } = await fetchHabitPreferences(supabase, userId);
    const nextPreferences = mergeHabitPreferences(rawPreferences, patch);

    const { error } = await supabase
        .from("profiles")
        .update({ preferences: nextPreferences, updated_at: new Date().toISOString() })
        .eq("id", userId);

    if (error) throw error;
}

async function fetchRecentAnalytics(
    supabase: SupabaseClient,
    userId: string,
    sinceDays: number,
    limit = 120,
) {
    const since = new Date(Date.now() - (sinceDays * 24 * 60 * 60 * 1000)).toISOString();
    const { data, error } = await supabase
        .from("focus_session_analytics")
        .select("*")
        .eq("user_id", userId)
        .gte("ended_at", since)
        .order("ended_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data ?? []).map((row) => mapAnalyticsRow(row as DbRow));
}

async function fetchBlocksWindow(
    supabase: SupabaseClient,
    userId: string,
) {
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const until = new Date(Date.now() + (2 * DAY_MS)).toISOString();
    const { data, error } = await supabase
        .from("blocks")
        .select("*")
        .eq("user_id", userId)
        .gte("end_at", since)
        .lte("start_at", until)
        .order("start_at", { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => mapBlockRow(row as DbRow));
}

async function fetchRecentHabitEvents(
    supabase: SupabaseClient,
    userId: string,
    sinceDays: number,
) {
    const since = new Date(Date.now() - (sinceDays * DAY_MS)).toISOString();
    const { data, error } = await supabase
        .from("habit_event_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false });

    if (error) {
        if (isHabitEventSchemaMissing(error)) return [];
        throw error;
    }

    return (data ?? []).map((row) => ({
        id: asString((row as DbRow).id),
        name: asString((row as DbRow).name),
        occurredAt: asString((row as DbRow).occurred_at),
        surface: asNullableString((row as DbRow).surface),
        blockId: asNullableString((row as DbRow).block_id),
        sessionId: asNullableString((row as DbRow).session_id),
        plannerSessionId: asNullableString((row as DbRow).planner_session_id),
        plannerProposalId: asNullableString((row as DbRow).planner_proposal_id),
        plannerDecisionId: asNullableString((row as DbRow).planner_decision_id),
        metadataJson: asObject((row as DbRow).metadata_json) ?? {},
    }));
}

function isMeaningfulEvent(name: string) {
    return name === "habit_first_meaningful_action"
        || name === "focus_started"
        || name === "focus_checkout_submitted"
        || name === "daily_ritual_confirmed"
        || name === "rescue_plan_applied"
        || name === "next_block_started_from_home";
}

async function recordSystemHabitEvent(
    supabase: SupabaseClient,
    userId: string,
    name: string,
    occurredAt: string,
    metadata?: Record<string, unknown>,
) {
    const { error } = await supabase.from("habit_event_logs").insert({
        user_id: userId,
        name,
        occurred_at: occurredAt,
        event_date: occurredAt.slice(0, 10),
        metadata_json: metadata ?? {},
    });

    if (error && !isHabitEventSchemaMissing(error)) {
        throw error;
    }
}

export async function recordHabitEvent(
    supabase: SupabaseClient,
    userId: string,
    payload: HabitEventPayload,
) {
    const occurredAt = payload.occurredAt ?? new Date().toISOString();

    const patch: Partial<HabitPreferences> = {};
    if (payload.name === "daily_ritual_shown") {
        patch.lastDailyRitualShownOn = occurredAt.slice(0, 10);
    }
    if (payload.name === "daily_ritual_confirmed") {
        patch.lastDailyRitualConfirmedAt = occurredAt;
        patch.lastDailyRitualShownOn = occurredAt.slice(0, 10);
    }
    if (isMeaningfulEvent(payload.name)) {
        patch.lastMeaningfulActionAt = occurredAt;
    }

    if (Object.keys(patch).length > 0) {
        const current = await fetchHabitPreferences(supabase, userId);
        await patchHabitPreferences(supabase, userId, {
            ...patch,
            firstMeaningfulActionAt: current.habit.firstMeaningfulActionAt ?? (isMeaningfulEvent(payload.name) ? occurredAt : null),
        });
    }

    const insertPayload = {
        user_id: userId,
        name: payload.name,
        occurred_at: occurredAt,
        surface: payload.surface ?? null,
        block_id: payload.blockId ?? null,
        session_id: payload.sessionId ?? null,
        planner_session_id: payload.plannerSessionId ?? null,
        planner_proposal_id: payload.plannerProposalId ?? null,
        planner_decision_id: payload.plannerDecisionId ?? null,
        metadata_json: payload.metadata ?? {},
        event_date: occurredAt.slice(0, 10),
    };

    const { error } = await supabase.from("habit_event_logs").insert(insertPayload);
    if (error && !isHabitEventSchemaMissing(error)) {
        throw error;
    }

    if (!isMeaningfulEvent(payload.name)) return;

    const { data: sameDayRows, error: sameDayError } = await supabase
        .from("habit_event_logs")
        .select("name")
        .eq("user_id", userId)
        .eq("event_date", occurredAt.slice(0, 10))
        .in("name", [
            "meaningful_day_counted",
            "habit_first_meaningful_action",
            "focus_started",
            "focus_checkout_submitted",
            "daily_ritual_confirmed",
            "rescue_plan_applied",
            "next_block_started_from_home",
        ]);

    if (sameDayError) {
        if (isHabitEventSchemaMissing(sameDayError)) return;
        throw sameDayError;
    }

    const dayNames = new Set((sameDayRows ?? []).map((row) => asString((row as DbRow).name)));
    if (!dayNames.has("meaningful_day_counted")) {
        await recordSystemHabitEvent(supabase, userId, "meaningful_day_counted", occurredAt, {
            sourceEvent: payload.name,
        });
    }

    const sinceDate = new Date(Date.now() - (7 * DAY_MS)).toISOString().slice(0, 10);
    const { data: weekRows, error: weekError } = await supabase
        .from("habit_event_logs")
        .select("name,event_date")
        .eq("user_id", userId)
        .gte("event_date", sinceDate)
        .in("name", [
            "meaningful_day_counted",
            "consistency_target_reached",
        ]);

    if (weekError) {
        if (isHabitEventSchemaMissing(weekError)) return;
        throw weekError;
    }

    const weekNames = new Set((weekRows ?? []).map((row) => asString((row as DbRow).name)));
    const meaningfulDates = new Set(
        (weekRows ?? [])
            .filter((row) => asString((row as DbRow).name) === "meaningful_day_counted")
            .map((row) => asString((row as DbRow).event_date)),
    );

    if (meaningfulDates.size >= 3 && !weekNames.has("consistency_target_reached")) {
        await recordSystemHabitEvent(supabase, userId, "consistency_target_reached", occurredAt, {
            meaningfulDays: meaningfulDates.size,
        });
    }
}

function buildWidgetLabel(args: {
    nextBlock: HabitHomeData["nextBlock"];
    language: AppLanguage;
}) {
    if (args.nextBlock.block) {
        return {
            title: args.nextBlock.block.title,
            body: args.nextBlock.context,
            ctaLabel: args.language === "es" ? "Empezar" : "Start",
            deepLink: `/?blockId=${encodeURIComponent(args.nextBlock.block.id)}&habit=start&source=widget`,
        };
    }

    return {
        title: args.language === "es" ? "Seguimos desde aca" : "Pick up from here",
        body: args.nextBlock.context,
        ctaLabel: args.language === "es" ? "Abrir Agendo" : "Open Agendo",
        deepLink: "/?habit=create&source=widget",
    };
}

export async function getHabitHomeData(
    supabase: SupabaseClient,
    userId: string,
    language: AppLanguage = "en",
) {
    const [
        dashboard,
        blocks,
        recentAnalytics,
        recentActivityExperiences,
        habitPrefsResult,
        recentHabitEvents,
    ] = await Promise.all([
        getInsightsDashboardData(supabase, userId, language),
        fetchBlocksWindow(supabase, userId),
        fetchRecentAnalytics(supabase, userId, 30, 90),
        fetchRecentActivityExperiences(supabase, userId, { sinceDays: 30, limit: 160 }),
        fetchHabitPreferences(supabase, userId),
        fetchRecentHabitEvents(supabase, userId, 14),
    ]);

    const now = new Date();
    const habitPrefs = habitPrefsResult.habit;
    const rescueEventsLast14d = recentHabitEvents.filter((event) => event.name === "rescue_plan_applied").length;
    const behavior = buildHabitBehaviorSnapshot({
        profile: dashboard.profile as BehaviorProfile | null,
        recentAnalytics,
        rescueEventsLast14d,
    });
    const nextBlock = getNextRelevantBlock({
        blocks,
        now,
        profile: dashboard.profile,
        recentAnalytics,
        rescueFrequency: rescueEventsLast14d,
        language,
    });
    const dayState = buildHabitDayState(blocks, now, language);
    const rescuePlan = buildRescuePlan({
        blocks,
        now,
        profile: dashboard.profile,
        language,
    });

    const meaningfulEventDates = recentHabitEvents
        .filter((event) => isMeaningfulEvent(event.name))
        .map((event) => event.occurredAt.slice(0, 10));
    const recentConfirmedExperiences = recentActivityExperiences as ActivityExperience[];
    const meaningfulDates = countMeaningfulDays({
        recentAnalytics,
        recentActivityExperiences: recentConfirmedExperiences,
        eventDates: meaningfulEventDates,
        now,
    });
    const meaningfulToday = meaningfulDates.has(now.toISOString().slice(0, 10));
    const weeklyConsistency = buildWeeklyConsistencyState({
        meaningfulDates: new Set(
            [...meaningfulDates]
                .filter((date) => Date.now() - new Date(`${date}T12:00:00.000Z`).getTime() <= (7 * DAY_MS))
        ),
        language,
    });
    const confirmedExperiences = recentConfirmedExperiences.filter((experience) => experience.wasUserConfirmed);
    const confirmedFocusReflections = confirmedExperiences.filter((experience) => Boolean(experience.sourceFocusSessionId));
    const calibrationProgress = calculateProfileCalibrationProgress({
        overallConfidence: dashboard.profile.confidenceOverview.overall,
        recentAnalyticsCount: recentAnalytics.length,
        confirmedActivityCount: confirmedExperiences.length,
        confirmedFocusReflectionCount: confirmedFocusReflections.length,
    });
    const onboardingShouldShow = !habitPrefs.onboardingCompletedAt
        && !habitPrefs.firstMeaningfulActionAt
        && recentAnalytics.length < 3
        && blocks.length < 3;

    const home: HabitHomeData = {
        onboarding: {
            shouldShow: onboardingShouldShow,
            completedAt: habitPrefs.onboardingCompletedAt ?? null,
            firstMeaningfulActionAt: habitPrefs.firstMeaningfulActionAt ?? null,
            draftSuggestion: null,
        },
        nextBlock,
        dayState,
        dailyRitual: {
            shouldShow: !meaningfulToday && habitPrefs.lastDailyRitualShownOn !== now.toISOString().slice(0, 10),
            headline: language === "es" ? "Esto es lo mas importante de hoy" : "This is the most important thing today",
            body: nextBlock.block
                ? (language === "es" ? "Confirmalo y seguimos." : "Confirm it and keep going.")
                : (language === "es" ? "Protege un proximo paso claro para no arrancar en vacio." : "Protect a clear next step so you do not start from zero."),
            blockId: nextBlock.block?.id ?? null,
            confirmedToday: Boolean(habitPrefs.lastDailyRitualConfirmedAt?.startsWith(now.toISOString().slice(0, 10))),
        },
        rescuePlan,
        weeklyConsistency,
        behavior,
        widget: buildWidgetLabel({
            nextBlock,
            language,
        }),
    };

    return {
        summary: {
            momentum_current: dashboard.compositeSignalCurrent,
            momentum_delta_week: dashboard.compositeSignalDeltaWeek,
            main_insight: calibrationProgress >= 70
                ? (dashboard.cards[0]?.title ?? (language === "es" ? "Seguimos afinando tu ritmo real." : "We keep sharpening your real rhythm."))
                : (language === "es"
                    ? "Todavia estamos calibrando con senales confirmadas."
                    : "We are still calibrating from confirmed signals."),
            progress_signal: dashboard.weeklySessions === 0
                ? "quiet"
                : dashboard.compositeSignalCurrent >= 65
                    ? "positive"
                    : "neutral",
            soft_recommendation: nextBlock.adaptiveRecommendation?.body
                ?? (language === "es"
                    ? "Agendo tiene que ayudarte a empezar, no a planear de mas."
                    : "Agendo should help you start, not over-plan."),
            profile_calibration_progress: calibrationProgress,
            focus_streak: dashboard.weeklySessions,
            weekly_sessions_count: dashboard.weeklySessions,
            best_focus_window: dashboard.profile.bestFocusWindow?.data.window ?? null,
        },
        habit: home,
    };
}
