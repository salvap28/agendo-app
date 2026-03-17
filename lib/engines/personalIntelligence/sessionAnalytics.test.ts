import { deriveSessionAnalytics } from "@/lib/engines/personalIntelligence/sessionAnalytics";
import { FocusSession, FocusSessionEvent } from "@/lib/types/focus";
import { FocusSessionAnalytics } from "@/lib/types/behavior";

function makeSession(overrides: Partial<FocusSession> = {}): FocusSession {
    return {
        id: "session-1",
        mode: "block",
        blockId: "block-1",
        blockType: "deep_work",
        initiatedAt: "2026-03-16T08:58:00.000Z",
        consolidatedAt: "2026-03-16T09:00:00.000Z",
        startedAt: "2026-03-16T09:00:00.000Z",
        endedAt: "2026-03-16T09:48:00.000Z",
        plannedDurationMs: 50 * 60 * 1000,
        isActive: false,
        isPaused: false,
        totalPausedMs: 0,
        pauseCount: 0,
        exitCount: 0,
        restCount: 0,
        lastPauseReason: null,
        pauseEvents: [],
        exitEvents: [],
        intention: "Ship the V2 pipeline",
        progressFeelingAfter: 5,
        difficulty: 4,
        clarity: 5,
        startDelayMs: 30_000,
        history: ["Started", "Finished"],
        cardMemory: {},
        runtimeState: "completed",
        events: [],
        inactivityStartedAt: null,
        persistenceStatus: "persisted",
        ...overrides,
    };
}

function makeEvent(type: FocusSessionEvent["type"], timestamp: string): FocusSessionEvent {
    return {
        id: `${type}-${timestamp}`,
        sessionId: "session-1",
        type,
        runtimeState: type === "session_abandoned"
            ? "abandoned"
            : type === "session_completed"
                ? "completed"
                : type === "inactivity_detected"
                    ? "friction_detected"
                    : "active",
        timestamp,
        relativeMs: 0,
    };
}

function makeRecentAnalytics(): FocusSessionAnalytics[] {
    return [
        {
            sessionId: "recent-1",
            userId: "user-1",
            mode: "block",
            blockType: "deep_work",
            initiatedAt: "2026-03-14T08:59:00.000Z",
            startedAt: "2026-03-14T09:00:00.000Z",
            endedAt: "2026-03-14T09:42:00.000Z",
            entryDurationMs: 60_000,
            plannedDurationMs: 45 * 60 * 1000,
            actualDurationMs: 42 * 60 * 1000,
            activeDurationMs: 40 * 60 * 1000,
            pauseDurationMs: 2 * 60 * 1000,
            inactivityDurationMs: 0,
            pauseCount: 0,
            exitCount: 0,
            taskChangeCount: 1,
            interventionCount: 0,
            interventionAcceptCount: 0,
            interventionIgnoreCount: 0,
            inactivityCount: 0,
            stabilityRecoveryCount: 0,
            closureType: "completed",
            completionRatio: 0.93,
            stabilityRatio: 0.89,
            continuityRatio: 0.9,
            recoveryRatio: 1,
            startDelayMs: 20_000,
            progressScore: 84,
            frictionScore: 18,
            contextualConsistencyScore: 66,
            behaviorScore: 83,
            timeWindow: "morning",
            durationBucket: "medium",
            diagnostics: {
                entryDurationMs: 60_000,
                completionRatio: 0.93,
                timeWindow: "morning",
                durationBucket: "medium",
                frictionEvents: 0,
                stabilityRecoveryCount: 0,
                interruptionPenalty: 0,
                inactivityPenalty: 0,
                recoveryBonus: 0.08,
                scoreBreakdown: {
                    progress: 84,
                    friction: 18,
                    contextualConsistency: 66,
                    behavior: 83,
                },
            },
            computedAt: "2026-03-14T09:42:00.000Z",
            updatedAt: "2026-03-14T09:42:00.000Z",
        },
        {
            sessionId: "recent-2",
            userId: "user-1",
            mode: "block",
            blockType: "deep_work",
            initiatedAt: "2026-03-15T09:00:00.000Z",
            startedAt: "2026-03-15T09:02:00.000Z",
            endedAt: "2026-03-15T09:40:00.000Z",
            entryDurationMs: 120_000,
            plannedDurationMs: 45 * 60 * 1000,
            actualDurationMs: 38 * 60 * 1000,
            activeDurationMs: 34 * 60 * 1000,
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
            completionRatio: 0.84,
            stabilityRatio: 0.78,
            continuityRatio: 0.81,
            recoveryRatio: 1,
            startDelayMs: 45_000,
            progressScore: 77,
            frictionScore: 29,
            contextualConsistencyScore: 61,
            behaviorScore: 74,
            timeWindow: "morning",
            durationBucket: "medium",
            diagnostics: {
                entryDurationMs: 120_000,
                completionRatio: 0.84,
                timeWindow: "morning",
                durationBucket: "medium",
                frictionEvents: 1,
                stabilityRecoveryCount: 1,
                interruptionPenalty: 0.08,
                inactivityPenalty: 0,
                recoveryBonus: 0.16,
                scoreBreakdown: {
                    progress: 77,
                    friction: 29,
                    contextualConsistency: 61,
                    behavior: 74,
                },
            },
            computedAt: "2026-03-15T09:40:00.000Z",
            updatedAt: "2026-03-15T09:40:00.000Z",
        },
    ];
}

