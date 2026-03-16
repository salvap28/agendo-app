import { FocusInterventionRecord, FocusSession, FocusSessionEvent } from "@/lib/types/focus";
import {
    FocusSessionAnalytics,
    FocusWindow,
    SessionLengthBucket,
} from "@/lib/types/behavior";
import { clampUnit, roundToTwoDecimals } from "./evidence";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type DeriveSessionAnalyticsArgs = {
    userId: string;
    session: FocusSession;
    events?: FocusSessionEvent[];
    interventions?: FocusInterventionRecord[];
    recentAnalytics?: FocusSessionAnalytics[];
};

function toTimestamp(value?: string | null) {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
}

function uniqueDayKeys(isoValues: string[]) {
    return new Set(isoValues.map((value) => new Date(value).toISOString().slice(0, 10)));
}

function average(values: number[]) {
    if (values.length === 0) return 0;
    return values.reduce((total, value) => total + value, 0) / values.length;
}

function mapHourToFocusWindow(hour: number): FocusWindow {
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
}

export function getFocusWindowLabel(window: FocusWindow) {
    switch (window) {
        case "morning":
            return "mañana";
        case "afternoon":
            return "tarde";
        case "evening":
            return "tardecita";
        case "night":
            return "noche";
        default:
            return "día";
    }
}

export function resolveFocusWindow(startedAt: string) {
    return mapHourToFocusWindow(new Date(startedAt).getHours());
}

export function resolveSessionLengthBucket(durationMs: number): SessionLengthBucket {
    const minutes = durationMs / MINUTE_MS;
    if (minutes < 25) return "short";
    if (minutes < 50) return "medium";
    if (minutes < 80) return "long";
    return "extended";
}

export function getSessionLengthBucketRange(bucket: SessionLengthBucket) {
    switch (bucket) {
        case "short":
            return { minMinutes: 0, maxMinutes: 24 };
        case "medium":
            return { minMinutes: 25, maxMinutes: 49 };
        case "long":
            return { minMinutes: 50, maxMinutes: 79 };
        case "extended":
            return { minMinutes: 80, maxMinutes: 180 };
        default:
            return { minMinutes: 0, maxMinutes: 180 };
    }
}

function sortEvents(events: FocusSessionEvent[] = []) {
    return [...events].sort((left, right) => toTimestamp(left.timestamp) - toTimestamp(right.timestamp));
}

function deriveInactivitySummary(events: FocusSessionEvent[], endedAt: string) {
    let inactiveSince = 0;
    let inactivityCount = 0;
    let recoveryCount = 0;
    let totalDurationMs = 0;

    for (const event of sortEvents(events)) {
        const eventTime = toTimestamp(event.timestamp);
        if (event.type === "inactivity_detected" && inactiveSince === 0) {
            inactiveSince = eventTime;
            inactivityCount += 1;
        }

        if (event.type === "stability_recovered" && inactiveSince > 0) {
            totalDurationMs += Math.max(0, eventTime - inactiveSince);
            recoveryCount += 1;
            inactiveSince = 0;
        }
    }

    if (inactiveSince > 0) {
        totalDurationMs += Math.max(0, toTimestamp(endedAt) - inactiveSince);
    }

    return {
        inactivityCount,
        recoveryCount,
        totalDurationMs,
    };
}

function deriveInterventionBreakdown(interventions: FocusInterventionRecord[] = []) {
    let acceptCount = 0;
    let ignoreCount = 0;

    for (const intervention of interventions) {
        const result = (intervention.result ?? "").toLowerCase();
        const action = (intervention.actionTaken ?? "").toLowerCase();

        if (
            action === "close" ||
            result === "dismissed" ||
            result === "ignored" ||
            result === "rejected" ||
            result === "skipped"
        ) {
            ignoreCount += 1;
            continue;
        }

        if (action || result) {
            acceptCount += 1;
        }
    }

    return {
        interventionCount: interventions.length,
        interventionAcceptCount: acceptCount,
        interventionIgnoreCount: ignoreCount,
    };
}

