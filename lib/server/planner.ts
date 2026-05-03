import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppLanguage } from "@/lib/i18n/messages";
import type { Block, SerializableBlock } from "@/lib/types/blocks";
import type {
    PlannerApplyResult,
    PlannerContextBundle,
    PlannerDecisionType,
    PlannerProposal,
    PlannerProposalRecord,
    PlannerProposalRevisionRequest,
    PlannerRequest,
    PlannerRevisionResult,
} from "@/lib/types/planner";
import { buildPlanningGuide } from "@/lib/engines/planningEngine";
import {
    resolveBlockEngagementMode,
    resolveBlockGeneratesExperienceRecord,
    resolveBlockLocationMode,
    resolveBlockPresenceMode,
    resolveBlockRequiresFocusMode,
    resolveBlockSocialDemand,
} from "@/lib/engines/activityExperience/domain";
import {
    adjustPlannerProposalDraft,
    buildHeuristicPlannerProposal,
    lightenPlannerProposal,
    regeneratePlannerProposal,
} from "@/lib/engines/planner/heuristic";
import {
    buildHabitBehaviorSnapshot,
    countMeaningfulDays,
} from "@/lib/engines/habit/selectors";
import { fetchRecentActivityExperiences } from "@/lib/server/activityExperience";
import { fetchHabitPreferences } from "@/lib/server/habit";
import {
    fetchBehaviorProfile,
    fetchCalendarBlocks,
    fetchPlanningFeedbackSummary,
    fetchRecentAnalytics,
} from "@/lib/server/planning";
import {
    createPlannerInput,
    createPlannerProposalRecord,
    createPlannerSession,
    fetchPlannerProposalRecord,
    hydratePlannerProposal,
    linkPlannerAppliedBlocks,
    recordPlannerDecision,
} from "@/lib/server/plannerPersistence";
import { enrichNewBlockWithPlanningMetadata } from "@/lib/utils/blockEnrichment";

type HabitEventRow = {
    name: string;
    occurredAt: string;
};

function buildTargetDate(request: PlannerRequest) {
    if (request.targetDate) return request.targetDate;
    const reference = request.nowIso ? new Date(request.nowIso) : new Date();
    return reference.toISOString().slice(0, 10);
}

function serializeBlock(block: Block): SerializableBlock {
    return {
        ...block,
        startAt: block.startAt.toISOString(),
        endAt: block.endAt.toISOString(),
    };
}

function toInsertPayload(block: Block, userId: string) {
    return {
        id: block.id,
        user_id: userId,
        title: block.title,
        type: block.type,
        status: block.status,
        start_at: block.startAt.toISOString(),
        end_at: block.endAt.toISOString(),
        notes: block.notes ?? null,
        tag: block.tag ?? null,
        color: block.color ?? null,
        priority: block.priority ?? null,
        estimated_duration_minutes: block.estimatedDurationMinutes ?? null,
        difficulty: block.difficulty ?? null,
        flexibility: block.flexibility ?? null,
        intensity: block.intensity ?? null,
        deadline: block.deadline?.toISOString() ?? null,
        cognitively_heavy: block.cognitivelyHeavy ?? null,
        splittable: block.splittable ?? null,
        optional: block.optional ?? null,
        engagement_mode: block.engagementMode ?? null,
        requires_focus_mode: block.requiresFocusMode ?? null,
        generates_experience_record: block.generatesExperienceRecord ?? null,
        social_demand_hint: block.socialDemandHint ?? null,
        location_mode: block.locationMode ?? null,
        presence_mode: block.presenceMode ?? null,
        notifications: block.notifications ?? null,
    };
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function sameDate(left: Date, right: Date) {
    return left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate();
}

function startOfDate(value: string) {
    return new Date(`${value}T00:00:00`);
}

function buildFreeWindows(args: {
    blocks: Block[];
    targetDate: string;
}) {
    const dayStart = startOfDate(args.targetDate);
    dayStart.setHours(6, 0, 0, 0);
    const dayEnd = startOfDate(args.targetDate);
    dayEnd.setHours(23, 30, 0, 0);

    const sameDayBlocks = args.blocks
        .filter((block) => sameDate(block.startAt, dayStart))
        .filter((block) => block.status !== "canceled")
        .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());

    const freeWindows: PlannerContextBundle["freeWindows"] = [];
    let cursor = new Date(dayStart);

    for (const block of sameDayBlocks) {
        if (block.startAt.getTime() > cursor.getTime()) {
            const durationMin = Math.round((block.startAt.getTime() - cursor.getTime()) / 60000);
            if (durationMin >= 15) {
                freeWindows.push({
                    startAt: cursor.toISOString(),
                    endAt: block.startAt.toISOString(),
                    durationMin,
                });
            }
        }

        if (block.endAt.getTime() > cursor.getTime()) {
            cursor = new Date(block.endAt);
        }
    }

    if (dayEnd.getTime() > cursor.getTime()) {
        const durationMin = Math.round((dayEnd.getTime() - cursor.getTime()) / 60000);
        if (durationMin >= 15) {
            freeWindows.push({
                startAt: cursor.toISOString(),
                endAt: dayEnd.toISOString(),
                durationMin,
            });
        }
    }

    return freeWindows.slice(0, 8);
}

