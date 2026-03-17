import {
    BehaviorPatternRecord,
    BehaviorProfile,
    BestFocusWindowPattern,
    ConfidenceOverview,
    ConsistencyTrendPattern,
    FocusSessionAnalytics,
    FrictionSourcePattern,
    PatternEvidence,
    PatternTrend,
    RecentImprovementPattern,
    SessionLengthBucket,
    WarmupStage,
    OptimalSessionLengthPattern,
} from "@/lib/types/behavior";
import { ActivityExperience } from "@/lib/types/activity";
import {
    buildActivityBehaviorSignals,
    computeActivityExperienceAnalytics,
} from "@/lib/engines/activityExperience";
import {
    calculateEvidenceConfidence,
    clampUnit,
    meetsEvidenceThreshold,
    roundToTwoDecimals,
    standardDeviation,
} from "./evidence";
import { getSessionLengthBucketRange } from "./sessionAnalytics";

const DAY_MS = 24 * 60 * 60 * 1000;

type AnalyticsGroup = {
    key: string;
    items: FocusSessionAnalytics[];
    score: number;
};

function average(values: number[]) {
    if (values.length === 0) return 0;
    return values.reduce((total, value) => total + value, 0) / values.length;
}

function sortByEndedAtDescending(items: FocusSessionAnalytics[]) {
    return [...items].sort((left, right) => new Date(right.endedAt).getTime() - new Date(left.endedAt).getTime());
}

function filterAnalyticsByDays(analytics: FocusSessionAnalytics[], days: number, now = new Date()) {
    const nowMs = now.getTime();
    return analytics.filter((item) => nowMs - new Date(item.endedAt).getTime() <= (days * DAY_MS));
}

function calculateOutcomeScore(item: FocusSessionAnalytics) {
    return (
        (item.progressScore * 0.45) +
        (item.behaviorScore * 0.35) +
        ((100 - item.frictionScore) * 0.20)
    );
}

function latestRecencyDays(items: FocusSessionAnalytics[], now = new Date()) {
    if (items.length === 0) return 365;
    const latestTimestamp = Math.max(...items.map((item) => new Date(item.endedAt).getTime()));
    return Math.max(0, (now.getTime() - latestTimestamp) / DAY_MS);
}

function buildPatternEvidence(
    items: FocusSessionAnalytics[],
    scores: number[],
    dominance: number,
    recentWins: number,
    comparisonDelta: number,
    secondaryScore: number | null,
    now = new Date()
): PatternEvidence {
    const variability = standardDeviation(scores);
    const consistency = clampUnit(1 - (variability / 20));
    const confidence = calculateEvidenceConfidence({
        sampleSize: items.length,
        variability,
        recencyDays: latestRecencyDays(items, now),
        dominance,
        consistency,
    });

    return {
        sampleSize: items.length,
        confidence,
        recencyDays: roundToTwoDecimals(latestRecencyDays(items, now)),
        variability: roundToTwoDecimals(variability),
        consistency: roundToTwoDecimals(consistency),
        dominance: roundToTwoDecimals(dominance),
        recentWins,
        comparisonDelta: roundToTwoDecimals(comparisonDelta),
        secondaryScore: secondaryScore === null ? null : roundToTwoDecimals(secondaryScore),
    };
}

function getWarmupStage(totalSessions: number): WarmupStage {
    if (totalSessions >= 16) return "ready";
    if (totalSessions >= 8) return "warming";
    return "cold";
}

function buildEmptyConfidenceOverview(): ConfidenceOverview {
    return {
        bestFocusWindow: null,
        optimalSessionLength: null,
        frictionSource: null,
        consistencyTrend: null,
        recentImprovement: null,
        overall: 0,
    };
}

function computeOverallConfidence(values: Array<number | null>) {
    const active = values.filter((value): value is number => typeof value === "number");
    return active.length === 0 ? 0 : Math.round(average(active) * 100) / 100;
}

function groupBy<T extends string>(
    analytics: FocusSessionAnalytics[],
    selector: (item: FocusSessionAnalytics) => T
) {
    return analytics.reduce<Record<T, FocusSessionAnalytics[]>>((accumulator, item) => {
        const key = selector(item);
        accumulator[key] = [...(accumulator[key] ?? []), item];
        return accumulator;
    }, {} as Record<T, FocusSessionAnalytics[]>);
}

