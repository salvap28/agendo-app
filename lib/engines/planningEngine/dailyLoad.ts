import { FocusSessionAnalytics } from "@/lib/types/behavior";
import { Block } from "@/lib/types/blocks";
import { DailyLoadSnapshot } from "@/lib/types/planning";
import { ActivityExperience } from "@/lib/types/activity";
import { buildPlanningBlockSnapshot } from "./blockMetadata";
import { computeDailyActivityLoad } from "@/lib/engines/activityExperience";

interface HistoricalDayCapacity {
    activeDays: number;
    typicalActiveMinutes: number;
    comfortUpperMinutes: number;
    typicalDemandingSessions: number;
}

function average(values: number[]) {
    if (values.length === 0) return 0;
    return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(values: number[], target: number) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * target)));
    return sorted[index];
}

function countIntenseSequences(minutes: Array<{ start: number; end: number; intense: boolean }>) {
    let sequences = 0;

    for (let index = 0; index < minutes.length - 1; index += 1) {
        const current = minutes[index];
        const next = minutes[index + 1];
        const gapMinutes = (next.start - current.end) / 60000;

        if (current.intense && next.intense && gapMinutes < 45) {
            sequences += 1;
        }
    }

    return sequences;
}

function isDemandingSession(item: FocusSessionAnalytics) {
    return item.blockType === "deep_work"
        || item.blockType === "study"
        || item.durationBucket === "long"
        || item.activeDurationMs >= 70 * 60 * 1000;
}

export function computeHistoricalDayCapacity(
    recentAnalytics: FocusSessionAnalytics[],
    currentDate: string,
): HistoricalDayCapacity {
    const dayMap = new Map<string, { totalActiveMinutes: number; demandingSessions: number }>();

    for (const item of recentAnalytics) {
        const dateKey = item.endedAt.slice(0, 10);
        if (dateKey === currentDate) continue;

        const entry = dayMap.get(dateKey) ?? { totalActiveMinutes: 0, demandingSessions: 0 };
        entry.totalActiveMinutes += item.activeDurationMs / 60000;
        if (isDemandingSession(item)) {
            entry.demandingSessions += 1;
        }
        dayMap.set(dateKey, entry);
    }

    const recentDays = Array.from(dayMap.entries())
        .sort((left, right) => right[0].localeCompare(left[0]))
        .slice(0, 14)
        .map(([, value]) => value);

    if (recentDays.length === 0) {
        return {
            activeDays: 0,
            typicalActiveMinutes: 180,
            comfortUpperMinutes: 225,
            typicalDemandingSessions: 2,
        };
    }

    const activeMinutes = recentDays.map((day) => day.totalActiveMinutes);
    const demandingSessions = recentDays.map((day) => day.demandingSessions);

    return {
        activeDays: recentDays.length,
        typicalActiveMinutes: Math.max(120, Math.round(average(activeMinutes))),
        comfortUpperMinutes: Math.max(150, Math.round(percentile(activeMinutes, 0.75))),
        typicalDemandingSessions: Math.max(1, Math.round(percentile(demandingSessions, 0.75))),
    };
}

