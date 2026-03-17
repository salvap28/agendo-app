import { computeDailyLoad, computeHistoricalDayCapacity } from "@/lib/engines/planningEngine";
import { FocusSessionAnalytics } from "@/lib/types/behavior";
import { Block } from "@/lib/types/blocks";

function makeBlock(id: string, startAt: string, endAt: string, overrides: Partial<Block> = {}): Block {
    return {
        id,
        title: id,
        type: "deep_work",
        status: "planned",
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        priority: 4,
        intensity: "high",
        flexibility: "flexible",
        cognitivelyHeavy: true,
        splittable: true,
        optional: false,
        ...overrides,
    };
}

function makeAnalytics(id: string, endedAt: string, activeMinutes: number, overrides: Partial<FocusSessionAnalytics> = {}): FocusSessionAnalytics {
    return {
        sessionId: id,
        userId: "user-1",
        mode: "block",
        blockType: "deep_work",
        initiatedAt: endedAt,
        startedAt: endedAt,
        endedAt,
        entryDurationMs: 60_000,
        plannedDurationMs: activeMinutes * 60_000,
        actualDurationMs: activeMinutes * 60_000,
        activeDurationMs: activeMinutes * 60_000,
        pauseDurationMs: 0,
        inactivityDurationMs: 0,
        pauseCount: 0,
        exitCount: 0,
        taskChangeCount: 0,
        interventionCount: 0,
        interventionAcceptCount: 0,
        interventionIgnoreCount: 0,
        inactivityCount: 0,
        stabilityRecoveryCount: 0,
        closureType: "completed",
        completionRatio: 0.9,
        stabilityRatio: 0.85,
        continuityRatio: 0.8,
        recoveryRatio: 0.8,
        startDelayMs: 0,
        progressScore: 80,
        frictionScore: 25,
        contextualConsistencyScore: 70,
        behaviorScore: 82,
        timeWindow: "morning",
        durationBucket: activeMinutes >= 75 ? "long" : "medium",
        diagnostics: {
            entryDurationMs: 60_000,
            completionRatio: 0.9,
            timeWindow: "morning",
            durationBucket: activeMinutes >= 75 ? "long" : "medium",
            frictionEvents: 0,
            stabilityRecoveryCount: 0,
            interruptionPenalty: 0,
            inactivityPenalty: 0,
            recoveryBonus: 0,
            scoreBreakdown: {
                progress: 80,
                friction: 25,
                contextualConsistency: 70,
                behavior: 82,
            },
        },
        computedAt: endedAt,
        updatedAt: endedAt,
        ...overrides,
    };
}

describe("computeDailyLoad", () => {
    it("uses grouped active days instead of a trivial per-session average as baseline", () => {
        const analytics = [
            makeAnalytics("a1", "2026-03-10T09:00:00.000Z", 60),
            makeAnalytics("a2", "2026-03-10T11:00:00.000Z", 60),
            makeAnalytics("a3", "2026-03-11T09:00:00.000Z", 120),
        ];

        const baseline = computeHistoricalDayCapacity(analytics, "2026-03-18");
        expect(baseline.activeDays).toBe(2);
        expect(baseline.typicalActiveMinutes).toBeGreaterThan(100);
    });

    it("classifies a low-load day as sustainable against the user's historical capacity", () => {
        const analytics = [
            makeAnalytics("a1", "2026-03-10T09:00:00.000Z", 90),
            makeAnalytics("a2", "2026-03-10T11:00:00.000Z", 90),
            makeAnalytics("a3", "2026-03-11T09:00:00.000Z", 120),
        ];

        const load = computeDailyLoad([
            makeBlock("light", "2026-03-18T09:00:00.000Z", "2026-03-18T10:00:00.000Z", {
                intensity: "medium",
                cognitivelyHeavy: false,
            }),
            makeBlock("break", "2026-03-18T10:15:00.000Z", "2026-03-18T10:30:00.000Z", {
                type: "break",
                intensity: "light",
                cognitivelyHeavy: false,
                priority: 1,
            }),
        ], "2026-03-18", analytics, []);

        expect(load.level === "low" || load.level === "medium").toBe(true);
    });

    it("flags an overloaded day when planned demand exceeds historical day capacity", () => {
        const analytics = [
            makeAnalytics("a1", "2026-03-10T09:00:00.000Z", 60),
            makeAnalytics("a2", "2026-03-10T11:00:00.000Z", 60),
            makeAnalytics("a3", "2026-03-11T09:00:00.000Z", 75),
            makeAnalytics("a4", "2026-03-11T11:00:00.000Z", 60),
        ];

        const load = computeDailyLoad([
            makeBlock("b1", "2026-03-18T08:00:00.000Z", "2026-03-18T10:00:00.000Z"),
            makeBlock("b2", "2026-03-18T10:15:00.000Z", "2026-03-18T12:15:00.000Z"),
            makeBlock("b3", "2026-03-18T13:00:00.000Z", "2026-03-18T15:00:00.000Z"),
            makeBlock("b4", "2026-03-18T15:15:00.000Z", "2026-03-18T17:15:00.000Z"),
        ], "2026-03-18", analytics, []);

        expect(load.level === "high" || load.level === "overload").toBe(true);
        expect(load.score).toBeGreaterThanOrEqual(58);
    });
});
