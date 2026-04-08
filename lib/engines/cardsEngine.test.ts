import { buildFocusContext } from "@/lib/engines/focusContext";
import { detectSessionState, evaluateFocusContext, SessionState, shouldOfferClosureBridgeOnFinish } from "@/lib/engines/cardsEngine";
import { Block } from "@/lib/types/blocks";
import { FocusContext, FocusSession } from "@/lib/types/focus";

const NOW = new Date("2026-03-15T20:10:00.000Z").getTime();

function makeBlock(): Block {
    return {
        id: "block-1",
        title: "Deep work",
        type: "deep_work",
        status: "active",
        startAt: new Date("2026-03-15T20:00:00.000Z"),
        endAt: new Date("2026-03-15T20:20:00.000Z"),
    };
}

function makeSession(overrides: Partial<FocusSession> = {}): FocusSession {
    return {
        id: "session-1",
        mode: "block",
        blockId: "block-1",
        blockType: "deep_work",
        startedAt: "2026-03-15T20:00:00.000Z",
        isActive: true,
        isPaused: false,
        totalPausedMs: 0,
        pauseCount: 0,
        exitCount: 0,
        restCount: 0,
        lastPauseReason: null,
        history: ["Started"],
        cardMemory: {},
        persistenceStatus: "draft",
        ...overrides,
    };
}

function makeContext(overrides: Partial<FocusContext> = {}): FocusContext {
    return {
        mode: "block",
        blockType: "deep_work",
        startTime: new Date("2026-03-15T20:00:00.000Z").getTime(),
        now: NOW,
        plannedDurationMs: 20 * 60 * 1000,
        elapsedMs: 10 * 60 * 1000,
        totalPausedMs: 0,
        sessionProgress: 0.5,
        pauses: 0,
        overlayExits: 0,
        restPauses: 0,
        lastPauseReason: null,
        recentPauseCount: 0,
        recentExitCount: 0,
        recentInteractionWindowMs: 30 * 1000,
        recentStabilityMs: 8 * 60 * 1000,
        startDelayMs: 30 * 1000,
        intention: "Write parser",
        nextStep: null,
        minimumViable: null,
        history: ["Started"],
        cardMemory: {},
        closureBridgeShown: false,
        lastSession: null,
        activeLayerId: null,
        activeLayerKind: null,
        ...overrides,
    };
}

