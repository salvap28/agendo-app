import { buildFocusContext, getFocusElapsedMs } from "@/lib/engines/focusContext";
import { Block } from "@/lib/types/blocks";
import { FocusSession } from "@/lib/types/focus";

describe("focusContext", () => {
    it("calculates elapsed time and session progress from a single runtime source", () => {
        const session: FocusSession = {
            id: "session-1",
            mode: "block",
            blockId: "block-1",
            blockType: "deep_work",
            startedAt: "2026-03-15T20:00:00.000Z",
            isActive: true,
            isPaused: false,
            totalPausedMs: 5 * 60 * 1000,
            pauseCount: 1,
            exitCount: 0,
            restCount: 0,
            lastPauseReason: "manual_pause",
            history: ["Started"],
            cardMemory: {},
            persistenceStatus: "draft",
        };
        const block: Block = {
            id: "block-1",
            title: "Deep work",
            type: "deep_work",
            status: "active",
            startAt: new Date("2026-03-15T20:00:00.000Z"),
            endAt: new Date("2026-03-15T20:30:00.000Z"),
        };

        const now = new Date("2026-03-15T20:15:00.000Z").getTime();
        const context = buildFocusContext({
            session,
            blocks: [block],
            now,
        });

        expect(getFocusElapsedMs(session, now)).toBe(10 * 60 * 1000);
        expect(context?.elapsedMs).toBe(10 * 60 * 1000);
        expect(context?.sessionProgress).toBeCloseTo(1 / 3, 5);
    });

    it("derives recent friction and start delay signals from session activity", () => {
        const session: FocusSession = {
            id: "session-activity",
            mode: "block",
            blockId: "block-1",
            blockType: "deep_work",
            startedAt: "2026-03-15T20:00:00.000Z",
            isActive: true,
            isPaused: false,
            totalPausedMs: 0,
            pauseCount: 2,
            exitCount: 1,
            restCount: 0,
            lastPauseReason: "manual_pause",
            pauseEvents: [
                new Date("2026-03-15T19:50:00.000Z").getTime(),
                new Date("2026-03-15T20:08:00.000Z").getTime(),
            ],
            exitEvents: [
                new Date("2026-03-15T20:12:00.000Z").getTime(),
            ],
            firstInteractionAt: "2026-03-15T20:03:00.000Z",
            lastInteractionAt: "2026-03-15T20:14:00.000Z",
            history: ["Started"],
            cardMemory: {},
            persistenceStatus: "draft",
        };
        const block: Block = {
            id: "block-1",
            title: "Deep work",
            type: "deep_work",
            status: "active",
            startAt: new Date("2026-03-15T20:00:00.000Z"),
            endAt: new Date("2026-03-15T20:30:00.000Z"),
        };

        const now = new Date("2026-03-15T20:15:00.000Z").getTime();
        const context = buildFocusContext({
            session,
            blocks: [block],
            now,
        });

        expect(context?.recentPauseCount).toBe(1);
        expect(context?.recentExitCount).toBe(1);
        expect(context?.recentInteractionWindowMs).toBe(60 * 1000);
        expect(context?.recentStabilityMs).toBe(3 * 60 * 1000);
        expect(context?.startDelayMs).toBe(3 * 60 * 1000);
    });

    it("freezes elapsed time while the session is paused", () => {
        const session: FocusSession = {
            id: "session-2",
            mode: "free",
            startedAt: "2026-03-15T20:00:00.000Z",
            isActive: false,
            isPaused: true,
            pausedAt: "2026-03-15T20:12:00.000Z",
            totalPausedMs: 0,
            pauseCount: 1,
            exitCount: 0,
            restCount: 0,
            lastPauseReason: "manual_pause",
            history: ["Started", "Paused"],
            cardMemory: {},
            persistenceStatus: "draft",
        };

        const context = buildFocusContext({
            session,
            blocks: [],
            defaultFocusMinutes: 25,
            now: new Date("2026-03-15T20:18:00.000Z").getTime(),
        });

        expect(context?.elapsedMs).toBe(12 * 60 * 1000);
        expect(context?.sessionProgress).toBeCloseTo(12 / 25, 5);
    });
});