function buildOverdueBlocks(args: {
    blocks: Block[];
    now: Date;
}) {
    return args.blocks
        .filter((block) => block.status !== "completed" && block.status !== "canceled")
        .filter((block) => block.endAt.getTime() < args.now.getTime())
        .sort((left, right) => (right.priority ?? 3) - (left.priority ?? 3))
        .slice(0, 6)
        .map((block) => ({
            id: block.id,
            title: block.title,
            type: block.type,
            startAt: block.startAt.toISOString(),
            endAt: block.endAt.toISOString(),
            priority: block.priority ?? 3,
            minutesOverdue: Math.max(0, Math.round((args.now.getTime() - block.endAt.getTime()) / 60000)),
        }));
}

async function fetchRecentHabitEvents(
    supabase: SupabaseClient,
    userId: string,
    sinceDays: number,
): Promise<HabitEventRow[]> {
    const since = new Date(Date.now() - (sinceDays * 24 * 60 * 60 * 1000)).toISOString();
    const { data, error } = await supabase
        .from("habit_event_logs")
        .select("name,occurred_at")
        .eq("user_id", userId)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false });

    if (error) {
        if (error.code === "PGRST205" || error.code === "42P01") return [];
        throw error;
    }

    return (data ?? []).map((row) => ({
        name: String((row as Record<string, unknown>).name ?? ""),
        occurredAt: String((row as Record<string, unknown>).occurred_at ?? ""),
    }));
}

function hydratePlannerBlock(draft: PlannerProposal["drafts"][number]): Block {
    const startAt = new Date(draft.startAt);
    const endAt = new Date(draft.endAt);
    const enriched = enrichNewBlockWithPlanningMetadata({
        title: draft.title,
        type: draft.type,
        startAt,
        endAt,
    });

    const block: Block = {
        id: crypto.randomUUID(),
        title: enriched.title,
        type: enriched.type ?? draft.type,
        status: "planned",
        startAt,
        endAt,
        priority: enriched.priority,
        estimatedDurationMinutes: draft.durationMin,
        difficulty: enriched.difficulty,
        flexibility: enriched.flexibility,
        intensity: enriched.intensity,
        deadline: enriched.deadline,
        cognitivelyHeavy: enriched.cognitivelyHeavy,
        splittable: enriched.splittable,
        optional: enriched.optional,
        notifications: [5],
    };

    block.engagementMode = resolveBlockEngagementMode(block);
    block.requiresFocusMode = resolveBlockRequiresFocusMode(block);
    block.generatesExperienceRecord = resolveBlockGeneratesExperienceRecord(block);
    block.socialDemandHint = resolveBlockSocialDemand(block);
    block.locationMode = resolveBlockLocationMode(block);
    block.presenceMode = resolveBlockPresenceMode(block);

    return block;
}

