import type { Block } from "@/lib/types/blocks";
import type { PlannerProposal, PlannerProposalDraft } from "@/lib/types/planner";
import {
    adjustPlannerProposalDraft,
    buildHeuristicPlannerProposal,
    humanizeBlockTitle,
    lightenPlannerProposal,
    regeneratePlannerProposal,
} from "@/lib/engines/planner/heuristic";

export type HabitCaptureDraft = PlannerProposalDraft;
export type HabitCapturePlan = PlannerProposal;

function getDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export { humanizeBlockTitle };

export function buildHabitCapturePlan(args: {
    input: string;
    existingBlocks: Block[];
    now?: Date;
}): HabitCapturePlan {
    const now = args.now ?? new Date();
    return buildHeuristicPlannerProposal({
        request: {
            input: args.input,
            source: "text",
            targetDate: getDateKey(now),
            nowIso: now.toISOString(),
            timezone: null,
        },
        context: {
            targetDate: getDateKey(now),
            nowIso: now.toISOString(),
            timezone: null,
            scheduledBlocks: args.existingBlocks.map((block) => ({
                id: block.id,
                title: block.title,
                type: block.type,
                status: block.status,
                startAt: block.startAt.toISOString(),
                endAt: block.endAt.toISOString(),
            })),
            freeWindows: [],
            overdueBlocks: [],
            habitSnapshot: {
                onboardingCompletedAt: null,
                firstMeaningfulActionAt: null,
                lastMeaningfulActionAt: null,
                rescueFrequencyLast14d: 0,
                meaningfulDaysLast7d: 0,
                weeklyConsistencyTarget: 3,
            },
            userSignals: {
                recentFocusSessionsCount: 0,
                recentActivityExperiencesCount: 0,
                bestFocusWindow: null,
                weakestStartWindows: [],
                recommendedFocusDurationMin: null,
                averageStartDelayMin: null,
                rescueFrequency: 0,
                frictionPatterns: [],
                preferredBlockTypes: [],
            },
            bestFocusWindow: null,
            recommendedFocusDurationMin: null,
            dailyLoadLevel: null,
            residualEnergyEstimate: null,
            primaryUseCase: null,
            hardestStartMoment: null,
            desiredHelp: null,
        },
        language: "es",
    });
}

export function lightenHabitCapturePlan(plan: HabitCapturePlan): HabitCapturePlan {
    return lightenPlannerProposal(plan, "es");
}

export function regenerateHabitCapturePlan(args: {
    plan: HabitCapturePlan;
    existingBlocks: Block[];
    now?: Date;
}): HabitCapturePlan {
    return regeneratePlannerProposal({
        proposal: args.plan,
        scheduledBlocks: args.existingBlocks,
        nowIso: args.now?.toISOString(),
        language: "es",
    });
}

export function adjustHabitCaptureDraft(args: {
    plan: HabitCapturePlan;
    draftIndex: number;
    mode: "earlier" | "later" | "shorter";
    existingBlocks: Block[];
}): HabitCapturePlan {
    return adjustPlannerProposalDraft({
        proposal: args.plan,
        draftIndex: args.draftIndex,
        mode: args.mode,
        scheduledBlocks: args.existingBlocks,
        language: "es",
    });
}
