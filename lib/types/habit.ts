import type { Block, BlockType } from "./blocks";
import type { FocusWindow } from "./behavior";

export type HabitPrimaryUseCase = "study" | "work" | "gym" | "mixed";
export type HabitHardestStartMoment =
    | "morning"
    | "afternoon"
    | "night"
    | "after_class"
    | "before_training"
    | "mixed";
export type HabitDesiredHelp =
    | "decide"
    | "start_focus"
    | "organize_day"
    | "resume_when_lost"
    | "mixed";

export interface HabitPreferences {
    primaryUseCase?: HabitPrimaryUseCase | null;
    hardestStartMoment?: HabitHardestStartMoment | null;
    desiredHelp?: HabitDesiredHelp | null;
    primaryUseCaseSelections?: HabitPrimaryUseCase[] | null;
    hardestStartMomentSelections?: HabitHardestStartMoment[] | null;
    desiredHelpSelections?: HabitDesiredHelp[] | null;
    onboardingCompletedAt?: string | null;
    firstMeaningfulActionAt?: string | null;
    lastMeaningfulActionAt?: string | null;
    lastDailyRitualShownOn?: string | null;
    lastDailyRitualConfirmedAt?: string | null;
    ignoredNotificationCount?: number;
    notificationCooldownUntil?: string | null;
}

export interface HabitSuggestedBlockDraft {
    title: string;
    type: BlockType;
    durationMin: number;
    startAt: string;
    reason: string;
}

export type HabitRecommendationType =
    | "shorter_block"
    | "move_earlier"
    | "move_later"
    | "bridge_block"
    | "lighter_version"
    | "avoid_window";

export interface HabitAdaptiveRecommendation {
    type: HabitRecommendationType;
    title: string;
    body: string;
    evidence: string;
    suggestedDurationMin?: number | null;
    suggestedWindow?: FocusWindow | null;
}

export type NextBlockActionState = "start_now" | "prepare" | "reorder" | "fallback";

export interface NextRelevantBlock {
    block: Block | null;
    state: NextBlockActionState;
    headline: string;
    context: string;
    reason: string;
    suggestedDurationMin: number | null;
    suggestedStartAt: string | null;
    adaptiveRecommendation: HabitAdaptiveRecommendation | null;
}

export type RescueActionType = "move" | "shorten" | "cancel" | "lighten";

export interface RescuePlanAction {
    type: RescueActionType;
    blockId: string;
    title: string;
    summary: string;
    suggestedStart: string | null;
    suggestedDurationMin: number | null;
}

export interface RescuePlanBlock {
    id: string;
    title: string;
    type: BlockType;
    startAt: string;
    endAt: string;
    priority: number;
}

export interface RescuePlan {
    overdueBlocks: RescuePlanBlock[];
    priorityCandidates: RescuePlanBlock[];
    suggestedActions: RescuePlanAction[];
    suggestedStart: string | null;
    suggestedDurationMin: number;
    headline: string;
    tone: string;
}

export interface HabitDayState {
    totalKeyBlocks: number;
    completedKeyBlocks: number;
    remainingLabel: string;
}

export interface DailyRitualState {
    shouldShow: boolean;
    headline: string;
    body: string;
    blockId: string | null;
    confirmedToday: boolean;
}

export interface WeeklyConsistencyState {
    meaningfulDays: number;
    targetDays: number;
    headline: string;
    body: string;
    reachedTarget: boolean;
}

export interface HabitBehaviorSnapshot {
    bestStartWindows: FocusWindow[];
    weakestStartWindows: FocusWindow[];
    recommendedFocusDurationMin: number | null;
    averageStartDelayMin: number | null;
    rescueFrequency: number;
    frictionPatterns: string[];
    preferredBlockTypes: BlockType[];
}

export interface HabitOnboardingState {
    shouldShow: boolean;
    completedAt: string | null;
    firstMeaningfulActionAt: string | null;
    draftSuggestion: HabitSuggestedBlockDraft | null;
}

export interface HabitWidgetSnapshot {
    title: string;
    body: string;
    ctaLabel: string;
    deepLink: string;
}

export interface HabitHomeData {
    onboarding: HabitOnboardingState;
    nextBlock: NextRelevantBlock;
    dayState: HabitDayState;
    dailyRitual: DailyRitualState;
    rescuePlan: RescuePlan | null;
    weeklyConsistency: WeeklyConsistencyState;
    behavior: HabitBehaviorSnapshot;
    widget: HabitWidgetSnapshot;
}

export interface HabitEventPayload {
    name: string;
    occurredAt?: string;
    blockId?: string | null;
    sessionId?: string | null;
    plannerSessionId?: string | null;
    plannerProposalId?: string | null;
    plannerDecisionId?: string | null;
    surface?: string | null;
    metadata?: Record<string, unknown>;
}
