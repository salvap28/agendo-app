export type EngagementMode =
    | "deep_focus"
    | "passive_attendance"
    | "collaborative"
    | "light_execution"
    | "admin_light"
    | "movement"
    | "logistics"
    | "recovery"
    | "personal";

export type ActivityOutcome =
    | "completed"
    | "partial"
    | "attended"
    | "joined_late"
    | "left_early"
    | "skipped"
    | "cancelled"
    | "postponed"
    | "rescheduled"
    | "interrupted"
    | "unknown";

export type EnergyImpact =
    | "restorative"
    | "energizing"
    | "neutral"
    | "demanding"
    | "draining"
    | "unknown";

export type CognitiveLoad =
    | "low"
    | "medium"
    | "high"
    | "unknown";

export type PerceivedValue =
    | "low"
    | "medium"
    | "high"
    | "unknown";

export type SocialDemand =
    | "solo"
    | "low"
    | "medium"
    | "high"
    | "unknown";

export type ExperienceSource =
    | "focus"
    | "calendar"
    | "manual"
    | "system_inferred"
    | "hybrid";

export type ActivityOutcomeReason =
    | "completed_as_planned"
    | "completed_with_adjustment"
    | "attended_as_expected"
    | "low_energy"
    | "high_friction"
    | "external_interruption"
    | "calendar_conflict"
    | "higher_priority"
    | "lack_of_clarity"
    | "poor_estimation"
    | "dependency_blocked"
    | "forgot"
    | "cancelled_by_other"
    | "not_useful_anymore"
    | "too_ambitious"
    | "transport_delay"
    | "health_or_wellbeing"
    | "unknown";

export type ActivityLocationMode =
    | "remote"
    | "in_person"
    | "hybrid"
    | "transit"
    | "unknown";

export type ActivityPresenceMode =
    | "required"
    | "optional"
    | "self_directed"
    | "unknown";

export type ActivityWindow = "morning" | "afternoon" | "evening" | "night";

export type ActivityPatternType =
    | "post_meeting_fatigue"
    | "post_class_residual_load"
    | "preferred_light_execution_window"
    | "attendance_reliability"
    | "postpone_tendency"
    | "energy_impact_by_engagement"
    | "logistics_fragmentation"
    | "recovery_boost"
    | "collaboration_buffer_need";

export interface ActivityExperience {
    id: string;
    experienceKey?: string;
    userId: string;
    sourceBlockId?: string | null;
    sourceFocusSessionId?: string | null;
    titleSnapshot?: string | null;
    blockTypeSnapshot?: string | null;
    tagSnapshot?: string | null;
    engagementMode: EngagementMode;
    outcome: ActivityOutcome;
    source: ExperienceSource;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
    actualStart?: string | null;
    actualEnd?: string | null;
    actualDurationMin?: number | null;
    energyImpact: EnergyImpact;
    cognitiveLoad: CognitiveLoad;
    perceivedValue: PerceivedValue;
    socialDemand: SocialDemand;
    outcomeReason: ActivityOutcomeReason;
    locationMode?: ActivityLocationMode | null;
    presenceMode?: ActivityPresenceMode | null;
    wasPlanned: boolean;
    wasCompletedAsPlanned: boolean;
    wasUserConfirmed: boolean;
    wasSystemInferred: boolean;
    confidence?: number | null;
    notes?: string | null;
    metadataJson?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface ActivityExperienceCheckoutInput {
    outcome: ActivityOutcome;
    energyImpact?: EnergyImpact;
    perceivedValue?: PerceivedValue;
    cognitiveLoad?: CognitiveLoad;
    outcomeReason?: ActivityOutcomeReason;
    notes?: string;
}

export interface ActivityExperienceAnalytics {
    totalCount: number;
    attendanceRate: number;
    skipRate: number;
    postponeRate: number;
    nonFocusCompletionRate: number;
    executionVarianceMinutes: number;
    outcomeDistribution: Partial<Record<ActivityOutcome, number>>;
    energyImpactDistribution: Partial<Record<EnergyImpact, number>>;
    cognitiveLoadDistribution: Partial<Record<CognitiveLoad, number>>;
    perceivedValueDistribution: Partial<Record<PerceivedValue, number>>;
    reasonDistribution: Partial<Record<ActivityOutcomeReason, number>>;
}

export interface ActivityDailyLoadSnapshot {
    passiveAttendanceLoad: number;
    logisticsLoad: number;
    collaborativeLoad: number;
    recoveryEffect: number;
    transitionCost: number;
    realDayLoad: number;
    residualEnergyEstimate: number;
    planRealityVariance: number;
}

export interface ActivityEngagementEnergySignal {
    engagementMode: EngagementMode;
    dominantImpact: EnergyImpact;
    drainingRate: number;
    restorativeRate: number;
    confidence: number;
    sampleSize: number;
}

export interface ActivityWindowSignal {
    window: ActivityWindow;
    score: number;
    confidence: number;
    sampleSize: number;
}

export interface PostponeTendencySignal {
    engagementMode: EngagementMode;
    rate: number;
    confidence: number;
    sampleSize: number;
}

export interface ActivityPatternSummary {
    patternKey: string;
    patternType: ActivityPatternType;
    confidence: number;
    sampleSize: number;
    title: string;
    description: string;
    appliesTo: string[];
    data: Record<string, unknown>;
    updatedAt: string;
}

export interface ActivityBehaviorSignals {
    attendanceReliability: number | null;
    postMeetingFatigue: number | null;
    postClassResidualLoad: number | null;
    preferredLightExecutionWindows: ActivityWindowSignal[];
    postponeTendencies: PostponeTendencySignal[];
    energyImpactByEngagementMode: ActivityEngagementEnergySignal[];
    dominantReasons: Array<{
        reason: ActivityOutcomeReason;
        count: number;
    }>;
    patterns: ActivityPatternSummary[];
    lastActivityAt: string | null;
}
