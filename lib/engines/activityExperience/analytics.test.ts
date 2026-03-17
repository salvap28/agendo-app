import {
    buildActivityBehaviorSignals,
    computeActivityExperienceAnalytics,
    computeDailyActivityLoad,
    estimatePostActivityApplicability,
} from "@/lib/engines/activityExperience";
import { ActivityExperience } from "@/lib/types/activity";
import { FocusSessionAnalytics } from "@/lib/types/behavior";
import { Block } from "@/lib/types/blocks";

function makeActivity(overrides: Partial<ActivityExperience> = {}): ActivityExperience {
    return {
        id: overrides.id ?? crypto.randomUUID(),
        experienceKey: overrides.experienceKey ?? `exp:${crypto.randomUUID()}`,
        userId: "user-1",
        sourceBlockId: overrides.sourceBlockId ?? null,
        sourceFocusSessionId: overrides.sourceFocusSessionId ?? null,
        titleSnapshot: overrides.titleSnapshot ?? "Activity",
        blockTypeSnapshot: overrides.blockTypeSnapshot ?? "meeting",
        tagSnapshot: overrides.tagSnapshot ?? null,
        engagementMode: overrides.engagementMode ?? "collaborative",
        outcome: overrides.outcome ?? "attended",
        source: overrides.source ?? "system_inferred",
        scheduledStart: overrides.scheduledStart ?? "2026-03-18T09:00:00.000Z",
        scheduledEnd: overrides.scheduledEnd ?? "2026-03-18T10:00:00.000Z",
        actualStart: overrides.actualStart ?? "2026-03-18T09:00:00.000Z",
        actualEnd: overrides.actualEnd ?? "2026-03-18T10:00:00.000Z",
        actualDurationMin: overrides.actualDurationMin ?? 60,
        energyImpact: overrides.energyImpact ?? "neutral",
        cognitiveLoad: overrides.cognitiveLoad ?? "medium",
        perceivedValue: overrides.perceivedValue ?? "medium",
        socialDemand: overrides.socialDemand ?? "medium",
        outcomeReason: overrides.outcomeReason ?? "attended_as_expected",
        locationMode: overrides.locationMode ?? "hybrid",
        presenceMode: overrides.presenceMode ?? "required",
        wasPlanned: overrides.wasPlanned ?? true,
        wasCompletedAsPlanned: overrides.wasCompletedAsPlanned ?? true,
        wasUserConfirmed: overrides.wasUserConfirmed ?? false,
        wasSystemInferred: overrides.wasSystemInferred ?? true,
        confidence: overrides.confidence ?? 0.7,
        notes: overrides.notes ?? null,
        metadataJson: overrides.metadataJson ?? {},
        createdAt: overrides.createdAt ?? "2026-03-18T10:05:00.000Z",
        updatedAt: overrides.updatedAt ?? "2026-03-18T10:05:00.000Z",
    };
}

function makeFocusAnalytics(overrides: Partial<FocusSessionAnalytics> = {}): FocusSessionAnalytics {
    return {
        sessionId: overrides.sessionId ?? crypto.randomUUID(),
        userId: "user-1",
        mode: "block",
        blockType: "deep_work",
        initiatedAt: "2026-03-18T10:30:00.000Z",
        startedAt: "2026-03-18T10:30:00.000Z",
        endedAt: "2026-03-18T11:30:00.000Z",
        entryDurationMs: 60_000,
        plannedDurationMs: 60 * 60 * 1000,
        actualDurationMs: 60 * 60 * 1000,
        activeDurationMs: 55 * 60 * 1000,
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
        completionRatio: 0.92,
        stabilityRatio: 0.88,
        continuityRatio: 0.82,
        recoveryRatio: 0.8,
        startDelayMs: 0,
        progressScore: 82,
        frictionScore: 28,
        contextualConsistencyScore: 70,
        behaviorScore: 80,
        timeWindow: "morning",
        durationBucket: "long",
        diagnostics: {
            entryDurationMs: 60_000,
            completionRatio: 0.92,
            timeWindow: "morning",
            durationBucket: "long",
            frictionEvents: 0,
            stabilityRecoveryCount: 0,
            interruptionPenalty: 0,
            inactivityPenalty: 0,
            recoveryBonus: 0,
            scoreBreakdown: {
                progress: 82,
                friction: 28,
                contextualConsistency: 70,
                behavior: 80,
            },
        },
        computedAt: "2026-03-18T11:30:00.000Z",
        updatedAt: "2026-03-18T11:30:00.000Z",
        ...overrides,
    };
}

function makeBlock(overrides: Partial<Block> = {}): Block {
    return {
        id: "block-1",
        title: "Plan",
        type: "deep_work",
        status: "planned",
        startAt: new Date("2026-03-18T12:00:00.000Z"),
        endAt: new Date("2026-03-18T13:30:00.000Z"),
        priority: 4,
        intensity: "high",
        flexibility: "flexible",
        estimatedDurationMinutes: 90,
        cognitivelyHeavy: true,
        ...overrides,
    };
}

