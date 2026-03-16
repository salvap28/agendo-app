import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useFocusStore } from "@/lib/stores/focusStore";
import { FocusSession } from "@/lib/types/focus";

const { createClientMock, getClientUserMock } = vi.hoisted(() => ({
    createClientMock: vi.fn(),
    getClientUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
    createClient: createClientMock,
    getClientUser: getClientUserMock,
}));

function createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

describe("focusStore", () => {
    const originalUpdateBlock = useBlocksStore.getState().updateBlock;

    beforeEach(() => {
        localStorage.clear();
        useFocusStore.setState({
            session: null,
            lastSession: null,
            intervention: null,
            interventions: [],
        });
        useBlocksStore.setState({
            blocks: [],
            isLoaded: false,
            updateBlock: originalUpdateBlock,
        });
        createClientMock.mockReset();
        getClientUserMock.mockReset();
        getClientUserMock.mockResolvedValue({ id: "user-1" });
        createClientMock.mockImplementation(() => ({
            from: () => ({
                insert: vi.fn().mockResolvedValue({ error: null }),
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                }),
            }),
        }));
    });

    afterEach(() => {
        useFocusStore.setState({
            session: null,
            lastSession: null,
            intervention: null,
            interventions: [],
        });
        useBlocksStore.setState({
            updateBlock: originalUpdateBlock,
        });
    });

    it("reuses a paused block session instead of reactivating the entry ritual", () => {
        const pausedSession: FocusSession = {
            id: "session-1",
            mode: "block",
            blockId: "block-1",
            blockType: "deep_work",
            startedAt: "2026-03-15T20:00:00.000Z",
            isActive: false,
            isPaused: true,
            pausedAt: "2026-03-15T20:10:00.000Z",
            totalPausedMs: 120000,
            pauseCount: 1,
            exitCount: 1,
            restCount: 0,
            lastPauseReason: "manual_pause",
            intention: "Ship the parser",
            nextStep: "Open parser.ts and write the tokenizer",
            history: ["Paused"],
            cardMemory: {},
            entryRitual: {
                isActive: false,
                completed: true,
                skipped: false,
                objective: "Ship the parser",
                nextStep: "Open parser.ts and write the tokenizer",
                minimumViable: null,
                suggestedStartMode: "normal",
                selectedStartMode: "normal",
                startedAt: Date.now() - 30000,
                completedAt: Date.now() - 25000,
            },
            persistenceStatus: "draft",
        };

        useFocusStore.setState({ session: pausedSession });

        useFocusStore.getState().openFromBlock("block-1", "deep_work");

        const session = useFocusStore.getState().session;
        expect(session?.id).toBe("session-1");
        expect(session?.isActive).toBe(true);
        expect(session?.isPaused).toBe(true);
        expect(session?.entryRitual?.isActive).toBe(false);
        expect(session?.history).toContain("Returned to overlay via block");
    });

    it("activates entry ritual for a brand new block session", () => {
        useFocusStore.getState().openFromBlock("block-entry", "study");

        const session = useFocusStore.getState().session;
        expect(session?.entryRitual?.isActive).toBe(true);
        expect(session?.entryRitual?.completed).toBe(false);
        expect(session?.entryRitual?.suggestedStartMode).toBe("study_technique");
        expect(useFocusStore.getState().interventions.some((record) => record.type === "entry_ritual_shown")).toBe(true);
    });

    it("completes the ritual and activates the chosen micro commit start mode", () => {
        useFocusStore.getState().openFromBlock("block-entry", "deep_work");
        useFocusStore.getState().updateEntryRitual({
            objective: "Cerrar la estructura del documento",
            nextStep: "Abrir el doc y escribir el primer encabezado",
            selectedStartMode: "micro_commit",
        });

        const startedBefore = useFocusStore.getState().session?.startedAt;
        useFocusStore.getState().completeEntryRitual();

        const session = useFocusStore.getState().session;
        expect(session?.entryRitual?.isActive).toBe(false);
        expect(session?.entryRitual?.completed).toBe(true);
        expect(session?.intention).toBe("Cerrar la estructura del documento");
        expect(session?.nextStep).toBe("Abrir el doc y escribir el primer encabezado");
        expect(session?.activeLayer?.id).toBe("micro_commit_layer");
        expect(session?.startedAt).not.toBe(startedBefore);
        expect(useFocusStore.getState().interventions.some((record) => record.type === "entry_ritual_completed")).toBe(true);
    });

    it("skips the ritual without leaving pause or exit state inconsistent", () => {
        useFocusStore.getState().openFree();
        useFocusStore.getState().skipEntryRitual();

        const session = useFocusStore.getState().session;
        expect(session?.entryRitual?.isActive).toBe(false);
        expect(session?.entryRitual?.skipped).toBe(true);
        expect(session?.isPaused).toBe(false);
        expect(session?.lastPauseReason).toBe(null);
        expect(useFocusStore.getState().interventions.some((record) => record.type === "entry_ritual_skipped")).toBe(true);
    });

    it("keeps the ritual recoverable when the user exits before completing it", () => {
        useFocusStore.getState().openFromBlock("block-exit", "deep_work");
        useFocusStore.getState().exit();

        const exitedSession = useFocusStore.getState().session;
        expect(exitedSession?.isActive).toBe(false);
        expect(exitedSession?.isPaused).toBe(false);
        expect(exitedSession?.exitCount).toBe(0);
        expect(exitedSession?.entryRitual?.isActive).toBe(true);

        useFocusStore.getState().openFromBlock("block-exit", "deep_work");

        const resumedSession = useFocusStore.getState().session;
        expect(resumedSession?.id).toBe(exitedSession?.id);
        expect(resumedSession?.entryRitual?.isActive).toBe(true);
        expect(resumedSession?.history).toContain("Returned to entry ritual via block");
    });

    it("marks the linked block as completed when a block focus session finishes", async () => {
        const updateBlockMock = vi.fn().mockResolvedValue(undefined);
        const typedUpdateBlockMock: typeof originalUpdateBlock = updateBlockMock;

        useBlocksStore.setState({
            updateBlock: typedUpdateBlockMock,
        });
        useFocusStore.setState({
            session: {
                id: "session-2",
                mode: "block",
                blockId: "block-2",
                blockType: "study",
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
            },
        });

        await useFocusStore.getState().finish();

        expect(updateBlockMock).toHaveBeenCalledWith("block-2", { status: "completed" });
        expect(useFocusStore.getState().session?.endedAt).toBeTruthy();
        expect(useFocusStore.getState().lastSession?.id).toBe("session-2");
        expect(useFocusStore.getState().session?.persistenceStatus).toBe("persisted");
    });

    it("does not count intentional rest as friction pause", () => {
        useFocusStore.setState({
            session: {
                id: "session-rest",
                mode: "block",
                blockId: "block-rest",
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
            },
        });

        useFocusStore.getState().pause({ reason: "manual_rest" });

        const session = useFocusStore.getState().session;
        expect(session?.pauseCount).toBe(0);
        expect(session?.restCount).toBe(1);
        expect(session?.lastPauseReason).toBe("manual_rest");
    });

    it("keeps reflection locked until finish persistence resolves", async () => {
        const deferredInsert = createDeferred<{ error: null }>();
        getClientUserMock.mockResolvedValue({ id: "user-1" });
        createClientMock.mockImplementation(() => ({
            from: () => ({
                insert: vi.fn().mockReturnValue(deferredInsert.promise),
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                }),
            }),
        }));

        useFocusStore.setState({
            session: {
                id: "session-persist",
                mode: "block",
                blockId: "block-persist",
                blockType: "study",
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
            },
        });

        const finishPromise = useFocusStore.getState().finish();

        expect(useFocusStore.getState().session?.endedAt).toBeTruthy();
        expect(useFocusStore.getState().session?.persistenceStatus).toBe("pending");

        deferredInsert.resolve({ error: null });
        await finishPromise;

        expect(useFocusStore.getState().session?.persistenceStatus).toBe("persisted");
    });

    it("stores structured intervention records on resolve", () => {
        useFocusStore.setState({
            session: {
                id: "session-int",
                mode: "block",
                blockId: "block-int",
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
            },
        });

        useFocusStore.getState().openIntervention("reduce_scope", {
            sourceCard: "card_reduce_scope",
            trigger: "card_action",
            payload: { intention: "Write spec" },
        });
        useFocusStore.getState().resolveIntervention({
            actionTaken: "work_5_minutes",
            result: "micro_commit_started",
        });

        const record = useFocusStore.getState().interventions[0];
        expect(record.type).toBe("reduce_scope");
        expect(record.sourceCard).toBe("card_reduce_scope");
        expect(record.actionTaken).toBe("work_5_minutes");
        expect(record.result).toBe("micro_commit_started");
    });

    it("stores closure bridge note as lightweight session memory", () => {
        useFocusStore.setState({
            session: {
                id: "session-closure",
                mode: "block",
                blockId: "block-closure",
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
            },
        });

        useFocusStore.getState().saveClosureNote("Termine el algoritmo y deje listo el siguiente paso");

        expect(useFocusStore.getState().session?.closureNote?.text).toBe("Termine el algoritmo y deje listo el siguiente paso");
    });

    it("marks closure bridge as shown when the card reaches real exposure", () => {
        useFocusStore.setState({
            session: {
                id: "session-closure-card",
                mode: "block",
                blockId: "block-closure",
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
            },
        });

        useFocusStore.getState().markCardShown("card_closure_bridge");

        expect(useFocusStore.getState().session?.closureBridgeShown).toBe(true);
    });
});