function detectBestFocusWindow(
    analytics: FocusSessionAnalytics[],
    now = new Date()
): BestFocusWindowPattern | null {
    const monthly = filterAnalyticsByDays(analytics, 30, now);
    const grouped = Object.entries(groupBy(monthly, (item) => item.timeWindow))
        .map(([key, items]) => ({
            key,
            items,
            score: average(items.map(calculateOutcomeScore)),
        }))
        .sort((left, right) => right.score - left.score);

    const top = grouped[0];
    const runnerUp = grouped[1];
    if (!top || top.items.length < 5) return null;

    const dominance = top.score - (runnerUp?.score ?? average(monthly.map(calculateOutcomeScore)));
    const scores = top.items.map(calculateOutcomeScore);
    const evidence = buildPatternEvidence(
        top.items,
        scores,
        dominance,
        filterAnalyticsByDays(top.items, 14, now).length,
        dominance,
        runnerUp?.score ?? null,
        now
    );

    if (!meetsEvidenceThreshold(evidence.confidence, top.items.length, {
        minConfidence: 0.76,
        minSampleSize: 5,
    }) || dominance < 6) {
        return null;
    }

    return {
        patternKey: `best_focus_window:${top.key}`,
        patternType: "best_focus_window",
        windowKind: "persistent",
        status: "active",
        confidence: evidence.confidence,
        sampleSize: top.items.length,
        data: {
            window: top.key as BestFocusWindowPattern["data"]["window"],
            averageOutcomeScore: Math.round(top.score),
            averageProgressScore: Math.round(average(top.items.map((item) => item.progressScore))),
            averageFrictionScore: Math.round(average(top.items.map((item) => item.frictionScore))),
            averageBehaviorScore: Math.round(average(top.items.map((item) => item.behaviorScore))),
            comparisonScore: Math.round(runnerUp?.score ?? top.score),
        },
        evidence,
        updatedAt: now.toISOString(),
    };
}

function detectOptimalSessionLength(
    analytics: FocusSessionAnalytics[],
    now = new Date()
): OptimalSessionLengthPattern | null {
    const monthly = filterAnalyticsByDays(analytics, 30, now);
    const grouped = Object.entries(groupBy(monthly, (item) => item.durationBucket))
        .map(([key, items]) => ({
            key: key as SessionLengthBucket,
            items,
            score: average(items.map((item) => (
                (calculateOutcomeScore(item) * 0.7) +
                ((item.stabilityRatio * 100) * 0.3)
            ))),
        }))
        .sort((left, right) => right.score - left.score);

    const top = grouped[0];
    const runnerUp = grouped[1];
    if (!top || top.items.length < 5) return null;

    const dominance = top.score - (runnerUp?.score ?? average(monthly.map(calculateOutcomeScore)));
    const scores = top.items.map((item) => (
        (calculateOutcomeScore(item) * 0.7) +
        ((item.stabilityRatio * 100) * 0.3)
    ));
    const evidence = buildPatternEvidence(
        top.items,
        scores,
        dominance,
        filterAnalyticsByDays(top.items, 14, now).length,
        dominance,
        runnerUp?.score ?? null,
        now
    );

    if (!meetsEvidenceThreshold(evidence.confidence, top.items.length, {
        minConfidence: 0.76,
        minSampleSize: 5,
    }) || dominance < 7) {
        return null;
    }

    const range = getSessionLengthBucketRange(top.key);
    const durations = top.items.map((item) => item.actualDurationMs / 60000).sort((left, right) => left - right);
    const middleIndex = Math.floor(durations.length / 2);
    const medianMinutes = durations[middleIndex] ?? range.minMinutes;

    return {
        patternKey: `optimal_session_length:${top.key}`,
        patternType: "optimal_session_length",
        windowKind: "persistent",
        status: "active",
        confidence: evidence.confidence,
        sampleSize: top.items.length,
        data: {
            bucket: top.key,
            minMinutes: range.minMinutes,
            maxMinutes: range.maxMinutes,
            medianMinutes: Math.round(medianMinutes),
            sustainabilityScore: Math.round(top.score),
            comparisonScore: Math.round(runnerUp?.score ?? top.score),
        },
        evidence,
        updatedAt: now.toISOString(),
    };
}

function buildFrictionCandidates(monthly: FocusSessionAnalytics[]) {
    const candidates: AnalyticsGroup[] = [];
    const byBlockType = Object.entries(groupBy(monthly.filter((item) => item.blockType), (item) => item.blockType!));
    const byWindow = Object.entries(groupBy(monthly, (item) => item.timeWindow));
    const byDuration = Object.entries(groupBy(monthly, (item) => item.durationBucket));
    const slowStartItems = monthly.filter((item) => item.startDelayMs >= 3 * 60 * 1000);

    for (const [key, items] of byBlockType) {
        candidates.push({ key: `block_type:${key}`, items, score: average(items.map((item) => item.frictionScore)) });
    }

    for (const [key, items] of byWindow) {
        candidates.push({ key: `time_window:${key}`, items, score: average(items.map((item) => item.frictionScore)) });
    }

    for (const [key, items] of byDuration) {
        candidates.push({ key: `duration_bucket:${key}`, items, score: average(items.map((item) => item.frictionScore)) });
    }

    if (slowStartItems.length >= 4) {
        candidates.push({ key: "start_pattern:slow_start", items: slowStartItems, score: average(slowStartItems.map((item) => item.frictionScore)) });
    }

    return candidates;
}