export async function buildPlannerContextBundle(
    supabase: SupabaseClient,
    userId: string,
    request: PlannerRequest,
    language: AppLanguage = "en",
): Promise<PlannerContextBundle> {
    const targetDate = buildTargetDate(request);
    const nowIso = request.nowIso ?? new Date().toISOString();
    const now = new Date(nowIso);

    const [recentAnalytics, recentActivityExperiences, feedbackSummary, blocks, habitPreferencesResult, recentHabitEvents] = await Promise.all([
        fetchRecentAnalytics(supabase, userId),
        fetchRecentActivityExperiences(supabase, userId, {
            startDate: targetDate,
            endDate: targetDate,
            sinceDays: 45,
            limit: 240,
        }),
        fetchPlanningFeedbackSummary(supabase, userId),
        fetchCalendarBlocks(supabase, userId, targetDate),
        fetchHabitPreferences(supabase, userId),
        fetchRecentHabitEvents(supabase, userId, 14),
    ]);

    const profile = await fetchBehaviorProfile(
        supabase,
        userId,
        recentAnalytics,
        recentActivityExperiences,
    );

    const guide = buildPlanningGuide({
        userId,
        profile,
        recentAnalytics,
        activityExperiences: recentActivityExperiences,
        blocks,
        targetDate,
        feedbackSummary,
    }, language);

    const rescueEventsLast14d = recentHabitEvents.filter((event) => event.name === "rescue_plan_applied").length;
    const behavior = buildHabitBehaviorSnapshot({
        profile,
        recentAnalytics,
        rescueEventsLast14d,
    });
    const recentMeaningfulEventDates = recentHabitEvents.map((event) => event.occurredAt.slice(0, 10));
    const meaningfulDates = countMeaningfulDays({
        recentAnalytics,
        recentActivityExperiences,
        eventDates: recentMeaningfulEventDates,
        now,
    });

    return {
        targetDate,
        nowIso,
        timezone: request.timezone ?? null,
        scheduledBlocks: blocks.map((block) => ({
            id: block.id,
            title: block.title,
            type: block.type,
            status: block.status,
            startAt: block.startAt.toISOString(),
            endAt: block.endAt.toISOString(),
        })),
        freeWindows: buildFreeWindows({ blocks, targetDate }),
        overdueBlocks: buildOverdueBlocks({ blocks, now }),
        habitSnapshot: {
            onboardingCompletedAt: habitPreferencesResult.habit.onboardingCompletedAt ?? null,
            firstMeaningfulActionAt: habitPreferencesResult.habit.firstMeaningfulActionAt ?? null,
            lastMeaningfulActionAt: habitPreferencesResult.habit.lastMeaningfulActionAt ?? null,
            rescueFrequencyLast14d: rescueEventsLast14d,
            meaningfulDaysLast7d: [...meaningfulDates]
                .filter((date) => Date.now() - new Date(`${date}T12:00:00.000Z`).getTime() <= (7 * 24 * 60 * 60 * 1000))
                .length,
            weeklyConsistencyTarget: 3,
        },
        userSignals: {
            recentFocusSessionsCount: recentAnalytics.length,
            recentActivityExperiencesCount: recentActivityExperiences.length,
            bestFocusWindow: behavior.bestStartWindows[0] ?? null,
            weakestStartWindows: behavior.weakestStartWindows,
            recommendedFocusDurationMin: behavior.recommendedFocusDurationMin,
            averageStartDelayMin: behavior.averageStartDelayMin,
            rescueFrequency: behavior.rescueFrequency,
            frictionPatterns: behavior.frictionPatterns,
            preferredBlockTypes: behavior.preferredBlockTypes,
        },
        bestFocusWindow: guide.bestFocusWindow ?? profile.bestFocusWindow?.data.window ?? null,
        recommendedFocusDurationMin: profile.optimalSessionLength?.data.medianMinutes ?? null,
        dailyLoadLevel: guide.dailyLoad.level,
        residualEnergyEstimate: guide.dailyLoad.residualEnergyEstimate,
        primaryUseCase: habitPreferencesResult.habit.primaryUseCase ?? null,
        hardestStartMoment: habitPreferencesResult.habit.hardestStartMoment ?? null,
        desiredHelp: habitPreferencesResult.habit.desiredHelp ?? null,
    };
}

