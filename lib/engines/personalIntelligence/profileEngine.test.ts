import { buildBehaviorProfile } from "@/lib/engines/personalIntelligence/profileEngine";
import { buildInsightCards } from "@/lib/engines/personalIntelligence/insightPresentation";
import { FocusSessionAnalytics } from "@/lib/types/behavior";

function makeAnalytics(
    id: string,
    overrides: Partial<FocusSessionAnalytics> = {}
): FocusSessionAnalytics {
    return {
        sessionId: id,
        userId: "user-1",
        mode: "block",
        blockType: "deep_work",
        initiatedAt: "2026-03-01T08:58:00.000Z",
        startedAt: "2026-03-01T09:00:00.000Z",
        endedAt: "2026-03-01T09:40:00.000Z",
        entryDurationMs: 120_000,
        plannedDurationMs: 45 * 60 * 1000,
        actualDurationMs: 40 * 60 * 1000,
        activeDurationMs: 36 * 60 * 1000,
        pauseDurationMs: 4 * 60 * 1000,
        inactivityDurationMs: 0,
        pauseCount: 1,
        exitCount: 0,
        taskChangeCount: 0,
        interventionCount: 1,
        interventionAcceptCount: 1,
        interventionIgnoreCount: 0,
        inactivityCount: 0,
        stabilityRecoveryCount: 1,
        closureType: "completed",
        completionRatio: 0.88,
        stabilityRatio: 0.82,
        continuityRatio: 0.84,
        recoveryRatio: 1,
        startDelayMs: 40_000,
        progressScore: 78,
        frictionScore: 28,
        consistencyScore: 64,
        behaviorScore: 79,
        timeWindow: "morning",
        durationBucket: "medium",
        diagnostics: {
            entryDurationMs: 120_000,
            completionRatio: 0.88,
            timeWindow: "morning",
            durationBucket: "medium",
            frictionEvents: 1,
            stabilityRecoveryCount: 1,
            interruptionPenalty: 0.08,
            inactivityPenalty: 0,
            recoveryBonus: 0.16,
            scoreBreakdown: {
                progress: 78,
                friction: 28,
                consistency: 64,
                behavior: 79,
            },
        },
        computedAt: overrides.endedAt ?? "2026-03-01T09:40:00.000Z",
        updatedAt: overrides.endedAt ?? "2026-03-01T09:40:00.000Z",
        ...overrides,
    };
}

