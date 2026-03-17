import { buildEmptyBehaviorProfile } from "@/lib/engines/personalIntelligence";
import { buildPlanningGuide } from "@/lib/engines/planningEngine";
import { FocusSessionAnalytics } from "@/lib/types/behavior";
import { Block } from "@/lib/types/blocks";

function makeBlock(
    id: string,
    overrides: Partial<Block> = {},
): Block {
    return {
        id,
        title: "Block",
        type: "deep_work",
        status: "planned",
        startAt: new Date("2026-03-18T14:00:00.000Z"),
        endAt: new Date("2026-03-18T16:00:00.000Z"),
        priority: 4,
        estimatedDurationMinutes: 120,
        difficulty: 4,
        flexibility: "flexible",
        intensity: "high",
        cognitivelyHeavy: true,
        splittable: true,
        optional: false,
        ...overrides,
    };
}

function makeAnalytics(
    id: string,
    overrides: Partial<FocusSessionAnalytics> = {},
): FocusSessionAnalytics {
    return {
        sessionId: id,
        userId: "user-1",
        mode: "block",
        blockType: "deep_work",
        initiatedAt: "2026-03-01T08:58:00.000Z",
        startedAt: "2026-03-01T09:00:00.000Z",
        endedAt: "2026-03-01T09:45:00.000Z",
        entryDurationMs: 60_000,
        plannedDurationMs: 45 * 60 * 1000,
        actualDurationMs: 45 * 60 * 1000,
        activeDurationMs: 40 * 60 * 1000,
        pauseDurationMs: 4 * 60 * 1000,
        inactivityDurationMs: 1 * 60 * 1000,
        pauseCount: 1,
        exitCount: 0,
        taskChangeCount: 0,
        interventionCount: 0,
        interventionAcceptCount: 0,
        interventionIgnoreCount: 0,
        inactivityCount: 0,
        stabilityRecoveryCount: 1,
        closureType: "completed",
        completionRatio: 0.88,
        stabilityRatio: 0.82,
        continuityRatio: 0.8,
        recoveryRatio: 0.9,
        startDelayMs: 45_000,
        progressScore: 80,
        frictionScore: 24,
        contextualConsistencyScore: 68,
        behaviorScore: 82,
        timeWindow: "morning",
        durationBucket: "medium",
        diagnostics: {
            entryDurationMs: 60_000,
            completionRatio: 0.88,
            timeWindow: "morning",
            durationBucket: "medium",
            frictionEvents: 1,
            stabilityRecoveryCount: 1,
            interruptionPenalty: 0.06,
            inactivityPenalty: 0.02,
            recoveryBonus: 0.14,
            scoreBreakdown: {
                progress: 80,
                friction: 24,
                contextualConsistency: 68,
                behavior: 82,
            },
        },
        computedAt: overrides.endedAt ?? "2026-03-01T09:45:00.000Z",
        updatedAt: overrides.endedAt ?? "2026-03-01T09:45:00.000Z",
        ...overrides,
    };
}

function makeProfile() {
    const profile = buildEmptyBehaviorProfile("user-1");

    profile.bestFocusWindow = {
        patternKey: "best-window:morning",
        patternType: "best_focus_window",
        windowKind: "persistent",
        status: "active",
        confidence: 0.86,
        sampleSize: 14,
        data: {
            window: "morning",
            averageOutcomeScore: 84,
            averageProgressScore: 82,
            averageFrictionScore: 24,
            averageBehaviorScore: 85,
            comparisonScore: 15,
        },
        evidence: {
            sampleSize: 14,
            confidence: 0.86,
            recencyDays: 5,
            variability: 0.16,
            consistency: 0.82,
            dominance: 0.78,
            recentWins: 9,
        },
        updatedAt: "2026-03-16T12:00:00.000Z",
    };

    profile.optimalSessionLength = {
        patternKey: "session-length:medium",
        patternType: "optimal_session_length",
        windowKind: "persistent",
        status: "active",
        confidence: 0.84,
        sampleSize: 12,
        data: {
            bucket: "medium",
            minMinutes: 50,
            maxMinutes: 75,
            medianMinutes: 60,
            sustainabilityScore: 81,
            comparisonScore: 12,
        },
        evidence: {
            sampleSize: 12,
            confidence: 0.84,
            recencyDays: 7,
            variability: 0.18,
            consistency: 0.8,
            dominance: 0.72,
            recentWins: 8,
        },
        updatedAt: "2026-03-16T12:00:00.000Z",
    };

    profile.topFrictionSources = [{
        patternKey: "friction:block_type:admin",
        patternType: "friction_source",
        windowKind: "persistent",
        status: "active",
        confidence: 0.8,
        sampleSize: 10,
        data: {
            sourceType: "block_type",
            value: "admin",
            label: "bloques admin",
            averageFrictionScore: 74,
            averageBehaviorScore: 46,
            comparisonFrictionScore: 38,
        },
        evidence: {
            sampleSize: 10,
            confidence: 0.8,
            recencyDays: 8,
            variability: 0.12,
            consistency: 0.76,
            dominance: 0.7,
            recentWins: 7,
        },
        updatedAt: "2026-03-16T12:00:00.000Z",
    }];

    profile.consistencyTrend = {
        patternKey: "consistency:improving",
        patternType: "consistency_trend",
        windowKind: "persistent",
        status: "active",
        confidence: 0.78,
        sampleSize: 10,
        data: {
            direction: "improving",
            recentScore: 74,
            previousScore: 62,
            delta: 12,
            recentSessionCount: 8,
            previousSessionCount: 8,
        },
        evidence: {
            sampleSize: 10,
            confidence: 0.78,
            recencyDays: 6,
            variability: 0.18,
            consistency: 0.74,
            dominance: 0.68,
            recentWins: 6,
        },
        updatedAt: "2026-03-16T12:00:00.000Z",
    };

    profile.lastUpdatedAt = "2026-03-16T12:00:00.000Z";
    return profile;
}