export async function getPlannerProposal(
    supabase: SupabaseClient,
    userId: string,
    request: PlannerRequest,
    language: AppLanguage = "en",
): Promise<PlannerProposal> {
    const context = await buildPlannerContextBundle(supabase, userId, request, language);
    const session = await createPlannerSession({
        supabase,
        userId,
        request,
        context,
    });
    const plannerInput = await createPlannerInput({
        supabase,
        userId,
        sessionId: session.id,
        request,
        targetDate: context.targetDate,
    });
    const baseProposal = buildHeuristicPlannerProposal({
        request: {
            ...request,
            targetDate: context.targetDate,
            nowIso: context.nowIso,
        },
        context,
        language,
    });
    const proposalRecord = await createPlannerProposalRecord({
        supabase,
        userId,
        sessionId: session.id,
        inputId: plannerInput.id,
        proposal: baseProposal,
        variant: "initial",
        status: "active",
    });
    await recordPlannerDecision({
        supabase,
        userId,
        sessionId: session.id,
        proposalId: proposalRecord.id,
        decisionType: "proposal_shown",
        payload: {
            engine: baseProposal.engine,
            blocksProposed: baseProposal.drafts.length,
            source: request.source,
        },
    });
    return hydratePlannerProposal(proposalRecord);
}

function buildRevisionVariant(action: PlannerProposalRevisionRequest["action"]) {
    if (action === "lighten") return "lightened";
    if (action === "regenerate") return "regenerated";
    return "edited";
}

function buildRevisionDecisionType(action: PlannerProposalRevisionRequest["action"]): PlannerDecisionType {
    if (action === "lighten") return "proposal_lightened";
    if (action === "regenerate") return "proposal_regenerated";
    return "proposal_edited";
}

async function requirePlannerProposalRecord(
    supabase: SupabaseClient,
    userId: string,
    proposalId: string,
) {
    const proposalRecord = await fetchPlannerProposalRecord(supabase, userId, proposalId);
    if (!proposalRecord) {
        throw new Error("Planner proposal not found");
    }
    return proposalRecord;
}