function detectFrictionSources(
    analytics: FocusSessionAnalytics[],
    now = new Date()
): FrictionSourcePattern[] {
    const monthly = filterAnalyticsByDays(analytics, 30, now);
    if (monthly.length < 8) return [];

    const candidates = buildFrictionCandidates(monthly)
        .map((candidate) => {
            const comparisonItems = monthly.filter((item) => !candidate.items.some((grouped) => grouped.sessionId === item.sessionId));
            const comparisonScore = comparisonItems.length > 0
                ? average(comparisonItems.map((item) => item.frictionScore))
                : average(monthly.map((item) => item.frictionScore));
            const delta = candidate.score - comparisonScore;
            return {
                ...candidate,
                comparisonScore,
                delta,
            };
        })
        .filter((candidate) => candidate.items.length >= 4)
        .filter((candidate) => candidate.score >= 56 || candidate.delta >= 8)
        .sort((left, right) => right.delta - left.delta);

    return candidates.slice(0, 2).flatMap((candidate) => {
        const [sourceType, rawValue] = candidate.key.split(":");
        const evidence = buildPatternEvidence(
            candidate.items,
            candidate.items.map((item) => item.frictionScore),
            candidate.delta,
            filterAnalyticsByDays(candidate.items, 14, now).length,
            candidate.delta,
            candidate.comparisonScore,
            now
        );

        if (!meetsEvidenceThreshold(evidence.confidence, candidate.items.length, {
            minConfidence: 0.72,
            minSampleSize: 4,
        })) {
            return [];
        }

        const label = sourceType === "start_pattern"
            ? "arranques demorados"
            : rawValue.replace(/_/g, " ");

        return [{
            patternKey: `friction_source:${candidate.key}`,
            patternType: "friction_source",
            windowKind: "persistent",
            status: "active",
            confidence: evidence.confidence,
            sampleSize: candidate.items.length,
            data: {
                sourceType: sourceType as FrictionSourcePattern["data"]["sourceType"],
                value: rawValue,
                label,
                averageFrictionScore: Math.round(candidate.score),
                averageBehaviorScore: Math.round(average(candidate.items.map((item) => item.behaviorScore))),
                comparisonFrictionScore: Math.round(candidate.comparisonScore),
            },
            evidence,
            updatedAt: now.toISOString(),
        }];
    });
}

export function calculateHistoricalConsistencyScore(items: FocusSessionAnalytics[]) {
    if (items.length === 0) return 0;
    const activeDaysRatio = clampUnit(uniqueDayKeys(items.map((item) => item.endedAt)).size / 7);
    const completionRate = average(items.map((item) => item.closureType === "completed" ? 1 : 0));
    const stability = average(items.map((item) => item.stabilityRatio));

    return Math.round(clampUnit(
        (activeDaysRatio * 0.45) +
        (completionRate * 0.35) +
        (stability * 0.20)
    ) * 100);
}

function uniqueDayKeys(isoValues: string[]) {
    return new Set(isoValues.map((value) => new Date(value).toISOString().slice(0, 10)));
}

function detectConsistencyTrend(
    analytics: FocusSessionAnalytics[],
    now = new Date()
): ConsistencyTrendPattern | null {
    const recent = filterAnalyticsByDays(analytics, 7, now);
    const fortnight = filterAnalyticsByDays(analytics, 14, now);
    const previous = fortnight.filter((item) => !recent.some((recentItem) => recentItem.sessionId === item.sessionId));
    if (recent.length + previous.length < 8 || previous.length < 3) return null;

    const recentScore = calculateHistoricalConsistencyScore(recent);
    const previousScore = calculateHistoricalConsistencyScore(previous);
    const delta = recentScore - previousScore;
    const direction: PatternTrend = delta >= 8
        ? "improving"
        : delta <= -8
            ? "declining"
            : "stable";
    const evidence = buildPatternEvidence(
        [...recent, ...previous],
        [recentScore, previousScore],
        Math.abs(delta),
        recent.length,
        delta,
        previousScore,
        now
    );

    if (!meetsEvidenceThreshold(evidence.confidence, recent.length + previous.length, {
        minConfidence: 0.72,
        minSampleSize: 8,
    })) {
        return null;
    }

    return {
        patternKey: `consistency_trend:${direction}`,
        patternType: "consistency_trend",
        windowKind: "fortnight",
        status: "active",
        confidence: evidence.confidence,
        sampleSize: recent.length + previous.length,
        data: {
            direction,
            recentScore,
            previousScore,
            delta,
            recentSessionCount: recent.length,
            previousSessionCount: previous.length,
        },
        evidence,
        updatedAt: now.toISOString(),
    };
}

