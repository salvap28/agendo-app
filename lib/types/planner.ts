import type { FocusWindow } from "./behavior";
import type {
    HabitDesiredHelp,
    HabitHardestStartMoment,
    HabitPrimaryUseCase,
} from "./habit";
import type { BlockStatus, BlockType, SerializableBlock } from "./blocks";
import type { DailyLoadLevel } from "./planning";

export type PlannerInputSource = "text" | "voice";
export type PlannerEngine = "heuristic_v1";
export type PlannerSurface = "habit_home" | "guided_planning" | "widget" | "notification" | "unknown";
export type PlannerSessionStatus = "active" | "applied" | "rejected" | "abandoned";
export type PlannerProposalStatus = "active" | "superseded" | "accepted" | "applied" | "rejected";
export type PlannerProposalVariant = "initial" | "lightened" | "regenerated" | "edited";
export type PlannerDecisionType =
    | "proposal_shown"
    | "proposal_lightened"
    | "proposal_regenerated"
    | "proposal_edited"
    | "proposal_accepted"
    | "proposal_rejected"
    | "plan_applied";

export interface PlannerRequest {
    input: string;
    source: PlannerInputSource;
    targetDate?: string | null;
    timezone?: string | null;
    nowIso?: string | null;
    surface?: PlannerSurface | null;
}

export interface PlannerScheduledBlockSnapshot {
    id: string;
    title: string;
    type: BlockType;
    status: BlockStatus;
    startAt: string;
    endAt: string;
}

export interface PlannerFreeWindow {
    startAt: string;
    endAt: string;
    durationMin: number;
}

export interface PlannerOverdueBlockSnapshot {
    id: string;
    title: string;
    type: BlockType;
    startAt: string;
    endAt: string;
    priority: number;
    minutesOverdue: number;
}

export interface PlannerHabitSnapshot {
    onboardingCompletedAt: string | null;
    firstMeaningfulActionAt: string | null;
    lastMeaningfulActionAt: string | null;
    rescueFrequencyLast14d: number;
    meaningfulDaysLast7d: number;
    weeklyConsistencyTarget: number;
}

export interface PlannerUserSignals {
    recentFocusSessionsCount: number;
    recentActivityExperiencesCount: number;
    bestFocusWindow: FocusWindow | null;
    weakestStartWindows: FocusWindow[];
    recommendedFocusDurationMin: number | null;
    averageStartDelayMin: number | null;
    rescueFrequency: number;
    frictionPatterns: string[];
    preferredBlockTypes: BlockType[];
}

export interface PlannerContextBundle {
    targetDate: string;
    nowIso: string;
    timezone: string | null;
    scheduledBlocks: PlannerScheduledBlockSnapshot[];
    freeWindows: PlannerFreeWindow[];
    overdueBlocks: PlannerOverdueBlockSnapshot[];
    habitSnapshot: PlannerHabitSnapshot;
    userSignals: PlannerUserSignals;
    bestFocusWindow: FocusWindow | null;
    recommendedFocusDurationMin: number | null;
    dailyLoadLevel: DailyLoadLevel | null;
    residualEnergyEstimate: number | null;
    primaryUseCase: HabitPrimaryUseCase | null;
    hardestStartMoment: HabitHardestStartMoment | null;
    desiredHelp: HabitDesiredHelp | null;
}

export interface PlannerInterpretationItem {
    source: string;
    title: string;
    type: BlockType;
    durationMin: number;
    explicitStartAt: string | null;
    explicitTime: boolean;
    focusRequired: boolean;
    overloadHint: boolean;
    constraints: string[];
}

export interface PlannerInterpretation {
    rawInput: string;
    source: PlannerInputSource;
    targetDate: string;
    items: PlannerInterpretationItem[];
    detectedOverload: boolean;
}

export interface PlannerProposalDraft {
    clientId: string;
    source: string;
    title: string;
    type: BlockType;
    durationMin: number;
    startAt: string;
    endAt: string;
    explicitTime: boolean;
    reason: string;
}

export interface PlannerProposal {
    sessionId: string;
    inputId: string;
    proposalId: string;
    parentProposalId: string | null;
    variant: PlannerProposalVariant;
    status: PlannerProposalStatus;
    createdAt: string;
    engine: PlannerEngine;
    headline: string;
    summary: string;
    targetDate: string;
    context: PlannerContextBundle;
    interpretation: PlannerInterpretation;
    drafts: PlannerProposalDraft[];
    totalDurationMin: number;
    explicitTimesCount: number;
    guidedPlanningSuggested: boolean;
}

export interface PlannerApplyResult {
    sessionId: string;
    proposalId: string;
    acceptedDecisionId: string | null;
    appliedDecisionId: string | null;
    createdBlockIds: string[];
    createdBlocks: SerializableBlock[];
    totalCreated: number;
    guidedPlanningRecommended: boolean;
}

export interface PlannerProposalRevisionRequest {
    sessionId: string;
    proposalId: string;
    action: "lighten" | "regenerate" | "edit" | "reject";
    draftIndex?: number;
    editMode?: "earlier" | "later" | "shorter";
    targetDate?: string | null;
    timezone?: string | null;
    nowIso?: string | null;
}

export interface PlannerRevisionResult {
    sessionId: string;
    decisionId: string;
    proposal: PlannerProposal | null;
}

export interface PlannerSessionRecord {
    id: string;
    userId: string;
    status: PlannerSessionStatus;
    surface: PlannerSurface;
    inputSource: PlannerInputSource;
    targetDate: string;
    latestContextBundle: PlannerContextBundle;
    latestInputId: string | null;
    latestProposalId: string | null;
    appliedProposalId: string | null;
    appliedAt: string | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PlannerInputRecord {
    id: string;
    sessionId: string;
    userId: string;
    source: PlannerInputSource;
    rawInput: string;
    normalizedInput: string | null;
    targetDate: string;
    requestPayload: Record<string, unknown>;
    createdAt: string;
}

export interface PlannerProposalRecord {
    id: string;
    sessionId: string;
    inputId: string;
    userId: string;
    parentProposalId: string | null;
    engine: PlannerEngine;
    variant: PlannerProposalVariant;
    status: PlannerProposalStatus;
    headline: string;
    summary: string;
    targetDate: string;
    contextBundle: PlannerContextBundle;
    interpretation: PlannerInterpretation;
    drafts: PlannerProposalDraft[];
    totalDurationMin: number;
    explicitTimesCount: number;
    guidedPlanningSuggested: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PlannerDecisionRecord {
    id: string;
    sessionId: string;
    userId: string;
    proposalId: string | null;
    fromProposalId: string | null;
    toProposalId: string | null;
    decisionType: PlannerDecisionType;
    payload: Record<string, unknown>;
    createdAt: string;
}
