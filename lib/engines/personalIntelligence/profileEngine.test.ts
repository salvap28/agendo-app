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
        contextualConsistencyScore: 64,
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
                contextualConsistency: 64,
                behavior: 79,
            },
        },
        computedAt: overrides.endedAt ?? "2026-03-01T09:40:00.000Z",
        updatedAt: overrides.endedAt ?? "2026-03-01T09:40:00.000Z",
        ...overrides,
    };
}

describe("buildBehaviorProfile", () => {
    it("extracts deterministic patterns only when evidence is mature enough", () => {
        const analytics: FocusSessionAnalytics[] = [
            makeAnalytics("a-1", { endedAt: "2026-03-02T09:40:00.000Z" }),
            makeAnalytics("a-2", { endedAt: "2026-03-03T09:35:00.000Z", progressScore: 80, behaviorScore: 81 }),
            makeAnalytics("a-3", { endedAt: "2026-03-04T09:45:00.000Z", progressScore: 82, behaviorScore: 83 }),
            makeAnalytics("a-4", { endedAt: "2026-03-05T09:30:00.000Z", progressScore: 80, behaviorScore: 80 }),
            makeAnalytics("a-5", { endedAt: "2026-03-06T09:42:00.000Z", progressScore: 84, behaviorScore: 84 }),
            makeAnalytics("a-6", { endedAt: "2026-03-07T09:38:00.000Z", progressScore: 86, behaviorScore: 86, frictionScore: 22 }),
            makeAnalytics("a-7", { endedAt: "2026-03-08T09:39:00.000Z", progressScore: 87, behaviorScore: 85, frictionScore: 20 }),
            makeAnalytics("a-8", { endedAt: "2026-03-09T09:40:00.000Z", progressScore: 90, behaviorScore: 88, frictionScore: 18 }),
            makeAnalytics("a-9", { endedAt: "2026-03-10T09:41:00.000Z", progressScore: 91, behaviorScore: 89, frictionScore: 17 }),
            makeAnalytics("a-10", { endedAt: "2026-03-11T09:44:00.000Z", progressScore: 92, behaviorScore: 90, frictionScore: 16, contextualConsistencyScore: 76 }),
            makeAnalytics("a-11", { endedAt: "2026-03-12T09:37:00.000Z", progressScore: 89, behaviorScore: 87, frictionScore: 19 }),
            makeAnalytics("a-12", { endedAt: "2026-03-15T09:43:00.000Z", progressScore: 93, behaviorScore: 91, frictionScore: 15, contextualConsistencyScore: 78 }),
            makeAnalytics("admin-1", {
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
            makeAnalytics("admin-2", {
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
            makeAnalytics("admin-3", {
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
            makeAnalytics("admin-4", {
                blockType: "admin",
                endedAt: "2026-03-13T19:18:00.000Z",
                startedAt: "2026-03-13T18:03:00.000Z",
                initiatedAt: "2026-03-13T18:00:00.000Z",
                durationBucket: "long",
                timeWindow: "evening",
                progressScore: 54,
                frictionScore: 78,
                behaviorScore: 42,
                completionRatio: 0.54,
                stabilityRatio: 0.39,
                continuityRatio: 0.45,
                recoveryRatio: 0.1,
                pauseCount: 3,
                exitCount: 1,
                actualDurationMs: 75 * 60 * 1000,
                activeDurationMs: 37 * 60 * 1000,
                pauseDurationMs: 15 * 60 * 1000,
                inactivityDurationMs: 22 * 60 * 1000,
                stabilityRecoveryCount: 0,
                closureType: "abandoned",
            }),
            makeAnalytics("admin-5", {
                blockType: "admin",
                endedAt: "2026-03-14T19:12:00.000Z",
                startedAt: "2026-03-14T18:00:00.000Z",
                initiatedAt: "2026-03-14T17:57:00.000Z",
                durationBucket: "long",
                timeWindow: "evening",
                progressScore: 56,
                frictionScore: 79,
                behaviorScore: 43,
                completionRatio: 0.53,
                stabilityRatio: 0.38,
                continuityRatio: 0.44,
                recoveryRatio: 0.09,
                pauseCount: 3,
                exitCount: 1,
                actualDurationMs: 72 * 60 * 1000,
                activeDurationMs: 36 * 60 * 1000,
                pauseDurationMs: 14 * 60 * 1000,
                inactivityDurationMs: 22 * 60 * 1000,
                stabilityRecoveryCount: 0,
                closureType: "abandoned",
            }),
            makeAnalytics("admin-6", {
                blockType: "admin",
                endedAt: "2026-03-15T19:16:00.000Z",
                startedAt: "2026-03-15T18:02:00.000Z",
                initiatedAt: "2026-03-15T17:58:00.000Z",
                durationBucket: "long",
                timeWindow: "evening",
                progressScore: 53,
                frictionScore: 81,
                behaviorScore: 41,
                completionRatio: 0.5,
                stabilityRatio: 0.36,
                continuityRatio: 0.42,
                recoveryRatio: 0.08,
                pauseCount: 4,
                exitCount: 1,
                actualDurationMs: 74 * 60 * 1000,
                activeDurationMs: 35 * 60 * 1000,
                pauseDurationMs: 15 * 60 * 1000,
                inactivityDurationMs: 24 * 60 * 1000,
                stabilityRecoveryCount: 0,
                closureType: "abandoned",
            }),
        ];

        const profile = buildBehaviorProfile("user-1", analytics, {
            now: new Date("2026-03-16T12:00:00.000Z"),
        });

        expect(profile.warmupStage).toBe("ready");
        expect(profile.bestFocusWindow?.data.window).toBe("morning");
        expect(profile.optimalSessionLength?.data.bucket).toBe("medium");
        expect(profile.topFrictionSources.length).toBeGreaterThan(0);
        expect(profile.topFrictionSources[0]?.sampleSize).toBeGreaterThanOrEqual(4);
        expect(profile.topFrictionSources[0]?.data.averageFrictionScore).toBeGreaterThan(
            profile.topFrictionSources[0]?.data.comparisonFrictionScore ?? 0
        );
        expect(
            profile.recentImprovements.length > 0 ||
            profile.consistencyTrend !== null
        ).toBe(true);

        const cards = buildInsightCards(profile);
        expect(cards.some((card) => card.type === "best_focus_window")).toBe(true);
        expect(cards.some((card) => card.type === "friction_source")).toBe(true);
    });

    it("keeps persistent patterns quiet during warm-up", () => {
        const warmingProfile = buildBehaviorProfile("user-1", [
            makeAnalytics("warm-1"),
            makeAnalytics("warm-2", { endedAt: "2026-03-04T09:40:00.000Z" }),
            makeAnalytics("warm-3", { endedAt: "2026-03-06T09:40:00.000Z" }),
            makeAnalytics("warm-4", { endedAt: "2026-03-08T09:40:00.000Z" }),
            makeAnalytics("warm-5", { endedAt: "2026-03-10T09:40:00.000Z" }),
            makeAnalytics("warm-6", { endedAt: "2026-03-12T09:40:00.000Z" }),
            makeAnalytics("warm-7", { endedAt: "2026-03-14T09:40:00.000Z" }),
            makeAnalytics("warm-8", { endedAt: "2026-03-15T09:40:00.000Z" }),
        ], {
            now: new Date("2026-03-16T12:00:00.000Z"),
        });

        expect(warmingProfile.warmupStage).toBe("warming");
        expect(warmingProfile.bestFocusWindow).toBeNull();
        expect(warmingProfile.optimalSessionLength).toBeNull();
        expect(warmingProfile.topFrictionSources).toHaveLength(0);
        expect(buildInsightCards(warmingProfile).every((card) => (
            card.type === "consistency_trend" || card.type === "recent_improvement"
        ))).toBe(true);
    });
});
