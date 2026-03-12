export interface DailyMetric {
    id: string;
    userId: string;
    date: string; // YYYY-MM-DD
    progressScore?: number;
    frictionScore?: number;
    consistencyScore?: number;
    emotionScore?: number;
    momentumDay?: number;
    momentumTotal?: number;
    createdAt: string;
    updatedAt: string;
}
