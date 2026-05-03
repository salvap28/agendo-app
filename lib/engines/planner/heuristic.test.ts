import { describe, expect, it } from "vitest";
import {
    buildHeuristicPlannerProposal,
    lightenPlannerProposal,
    regeneratePlannerProposal,
} from "./heuristic";
import type { PlannerContextBundle } from "@/lib/types/planner";

function buildContext(overrides: Partial<PlannerContextBundle> = {}): PlannerContextBundle {
    return {
        targetDate: "2026-04-12",
        nowIso: "2026-04-12T14:05:00.000Z",
        timezone: "America/Asuncion",
        scheduledBlocks: [],
        freeWindows: [],
        overdueBlocks: [],
        habitSnapshot: {
            onboardingCompletedAt: null,
            firstMeaningfulActionAt: null,
            lastMeaningfulActionAt: null,
            rescueFrequencyLast14d: 0,
            meaningfulDaysLast7d: 0,
            weeklyConsistencyTarget: 3,
        },
        userSignals: {
            recentFocusSessionsCount: 0,
            recentActivityExperiencesCount: 0,
            bestFocusWindow: null,
            weakestStartWindows: [],
            recommendedFocusDurationMin: 50,
            averageStartDelayMin: null,
            rescueFrequency: 0,
            frictionPatterns: [],
            preferredBlockTypes: [],
        },
        bestFocusWindow: "afternoon",
        recommendedFocusDurationMin: 50,
        dailyLoadLevel: "medium",
        residualEnergyEstimate: 62,
        primaryUseCase: "study",
        hardestStartMoment: "afternoon",
        desiredHelp: "decide",
        ...overrides,
    };
}

describe("buildHeuristicPlannerProposal", () => {
    it("builds a server-ready proposal from natural input", () => {
        const proposal = buildHeuristicPlannerProposal({
            request: {
                input: "estudiar analisis 90 min, gym 19:00 60 min, mails 30 min",
                source: "text",
                targetDate: "2026-04-12",
                nowIso: "2026-04-12T14:05:00.000Z",
            },
            context: buildContext(),
            language: "es",
        });

        expect(proposal.engine).toBe("heuristic_v1");
        expect(proposal.drafts).toHaveLength(3);
        expect(proposal.interpretation.items).toHaveLength(3);
        expect(proposal.explicitTimesCount).toBe(1);
        expect(new Date(proposal.drafts[1]?.startAt ?? "").getHours()).toBe(19);
    });

    it("lightens and regenerates a proposal deterministically", () => {
        const proposal = buildHeuristicPlannerProposal({
            request: {
                input: "hoy estoy cansado pero necesito avanzar algo del TP",
                source: "text",
                targetDate: "2026-04-12",
                nowIso: "2026-04-12T14:05:00.000Z",
            },
            context: buildContext(),
            language: "es",
        });

        const lighter = lightenPlannerProposal(proposal, "es");
        const regenerated = regeneratePlannerProposal({
            proposal: lighter,
            scheduledBlocks: [],
            nowIso: "2026-04-12T14:05:00.000Z",
            language: "es",
        });

        expect(lighter.drafts[0]?.durationMin).toBeLessThanOrEqual(proposal.drafts[0]?.durationMin ?? 999);
        expect(regenerated.drafts).toHaveLength(lighter.drafts.length);
    });
});
