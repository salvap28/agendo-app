import { describe, expect, it } from "vitest";
import { buildHabitCapturePlan, humanizeBlockTitle } from "./capture";

describe("humanizeBlockTitle", () => {
    it("softens all caps titles for display", () => {
        expect(humanizeBlockTitle("TDC ED ROJO AULA 8")).toBe("TDC ED Rojo Aula 8");
    });
});

describe("buildHabitCapturePlan", () => {
    it("creates multiple drafts from quick capture input", () => {
        const now = new Date(2026, 3, 12, 14, 5);
        const plan = buildHabitCapturePlan({
            input: "estudiar fisica 90 min, gym 19:00 60 min, mails 30 min",
            existingBlocks: [],
            now,
        });

        expect(plan.drafts).toHaveLength(3);
        expect(plan.totalDurationMin).toBe(180);
        expect(plan.explicitTimesCount).toBe(1);
        expect(plan.drafts[0]?.type).toBe("study");
        expect(plan.drafts[1]?.type).toBe("gym");
        expect(new Date(plan.drafts[1]?.startAt ?? "").getHours()).toBe(19);
        expect(new Date(plan.drafts[1]?.startAt ?? "").getMinutes()).toBe(0);
    });

    it("falls back to the next free slot when a stated time is already in the past", () => {
        const now = new Date(2026, 3, 12, 18, 20);
        const plan = buildHabitCapturePlan({
            input: "gym 17:00 45 min",
            existingBlocks: [],
            now,
        });

        expect(plan.drafts).toHaveLength(1);
        expect(new Date(plan.drafts[0]?.startAt ?? "").getHours()).toBe(18);
        expect(new Date(plan.drafts[0]?.startAt ?? "").getMinutes()).toBe(30);
    });
});
