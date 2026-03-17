import { BehaviorProfile, FocusSessionAnalytics, FocusWindow } from "./behavior";
import { Block, BlockFlexibility, BlockIntensity, BlockPriority } from "./blocks";
import { ActivityExperience, ActivityDailyLoadSnapshot } from "./activity";

export type PlanningRecommendationType =
    | "move_block"
    | "shorten_block"
    | "split_block"
    | "reduce_daily_load"
    | "insert_break"
    | "reschedule_to_best_window"
    | "downgrade_goal"
    | "start_small"
    | "protect_focus_window";

export type PlanningRecommendationScope = "block" | "day" | "guided_plan";
export type PlanningRecommendationStatus = "active" | "dismissed" | "accepted" | "ignored" | "expired" | "applied";
export type PlanningPriority = "low" | "medium" | "high";
export type PlanningHypothesisStrength = "weak" | "recent" | "stable";
export type DailyLoadLevel = "low" | "medium" | "high" | "overload";
export type PlanningActionMode = "informational" | "manual" | "auto";
export type ReasonCode =
    | "BEST_WINDOW_MISMATCH"
    | "SESSION_TOO_LONG"
    | "DAY_OVERLOAD"
    | "HIGH_FRICTION_CATEGORY"
    | "INTENSE_SEQUENCE"
    | "PREMIUM_WINDOW_PROTECTION"
    | "OVEROPTIMISTIC_PLAN";

export interface RecommendationApplyability {
    mode: PlanningActionMode;
    helperText: string;
}

export interface DailyLoadSnapshot {
    date: string;
    score: number;
    level: DailyLoadLevel;
    totalBlocks: number;
    totalPlannedMinutes: number;
    intenseBlocks: number;
    longBlocks: number;
    intenseSequences: number;
    deadlinePressureCount: number;
    breakCoverageRatio: number;
    passiveAttendanceLoad: number;
    logisticsLoad: number;
    collaborativeLoad: number;
    recoveryEffect: number;
    transitionCost: number;
    realDayLoad: number;
    residualEnergyEstimate: number;
    planRealityVariance: number;
}

export interface PlanningEvidence {
    sampleSize: number;
    confidence: number;
    hypothesisStrength: PlanningHypothesisStrength;
    lastUpdated: string | null;
    trendDirection?: "improving" | "stable" | "declining" | null;
    appliesTo: string[];
    recentlyValidated: boolean;
    signals: string[];
}

export interface SuggestedAction {
    kind: "move" | "shorten" | "split" | "insert_break" | "mark_optional" | "downgrade_goal" | "review_window" | "review_plan";
    label: string;
    payload: Record<string, unknown>;
}

export interface GuidedPlanningStep {
    order: number;
    blockId: string | null;
    title: string;
    emphasis: "protect" | "pace" | "lighten" | "recover";
    suggestedStart: string | null;
    suggestedEnd: string | null;
    recommendedDurationMinutes: number | null;
    reason: string;
}

export interface GuidedPlanningOutput {
    headline: string;
    summary: string;
    strategy: string;
    priorityBlockIds: string[];
    steps: GuidedPlanningStep[];
    adjustmentRecommendationIds: string[];
}

export interface PlanningFeedbackSummaryItem {
    type: PlanningRecommendationType;
    shownCount: number;
    acceptedCount: number;
    dismissedCount: number;
    ignoredCount: number;
    appliedCount: number;
    lastFeedbackAt: string | null;
}

export type PlanningFeedbackSummary = Partial<Record<PlanningRecommendationType, PlanningFeedbackSummaryItem>>;

export interface PlanningRecommendation {
    id: string;
    type: PlanningRecommendationType;
    scope: PlanningRecommendationScope;
    targetBlockId?: string | null;
    targetDate?: string | null;
    priority: PlanningPriority;
    confidence: number;
    title: string;
    message: string;
    reason: string;
    reasonCode: ReasonCode;
    reasonPayload: Record<string, unknown>;
    evidence: PlanningEvidence;
    applyability: RecommendationApplyability;
    suggestedAction: SuggestedAction;
    dismissible: boolean;
    reversible: boolean;
    createdAt: string;
    status?: PlanningRecommendationStatus;
    acceptedAt?: string | null;
    dismissedAt?: string | null;
    appliedAt?: string | null;
    ignoredAt?: string | null;
    firstSeenAt?: string | null;
    lastSeenAt?: string | null;
    seenCount?: number;
}

export interface PlanningEngineInput {
    userId: string;
    profile: BehaviorProfile;
    recentAnalytics: FocusSessionAnalytics[];
    activityExperiences: ActivityExperience[];
    blocks: Block[];
    targetDate: string;
    targetBlockId?: string;
    preferences?: PlanningPreferencesInput;
    feedbackSummary?: PlanningFeedbackSummary;
}

export interface PlanningBlockSnapshot {
    block: Block;
    durationMinutes: number;
    priority: BlockPriority;
    difficulty: number;
    flexibility: BlockFlexibility;
    intensity: BlockIntensity;
    cognitivelyHeavy: boolean;
    splittable: boolean;
    optional: boolean;
    deadlineIso: string | null;
}

export interface PlanningGuideResult {
    date: string;
    dailyLoad: DailyLoadSnapshot;
    blocks: PlanningBlockSnapshot[];
    recommendations: PlanningRecommendation[];
    bestFocusWindow: FocusWindow | null;
    guidedPlan: GuidedPlanningOutput | null;
    activityLoad: ActivityDailyLoadSnapshot;
}

export interface PersistedPlanningRecommendation {
    recommendationId: string;
    userId: string;
    targetBlockId: string | null;
    targetDate: string | null;
    type: PlanningRecommendationType;
    scope: PlanningRecommendationScope;
    status: PlanningRecommendationStatus;
    confidence: number;
    priority: PlanningPriority;
    title: string;
    message: string;
    reasonCode: ReasonCode;
    reasonPayload: Record<string, unknown>;
    evidence: PlanningEvidence;
    applyability: RecommendationApplyability;
    suggestedAction: SuggestedAction;
    dismissible: boolean;
    reversible: boolean;
    createdAt: string;
    expiresAt: string | null;
    acceptedAt: string | null;
    appliedAt: string | null;
    dismissedAt: string | null;
    ignoredAt: string | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    seenCount: number;
    acceptedCount: number;
    dismissedCount: number;
    ignoredCount: number;
    appliedCount: number;
}

export interface PlanningPreferencesInput {
    availableFrom?: string | null;
    availableTo?: string | null;
    preferredDate?: string | null;
    rigidity?: "low" | "medium" | "high";
    subjectiveEnergy?: "low" | "medium" | "high" | null;
    blockIds?: string[];
}