function calculateConsistencyContextScore(
    session: FocusSession,
    recentAnalytics: FocusSessionAnalytics[],
    timeWindow: FocusWindow,
    closureType: "completed" | "abandoned",
    stabilityRatio: number
) {
    const endedAtMs = toTimestamp(session.endedAt);
    const recentWindow = recentAnalytics.filter((item) => {
        const itemEndedAt = toTimestamp(item.endedAt);
        return itemEndedAt > 0 && endedAtMs - itemEndedAt <= (7 * DAY_MS);
    });

    if (recentWindow.length === 0) {
        const bootstrap = clampUnit((stabilityRatio * 0.5) + (closureType === "completed" ? 0.25 : 0.1));
        return Math.round(bootstrap * 100);
    }

    const activeDaysRatio = clampUnit(uniqueDayKeys(recentWindow.map((item) => item.endedAt)).size / 7);
    const completionRate = average(recentWindow.map((item) => item.closureType === "completed" ? 1 : 0));
    const sameWindowAlignment = average(recentWindow.map((item) => item.timeWindow === timeWindow ? 1 : 0));

    return Math.round(clampUnit(
        (activeDaysRatio * 0.45) +
        (completionRate * 0.35) +
        (sameWindowAlignment * 0.20)
    ) * 100);
}