describe("activity experience analytics", () => {
    it("computes non-focus rates and distributions", () => {
        const analytics = computeActivityExperienceAnalytics([
            makeActivity(),
            makeActivity({ outcome: "skipped", energyImpact: "draining" }),
            makeActivity({ engagementMode: "recovery", outcome: "completed", energyImpact: "restorative", perceivedValue: "high" }),
        ]);

        expect(analytics.totalCount).toBe(3);
        expect(analytics.attendanceRate).toBeGreaterThan(0);
        expect(analytics.skipRate).toBeGreaterThan(0);
        expect(analytics.energyImpactDistribution.draining).toBeGreaterThan(0);
    });

    it("extends daily load with attendance, logistics and recovery effects", () => {
        const load = computeDailyActivityLoad([
            makeActivity({
                engagementMode: "passive_attendance",
                actualDurationMin: 90,
                cognitiveLoad: "high",
                energyImpact: "demanding",
            }),
            makeActivity({
                id: "logistics",
                engagementMode: "logistics",
                actualDurationMin: 45,
                energyImpact: "neutral",
                scheduledStart: "2026-03-18T10:20:00.000Z",
                scheduledEnd: "2026-03-18T11:05:00.000Z",
                actualStart: "2026-03-18T10:20:00.000Z",
                actualEnd: "2026-03-18T11:05:00.000Z",
            }),
            makeActivity({
                id: "recovery",
                engagementMode: "recovery",
                actualDurationMin: 30,
                energyImpact: "restorative",
                scheduledStart: "2026-03-18T11:15:00.000Z",
                scheduledEnd: "2026-03-18T11:45:00.000Z",
                actualStart: "2026-03-18T11:15:00.000Z",
                actualEnd: "2026-03-18T11:45:00.000Z",
            }),
        ], [makeBlock()], "2026-03-18");

        expect(load.passiveAttendanceLoad).toBeGreaterThan(0);
        expect(load.logisticsLoad).toBeGreaterThan(0);
        expect(load.recoveryEffect).toBeGreaterThan(0);
        expect(load.realDayLoad).toBeGreaterThan(0);
    });

    it("detects post-activity applicability drops after draining collaboration", () => {
        const applicability = estimatePostActivityApplicability({
            targetDate: "2026-03-18",
            blockStart: new Date("2026-03-18T11:30:00.000Z"),
            cognitivelyHeavy: true,
            experiences: [
                makeActivity({
                    engagementMode: "collaborative",
                    energyImpact: "draining",
                    actualEnd: "2026-03-18T10:40:00.000Z",
                    scheduledEnd: "2026-03-18T10:40:00.000Z",
                }),
            ],
        });

        expect(applicability.modifier).toBeLessThan(1);
        expect(applicability.signals).toContain("recent_draining_attendance");
    });

    it("builds activity signals and patterns from recent experiences", () => {
        const signals = buildActivityBehaviorSignals([
            makeActivity({ energyImpact: "draining" }),
            makeActivity({ id: "meeting-2", energyImpact: "demanding" }),
            makeActivity({
                id: "recovery",
                engagementMode: "recovery",
                energyImpact: "restorative",
                scheduledStart: "2026-03-18T11:40:00.000Z",
                scheduledEnd: "2026-03-18T12:00:00.000Z",
                actualStart: "2026-03-18T11:40:00.000Z",
                actualEnd: "2026-03-18T12:00:00.000Z",
            }),
            makeActivity({
                id: "admin",
                engagementMode: "admin_light",
                perceivedValue: "high",
                energyImpact: "neutral",
                scheduledStart: "2026-03-19T08:30:00.000Z",
                scheduledEnd: "2026-03-19T09:00:00.000Z",
                actualStart: "2026-03-19T08:30:00.000Z",
                actualEnd: "2026-03-19T09:00:00.000Z",
            }),
            makeActivity({
                id: "admin-2",
                engagementMode: "admin_light",
                perceivedValue: "high",
                energyImpact: "energizing",
                scheduledStart: "2026-03-20T08:20:00.000Z",
                scheduledEnd: "2026-03-20T08:55:00.000Z",
                actualStart: "2026-03-20T08:20:00.000Z",
                actualEnd: "2026-03-20T08:55:00.000Z",
            }),
            makeActivity({
                id: "admin-3",
                engagementMode: "admin_light",
                perceivedValue: "medium",
                energyImpact: "neutral",
                scheduledStart: "2026-03-21T08:10:00.000Z",
                scheduledEnd: "2026-03-21T08:40:00.000Z",
                actualStart: "2026-03-21T08:10:00.000Z",
                actualEnd: "2026-03-21T08:40:00.000Z",
            }),
        ], [
            makeFocusAnalytics({
                startedAt: "2026-03-18T10:50:00.000Z",
                endedAt: "2026-03-18T11:40:00.000Z",
                frictionScore: 64,
                behaviorScore: 54,
            }),
            makeFocusAnalytics({
                sessionId: "focus-2",
                startedAt: "2026-03-18T12:10:00.000Z",
                endedAt: "2026-03-18T13:00:00.000Z",
                frictionScore: 28,
                behaviorScore: 82,
            }),
        ]);

        expect(signals.postMeetingFatigue).not.toBeNull();
        expect(signals.patterns.length).toBeGreaterThan(0);
        expect(signals.preferredLightExecutionWindows.length).toBeGreaterThan(0);
    });
});
