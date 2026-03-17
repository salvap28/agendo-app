import {
    canAutoApplyRecommendation,
    isSuppressed,
    serializeRecommendation,
    summarizePlanningFeedback,
} from "@/lib/server/planning";
import {
    PersistedPlanningRecommendation,
    PlanningRecommendation,
} from "@/lib/types/planning";

function makeRecommendation(overrides: Partial<PlanningRecommendation> = {}): PlanningRecommendation {
    return {
        id: "user-1:block:move_block:block-1:default",
        type: "move_block",
        scope: "block",
        targetBlockId: "block-1",
        targetDate: "2026-03-18",
        priority: "high",
        confidence: 0.88,
        title: "Mover bloque",
        message: "Moverlo podria ayudar.",
        reason: "Rinde mejor en otra franja.",
        reasonCode: "BEST_WINDOW_MISMATCH",
        reasonPayload: {},
        evidence: {
            sampleSize: 12,
            confidence: 0.88,
            hypothesisStrength: "stable",
            lastUpdated: "2026-03-16T12:00:00.000Z",
            trendDirection: "stable",
            appliesTo: ["block-1"],
            recentlyValidated: true,
            signals: ["best_focus_window"],
        },
        applyability: {
            mode: "auto",
            helperText: "Agendo puede aplicarlo automaticamente.",
        },
        suggestedAction: {
            kind: "move",
            label: "Mover",
            payload: {
                suggestedStart: "2026-03-18T09:00:00.000Z",
                suggestedEnd: "2026-03-18T10:00:00.000Z",
            },
        },
        dismissible: true,
        reversible: false,
        createdAt: "2026-03-16T12:00:00.000Z",
        ...overrides,
    };
}

function makePersistedRecommendation(overrides: Partial<PersistedPlanningRecommendation> = {}): PersistedPlanningRecommendation {
    return {
        recommendationId: "user-1:block:move_block:block-1:default",
        userId: "user-1",
        targetBlockId: "block-1",
        targetDate: "2026-03-18",
        type: "move_block",
        scope: "block",
        status: "active",
        confidence: 0.88,
        priority: "high",
        title: "Mover bloque",
        message: "Moverlo podria ayudar.",
        reasonCode: "BEST_WINDOW_MISMATCH",
        reasonPayload: {},
        evidence: {
            sampleSize: 12,
            confidence: 0.88,
            hypothesisStrength: "stable",
            lastUpdated: "2026-03-16T12:00:00.000Z",
            trendDirection: "stable",
            appliesTo: ["block-1"],
            recentlyValidated: true,
            signals: ["best_focus_window"],
        },
        applyability: {
            mode: "auto",
            helperText: "Agendo puede aplicarlo automaticamente.",
        },
        suggestedAction: {
            kind: "move",
            label: "Mover",
            payload: {
                suggestedStart: "2026-03-18T09:00:00.000Z",
                suggestedEnd: "2026-03-18T10:00:00.000Z",
            },
        },
        dismissible: true,
        reversible: false,
        createdAt: "2026-03-16T12:00:00.000Z",
        expiresAt: null,
        acceptedAt: null,
        appliedAt: null,
        dismissedAt: null,
        ignoredAt: null,
        firstSeenAt: "2026-03-16T12:00:00.000Z",
        lastSeenAt: "2026-03-16T12:00:00.000Z",
        seenCount: 1,
        acceptedCount: 0,
        dismissedCount: 0,
        ignoredCount: 0,
        appliedCount: 0,
        ...overrides,
    };
}

describe("planning lifecycle helpers", () => {
    it("marks a repeatedly seen active recommendation as ignored", () => {
        const payload = serializeRecommendation(
            "user-1",
            makeRecommendation(),
            makePersistedRecommendation({
                seenCount: 2,
            }),
        );

        expect(payload.status).toBe("ignored");
        expect(payload.seen_count).toBe(3);
        expect(payload.ignored_count).toBe(1);
        expect(payload.ignored_at).toBeTruthy();
    });

    it("aggregates feedback counts by recommendation type", () => {
        const summary = summarizePlanningFeedback([
            makePersistedRecommendation({
                type: "move_block",
                acceptedCount: 1,
                appliedCount: 2,
                seenCount: 4,
                appliedAt: "2026-03-16T12:00:00.000Z",
            }),
            makePersistedRecommendation({
                recommendationId: "user-1:day:insert_break:2026-03-18:default",
                type: "insert_break",
                scope: "day",
                targetBlockId: null,
                dismissedCount: 2,
                ignoredCount: 1,
                seenCount: 5,
                dismissedAt: "2026-03-16T11:00:00.000Z",
            }),
        ]);

        expect(summary.move_block?.appliedCount).toBe(2);
        expect(summary.move_block?.shownCount).toBe(4);
        expect(summary.insert_break?.dismissedCount).toBe(2);
        expect(summary.insert_break?.ignoredCount).toBe(1);
    });

    it("only considers recommendations auto-applicable when mode and payload are real", () => {
        expect(canAutoApplyRecommendation(makeRecommendation())).toBe(true);

        const manualRecommendation = makeRecommendation({
            type: "protect_focus_window",
            applyability: {
                mode: "manual",
                helperText: "Conviene revisarlo manualmente.",
            },
            suggestedAction: {
                kind: "review_window",
                label: "Revisar esa franja",
                payload: {
                    moveOutBlockId: "block-1",
                    protectForBlockId: "block-2",
                },
            },
        });

        expect(canAutoApplyRecommendation(manualRecommendation)).toBe(false);
        expect(canAutoApplyRecommendation(makeRecommendation({
            suggestedAction: {
                kind: "move",
                label: "Mover",
                payload: {},
            },
        }))).toBe(false);
    });

    it("suppresses ignored recommendations during the cooling window", () => {
        expect(isSuppressed(makePersistedRecommendation({
            status: "ignored",
            ignoredAt: new Date(Date.now() - (12 * 60 * 60 * 1000)).toISOString(),
        }))).toBe(true);
    });
});