describe("buildBehaviorProfile", () => {
    it("extracts deterministic patterns only when evidence is strong enough", () => {
        const analytics: FocusSessionAnalytics[] = [
            makeAnalytics("a-1", { endedAt: "2026-03-02T09:40:00.000Z" }),
            makeAnalytics("a-2", { endedAt: "2026-03-04T09:35:00.000Z", progressScore: 82, behaviorScore: 81 }),
            makeAnalytics("a-3", { endedAt: "2026-03-06T09:45:00.000Z", progressScore: 84, behaviorScore: 83 }),
            makeAnalytics("a-4", { endedAt: "2026-03-08T09:30:00.000Z", progressScore: 80, behaviorScore: 80 }),
            makeAnalytics("a-5", { endedAt: "2026-03-10T09:42:00.000Z", progressScore: 86, behaviorScore: 84 }),
            makeAnalytics("a-6", { endedAt: "2026-03-12T09:38:00.000Z", progressScore: 88, behaviorScore: 86, frictionScore: 22 }),
            makeAnalytics("a-7", { endedAt: "2026-03-13T09:39:00.000Z", progressScore: 87, behaviorScore: 85, frictionScore: 20 }),
            makeAnalytics("a-8", { endedAt: "2026-03-14T09:40:00.000Z", progressScore: 90, behaviorScore: 88, frictionScore: 18 }),
            makeAnalytics("a-9", {
                sessionId: "admin-1",
                blockType: "admin",
                endedAt: "2026-03-05T19:10:00.000Z",
                startedAt: "2026-03-05T18:00:00.000Z",
                initiatedAt: "2026-03-05T17:58:00.000Z",
                durationBucket: "long",
                timeWindow: "evening",
                progressScore: 58,
                frictionScore: 71,
                behaviorScore: 48,
                completionRatio: 0.62,
                stabilityRatio: 0.46,
                continuityRatio: 0.52,
                recoveryRatio: 0.2,
                pauseCount: 2,
                exitCount: 1,
                actualDurationMs: 70 * 60 * 1000,
                activeDurationMs: 40 * 60 * 1000,
                pauseDurationMs: 12 * 60 * 1000,
                inactivityDurationMs: 18 * 60 * 1000,
                stabilityRecoveryCount: 0,
                closureType: "abandoned",
            }),
            makeAnalytics("a-10", {
                sessionId: "admin-2",
                blockType: "admin",
                endedAt: "2026-03-09T19:15:00.000Z",
                startedAt: "2026-03-09T18:05:00.000Z",
                initiatedAt: "2026-03-09T18:00:00.000Z",
                durationBucket: "long",
                timeWindow: "evening",
                progressScore: 55,
                frictionScore: 74,
                behaviorScore: 46,
                completionRatio: 0.58,
                stabilityRatio: 0.42,
                continuityRatio: 0.49,
                recoveryRatio: 0.18,
                pauseCount: 2,
                exitCount: 1,
                actualDurationMs: 70 * 60 * 1000,
                activeDurationMs: 38 * 60 * 1000,
                pauseDurationMs: 14 * 60 * 1000,
                inactivityDurationMs: 18 * 60 * 1000,
                stabilityRecoveryCount: 0,
                closureType: "abandoned",
            }),
            makeAnalytics("a-11", {
                sessionId: "admin-3",
                blockType: "admin",
                endedAt: "2026-03-11T19:20:00.000Z",
                startedAt: "2026-03-11T18:00:00.000Z",
                initiatedAt: "2026-03-11T17:56:00.000Z",
                durationBucket: "long",
                timeWindow: "evening",
                progressScore: 57,
                frictionScore: 76,
                behaviorScore: 44,
                completionRatio: 0.56,
                stabilityRatio: 0.41,
                continuityRatio: 0.47,
                recoveryRatio: 0.12,
                pauseCount: 3,
                exitCount: 1,
                actualDurationMs: 80 * 60 * 1000,
                activeDurationMs: 39 * 60 * 1000,
                pauseDurationMs: 15 * 60 * 1000,
                inactivityDurationMs: 20 * 60 * 1000,
                stabilityRecoveryCount: 0,
                closureType: "abandoned",
            }),
            makeAnalytics("a-12", {
                endedAt: "2026-03-15T09:43:00.000Z",
                progressScore: 92,
                frictionScore: 16,
                consistencyScore: 78,
                behaviorScore: 90,
            }),
        ];

        const profile = buildBehaviorProfile("user-1", analytics, {
            now: new Date("2026-03-16T12:00:00.000Z"),
        });

        expect(profile.warmupStage).toBe("ready");
        expect(profile.bestFocusWindow?.data.window).toBe("morning");
        expect(profile.optimalSessionLength?.data.bucket).toBe("medium");
        expect(profile.topFrictionSources[0]?.data.sourceType).toBe("block_type");
        expect(profile.topFrictionSources[0]?.data.value).toBe("admin");
        expect(profile.recentImprovements.length).toBeGreaterThan(0);

        const cards = buildInsightCards(profile);
        expect(cards.some((card) => card.type === "best_focus_window")).toBe(true);
        expect(cards.some((card) => card.type === "friction_source")).toBe(true);
    });

    it("keeps the profile quiet during warm-up", () => {
        const profile = buildBehaviorProfile("user-1", [
            makeAnalytics("warm-1"),
            makeAnalytics("warm-2", { endedAt: "2026-03-14T09:40:00.000Z" }),
        ], {
            now: new Date("2026-03-16T12:00:00.000Z"),
        });

        expect(profile.warmupStage).toBe("cold");
        expect(profile.activePatterns.length).toBe(0);
        expect(buildInsightCards(profile)).toHaveLength(0);
    });
});