describe("cardsEngine", () => {
    it("keeps FLOW through mid progress when the session is stable", () => {
        const session = makeSession({ intention: "Ship parser" });
        const block = makeBlock();

        const earlyContext = buildFocusContext({
            session,
            blocks: [block],
            now: new Date("2026-03-15T20:05:00.000Z").getTime(),
        })!;
        const midContext = buildFocusContext({
            session,
            blocks: [block],
            now: new Date("2026-03-15T20:10:00.000Z").getTime(),
        })!;

        expect(detectSessionState(earlyContext)).toBe(SessionState.FLOW);
        expect(detectSessionState(midContext)).toBe(SessionState.FLOW);
        expect(evaluateFocusContext(midContext).visibleCards.some((card) => card.id === "card_lock_in_focus")).toBe(true);
        expect(evaluateFocusContext(midContext).visibleCards.some((card) => card.id === "card_progress_check")).toBe(false);
    });

    it("shows closure bridge in the final phase and suppresses competing cards", () => {
        const result = evaluateFocusContext(makeContext({
            sessionProgress: 0.92,
            elapsedMs: 18.5 * 60 * 1000,
            recentStabilityMs: 8 * 60 * 1000,
            nextStep: null,
        }));

        expect(result.visibleCards.some((card) => card.id === "card_closure_bridge")).toBe(true);
        expect(result.visibleCards.some((card) => card.id === "card_lock_in_focus")).toBe(false);
        expect(result.visibleCards.some((card) => card.id === "card_progress_check")).toBe(false);
        expect(result.visibleCards.some((card) => card.id === "card_next_step")).toBe(false);
    });

    it("does not show closure bridge before the final phase", () => {
        const result = evaluateFocusContext(makeContext({
            sessionProgress: 0.89,
            elapsedMs: 17 * 60 * 1000,
            recentStabilityMs: 8 * 60 * 1000,
        }));

        expect(result.visibleCards.some((card) => card.id === "card_closure_bridge")).toBe(false);
    });

    it("does not re-show closure bridge once it already appeared in the session", () => {
        const result = evaluateFocusContext(makeContext({
            sessionProgress: 0.94,
            elapsedMs: 19 * 60 * 1000,
            closureBridgeShown: true,
            cardMemory: {
                card_closure_bridge: {
                    cardId: "card_closure_bridge",
                    shownAt: NOW - 10_000,
                    lastShownAt: NOW - 10_000,
                    timesShown: 1,
                    cooldownUntil: null,
                },
            },
        }));

        expect(result.visibleCards.some((card) => card.id === "card_closure_bridge")).toBe(false);
    });

    it("recovers from historical friction once the session is stable again", () => {
        const context = makeContext({
            pauses: 3,
            overlayExits: 2,
            sessionProgress: 0.35,
            elapsedMs: 7 * 60 * 1000,
            recentPauseCount: 0,
            recentExitCount: 0,
            recentStabilityMs: 7 * 60 * 1000,
        });

        expect(detectSessionState(context)).toBe(SessionState.FLOW);
        expect(evaluateFocusContext(context).visibleCards.some((card) => card.id === "card_lock_in_focus")).toBe(true);
    });

    it("detects silent slow start without requiring an explicit pause", () => {
        const context = makeContext({
            intention: null,
            nextStep: null,
            minimumViable: null,
            sessionProgress: 0.12,
            elapsedMs: 3 * 60 * 1000,
            recentInteractionWindowMs: 3 * 60 * 1000,
            recentStabilityMs: 3 * 60 * 1000,
            startDelayMs: 3 * 60 * 1000,
        });

        expect(detectSessionState(context)).toBe(SessionState.SLOW_START);
        expect(evaluateFocusContext(context).visibleCards.some((card) => card.id === "card_micro_commit")).toBe(true);
    });

    it("does not classify intentional rest as friction", () => {
        const context = makeContext({
            sessionProgress: 0.2,
            elapsedMs: 4 * 60 * 1000,
            pauses: 0,
            restPauses: 1,
            lastPauseReason: "manual_rest",
            recentPauseCount: 0,
            recentExitCount: 0,
            recentStabilityMs: 4 * 60 * 1000,
            intention: "Stay on task",
        });

        expect(detectSessionState(context)).toBe(SessionState.NORMAL_FLOW);
    });

    it("does not show closure bridge in distracted final states", () => {
        const context = makeContext({
            sessionProgress: 0.95,
            elapsedMs: 19 * 60 * 1000,
            recentExitCount: 2,
            recentStabilityMs: 60 * 1000,
        });

        expect(detectSessionState(context)).toBe(SessionState.DISTRACTED);
        expect(evaluateFocusContext(context).visibleCards.some((card) => card.id === "card_closure_bridge")).toBe(false);
    });

    it("resolves conflicting friction cards to the higher-priority recovery card", () => {
        const context = makeContext({
            pauses: 2,
            overlayExits: 1,
            recentPauseCount: 1,
            recentExitCount: 1,
            recentStabilityMs: 60 * 1000,
            sessionProgress: 0.3,
            elapsedMs: 6 * 60 * 1000,
        });

        const result = evaluateFocusContext(context);

        expect(detectSessionState(context)).toBe(SessionState.FRICTION);
        expect(result.visibleCards.some((card) => card.id === "card_reset_clarity")).toBe(true);
        expect(result.visibleCards.some((card) => card.id === "card_reduce_scope")).toBe(false);
    });

    it("keeps toast priority and actions intact", () => {
        const context = makeContext({
            sessionProgress: 0.95,
            elapsedMs: 19 * 60 * 1000,
            pauses: 1,
            lastPauseReason: "manual_pause",
        });

        const result = evaluateFocusContext(context, "es");
        const topToast = result.toastCards[0];

        expect(topToast.id).toBe("toast_near_end");
        expect(topToast.action?.label).toBe("Extender 5 min");
        expect(topToast.secondaryAction?.label).toBe("Finalizar");
    });

    it("offers closure bridge on manual finish once the session is close enough to the end", () => {
        const context = makeContext({
            sessionProgress: 0.78,
            elapsedMs: 16 * 60 * 1000,
            recentStabilityMs: 6 * 60 * 1000,
        });

        expect(shouldOfferClosureBridgeOnFinish(context, detectSessionState(context))).toBe(true);
    });

    it("falls back to the next eligible toast when the top one is suppressed", () => {
        const result = evaluateFocusContext(makeContext({
            blockType: "study",
            sessionProgress: 0.95,
            elapsedMs: 19 * 60 * 1000,
            cardMemory: {
                toast_near_end: {
                    cardId: "toast_near_end",
                    shownAt: NOW - 1000,
                    lastShownAt: NOW - 1000,
                    dismissedAt: NOW - 1000,
                    cooldownUntil: NOW + 60 * 1000,
                    timesShown: 1,
                },
            },
        }));

        expect(result.toastCards[0]?.id).toBe("toast_active_recall_late");
    });

    it("excludes progress_check once it already showed in the same session", () => {
        const result = evaluateFocusContext(makeContext({
            sessionProgress: 0.5,
            recentStabilityMs: 0,
            cardMemory: {
                card_progress_check: {
                    cardId: "card_progress_check",
                    shownAt: NOW - 1000,
                    lastShownAt: NOW - 1000,
                    timesShown: 1,
                    cooldownUntil: null,
                },
            },
        }));

        expect(detectSessionState(makeContext({
            sessionProgress: 0.5,
            recentStabilityMs: 0,
        }))).toBe(SessionState.MID_PROGRESS);
        expect(result.visibleCards.some((card) => card.id === "card_progress_check")).toBe(false);
    });

    it("does not suggest next_step when the session already has an operational first step", () => {
        const result = evaluateFocusContext(makeContext({
            sessionProgress: 0.25,
            nextStep: "Open parser.ts and write the tokenizer",
        }));

        expect(result.visibleCards.some((card) => card.id === "card_next_step")).toBe(false);
    });

    it("keeps free focus inside the real pipeline with limits and memory suppression", () => {
        const result = evaluateFocusContext(makeContext({
            mode: "free",
            blockType: undefined,
            intention: "Explore ideas",
            nextStep: null,
            sessionProgress: 0.22,
            elapsedMs: 6 * 60 * 1000,
            recentStabilityMs: 0,
            cardMemory: {
                card_gym_mode: {
                    cardId: "card_gym_mode",
                    shownAt: NOW - 1000,
                    lastShownAt: NOW - 1000,
                    acceptedAt: NOW - 1000,
                    cooldownUntil: NOW + 10 * 60 * 1000,
                    timesShown: 1,
                },
            },
        }));

        expect(detectSessionState(makeContext({
            mode: "free",
            blockType: undefined,
            intention: "Explore ideas",
            nextStep: null,
            sessionProgress: 0.22,
            elapsedMs: 6 * 60 * 1000,
            recentStabilityMs: 0,
        }))).toBe(SessionState.NORMAL_FLOW);
        expect(result.visibleCards.length).toBeLessThanOrEqual(4);
        expect(result.visibleCards.some((card) => card.id === "card_study_technique")).toBe(true);
        expect(result.visibleCards.some((card) => card.id === "card_gym_mode")).toBe(false);
        expect(result.visibleCards.some((card) => card.id === "card_micro_commit")).toBe(false);
    });
});
