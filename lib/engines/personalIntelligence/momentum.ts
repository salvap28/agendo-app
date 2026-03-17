import { average } from "./evidence";

export function calculateDailyCompositeSignal(
    progressScore: number,
    historicalConsistencyScore: number,
    frictionScore: number,
    behaviorScore: number
) {
    const signal = (progressScore * 0.35) +
        (historicalConsistencyScore * 0.25) -
        (frictionScore * 0.2) +
        (behaviorScore * 0.2);

    return Math.min(100, Math.max(0, Math.round(signal)));
}

export function calculateCompositeTrajectory(
    pastSignals: Array<{ date: string; composite_signal: number }>
) {
    if (pastSignals.length === 0) return 0;

    const recent = pastSignals.slice(0, 7).map((item) => item.composite_signal || 0);
    const baseline = pastSignals.slice(7, 21).map((item) => item.composite_signal || 0);

    if (baseline.length === 0) {
        return Math.round(average(recent));
    }

    const recentAverage = average(recent);
    const baselineAverage = average(baseline);
    const blend = (recentAverage * 0.7) + (baselineAverage * 0.3);

    return Math.min(100, Math.max(0, Math.round(blend)));
}
