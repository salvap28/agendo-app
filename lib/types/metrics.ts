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
    createdAt: string;
    updatedAt: string;
}
