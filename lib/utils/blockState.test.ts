import { getBlockEffectiveStatus, getBlockRuntimeState } from "@/lib/utils/blockState";
import { Block } from "@/lib/types/blocks";
import { FocusSession } from "@/lib/types/focus";

const baseBlock: Block = {
    id: "block-1",
    title: "Deep Work",
    type: "deep_work",
    status: "planned",
    startAt: new Date("2026-03-15T20:00:00.000Z"),
    endAt: new Date("2026-03-15T21:00:00.000Z"),
};

describe("blockState", () => {
    it("derives planned, active, completed and canceled from time", () => {
        expect(getBlockEffectiveStatus(baseBlock, new Date("2026-03-15T19:30:00.000Z"))).toBe("planned");
        expect(getBlockEffectiveStatus(baseBlock, new Date("2026-03-15T20:30:00.000Z"))).toBe("active");
        expect(getBlockEffectiveStatus(baseBlock, new Date("2026-03-15T21:00:00.000Z"))).toBe("completed");
        expect(
            getBlockEffectiveStatus({ ...baseBlock, status: "canceled" }, new Date("2026-03-15T20:30:00.000Z"))
        ).toBe("canceled");
    });

    it("respects a user-started active block even before its scheduled start", () => {
        expect(
            getBlockEffectiveStatus(
                { ...baseBlock, status: "active" },
                new Date("2026-03-15T19:30:00.000Z")
            )
        ).toBe("active");
    });

    it("exposes paused focus state on the matching block", () => {
        const pausedSession: FocusSession = {
            id: "session-1",
            mode: "block",
            blockId: baseBlock.id,
            blockType: baseBlock.type,
            startedAt: "2026-03-15T20:00:00.000Z",
            isActive: false,
            isPaused: true,
            pausedAt: "2026-03-15T20:15:00.000Z",
            totalPausedMs: 0,
            pauseCount: 1,
            exitCount: 1,
        };

        const runtimeState = getBlockRuntimeState(baseBlock, pausedSession, new Date("2026-03-15T20:20:00.000Z"));

        expect(runtimeState.isSessionBlock).toBe(true);
        expect(runtimeState.hasPausedFocus).toBe(true);
        expect(runtimeState.isFocusRunning).toBe(false);
        expect(runtimeState.effectiveStatus).toBe("active");
    });
});