export async function revisePlannerProposal(
    supabase: SupabaseClient,
    userId: string,
    request: PlannerProposalRevisionRequest,
    language: AppLanguage = "en",
): Promise<PlannerRevisionResult> {
    const baseRecord = await requirePlannerProposalRecord(supabase, userId, request.proposalId);

    if (request.action === "reject") {
        const decision = await recordPlannerDecision({
            supabase,
            userId,
            sessionId: request.sessionId,
            proposalId: baseRecord.id,
            decisionType: "proposal_rejected",
            payload: {
                action: request.action,
            },
        });
        return {
            sessionId: request.sessionId,
            decisionId: decision.id,
            proposal: null,
        };
    }

    const nextContext = await buildPlannerContextBundle(supabase, userId, {
        input: baseRecord.interpretation.rawInput,
        source: baseRecord.interpretation.source,
        targetDate: request.targetDate ?? baseRecord.targetDate,
        timezone: request.timezone ?? baseRecord.contextBundle.timezone,
        nowIso: request.nowIso ?? new Date().toISOString(),
        surface: "habit_home",
    }, language);
    const baseProposal = hydratePlannerProposal(baseRecord);
    const contextualProposal: PlannerProposal = {
        ...baseProposal,
        context: nextContext,
    };

    const revisedProposal = request.action === "lighten"
        ? lightenPlannerProposal(contextualProposal, language)
        : request.action === "regenerate"
            ? regeneratePlannerProposal({
                proposal: contextualProposal,
                scheduledBlocks: nextContext.scheduledBlocks,
                nowIso: request.nowIso ?? nextContext.nowIso,
                language,
            })
            : adjustPlannerProposalDraft({
                proposal: contextualProposal,
                draftIndex: request.draftIndex ?? 0,
                mode: request.editMode ?? "shorter",
                scheduledBlocks: nextContext.scheduledBlocks,
                language,
            });

    const nextRecord = await createPlannerProposalRecord({
        supabase,
        userId,
        sessionId: request.sessionId,
        inputId: baseRecord.inputId,
        proposal: revisedProposal,
        parentProposalId: baseRecord.id,
        variant: buildRevisionVariant(request.action),
        status: "active",
    });
    const decision = await recordPlannerDecision({
        supabase,
        userId,
        sessionId: request.sessionId,
        proposalId: nextRecord.id,
        fromProposalId: baseRecord.id,
        toProposalId: nextRecord.id,
        decisionType: buildRevisionDecisionType(request.action),
        payload: {
            action: request.action,
            draftIndex: request.draftIndex ?? null,
            editMode: request.editMode ?? null,
        },
    });

    return {
        sessionId: request.sessionId,
        decisionId: decision.id,
        proposal: hydratePlannerProposal(nextRecord),
    };
}

export async function applyPlannerProposal(
    supabase: SupabaseClient,
    userId: string,
    proposal: PlannerProposal,
): Promise<PlannerApplyResult> {
    const persistedProposal = await requirePlannerProposalRecord(supabase, userId, proposal.proposalId);
    const acceptedDecision = await recordPlannerDecision({
        supabase,
        userId,
        sessionId: proposal.sessionId,
        proposalId: persistedProposal.id,
        decisionType: "proposal_accepted",
        payload: {
            engine: persistedProposal.engine,
            variant: persistedProposal.variant,
        },
    });

    const createdBlocks = proposal.drafts.map((draft) => hydratePlannerBlock(draft));
    if (createdBlocks.length === 0) {
        return {
            sessionId: proposal.sessionId,
            proposalId: proposal.proposalId,
            acceptedDecisionId: acceptedDecision.id,
            appliedDecisionId: null,
            createdBlockIds: [],
            createdBlocks: [],
            totalCreated: 0,
            guidedPlanningRecommended: true,
        };
    }

    const payload = createdBlocks.map((block) => toInsertPayload(block, userId));
    const { error } = await supabase.from("blocks").insert(payload);
    if (error) throw error;

    const appliedDecision = await recordPlannerDecision({
        supabase,
        userId,
        sessionId: proposal.sessionId,
        proposalId: persistedProposal.id,
        decisionType: "plan_applied",
        payload: {
            createdBlockIds: createdBlocks.map((block) => block.id),
            createdBlocks: createdBlocks.length,
        },
    });
    await linkPlannerAppliedBlocks({
        supabase,
        userId,
        sessionId: proposal.sessionId,
        proposalId: persistedProposal.id,
        decisionId: appliedDecision.id,
        blockIds: createdBlocks.map((block) => block.id),
    });

    return {
        sessionId: proposal.sessionId,
        proposalId: proposal.proposalId,
        acceptedDecisionId: acceptedDecision.id,
        appliedDecisionId: appliedDecision.id,
        createdBlockIds: createdBlocks.map((block) => block.id),
        createdBlocks: createdBlocks.map((block) => serializeBlock(block)),
        totalCreated: createdBlocks.length,
        guidedPlanningRecommended: proposal.guidedPlanningSuggested || createdBlocks.length > 1,
    };
}