function detectRecentImprovements(
    analytics: FocusSessionAnalytics[],
    now = new Date()
): RecentImprovementPattern[] {
    const recent = filterAnalyticsByDays(analytics, 7, now);
    const fortnight = filterAnalyticsByDays(analytics, 14, now);
    const previous = fortnight.filter((item) => !recent.some((recentItem) => recentItem.sessionId === item.sessionId));
    if (recent.length + previous.length < 8 || previous.length < 3) return [];

    const candidates: Array<{
        area: RecentImprovementPattern["data"]["area"];
        delta: number;
        recentValue: number;
        previousValue: number;
    }> = [];

    const recentFriction = average(recent.map((item) => item.frictionScore));
    const previousFriction = average(previous.map((item) => item.frictionScore));
    if ((previousFriction - recentFriction) >= 10) {
        candidates.push({
            area: "friction",
            delta: previousFriction - recentFriction,
            recentValue: recentFriction,
            previousValue: previousFriction,
        });
    }

    const recentStability = average(recent.map((item) => item.stabilityRatio));
    const previousStability = average(previous.map((item) => item.stabilityRatio));
    if ((recentStability - previousStability) >= 0.1) {
        candidates.push({
            area: "stability",
            delta: (recentStability - previousStability) * 100,
            recentValue: roundToTwoDecimals(recentStability),
            previousValue: roundToTwoDecimals(previousStability),
        });
    }

    const recentRecovery = average(recent.map((item) => item.recoveryRatio));
    const previousRecovery = average(previous.map((item) => item.recoveryRatio));
    if ((recentRecovery - previousRecovery) >= 0.14) {
        candidates.push({
            area: "recovery",
            delta: (recentRecovery - previousRecovery) * 100,
            recentValue: roundToTwoDecimals(recentRecovery),
            previousValue: roundToTwoDecimals(previousRecovery),
        });
    }

    const recentConsistency = calculateHistoricalConsistencyScore(recent);
    const previousConsistency = calculateHistoricalConsistencyScore(previous);
    if ((recentConsistency - previousConsistency) >= 10) {
        candidates.push({
            area: "consistency",
            delta: recentConsistency - previousConsistency,
            recentValue: recentConsistency,
            previousValue: previousConsistency,
        });
    }

    return candidates
        .sort((left, right) => right.delta - left.delta)
        .slice(0, 2)
        .flatMap((candidate) => {
            const evidence = buildPatternEvidence(
                [...recent, ...previous],
                [candidate.recentValue, candidate.previousValue],
                candidate.delta,
                recent.length,
                candidate.delta,
                candidate.previousValue,
                now
            );

            if (!meetsEvidenceThreshold(evidence.confidence, recent.length + previous.length, {
                minConfidence: 0.72,
                minSampleSize: 8,
            })) {
                return [];
            }

            return [{
                patternKey: `recent_improvement:${candidate.area}`,
                patternType: "recent_improvement",
                windowKind: "weekly",
                status: "active",
                confidence: evidence.confidence,
                sampleSize: recent.length + previous.length,
                data: {
                    area: candidate.area,
                    delta: Math.round(candidate.delta),
                    recentValue: roundToTwoDecimals(candidate.recentValue),
                    previousValue: roundToTwoDecimals(candidate.previousValue),
                },
                evidence,
                updatedAt: now.toISOString(),
            }];
        });
}

export function buildEmptyBehaviorProfile(userId: string, nowIso = new Date().toISOString()): BehaviorProfile {
    return {
        userId,
        warmupStage: "cold",
        bestFocusWindow: null,
        optimalSessionLength: null,
        topFrictionSources: [],
        consistencyTrend: null,
        recentImprovements: [],
        activePatterns: [],
        confidenceOverview: buildEmptyConfidenceOverview(),
        activitySignals: {
            attendanceReliability: null,
            postMeetingFatigue: null,
            postClassResidualLoad: null,
            preferredLightExecutionWindows: [],
            postponeTendencies: [],
            energyImpactByEngagementMode: [],
            dominantReasons: [],
            patterns: [],
            lastActivityAt: null,
        },
        activityAnalytics: null,
        activityPatterns: [],
        lastSessionAnalyticsAt: null,
        lastActivityAnalyticsAt: null,
        lastDailyConsolidatedAt: null,
        lastWeeklyConsolidatedAt: null,
        lastUpdatedAt: nowIso,
        profileVersion: "v2",
    };
}

