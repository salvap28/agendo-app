import {
    createEntryRitualState,
    getSuggestedEntryStartMode,
    isEntryRitualBlockingRuntime,
    resolveEntryStartLayer,
} from "@/lib/engines/focusEntryRitual";
import { Block } from "@/lib/types/blocks";
import { FocusSession, FocusSessionSummary } from "@/lib/types/focus";

function makeSession(overrides: Partial<FocusSession> = {}): FocusSession {
    return {
        id: "session-entry",
        mode: "block",
        blockId: "block-1",
        blockType: "deep_work",
        startedAt: "2026-03-16T12:00:00.000Z",
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

function makeBlock(overrides: Partial<Block> = {}): Block {
    return {
        id: "block-1",
        title: "Deep work block",
        type: "deep_work",
        status: "planned",
        startAt: new Date("2026-03-16T12:00:00.000Z"),
        endAt: new Date("2026-03-16T13:00:00.000Z"),
        ...overrides,
    };
}

describe("focusEntryRitual", () => {
    it("suggests study technique for study blocks without an active study layer", () => {
        const session = makeSession({ blockType: "study" });

        expect(getSuggestedEntryStartMode({
            session,
            blocks: [makeBlock({ type: "study" })],
            lastSession: null,
        })).toBe("study_technique");
    });

    it("prefills objective and next step from a recent compatible session", () => {
        const session = makeSession({ blockType: "admin" });
        const lastSession: FocusSessionSummary = {
            id: "last-1",
            blockType: "admin",
            intention: "Ordenar los pendientes del dia",
            nextStep: "Abrir la bandeja y responder los dos mails urgentes",
            endedAt: "2026-03-16T10:00:00.000Z",
            age: 60 * 60 * 1000,
        };

        const ritual = createEntryRitualState({
            session,
            blocks: [makeBlock({ type: "admin", title: "Admin block" })],
            lastSession,
            now: Date.now(),
        });

        expect(ritual.objective).toBe("Ordenar los pendientes del dia");
        expect(ritual.nextStep).toBe("Abrir la bandeja y responder los dos mails urgentes");
    });

    it("suggests micro commit when the recent compatible session had weak continuity", () => {
        const session = makeSession({ blockType: "deep_work" });
        const lastSession: FocusSessionSummary = {
            id: "last-weak",
            blockType: "deep_work",
            intention: "Escribir la propuesta",
            nextStep: null,
            endedAt: "2026-03-16T11:00:00.000Z",
            age: 30 * 60 * 1000,
        };

        expect(getSuggestedEntryStartMode({
            session,
            blocks: [makeBlock()],
            lastSession,
        })).toBe("micro_commit");
    });

    it("activates the matching layer when a special start mode is selected", () => {
        const session = makeSession({ blockType: "study" });
        const blocks = [makeBlock({ type: "study" })];

        const studyLayer = resolveEntryStartLayer(session, blocks, "study_technique");
        const microCommitLayer = resolveEntryStartLayer(session, blocks, "micro_commit");

        expect(studyLayer?.kind).toBe("studyTechnique");
        expect(microCommitLayer?.id).toBe("micro_commit_layer");
    });

    it("blocks the runtime while the ritual remains active", () => {
        expect(isEntryRitualBlockingRuntime({
            endedAt: undefined,
            entryRitual: {
                isActive: true,
                completed: false,
                skipped: false,
                objective: null,
                nextStep: null,
                minimumViable: null,
                suggestedStartMode: "normal",
                selectedStartMode: "normal",
                startedAt: Date.now(),
                completedAt: null,
            },
        })).toBe(true);

        expect(isEntryRitualBlockingRuntime({
            endedAt: undefined,
            entryRitual: {
                isActive: false,
                completed: true,
                skipped: false,
                objective: "Ship it",
                nextStep: "Open the doc",
                minimumViable: null,
                suggestedStartMode: "normal",
                selectedStartMode: "normal",
                startedAt: Date.now(),
                completedAt: Date.now(),
            },
        })).toBe(false);
    });
});