describe("buildPlanningGuide", () => {
    it("suggests moving a demanding block that sits outside the best focus window", () => {
        const guide = buildPlanningGuide({
            userId: "user-1",
            profile: makeProfile(),
            recentAnalytics: Array.from({ length: 8 }, (_, index) => makeAnalytics(`a-${index}`)),
            blocks: [
                makeBlock("candidate"),
                makeBlock("morning-gap", {
                    title: "Existing morning block",
                    startAt: new Date("2026-03-18T08:00:00.000Z"),
                    endAt: new Date("2026-03-18T08:45:00.000Z"),
                    intensity: "light",
                    priority: 2,
                    cognitivelyHeavy: false,
                }),
            ],
            targetDate: "2026-03-18",
        });

        const recommendation = guide.recommendations.find((item) => item.type === "move_block");
        expect(recommendation).toBeTruthy();
        expect(recommendation?.reasonCode).toBe("BEST_WINDOW_MISMATCH");
        expect(recommendation?.suggestedAction.kind).toBe("move");
        expect(recommendation?.applyability.mode).toBe("auto");
    });

    it("suggests shortening or splitting a block that exceeds the historical useful range", () => {
        const guide = buildPlanningGuide({
            userId: "user-1",
            profile: makeProfile(),
            recentAnalytics: Array.from({ length: 8 }, (_, index) => makeAnalytics(`a-${index}`)),
            blocks: [makeBlock("long-block")],
            targetDate: "2026-03-18",
        });

        const recommendation = guide.recommendations.find((item) => item.type === "split_block");
        expect(recommendation).toBeTruthy();
        expect(recommendation?.reasonCode).toBe("SESSION_TOO_LONG");
        expect(recommendation?.evidence.sampleSize).toBeGreaterThanOrEqual(10);
    });

    it("detects an overloaded day and proposes reducing the daily load", () => {
        const blocks = [
            makeBlock("b1", {
                startAt: new Date("2026-03-18T08:00:00.000Z"),
                endAt: new Date("2026-03-18T10:00:00.000Z"),
            }),
            makeBlock("b2", {
                startAt: new Date("2026-03-18T10:15:00.000Z"),
                endAt: new Date("2026-03-18T12:15:00.000Z"),
            }),
            makeBlock("b3", {
                startAt: new Date("2026-03-18T13:00:00.000Z"),
                endAt: new Date("2026-03-18T15:00:00.000Z"),
            }),
            makeBlock("b4", {
                startAt: new Date("2026-03-18T15:15:00.000Z"),
                endAt: new Date("2026-03-18T17:15:00.000Z"),
            }),
        ];

        const guide = buildPlanningGuide({
            userId: "user-1",
            profile: makeProfile(),
            recentAnalytics: Array.from({ length: 8 }, (_, index) => makeAnalytics(`a-${index}`, {
                activeDurationMs: 45 * 60 * 1000,
            })),
            blocks,
            targetDate: "2026-03-18",
            preferences: {
                subjectiveEnergy: "low",
                rigidity: "medium",
            },
        });

        expect(guide.dailyLoad.level === "high" || guide.dailyLoad.level === "overload").toBe(true);
        expect(guide.recommendations.some((item) => item.type === "reduce_daily_load")).toBe(true);
        expect(guide.recommendations.some((item) => item.scope === "day")).toBe(true);
    });

    it("suggests an anti-block entry for categories with strong friction history", () => {
        const guide = buildPlanningGuide({
            userId: "user-1",
            profile: makeProfile(),
            recentAnalytics: Array.from({ length: 8 }, (_, index) => makeAnalytics(`a-${index}`)),
            blocks: [
                makeBlock("admin-risk", {
                    type: "admin",
                    title: "Inbox cleanup",
                    intensity: "medium",
                    cognitivelyHeavy: false,
                    priority: 3,
                }),
            ],
            targetDate: "2026-03-18",
        });

        const recommendation = guide.recommendations.find((item) => item.type === "start_small");
        expect(recommendation).toBeTruthy();
        expect(recommendation?.reasonCode).toBe("HIGH_FRICTION_CATEGORY");
        expect(recommendation?.message.length).toBeGreaterThan(10);
    });

    it("stays prudent when evidence for the best window is still weak", () => {
        const profile = makeProfile();
        profile.bestFocusWindow = profile.bestFocusWindow
            ? { ...profile.bestFocusWindow, confidence: 0.58, sampleSize: 3 }
            : null;

        const guide = buildPlanningGuide({
            userId: "user-1",
            profile,
            recentAnalytics: Array.from({ length: 4 }, (_, index) => makeAnalytics(`a-${index}`)),
            blocks: [makeBlock("candidate")],
            targetDate: "2026-03-18",
        });

        expect(guide.recommendations.some((item) => item.type === "move_block")).toBe(false);
    });

    it("scopes stable recommendation ids by user to avoid multi-user collisions", () => {
        const blocks = [
            makeBlock("b1", {
                startAt: new Date("2026-03-18T08:00:00.000Z"),
                endAt: new Date("2026-03-18T10:00:00.000Z"),
            }),
            makeBlock("b2", {
                startAt: new Date("2026-03-18T10:15:00.000Z"),
                endAt: new Date("2026-03-18T12:15:00.000Z"),
            }),
            makeBlock("b3", {
                startAt: new Date("2026-03-18T13:00:00.000Z"),
                endAt: new Date("2026-03-18T15:00:00.000Z"),
            }),
        ];

        const firstGuide = buildPlanningGuide({
            userId: "user-1",
            profile: makeProfile(),
            recentAnalytics: Array.from({ length: 8 }, (_, index) => makeAnalytics(`a-${index}`)),
            blocks,
            targetDate: "2026-03-18",
        });

        const secondGuide = buildPlanningGuide({
            userId: "user-2",
            profile: makeProfile(),
            recentAnalytics: Array.from({ length: 8 }, (_, index) => makeAnalytics(`b-${index}`, { userId: "user-2" })),
            blocks,
            targetDate: "2026-03-18",
        });

        expect(firstGuide.recommendations[0]?.id.startsWith("user-1:")).toBe(true);
        expect(secondGuide.recommendations[0]?.id.startsWith("user-2:")).toBe(true);
        expect(firstGuide.recommendations[0]?.id).not.toBe(secondGuide.recommendations[0]?.id);
    });

    it("downgrades repeated weak recommendation types when the user keeps dismissing them", () => {
        const guide = buildPlanningGuide({
            userId: "user-1",
            profile: makeProfile(),
            recentAnalytics: Array.from({ length: 8 }, (_, index) => makeAnalytics(`a-${index}`)),
            blocks: [
                makeBlock("admin-risk", {
                    type: "admin",
                    title: "Inbox cleanup",
                    intensity: "medium",
                    cognitivelyHeavy: false,
                    priority: 3,
                }),
            ],
            targetDate: "2026-03-18",
            feedbackSummary: {
                start_small: {
                    type: "start_small",
                    shownCount: 5,
                    acceptedCount: 0,
                    dismissedCount: 2,
                    ignoredCount: 1,
                    appliedCount: 0,
                    lastFeedbackAt: "2026-03-15T12:00:00.000Z",
                },
            },
        });

        const recommendation = guide.recommendations.find((item) => item.type === "start_small");
        expect(recommendation).toBeTruthy();
        expect(recommendation?.priority).toBe("low");
        expect(recommendation?.confidence).toBeLessThan(0.8);
    });

    it("returns a differentiated guided planning output when preferences are provided", () => {
        const guide = buildPlanningGuide({
            userId: "user-1",
            profile: makeProfile(),
            recentAnalytics: Array.from({ length: 8 }, (_, index) => makeAnalytics(`a-${index}`)),
            blocks: [
                makeBlock("prime", {
                    startAt: new Date("2026-03-18T14:00:00.000Z"),
                    endAt: new Date("2026-03-18T16:00:00.000Z"),
                }),
                makeBlock("support", {
                    id: "support",
                    title: "Email",
                    type: "admin",
                    intensity: "light",
                    cognitivelyHeavy: false,
                    priority: 2,
                    startAt: new Date("2026-03-18T09:00:00.000Z"),
                    endAt: new Date("2026-03-18T09:45:00.000Z"),
                }),
            ],
            targetDate: "2026-03-18",
            preferences: {
                subjectiveEnergy: "low",
                rigidity: "medium",
            },
        });

        expect(guide.guidedPlan).toBeTruthy();
        expect(guide.guidedPlan?.steps.length).toBeGreaterThan(0);
        expect(guide.guidedPlan?.headline.length).toBeGreaterThan(10);
    });
});
