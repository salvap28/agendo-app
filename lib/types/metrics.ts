export interface DailyMetric {
    id: string;
    userId: string;
    date: string; // YYYY-MM-DD
    progressScore?: number;
    frictionScore?: number;
    consistencyScore?: number;
    emotionScore?: number;
    behaviorScore?: number;
    momentumDay?: number;
    momentumTotal?: number;
    sessionCount?: number;
    completedSessions?: number;
    abandonedSessions?: number;
    activeDurationMs?: number;
    pauseDurationMs?: number;
    inactivityDurationMs?: number;
    attendanceRate?: number;
    skipRate?: number;
    postponeRate?: number;
    nonFocusCompletionRate?: number;
    passiveLoadScore?: number;
    logisticsLoadScore?: number;
    collaborativeLoadScore?: number;
    recoveryEffectScore?: number;
    transitionCostScore?: number;
    realDayLoadScore?: number;
    residualEnergyEstimate?: number;
    planRealityVariance?: number;
    createdAt: string;
    updatedAt: string;
}