describe("deriveSessionAnalytics", () => {
    it("reads a stable session as completed with strong progress and low friction", () => {
        const analytics = deriveSessionAnalytics({
            userId: "user-1",
            session: makeSession(),
            recentAnalytics: makeRecentAnalytics(),
        });

        expect(analytics.closureType).toBe("completed");
        expect(analytics.progressScore).toBeGreaterThan(analytics.frictionScore);
        expect(analytics.timeWindow).toBe("morning");
        expect(analytics.durationBucket).toBe("medium");
        expect(analytics.contextualConsistencyScore).toBeGreaterThanOrEqual(50);
    });

    it("marks a short unstable session with unresolved inactivity as abandoned", () => {
        const analytics = deriveSessionAnalytics({
            userId: "user-1",
            session: makeSession({
                startedAt: "2026-03-16T10:00:00.000Z",
                initiatedAt: "2026-03-16T09:57:00.000Z",
                endedAt: "2026-03-16T10:12:00.000Z",
                plannedDurationMs: 45 * 60 * 1000,
                pauseCount: 1,
                exitCount: 2,
                totalPausedMs: 3 * 60 * 1000,
                clarity: 2,
                difficulty: 5,
                progressFeelingAfter: 2,
                startDelayMs: 5 * 60 * 1000,
            }),
            events: [
                makeEvent("inactivity_detected", "2026-03-16T10:05:00.000Z"),
            ],
            recentAnalytics: makeRecentAnalytics(),
        });

        expect(analytics.closureType).toBe("abandoned");
        expect(analytics.inactivityDurationMs).toBeGreaterThan(0);
        expect(analytics.frictionScore).toBeGreaterThanOrEqual(60);
        expect(analytics.behaviorScore).toBeLessThan(analytics.progressScore);
    });

    it("respects an explicit runtime abandoned terminal event over heuristics", () => {
        const analytics = deriveSessionAnalytics({
            userId: "user-1",
            session: makeSession({
                endedAt: "2026-03-16T09:46:00.000Z",
                plannedDurationMs: 50 * 60 * 1000,
                progressFeelingAfter: 4,
                exitCount: 0,
            }),
            events: [
                makeEvent("session_abandoned", "2026-03-16T09:46:00.000Z"),
            ],
            recentAnalytics: makeRecentAnalytics(),
        });

        expect(analytics.closureType).toBe("abandoned");
    });
});