export function deriveSessionAnalytics({
    userId,
    session,
    events = [],
    interventions = [],
    recentAnalytics = [],
}: DeriveSessionAnalyticsArgs): FocusSessionAnalytics {
    if (!session.endedAt) {
        throw new Error("Session analytics requires a finished session.");
    }

    const nowIso = new Date().toISOString();
    const initiatedAt = session.initiatedAt ?? session.startedAt;
    const startedAt = session.startedAt;
    const endedAt = session.endedAt;
    const initiatedAtMs = toTimestamp(initiatedAt);
    const startedAtMs = toTimestamp(startedAt);
    const endedAtMs = toTimestamp(endedAt);

    const entryDurationMs = Math.max(0, startedAtMs - initiatedAtMs);
    const actualDurationMs = Math.max(0, endedAtMs - startedAtMs);
    const plannedDurationMs = Math.max(
        actualDurationMs || (25 * MINUTE_MS),
        session.plannedDurationMs ?? 0
    );
    const inactivitySummary = deriveInactivitySummary(events, endedAt);
    const pauseDurationMs = Math.max(0, session.totalPausedMs ?? 0);
    const inactivityDurationMs = Math.min(actualDurationMs, Math.max(0, inactivitySummary.totalDurationMs));
    const activeDurationMs = Math.max(0, actualDurationMs - pauseDurationMs - inactivityDurationMs);
    const pauseCount = session.pauseCount ?? 0;
    const exitCount = session.exitCount ?? 0;
    const taskChangeCount = events.filter((event) => event.type === "task_changed").length;
    const stabilityRecoveryCount = Math.max(
        inactivitySummary.recoveryCount,
        events.filter((event) => event.type === "stability_recovered").length
    );
    const interventionBreakdown = deriveInterventionBreakdown(interventions);

    const completionRatio = plannedDurationMs > 0
        ? clampUnit(actualDurationMs / plannedDurationMs)
        : 1;
    const sustainedWorkRatio = plannedDurationMs > 0
        ? clampUnit(activeDurationMs / plannedDurationMs)
        : clampUnit(activeDurationMs / Math.max(1, actualDurationMs));
    const activeRatio = actualDurationMs > 0
        ? clampUnit(activeDurationMs / actualDurationMs)
        : 0;
    const frictionEvents = pauseCount + exitCount + inactivitySummary.inactivityCount;
    const recoveryRatio = frictionEvents > 0
        ? clampUnit(stabilityRecoveryCount / frictionEvents)
        : 1;
    const startDelayMs = Math.max(0, session.startDelayMs ?? 0);
    const subjectiveProgress = session.progressFeelingAfter
        ? clampUnit((session.progressFeelingAfter - 1) / 4)
        : 0.5;
    const difficultyWeight = session.difficulty
        ? clampUnit((session.difficulty + 1) / 6)
        : 0.55;
    const lowClarityPenalty = (session.clarity ?? 3) < 3
        ? clampUnit((3 - (session.clarity ?? 3)) / 4) * 0.18
        : 0;
    const slowStartPenalty = plannedDurationMs > 0
        ? Math.min(0.18, (startDelayMs / plannedDurationMs) * 0.75)
        : 0;
    const interruptionPenalty = Math.min(0.34, (pauseCount * 0.05) + (exitCount * 0.1));
    const inactivityPenalty = actualDurationMs > 0
        ? Math.min(0.3, (inactivityDurationMs / actualDurationMs) * 0.8)
        : 0;
    const recoveryBonus = frictionEvents > 0
        ? Math.min(0.16, recoveryRatio * 0.16)
        : 0.08;

    const likelyAbandoned = completionRatio < 0.45 &&
        subjectiveProgress < 0.7 &&
        (exitCount >= 2 || inactivitySummary.inactivityCount >= 1 || sustainedWorkRatio < 0.35);
    const closureType = likelyAbandoned ? "abandoned" : "completed";

    const stabilityRatio = clampUnit(activeRatio - interruptionPenalty - inactivityPenalty + recoveryBonus);
    const continuityRatio = clampUnit(
        1 -
        Math.min(0.5, (pauseCount * 0.08) + (exitCount * 0.14) + (taskChangeCount * 0.06)) -
        (closureType === "abandoned" ? 0.1 : 0) +
        Math.min(0.12, stabilityRecoveryCount * 0.04)
    );
    const timeWindow = resolveFocusWindow(startedAt);
    const durationBucket = resolveSessionLengthBucket(actualDurationMs);

    let progressScore = clampUnit(
        (completionRatio * 0.34) +
        (sustainedWorkRatio * 0.28) +
        (subjectiveProgress * 0.22) +
        (difficultyWeight * 0.16)
    ) * 100;
    if (closureType === "abandoned") progressScore *= 0.84;
    if ((session.progressFeelingAfter ?? 3) <= 2) progressScore *= 0.88;

    const frictionScore = clampUnit(
        Math.min(0.24, pauseCount * 0.08) +
        Math.min(0.28, exitCount * 0.12) +
        (actualDurationMs > 0 ? Math.min(0.24, (inactivityDurationMs / actualDurationMs) * 0.8) : 0) +
        slowStartPenalty +
        lowClarityPenalty +
        (frictionEvents > 0 ? (1 - recoveryRatio) * 0.14 : 0)
    ) * 100;

    const consistencyScore = calculateConsistencyContextScore(
        session,
        recentAnalytics,
        timeWindow,
        closureType,
        stabilityRatio
    );

    const behaviorScore = clampUnit(
        (stabilityRatio * 0.34) +
        (continuityRatio * 0.24) +
        (recoveryRatio * 0.22) +
        ((1 - (frictionScore / 100)) * 0.20) -
        (closureType === "abandoned" ? 0.08 : 0)
    ) * 100;

    return {
        sessionId: session.id,
        userId,
        mode: session.mode,
        blockType: session.blockType,
        initiatedAt,
        startedAt,
        endedAt,
        entryDurationMs,
        plannedDurationMs,
        actualDurationMs,
        activeDurationMs,
        pauseDurationMs,
        inactivityDurationMs,
        pauseCount,
        exitCount,
        taskChangeCount,
        interventionCount: interventionBreakdown.interventionCount,
        interventionAcceptCount: interventionBreakdown.interventionAcceptCount,
        interventionIgnoreCount: interventionBreakdown.interventionIgnoreCount,
        inactivityCount: inactivitySummary.inactivityCount,
        stabilityRecoveryCount,
        closureType,
        completionRatio: roundToTwoDecimals(completionRatio),
        stabilityRatio: roundToTwoDecimals(stabilityRatio),
        continuityRatio: roundToTwoDecimals(continuityRatio),
        recoveryRatio: roundToTwoDecimals(recoveryRatio),
        startDelayMs,
        progressScore: Math.round(progressScore),
        frictionScore: Math.round(frictionScore),
        consistencyScore,
        behaviorScore: Math.round(behaviorScore),
        timeWindow,
        durationBucket,
        diagnostics: {
            entryDurationMs,
            completionRatio: roundToTwoDecimals(completionRatio),
            timeWindow,
            durationBucket,
            frictionEvents,
            stabilityRecoveryCount,
            interruptionPenalty: roundToTwoDecimals(interruptionPenalty),
            inactivityPenalty: roundToTwoDecimals(inactivityPenalty),
            recoveryBonus: roundToTwoDecimals(recoveryBonus),
            scoreBreakdown: {
                progress: Math.round(progressScore),
                friction: Math.round(frictionScore),
                consistency: consistencyScore,
                behavior: Math.round(behaviorScore),
            },
        },
        computedAt: nowIso,
        updatedAt: nowIso,
    };
}
