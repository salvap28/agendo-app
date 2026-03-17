import { BlockType } from "./blocks";
import { FocusMode } from "./focus";
import {
    ActivityBehaviorSignals,
    ActivityExperienceAnalytics,
    ActivityPatternType,
    ActivityPatternSummary,
} from "./activity";

export type FocusWindow = "morning" | "afternoon" | "evening" | "night";
export type SessionLengthBucket = "short" | "medium" | "long" | "extended";
export type WarmupStage = "cold" | "warming" | "ready";
export type PatternTrend = "improving" | "stable" | "declining";
export type BehaviorPatternType =
    | "best_focus_window"
    | "optimal_session_length"
    | "friction_source"
    | "consistency_trend"
    | "recent_improvement"
    | "post_meeting_fatigue"
    | "post_class_residual_load"
    | "preferred_light_execution_window"
    | "attendance_reliability"
    | "postpone_tendency"
    | "energy_impact_by_engagement"
    | "logistics_fragmentation"
    | "recovery_boost"
    | "collaboration_buffer_need";
export type BehaviorPatternStatus = "warming" | "active" | "stale";
export type FrictionSourceType =
    | "block_type"
    | "time_window"
    | "duration_bucket"
    | "start_pattern";

export interface PatternEvidence {
    sampleSize: number;
    confidence: number;
    recencyDays: number;
    variability: number;
    consistency: number;
    dominance: number;
    recentWins: number;
    comparisonDelta?: number;
    secondaryScore?: number | null;
}

export interface BehaviorPatternBase<
    TPatternType extends BehaviorPatternType,
    TData extends object
> {
    patternKey: string;
    patternType: TPatternType;
    windowKind: "recent" | "weekly" | "fortnight" | "monthly" | "persistent";
    status: BehaviorPatternStatus;
    confidence: number;
    sampleSize: number;
    data: TData;
    evidence: PatternEvidence;
    firstDetectedAt?: string;
    lastConfirmedAt?: string;
    updatedAt: string;
}

export interface BestFocusWindowPatternData {
    window: FocusWindow;
    averageOutcomeScore: number;
    averageProgressScore: number;
    averageFrictionScore: number;
    averageBehaviorScore: number;
    comparisonScore: number;
}

export interface OptimalSessionLengthPatternData {
    bucket: SessionLengthBucket;
    minMinutes: number;
    maxMinutes: number;
    medianMinutes: number;
    sustainabilityScore: number;
    comparisonScore: number;
}

export interface FrictionSourcePatternData {
    sourceType: FrictionSourceType;
    value: string;
    label: string;
    averageFrictionScore: number;
    averageBehaviorScore: number;
    comparisonFrictionScore: number;
}

export interface ConsistencyTrendPatternData {
    direction: PatternTrend;
    recentScore: number;
    previousScore: number;
    delta: number;
    recentSessionCount: number;
    previousSessionCount: number;
}

export interface RecentImprovementPatternData {
    area: "friction" | "stability" | "consistency" | "recovery";
    delta: number;
    recentValue: number;
    previousValue: number;
}

export type BestFocusWindowPattern = BehaviorPatternBase<"best_focus_window", BestFocusWindowPatternData>;
export type OptimalSessionLengthPattern = BehaviorPatternBase<"optimal_session_length", OptimalSessionLengthPatternData>;
export type FrictionSourcePattern = BehaviorPatternBase<"friction_source", FrictionSourcePatternData>;
export type ConsistencyTrendPattern = BehaviorPatternBase<"consistency_trend", ConsistencyTrendPatternData>;
export type RecentImprovementPattern = BehaviorPatternBase<"recent_improvement", RecentImprovementPatternData>;
export type ActivityDerivedPattern = BehaviorPatternBase<ActivityPatternType, Record<string, unknown>>;

export type BehaviorPatternRecord =
    | BestFocusWindowPattern
    | OptimalSessionLengthPattern
    | FrictionSourcePattern
    | ConsistencyTrendPattern
    | RecentImprovementPattern
    | ActivityDerivedPattern;

export interface SessionAnalyticsDiagnostics {
    entryDurationMs: number;
    completionRatio: number;
    timeWindow: FocusWindow;
    durationBucket: SessionLengthBucket;
    frictionEvents: number;
    stabilityRecoveryCount: number;
    interruptionPenalty: number;
    inactivityPenalty: number;
    recoveryBonus: number;
    scoreBreakdown: {
        progress: number;
        friction: number;
        contextualConsistency: number;
        behavior: number;
    };
}

export interface FocusSessionAnalytics {
    sessionId: string;
    userId: string;
    mode: FocusMode;
    blockType?: BlockType;
    initiatedAt: string;
    startedAt: string;
    endedAt: string;
    entryDurationMs: number;
    plannedDurationMs: number;
    actualDurationMs: number;
    activeDurationMs: number;
    pauseDurationMs: number;
    inactivityDurationMs: number;
    pauseCount: number;
    exitCount: number;
    taskChangeCount: number;
    interventionCount: number;
    interventionAcceptCount: number;
    interventionIgnoreCount: number;
    inactivityCount: number;
    stabilityRecoveryCount: number;
    closureType: "completed" | "abandoned";
    completionRatio: number;
    stabilityRatio: number;
    continuityRatio: number;
    recoveryRatio: number;
    startDelayMs: number;
    progressScore: number;
    frictionScore: number;
    contextualConsistencyScore: number;
    behaviorScore: number;
    timeWindow: FocusWindow;
    durationBucket: SessionLengthBucket;
    diagnostics: SessionAnalyticsDiagnostics;
    computedAt: string;
    updatedAt: string;
}

export interface ConfidenceOverview {
    bestFocusWindow: number | null;
    optimalSessionLength: number | null;
    frictionSource: number | null;
    consistencyTrend: number | null;
    recentImprovement: number | null;
    overall: number;
}

export interface BehaviorProfile {
    userId: string;
    warmupStage: WarmupStage;
    bestFocusWindow: BestFocusWindowPattern | null;
    optimalSessionLength: OptimalSessionLengthPattern | null;
    topFrictionSources: FrictionSourcePattern[];
    consistencyTrend: ConsistencyTrendPattern | null;
    recentImprovements: RecentImprovementPattern[];
    activePatterns: BehaviorPatternRecord[];
    confidenceOverview: ConfidenceOverview;
    activitySignals: ActivityBehaviorSignals;
    activityAnalytics: ActivityExperienceAnalytics | null;
    activityPatterns: ActivityPatternSummary[];
    lastSessionAnalyticsAt: string | null;
    lastActivityAnalyticsAt: string | null;
    lastDailyConsolidatedAt: string | null;
    lastWeeklyConsolidatedAt: string | null;
    lastUpdatedAt: string;
    profileVersion: string;
}

export interface InsightCardData {
    id: string;
    patternKey: string;
    type: BehaviorPatternType | "activity_signal";
    tone: "positive" | "neutral" | "caution";
    title: string;
    description: string;
    confidence: number;
    sampleSize: number;
}

export interface InsightTimelinePoint {
    date: string;
    progressScore: number | null;
    frictionScore: number | null;
    historicalConsistencyScore: number | null;
    behaviorScore: number | null;
    compositeSignalScore: number | null;
}

export interface InsightsDashboardData {
    profile: BehaviorProfile;
    cards: InsightCardData[];
    timeline: InsightTimelinePoint[];
    activityOverview: ActivityExperienceAnalytics | null;
    weeklySessions: number;
    completionRate: number;
    averageStability: number;
    compositeSignalCurrent: number;
    compositeSignalDeltaWeek: number;
}