export function computeDailyLoad(
    blocks: Block[],
    date: string,
    recentAnalytics: FocusSessionAnalytics[],
    activityExperiences: ActivityExperience[] = [],
): DailyLoadSnapshot {
    const dayBlocks = blocks
        .filter((block) => block.startAt.toISOString().slice(0, 10) === date)
        .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
    const snapshots = dayBlocks.map(buildPlanningBlockSnapshot);
    const intenseBlocks = snapshots.filter((snapshot) => snapshot.cognitivelyHeavy || snapshot.intensity === "high");
    const longBlocks = snapshots.filter((snapshot) => snapshot.durationMinutes >= 90);
    const breakBlocks = snapshots.filter((snapshot) => snapshot.block.type === "break");
    const deadlinePressureCount = snapshots.filter((snapshot) => {
        if (!snapshot.deadlineIso) return false;
        const diffDays = (new Date(snapshot.deadlineIso).getTime() - snapshot.block.startAt.getTime()) / (24 * 60 * 60 * 1000);
        return diffDays <= 3;
    }).length;

    const sequenced = snapshots.map((snapshot) => ({
        start: snapshot.block.startAt.getTime(),
        end: snapshot.block.endAt.getTime(),
        intense: snapshot.cognitivelyHeavy || snapshot.intensity === "high",
    }));
    const intenseSequences = countIntenseSequences(sequenced);
    const totalPlannedMinutes = snapshots.reduce((total, snapshot) => total + snapshot.durationMinutes, 0);
    const breakCoverageRatio = intenseBlocks.length === 0
        ? breakBlocks.length > 0 ? 1 : 0
        : Math.min(1, breakBlocks.length / intenseBlocks.length);
    const activityLoad = computeDailyActivityLoad(activityExperiences, blocks, date);

    const historicalCapacity = computeHistoricalDayCapacity(recentAnalytics, date);
    const comfortMinutes = Math.max(historicalCapacity.typicalActiveMinutes, historicalCapacity.comfortUpperMinutes);
    const minutesRatio = comfortMinutes > 0 ? totalPlannedMinutes / comfortMinutes : 0;
    const demandingRatio = intenseBlocks.length / Math.max(1, historicalCapacity.typicalDemandingSessions);

    const historicalMinutesPenalty = minutesRatio >= 1.55
        ? 16
        : minutesRatio >= 1.3
            ? 10
            : minutesRatio >= 1.1
                ? 5
                : 0;
    const historicalDemandPenalty = demandingRatio >= 2
        ? 12
        : demandingRatio >= 1.35
            ? 7
            : 0;

    const noBreakPenalty = snapshots.length > 2 ? ((1 - breakCoverageRatio) * 12) : 0;

    const score = Math.round(
        Math.min(100,
            (Math.min(25, snapshots.length * 5)) +
            (totalPlannedMinutes / 18) +
            (intenseBlocks.length * 8) +
            (longBlocks.length * 6) +
            (intenseSequences * 10) +
            (deadlinePressureCount * 6) +
            noBreakPenalty +
            (activityLoad.passiveAttendanceLoad / 20) +
            (activityLoad.collaborativeLoad / 18) +
            (activityLoad.logisticsLoad / 26) +
            (activityLoad.transitionCost * 0.6) +
            Math.max(0, (50 - activityLoad.residualEnergyEstimate) * 0.3) +
            Math.max(0, activityLoad.planRealityVariance / 15) -
            Math.min(12, activityLoad.recoveryEffect / 14) +
            (historicalMinutesPenalty * 0.9) +
            (historicalDemandPenalty * 0.9)
        )
    );

    const level: DailyLoadSnapshot["level"] = score >= 76
        ? "overload"
        : score >= 58
            ? "high"
            : score >= 34
                ? "medium"
                : "low";

    return {
        date,
        score,
        level,
        totalBlocks: snapshots.length,
        totalPlannedMinutes,
        intenseBlocks: intenseBlocks.length,
        longBlocks: longBlocks.length,
        intenseSequences,
        deadlinePressureCount,
        breakCoverageRatio: Math.round(breakCoverageRatio * 100) / 100,
        passiveAttendanceLoad: activityLoad.passiveAttendanceLoad,
        logisticsLoad: activityLoad.logisticsLoad,
        collaborativeLoad: activityLoad.collaborativeLoad,
        recoveryEffect: activityLoad.recoveryEffect,
        transitionCost: activityLoad.transitionCost,
        realDayLoad: activityLoad.realDayLoad,
        residualEnergyEstimate: activityLoad.residualEnergyEstimate,
        planRealityVariance: activityLoad.planRealityVariance,
    };
}