export function buildBehaviorProfile(
    userId: string,
    analytics: FocusSessionAnalytics[],
    options?: {
        now?: Date;
        lastDailyConsolidatedAt?: string | null;
        lastWeeklyConsolidatedAt?: string | null;
        activityExperiences?: ActivityExperience[];
    }
): BehaviorProfile {
    const now = options?.now ?? new Date();
    const sortedAnalytics = sortByEndedAtDescending(analytics);
    const sortedActivities = [...(options?.activityExperiences ?? [])]
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
    const warmupStage = getWarmupStage(sortedAnalytics.length);
    if (sortedAnalytics.length === 0) {
        const emptyProfile = buildEmptyBehaviorProfile(userId, now.toISOString());
        if (sortedActivities.length > 0) {
            emptyProfile.activitySignals = buildActivityBehaviorSignals(sortedActivities, sortedAnalytics, now);
            emptyProfile.activityAnalytics = computeActivityExperienceAnalytics(sortedActivities);
            emptyProfile.activityPatterns = emptyProfile.activitySignals.patterns;
            emptyProfile.lastActivityAnalyticsAt = sortedActivities[0]?.updatedAt ?? null;
        }
        return {
            ...emptyProfile,
            lastDailyConsolidatedAt: options?.lastDailyConsolidatedAt ?? null,
            lastWeeklyConsolidatedAt: options?.lastWeeklyConsolidatedAt ?? null,
        };
    }

    const bestFocusWindow = warmupStage === "ready"
        ? detectBestFocusWindow(sortedAnalytics, now)
        : null;
    const optimalSessionLength = warmupStage === "ready"
        ? detectOptimalSessionLength(sortedAnalytics, now)
        : null;
    const topFrictionSources = warmupStage === "ready"
        ? detectFrictionSources(sortedAnalytics, now)
        : [];
    const consistencyTrend = warmupStage === "cold"
        ? null
        : detectConsistencyTrend(sortedAnalytics, now);
    const recentImprovements = warmupStage === "cold"
        ? []
        : detectRecentImprovements(sortedAnalytics, now);
    const activePatterns: BehaviorPatternRecord[] = [
        ...(bestFocusWindow ? [bestFocusWindow] : []),
        ...(optimalSessionLength ? [optimalSessionLength] : []),
        ...topFrictionSources,
        ...(consistencyTrend ? [consistencyTrend] : []),
        ...recentImprovements,
    ];
    const activitySignals = buildActivityBehaviorSignals(sortedActivities, sortedAnalytics, now);
    const activityAnalytics = sortedActivities.length > 0
        ? computeActivityExperienceAnalytics(sortedActivities)
        : null;
    const activityPatterns = activitySignals.patterns;

    const confidenceOverview: ConfidenceOverview = {
        bestFocusWindow: bestFocusWindow?.confidence ?? null,
        optimalSessionLength: optimalSessionLength?.confidence ?? null,
        frictionSource: topFrictionSources[0]?.confidence ?? null,
        consistencyTrend: consistencyTrend?.confidence ?? null,
        recentImprovement: recentImprovements[0]?.confidence ?? null,
        overall: computeOverallConfidence([
            bestFocusWindow?.confidence ?? null,
            optimalSessionLength?.confidence ?? null,
            topFrictionSources[0]?.confidence ?? null,
            consistencyTrend?.confidence ?? null,
            recentImprovements[0]?.confidence ?? null,
        ]),
    };

    return {
        userId,
        warmupStage,
        bestFocusWindow,
        optimalSessionLength,
        topFrictionSources,
        consistencyTrend,
        recentImprovements,
        activePatterns,
        confidenceOverview,
        activitySignals,
        activityAnalytics,
        activityPatterns,
        lastSessionAnalyticsAt: sortedAnalytics[0]?.endedAt ?? null,
        lastActivityAnalyticsAt: sortedActivities[0]?.updatedAt ?? null,
        lastDailyConsolidatedAt: options?.lastDailyConsolidatedAt ?? null,
        lastWeeklyConsolidatedAt: options?.lastWeeklyConsolidatedAt ?? null,
        lastUpdatedAt: now.toISOString(),
        profileVersion: "v2",
    };
}
