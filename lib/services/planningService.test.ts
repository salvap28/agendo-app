import { describe, expect, it } from "vitest";
import { canApplyRecommendation } from "@/lib/services/planningService";
import { PlanningRecommendation } from "@/lib/types/planning";

function makeRecommendation(overrides: Partial<PlanningRecommendation> = {}): PlanningRecommendation {
    return {
        id: "user-1:block:move_block:block-1:default",
        type: "move_block",
        scope: "block",
        targetBlockId: "block-1",
        targetDate: "2026-03-17",
        priority: "high",
        confidence: 0.9,
        title: "Move it",
        message: "A move would help.",
        reason: "Morning is stronger.",
        reasonCode: "BEST_WINDOW_MISMATCH",
        reasonPayload: {},
        evidence: {
            sampleSize: 8,
            confidence: 0.9,
            hypothesisStrength: "stable",
            lastUpdated: "2026-03-17T10:00:00.000Z",
            trendDirection: "stable",
            appliesTo: ["block-1"],
            recentlyValidated: true,
            signals: ["best_focus_window"],
        },
        applyability: {
            mode: "auto",
            helperText: "Agendo can apply it.",
        },
        suggestedAction: {
            kind: "move",
            label: "Move block",
            payload: {
                suggestedStart: "2026-03-17T09:00:00.000Z",
                suggestedEnd: "2026-03-17T10:00:00.000Z",
            },
        },
        dismissible: true,
        reversible: false,
        createdAt: "2026-03-17T10:00:00.000Z",
        ...overrides,
    };
}

describe("canApplyRecommendation", () => {
    it("returns true only when auto mode has a complete executable payload", () => {
        expect(canApplyRecommendation(makeRecommendation())).toBe(true);

        expect(canApplyRecommendation(makeRecommendation({
            suggestedAction: {
                kind: "move",
                label: "Move block",
                payload: {},
            },
        }))).toBe(false);

        expect(canApplyRecommendation(makeRecommendation({
            applyability: {
                mode: "manual",
                helperText: "Review this one manually.",
            },
            suggestedAction: {
                kind: "review_window",
                label: "Review window",
                payload: {
                    moveOutBlockId: "block-1",
                },
            },
        }))).toBe(false);
    });
});
