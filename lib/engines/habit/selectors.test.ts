import { describe, expect, it } from "vitest";
import {
    buildOnboardingSuggestedBlock,
    buildRescuePlan,
    getNextRelevantBlock,
    getPrimaryUseCaseConcreteValues,
    resolveDesiredHelpSelection,
    resolveHardestStartMomentSelection,
    resolvePrimaryUseCaseSelection,
    toggleAggregateSelection,
} from "@/lib/engines/habit";
import type { Block } from "@/lib/types/blocks";

function makeBlock(overrides: Partial<Block> = {}): Block {
    return {
        id: overrides.id ?? crypto.randomUUID(),
        title: overrides.title ?? "Block",
        type: overrides.type ?? "deep_work",
        startAt: overrides.startAt ?? new Date("2026-04-12T10:00:00.000Z"),
        endAt: overrides.endAt ?? new Date("2026-04-12T11:00:00.000Z"),
        status: overrides.status ?? "planned",
        ...overrides,
    };
}

describe("habit selectors", () => {
    it("prioritizes the nearest relevant unfinished block", () => {
        const now = new Date("2026-04-12T09:50:00.000Z");
        const result = getNextRelevantBlock({
            now,
            language: "en",
            blocks: [
                makeBlock({ id: "later", title: "Later", startAt: new Date("2026-04-12T13:00:00.000Z"), endAt: new Date("2026-04-12T14:00:00.000Z") }),
                makeBlock({ id: "next", title: "Next", startAt: new Date("2026-04-12T10:05:00.000Z"), endAt: new Date("2026-04-12T11:00:00.000Z"), priority: 4 }),
                makeBlock({ id: "done", title: "Done", status: "completed", startAt: new Date("2026-04-12T08:00:00.000Z"), endAt: new Date("2026-04-12T09:00:00.000Z") }),
            ],
        });

        expect(result.block?.id).toBe("next");
        expect(result.state).toBe("start_now");
    });

    it("builds an onboarding block suggestion from activation answers", () => {
        const suggestion = buildOnboardingSuggestedBlock({
            language: "es",
            now: new Date("2026-04-12T07:20:00.000Z"),
            primaryUseCase: "study",
            hardestStartMoment: "morning",
            desiredHelp: "start_focus",
        });

        expect(suggestion.type).toBe("study");
        expect(suggestion.durationMin).toBe(45);
        expect(suggestion.title.toLowerCase()).toContain("estudio");
    });

    it("collapses all onboarding use cases into mixed when the concrete set is complete", () => {
        const next = toggleAggregateSelection({
            current: ["study", "work"],
            value: "gym",
            aggregateValue: "mixed",
            concreteValues: getPrimaryUseCaseConcreteValues(),
        });

        expect(next).toEqual(["mixed"]);
        expect(resolvePrimaryUseCaseSelection(next)).toBe("mixed");
    });

    it("treats multi-select answers as mixed canonically for the later questions", () => {
        expect(resolveHardestStartMomentSelection(["morning", "night"])).toBe("mixed");
        expect(resolveDesiredHelpSelection(["decide", "resume_when_lost"])).toBe("mixed");
    });

    it("creates a rescue plan when key blocks are overdue", () => {
        const now = new Date("2026-04-12T16:30:00.000Z");
        const rescue = buildRescuePlan({
            now,
            language: "es",
            blocks: [
                makeBlock({
                    id: "overdue",
                    title: "Overdue",
                    priority: 5,
                    startAt: new Date("2026-04-12T13:00:00.000Z"),
                    endAt: new Date("2026-04-12T14:00:00.000Z"),
                    status: "planned",
                }),
                makeBlock({
                    id: "break",
                    type: "break",
                    startAt: new Date("2026-04-12T17:00:00.000Z"),
                    endAt: new Date("2026-04-12T17:30:00.000Z"),
                }),
            ],
        });

        expect(rescue).not.toBeNull();
        expect(rescue?.priorityCandidates[0]?.id).toBe("overdue");
        expect(rescue?.suggestedActions.length).toBeGreaterThan(0);
    });
});
