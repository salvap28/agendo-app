import {
    applyCheckoutToExperience,
    getDefaultActivityCheckoutOutcome,
    inferActivityExperienceFromBlock,
    inferRescheduledActivityExperience,
    mapFocusSessionToActivityExperience,
    shouldPromptActivityCheckout,
} from "@/lib/engines/activityExperience";
import { FocusSessionAnalytics } from "@/lib/types/behavior";
import { Block } from "@/lib/types/blocks";
import { FocusSession } from "@/lib/types/focus";

function makeBlock(overrides: Partial<Block> = {}): Block {
    return {
        id: "block-1",
        title: "Weekly sync",
        type: "meeting",
        status: "planned",
        startAt: new Date("2026-03-18T14:00:00.000Z"),
        endAt: new Date("2026-03-18T15:00:00.000Z"),
        priority: 3,
        intensity: "medium",
        flexibility: "fixed",
        estimatedDurationMinutes: 60,
        ...overrides,
    };
}

function makeFocusSession(overrides: Partial<FocusSession> = {}): FocusSession {
    return {
        id: "focus-1",
        mode: "block",
        blockId: "block-1",
        blockType: "deep_work",
        startedAt: "2026-03-18T09:00:00.000Z",
        endedAt: "2026-03-18T10:00:00.000Z",
        isActive: false,
        isPaused: false,
        totalPausedMs: 0,
        pauseCount: 0,
        exitCount: 0,
        runtimeState: "completed",
        ...overrides,
    };
}

function makeAnalytics(overrides: Partial<FocusSessionAnalytics> = {}): FocusSessionAnalytics {
    return {
        sessionId: "focus-1",
        userId: "user-1",
        mode: "block",
        blockType: "deep_work",
        initiatedAt: "2026-03-18T08:58:00.000Z",
        startedAt: "2026-03-18T09:00:00.000Z",
        endedAt: "2026-03-18T10:00:00.000Z",
        entryDurationMs: 60_000,
        plannedDurationMs: 60 * 60 * 1000,
        actualDurationMs: 60 * 60 * 1000,
        activeDurationMs: 56 * 60 * 1000,
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
        completionRatio: 1,
        stabilityRatio: 0.9,
        continuityRatio: 0.86,
        recoveryRatio: 0.84,
        startDelayMs: 0,
        progressScore: 84,
        frictionScore: 22,
        contextualConsistencyScore: 76,
        behaviorScore: 85,
        timeWindow: "morning",
        durationBucket: "long",
        diagnostics: {
            entryDurationMs: 60_000,
            completionRatio: 1,
            timeWindow: "morning",
            durationBucket: "long",
            frictionEvents: 0,
            stabilityRecoveryCount: 0,
            interruptionPenalty: 0,
            inactivityPenalty: 0,
            recoveryBonus: 0,
            scoreBreakdown: {
                progress: 84,
                friction: 22,
                contextualConsistency: 76,
                behavior: 85,
            },
        },
        computedAt: "2026-03-18T10:00:00.000Z",
        updatedAt: "2026-03-18T10:00:00.000Z",
        ...overrides,
    };
}

describe("activity experience domain", () => {
    it("maps a closed focus session into a deep-focus activity experience", () => {
        const experience = mapFocusSessionToActivityExperience({
            userId: "user-1",
            session: makeFocusSession({
                intention: "Write draft",
                moodBefore: 2,
                moodAfter: 4,
                progressFeelingAfter: 5,
                difficulty: 3,
            }),
            analytics: makeAnalytics(),
        });

        expect(experience.engagementMode).toBe("deep_focus");
        expect(experience.sourceFocusSessionId).toBe("focus-1");
        expect(experience.outcome).toBe("completed");
        expect(experience.energyImpact).toBe("energizing");
        expect(experience.wasSystemInferred).toBe(false);
    });

    it("infers a non-focus completed block honestly from block status", () => {
        const experience = inferActivityExperienceFromBlock({
            userId: "user-1",
            block: makeBlock({
                status: "completed",
            }),
        });

        expect(experience).toBeTruthy();
        expect(experience?.outcome).toBe("attended");
        expect(experience?.wasSystemInferred).toBe(true);
        expect(experience?.confidence).toBeGreaterThan(0.8);
    });

    it("records a rescheduled outcome when the block moved materially", () => {
        const experience = inferRescheduledActivityExperience({
            userId: "user-1",
            previousBlock: makeBlock(),
            nextBlock: makeBlock({
                startAt: new Date("2026-03-18T16:00:00.000Z"),
                endAt: new Date("2026-03-18T17:00:00.000Z"),
            }),
        });

        expect(experience).toBeTruthy();
        expect(experience?.outcome).toBe("rescheduled");
        expect(experience?.outcomeReason).toBe("calendar_conflict");
    });

    it("turns an inferred experience into a confirmed checkout", () => {
        const base = inferActivityExperienceFromBlock({
            userId: "user-1",
            block: makeBlock({
                endAt: new Date("2026-03-18T11:00:00.000Z"),
            }),
            now: new Date("2026-03-18T12:00:00.000Z"),
        });

        expect(base).toBeTruthy();
        const confirmed = applyCheckoutToExperience(base!, {
            outcome: "partial",
            energyImpact: "draining",
            perceivedValue: "medium",
        });

        expect(confirmed.wasUserConfirmed).toBe(true);
        expect(confirmed.wasSystemInferred).toBe(false);
        expect(confirmed.outcome).toBe("partial");
        expect(confirmed.energyImpact).toBe("draining");
    });

    it("prompts a checkout for ended non-focus blocks until confirmation exists", () => {
        const block = makeBlock({
            endAt: new Date("2026-03-18T11:00:00.000Z"),
        });
        const inferred = inferActivityExperienceFromBlock({
            userId: "user-1",
            block,
            now: new Date("2026-03-18T12:00:00.000Z"),
        });

        expect(shouldPromptActivityCheckout({
            block,
            experience: inferred,
            now: new Date("2026-03-18T12:00:00.000Z"),
        })).toBe(true);

        const confirmed = applyCheckoutToExperience(inferred!, {
            outcome: "attended",
            perceivedValue: "high",
        });

        expect(shouldPromptActivityCheckout({
            block,
            experience: confirmed,
            now: new Date("2026-03-18T12:00:00.000Z"),
        })).toBe(false);
    });

    it("does not prompt checkout for focus-required blocks and derives sensible defaults", () => {
        const block = makeBlock({
            type: "deep_work",
            requiresFocusMode: true,
            endAt: new Date("2026-03-18T11:00:00.000Z"),
        });

        expect(shouldPromptActivityCheckout({
            block,
            now: new Date("2026-03-18T12:00:00.000Z"),
        })).toBe(false);
        expect(getDefaultActivityCheckoutOutcome(makeBlock())).toBe("attended");
        expect(getDefaultActivityCheckoutOutcome(makeBlock({ type: "admin" }))).toBe("completed");
    });
});
