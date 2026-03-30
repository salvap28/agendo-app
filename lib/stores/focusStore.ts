import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    AttentionAidConfig,
    ClosureNote,
    FocusCardMemory,
    FocusEntryRitualState,
    FocusIntervention,
    FocusInterventionKind,
    FocusInterventionRecord,
    FocusEntryStartMode,
    FocusLayer,
    FocusPauseReason,
    FocusRuntimeState,
    FocusSession,
    FocusSessionEvent,
    FocusSessionEventType,
    FocusSessionSummary,
    GymExerciseLog,
    GymLayerConfig,
    GymSet,
    WorkoutRoutine
} from '@/lib/types/focus';
import { createGymLayer } from '@/lib/engines/layersEngine';
import {
    createEntryRitualState,
    createLegacyEntryRitualState,
    resolveEntryStartLayer,
} from '@/lib/engines/focusEntryRitual';
import { getFocusPlannedDurationMs } from '@/lib/engines/focusContext';
import { useBlocksStore } from '@/lib/stores/blocksStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { BlockType } from '@/lib/types/blocks';
import { focusCardCooldowns } from '@/lib/engines/cardsEngine';
import { persistCompletedSession, syncActiveSession } from '@/lib/services/focusService';
import { resolveSessionClosureType } from '@/lib/engines/personalIntelligence/sessionAnalytics';

type StudyTechniqueLayerConfig = {
    state?: {
        phaseStartedAt?: string | null;
    };
} & Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeGymConfig(config: unknown): GymLayerConfig {
    const rawConfig = isRecord(config) ? config : {};
    const rawRest = isRecord(rawConfig.rest) ? rawConfig.rest : {};

    return {
        workoutName: typeof rawConfig.workoutName === 'string' ? rawConfig.workoutName : null,
        workoutColor: typeof rawConfig.workoutColor === 'string' ? rawConfig.workoutColor : null,
        activeRoutineId: typeof rawConfig.activeRoutineId === 'string' ? rawConfig.activeRoutineId : null,
        exercises: Array.isArray(rawConfig.exercises) ? (rawConfig.exercises as GymExerciseLog[]) : [],
        activeExerciseId: typeof rawConfig.activeExerciseId === 'string' ? rawConfig.activeExerciseId : null,
        rest: {
            isResting: rawRest.isResting === true,
            selectedSec: typeof rawRest.selectedSec === 'number' ? rawRest.selectedSec : undefined,
            restStartedAt: typeof rawRest.restStartedAt === 'string' ? rawRest.restStartedAt : null,
        }
    };
}

function normalizeStudyTechniqueConfig(config: unknown): StudyTechniqueLayerConfig {
    if (!isRecord(config)) return {};
    const rawState = isRecord(config.state) ? config.state : undefined;

    return {
        ...config,
        state: rawState
            ? {
                ...rawState,
                phaseStartedAt: typeof rawState.phaseStartedAt === 'string' ? rawState.phaseStartedAt : null,
            }
            : undefined,
    };
}

function normalizeAttentionAidConfig(config: unknown): AttentionAidConfig {
    if (!isRecord(config)) return {};

    return {
        ...config,
        startedAt: typeof config.startedAt === 'string' ? config.startedAt : null,
        durationSec: typeof config.durationSec === 'number' ? config.durationSec : undefined,
        compact: typeof config.compact === 'boolean' ? config.compact : undefined,
    };
}

function normalizeEntryRitualState(
    entryRitual: unknown,
    session: Pick<FocusSession, "intention" | "nextStep" | "minimumViable">
): FocusEntryRitualState {
    if (!isRecord(entryRitual)) {
        return createLegacyEntryRitualState(session);
    }

    return {
        isActive: entryRitual.isActive === true,
        completed: entryRitual.completed === true,
        skipped: entryRitual.skipped === true,
        objective: typeof entryRitual.objective === 'string' ? entryRitual.objective : session.intention ?? null,
        nextStep: typeof entryRitual.nextStep === 'string' ? entryRitual.nextStep : session.nextStep ?? null,
        minimumViable: typeof entryRitual.minimumViable === 'string' ? entryRitual.minimumViable : session.minimumViable ?? null,
        suggestedStartMode: typeof entryRitual.suggestedStartMode === 'string'
            ? entryRitual.suggestedStartMode as FocusEntryStartMode
            : null,
        selectedStartMode: typeof entryRitual.selectedStartMode === 'string'
            ? entryRitual.selectedStartMode as FocusEntryStartMode
            : null,
        startedAt: typeof entryRitual.startedAt === 'number' ? entryRitual.startedAt : null,
        completedAt: typeof entryRitual.completedAt === 'number' ? entryRitual.completedAt : null,
    };
}

function normalizeFocusSessionEvents(events: unknown, sessionId: string): FocusSessionEvent[] {
    if (!Array.isArray(events)) return [];

    return events
        .filter((event): event is Record<string, unknown> => isRecord(event))
        .map((event) => ({
            id: typeof event.id === 'string' ? event.id : crypto.randomUUID(),
            sessionId: typeof event.sessionId === 'string' ? event.sessionId : sessionId,
            type: typeof event.type === 'string' ? event.type as FocusSessionEventType : "session_started",
            runtimeState: typeof event.runtimeState === 'string' ? event.runtimeState as FocusRuntimeState : "entry",
            timestamp: typeof event.timestamp === 'string' ? event.timestamp : new Date().toISOString(),
            relativeMs: typeof event.relativeMs === 'number' ? event.relativeMs : 0,
            payload: isRecord(event.payload) ? event.payload : undefined,
        }));
}

function normalizeFocusSession(session: unknown): FocusSession | null {
    if (!isRecord(session)) return null;

    const rawSession = session as Partial<FocusSession>;
    let activeLayer = rawSession.activeLayer;

    if (activeLayer?.kind === "gymMode") {
        activeLayer = {
            ...activeLayer,
            config: normalizeGymConfig(activeLayer.config),
        };
    } else if (activeLayer?.kind === "studyTechnique") {
        activeLayer = {
            ...activeLayer,
            config: normalizeStudyTechniqueConfig(activeLayer.config),
        };
    } else if (activeLayer?.kind === "attentionAid") {
        activeLayer = {
            ...activeLayer,
            config: normalizeAttentionAidConfig(activeLayer.config),
        };
    }

    const normalizedSession: FocusSession = {
        id: typeof rawSession.id === 'string' ? rawSession.id : crypto.randomUUID(),
        mode: rawSession.mode === "free" ? "free" : "block",
        blockId: typeof rawSession.blockId === 'string' ? rawSession.blockId : undefined,
        blockType: rawSession.blockType,
        initiatedAt: typeof rawSession.initiatedAt === 'string' ? rawSession.initiatedAt : undefined,
        consolidatedAt: typeof rawSession.consolidatedAt === 'string' ? rawSession.consolidatedAt : undefined,
        startedAt: typeof rawSession.startedAt === 'string' ? rawSession.startedAt : new Date().toISOString(),
        endedAt: typeof rawSession.endedAt === 'string' ? rawSession.endedAt : undefined,
        plannedDurationMs: typeof rawSession.plannedDurationMs === 'number' ? rawSession.plannedDurationMs : undefined,
        isActive: rawSession.isActive === true,
        isPaused: rawSession.isPaused === true,
        pausedAt: typeof rawSession.pausedAt === 'string' ? rawSession.pausedAt : undefined,
        totalPausedMs: typeof rawSession.totalPausedMs === 'number' ? rawSession.totalPausedMs : 0,
        pauseCount: typeof rawSession.pauseCount === 'number' ? rawSession.pauseCount : 0,
        exitCount: typeof rawSession.exitCount === 'number' ? rawSession.exitCount : 0,
        restCount: typeof rawSession.restCount === 'number' ? rawSession.restCount : 0,
        lastPauseReason: rawSession.lastPauseReason ?? null,
        pauseEvents: Array.isArray(rawSession.pauseEvents)
            ? rawSession.pauseEvents.filter((value): value is number => typeof value === 'number')
            : [],
        exitEvents: Array.isArray(rawSession.exitEvents)
            ? rawSession.exitEvents.filter((value): value is number => typeof value === 'number')
            : [],
        firstInteractionAt: typeof rawSession.firstInteractionAt === 'string' ? rawSession.firstInteractionAt : undefined,
        lastInteractionAt: typeof rawSession.lastInteractionAt === 'string' ? rawSession.lastInteractionAt : undefined,
        intention: typeof rawSession.intention === 'string' ? rawSession.intention : undefined,
        nextStep: typeof rawSession.nextStep === 'string' ? rawSession.nextStep : undefined,
        minimumViable: typeof rawSession.minimumViable === 'string' ? rawSession.minimumViable : undefined,
        energyBefore: rawSession.energyBefore,
        moodBefore: rawSession.moodBefore,
        moodAfter: rawSession.moodAfter,
        progressFeelingAfter: rawSession.progressFeelingAfter,
        difficulty: rawSession.difficulty,
        clarity: rawSession.clarity,
        startDelayMs: rawSession.startDelayMs,
        previousContext: rawSession.previousContext,
        sessionQualityScore: rawSession.sessionQualityScore,
        activeLayer: activeLayer ?? null,
        history: Array.isArray(rawSession.history) ? rawSession.history : [],
        cardMemory: isRecord(rawSession.cardMemory) ? rawSession.cardMemory as Record<string, FocusCardMemory> : {},
        closureBridgeShown: rawSession.closureBridgeShown === true,
        closureNote: isRecord(rawSession.closureNote) && typeof rawSession.closureNote.text === 'string' && typeof rawSession.closureNote.timestamp === 'number'
            ? rawSession.closureNote as ClosureNote
            : null,
        runtimeState: typeof rawSession.runtimeState === 'string' ? rawSession.runtimeState as FocusRuntimeState : "entry",
        events: normalizeFocusSessionEvents(rawSession.events, typeof rawSession.id === 'string' ? rawSession.id : crypto.randomUUID()),
        inactivityStartedAt: typeof rawSession.inactivityStartedAt === 'string' ? rawSession.inactivityStartedAt : null,
        persistenceStatus: rawSession.persistenceStatus ?? "draft",
        entryRitual: normalizeEntryRitualState(rawSession.entryRitual, {
            intention: typeof rawSession.intention === 'string' ? rawSession.intention : undefined,
            nextStep: typeof rawSession.nextStep === 'string' ? rawSession.nextStep : undefined,
            minimumViable: typeof rawSession.minimumViable === 'string' ? rawSession.minimumViable : undefined,
        }),
    };

    return normalizedSession;
}

function getCardMemoryKey(cardId: string) {
    if (cardId.startsWith('toast_active_recall_')) return 'toast_active_recall';
    return cardId;
}

function getOutcomeCooldownMs(cardId: string, outcome: "accepted" | "dismissed" | "rejected") {
    const policy = focusCardCooldowns[getCardMemoryKey(cardId) as keyof typeof focusCardCooldowns];
    if (!policy) return null;
    return policy[outcome] ?? null;
}

function updateCardMemoryEntry(
    existingMemory: Record<string, FocusCardMemory> | undefined,
    cardId: string,
    updater: (current: FocusCardMemory | null) => FocusCardMemory
) {
    const key = getCardMemoryKey(cardId);
    const current = existingMemory?.[key] ?? null;

    return {
        ...(existingMemory || {}),
        [key]: updater(current),
    };
}

function createRuntimeStartedAt(previousStartedAt?: string) {
    const now = Date.now();
    const previousMs = previousStartedAt ? new Date(previousStartedAt).getTime() : 0;
    return new Date(Math.max(now, previousMs + 1)).toISOString();
}

const MAX_SESSION_EVENT_HISTORY = 20;

function appendSessionEvent(events: number[] | undefined, timestamp: number) {
    return [...(events ?? []), timestamp].slice(-MAX_SESSION_EVENT_HISTORY);
}

function noteSessionInteraction(session: FocusSession, timestamp = Date.now()) {
    const isoTimestamp = new Date(timestamp).toISOString();

    return {
        firstInteractionAt: session.firstInteractionAt ?? isoTimestamp,
        lastInteractionAt: isoTimestamp,
        startDelayMs: session.startDelayMs ?? Math.max(0, timestamp - new Date(session.startedAt).getTime()),
    };
}

function resetRuntimeInteractionState() {
    return {
        pauseEvents: [] as number[],
        exitEvents: [] as number[],
        firstInteractionAt: undefined,
        lastInteractionAt: undefined,
        startDelayMs: undefined,
    };
}

const MAX_RAW_SESSION_EVENTS = 300;

function getEventBaseTimestamp(session: FocusSession) {
    return new Date(session.initiatedAt ?? session.startedAt).getTime();
}

function appendRuntimeEvent(
    session: FocusSession,
    type: FocusSessionEventType,
    runtimeState: FocusRuntimeState,
    timestamp = Date.now(),
    payload?: Record<string, unknown>
): FocusSession {
    const isoTimestamp = new Date(timestamp).toISOString();
    const event: FocusSessionEvent = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        type,
        runtimeState,
        timestamp: isoTimestamp,
        relativeMs: Math.max(0, timestamp - getEventBaseTimestamp(session)),
        payload,
    };

    return {
        ...session,
        runtimeState,
        events: [...(session.events ?? []), event].slice(-MAX_RAW_SESSION_EVENTS),
    };
}

// ── Local storage helpers ──────────────────────────────────────────────────

const GYM_LAST_KEY = 'agendo:gym:exerciseLast';
const GYM_RECENT_KEY = 'agendo:gym:recentExercises';

function getGymLastMap(): Record<string, { weight: number; reps: number; at: string }> {
    try { return JSON.parse(localStorage.getItem(GYM_LAST_KEY) || '{}'); } catch { return {}; }
}
function setGymLastMap(map: Record<string, { weight: number; reps: number; at: string }>) {
    localStorage.setItem(GYM_LAST_KEY, JSON.stringify(map));
}

export function getGymLast(exerciseName: string) {
    return getGymLastMap()[exerciseName.toLowerCase()] ?? null;
}

export function getGymRecentExercises(): string[] {
    try { return JSON.parse(localStorage.getItem(GYM_RECENT_KEY) || '[]'); } catch { return []; }
}

function addGymRecentExercise(name: string) {
    const recent = getGymRecentExercises().filter(n => n.toLowerCase() !== name.toLowerCase());
    localStorage.setItem(GYM_RECENT_KEY, JSON.stringify([name, ...recent].slice(0, 20)));
}

// ── Store interface ────────────────────────────────────────────────────────

interface FocusState {
    session: FocusSession | null;
    lastSession: FocusSessionSummary | null;
    intervention: FocusIntervention | null;
    interventions: FocusInterventionRecord[];

    // General
    openFromBlock: (blockId: string, blockType: BlockType) => void;
    openFree: () => void;
    pause: (options?: { reason?: FocusPauseReason }) => void;
    resume: () => void;
    exit: () => void;
    returnToFocus: () => void;
    finish: () => Promise<void>;
    dangerouslyInjectRemoteSession: (remoteSession: FocusSession) => void;
    extendBlock: (additionalMinutes: number) => void;
    setLayer: (layer: FocusLayer | null) => void;
    setSessionIntention: (intention: string) => void;
    setSessionNextStep: (nextStep: string) => void;
    setSessionMinimumViable: (minimumViable: string) => void;
    addToHistory: (event: string) => void;
    markClosureBridgeShown: () => void;
    saveClosureNote: (text: string, timestamp?: number) => void;
    markCardShown: (cardId: string, now?: number) => void;
    recordCardOutcome: (cardId: string, outcome: "accepted" | "dismissed" | "rejected", now?: number) => void;
    startEntryRitual: () => void;
    updateEntryRitual: (updates: Partial<FocusEntryRitualState>) => void;
    completeEntryRitual: () => void;
    skipEntryRitual: () => void;
    clearEntryRitual: () => void;
    openIntervention: (
        kind: FocusInterventionKind,
        options?: {
            payload?: Record<string, unknown>;
            sourceCard?: string | null;
            sourceToast?: string | null;
            trigger?: string | null;
        }
    ) => void;
    resolveIntervention: (resolution: {
        actionTaken: string;
        result: string;
        payload?: Record<string, unknown>;
    }) => void;
    closeIntervention: (result?: string) => void;
    recordIntervention: (record: {
        type: string;
        sourceCard?: string | null;
        sourceToast?: string | null;
        trigger?: string | null;
        actionTaken?: string | null;
        result?: string | null;
        payload?: Record<string, unknown>;
    }) => void;
    recordSessionInteraction: (source?: string, now?: number) => void;
    recordInactivityDetected: (source?: string) => void;
    recordStabilityRecovered: (source?: string) => void;

    // Gym tracker
    activateGymTracker: () => void;
    startGymWorkout: (routine: WorkoutRoutine) => void;
    addGymExercise: (name: string) => void;
    updateGymExercise: (exerciseId: string, updates: Partial<GymExerciseLog>) => void;
    selectGymExercise: (exerciseId: string) => void;
    addEmptyGymSet: (exerciseId: string) => void;
    updateGymSet: (exerciseId: string, setId: string, updates: Partial<GymSet>) => void;
    deleteGymSet: (exerciseId: string, setId: string) => void;
    undoLastGymSet: (exerciseId: string) => void;

    // Gym rest
    startGymRest: (selectedSec: number) => void;
    cancelGymRest: () => void;
    finishGymRest: () => void;
}

// ── Helper: get gym config safely ──────────────────────────────────────────

function getGymConfig(session: FocusSession | null): GymLayerConfig | null {
    if (!session?.activeLayer || session.activeLayer.kind !== 'gymMode') return null;
    return normalizeGymConfig(session.activeLayer.config);
}

function updateGymConfig(session: FocusSession, updater: (cfg: GymLayerConfig) => GymLayerConfig): FocusSession {
    const layer = session.activeLayer;
    if (!layer || layer.kind !== 'gymMode') return session;
    const safeCfg = normalizeGymConfig(layer.config);
    return {
        ...session,
        activeLayer: {
            ...layer,
            config: updater(safeCfg),
        },
    };
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useFocusStore = create<FocusState>()(
    persist(
        (set, get) => ({
            session: null,
            lastSession: null,
            intervention: null,
            interventions: [],

            openFromBlock: (blockId, blockType) => {
                const existingSession = get().session;

                if (
                    existingSession?.mode === "block" &&
                    existingSession.blockId === blockId &&
                    !existingSession.endedAt
                ) {
                    if (existingSession.isActive) return;

                    const resumedSession = appendRuntimeEvent(
                        {
                            ...existingSession,
                            isActive: true,
                            runtimeState: existingSession.entryRitual?.isActive ? "entry" : "stabilized",
                            history: [
                                ...(existingSession.history || []),
                                existingSession.entryRitual?.isActive
                                    ? 'Returned to entry ritual via block'
                                    : 'Returned to overlay via block'
                            ]
                        },
                        "session_returned",
                        existingSession.entryRitual?.isActive ? "entry" : "stabilized",
                        Date.now(),
                        { source: "block" }
                    );

                    set({
                        session: resumedSession
                    });
                    syncActiveSession(resumedSession);
                    return;
                }

                const now = new Date().toISOString();
                const nextSession = appendRuntimeEvent({
                    id: crypto.randomUUID(),
                    mode: "block",
                    blockId,
                    blockType,
                    initiatedAt: now,
                    startedAt: now,
                    isActive: true,
                    isPaused: false,
                    totalPausedMs: 0,
                    pauseCount: 0,
                    exitCount: 0,
                    restCount: 0,
                    lastPauseReason: null,
                    pauseEvents: [],
                    exitEvents: [],
                    firstInteractionAt: undefined,
                    lastInteractionAt: undefined,
                    history: ["Session started from block"],
                    activeLayer: undefined,
                    cardMemory: {},
                    closureBridgeShown: false,
                    closureNote: null,
                    runtimeState: "entry",
                    events: [],
                    inactivityStartedAt: null,
                    persistenceStatus: "draft",
                }, "session_started", "entry", Date.now(), {
                    source: "block",
                    blockType,
                });

                set({
                    session: nextSession
                });
                syncActiveSession(nextSession);
                get().startEntryRitual();
            },

            openFree: () => {
                const existingSession = get().session;
                if (existingSession?.mode === "free" && !existingSession.endedAt) {
                    if (existingSession.isActive) return;

                    const resumedSession = appendRuntimeEvent(
                        {
                            ...existingSession,
                            isActive: true,
                            runtimeState: existingSession.entryRitual?.isActive ? "entry" : "stabilized",
                            history: [
                                ...(existingSession.history || []),
                                existingSession.entryRitual?.isActive
                                    ? 'Returned to free entry ritual'
                                    : 'Returned to free focus',
                            ],
                        },
                        "session_returned",
                        existingSession.entryRitual?.isActive ? "entry" : "stabilized",
                        Date.now(),
                        { source: "free" }
                    );

                    set({
                        session: resumedSession
                    });
                    syncActiveSession(resumedSession);
                    return;
                }

                const now = new Date().toISOString();
                const nextSession = appendRuntimeEvent({
                    id: crypto.randomUUID(),
                    mode: "free",
                    initiatedAt: now,
                    startedAt: now,
                    isActive: true,
                    isPaused: false,
                    totalPausedMs: 0,
                    pauseCount: 0,
                    exitCount: 0,
                    restCount: 0,
                    lastPauseReason: null,
                    pauseEvents: [],
                    exitEvents: [],
                    firstInteractionAt: undefined,
                    lastInteractionAt: undefined,
                    history: ["Free session started"],
                    cardMemory: {},
                    closureBridgeShown: false,
                    closureNote: null,
                    runtimeState: "entry",
                    events: [],
                    inactivityStartedAt: null,
                    persistenceStatus: "draft",
                }, "session_started", "entry", Date.now(), {
                    source: "free",
                });

                set({
                    session: nextSession
                });
                syncActiveSession(nextSession);
                get().startEntryRitual();
            },

            pause: (options) => {
                const { session } = get();
                if (!session || session.isPaused) return;
                const reason = options?.reason ?? "manual_pause";
                const timestamp = Date.now();
                const interactionState = noteSessionInteraction(session, timestamp);
                const pausedAt = new Date(timestamp).toISOString();
                const nextSession = appendRuntimeEvent({
                    ...session,
                    isPaused: true,
                    pausedAt,
                    pauseCount: reason === "manual_pause" ? (session.pauseCount ?? 0) + 1 : (session.pauseCount ?? 0),
                    restCount: reason === "manual_rest" ? (session.restCount ?? 0) + 1 : (session.restCount ?? 0),
                    lastPauseReason: reason,
                    pauseEvents: reason === "manual_pause"
                        ? appendSessionEvent(session.pauseEvents, timestamp)
                        : session.pauseEvents ?? [],
                    ...interactionState,
                    history: [...(session.history || []), reason === "manual_rest" ? 'Rest started' : reason === "overlay_exit" ? 'Paused via exit' : 'Paused']
                }, "session_paused", reason === "manual_rest" ? "active" : "friction_detected", timestamp, {
                    reason,
                });

                set({
                    session: nextSession
                });
                syncActiveSession(nextSession);
            },

            resume: () => {
                const { session } = get();
                if (!session || !session.isPaused || !session.pausedAt) return;
                const now = new Date();
                const pausedAt = new Date(session.pausedAt);
                const pauseDurationMs = now.getTime() - pausedAt.getTime();
                const interactionState = noteSessionInteraction(session, now.getTime());
                const resumeState = session.lastPauseReason === "manual_rest" ? "active" : "stabilized";
                
                let activeLayer = session.activeLayer;
                    if (activeLayer) {
                        if (activeLayer.kind === 'studyTechnique' && activeLayer.config) {
                        const cfg = normalizeStudyTechniqueConfig(activeLayer.config);
                        if (cfg.state?.phaseStartedAt) {
                            const newPhaseStartedAt = new Date(new Date(cfg.state.phaseStartedAt).getTime() + pauseDurationMs).toISOString();
                            activeLayer = {
                                ...activeLayer,
                                config: {
                                    ...cfg,
                                    state: { ...cfg.state, phaseStartedAt: newPhaseStartedAt }
                                }
                            };
                        }
                    } else if (activeLayer.kind === 'gymMode' && activeLayer.config) {
                        const cfg = normalizeGymConfig(activeLayer.config);
                        if (cfg.rest.isResting && cfg.rest.restStartedAt) {
                            const newRestStartedAt = new Date(new Date(cfg.rest.restStartedAt).getTime() + pauseDurationMs).toISOString();
                            activeLayer = {
                                ...activeLayer,
                                config: {
                                    ...cfg,
                                    rest: { ...cfg.rest, restStartedAt: newRestStartedAt }
                                }
                            };
                        }
                    } else if (activeLayer.kind === 'attentionAid' && activeLayer.config) {
                        const cfg = normalizeAttentionAidConfig(activeLayer.config);
                        if (cfg.startedAt) {
                            activeLayer = {
                                ...activeLayer,
                                config: {
                                    ...cfg,
                                    startedAt: new Date(new Date(cfg.startedAt).getTime() + pauseDurationMs).toISOString()
                                }
                            };
                        }
                    }
                }

                const resumedSession = appendRuntimeEvent({
                    ...session,
                    isPaused: false,
                    pausedAt: undefined,
                    totalPausedMs: session.totalPausedMs + pauseDurationMs,
                    lastPauseReason: null,
                    ...interactionState,
                    activeLayer,
                    history: [...(session.history || []), 'Resumed']
                }, "session_resumed", resumeState, now.getTime(), {
                    previousPauseReason: session.lastPauseReason ?? null,
                });

                set({
                    session: resumedSession
                });
                syncActiveSession(resumedSession);
            },

            exit: () => {
                const { session, pause } = get();
                if (!session) return;
                if (session.entryRitual?.isActive) {
                    const exitedEntrySession = appendRuntimeEvent({
                        ...session,
                        isActive: false,
                        history: [...(session.history || []), 'Exited during entry ritual']
                    }, "session_exit", "entry", Date.now(), {
                        stage: "entry",
                    });

                    set({
                        session: exitedEntrySession
                    });
                    return;
                }
                if (!session.isPaused) pause({ reason: "overlay_exit" });
                const currentSession = get().session;
                if (currentSession) {
                    const timestamp = Date.now();
                    const interactionState = noteSessionInteraction(currentSession, timestamp);
                    const exitedSession = appendRuntimeEvent({
                        ...currentSession,
                        isActive: false,
                        exitCount: (currentSession.exitCount ?? 0) + 1,
                        exitEvents: appendSessionEvent(currentSession.exitEvents, timestamp),
                        ...interactionState,
                        history: [...(currentSession.history || []), 'Exited overlay']
                    }, "session_exit", "friction_detected", timestamp, {
                        source: "overlay",
                    });

                    set({
                        session: exitedSession
                    });
                }
            },

            returnToFocus: () => {
                const { session } = get();
                if (!session) return;
                set({
                    session: appendRuntimeEvent({
                        ...session,
                        isActive: true,
                        history: [...(session.history || []), 'Returned to overlay']
                    }, "session_returned", session.entryRitual?.isActive ? "entry" : "stabilized", Date.now(), {
                        source: "overlay",
                    })
                });
            },

            finish: async () => {
                const { session, interventions } = get();
                if (!session) return;
                const finishedAtMs = Date.now();
                const now = new Date(finishedAtMs).toISOString();
                let finalTotalPausedMs = session.totalPausedMs;
                if (session.isPaused && session.pausedAt) {
                    finalTotalPausedMs += finishedAtMs - new Date(session.pausedAt).getTime();
                }

                const finishedSessionBase: FocusSession = {
                    ...session,
                    isPaused: false,
                    isActive: false, // Marked as false so it's completed
                    endedAt: now,
                    consolidatedAt: session.consolidatedAt ?? session.startedAt,
                    plannedDurationMs: getFocusPlannedDurationMs(
                        session,
                        useBlocksStore.getState().blocks,
                        useSettingsStore.getState().settings.focus_default_minutes
                    ),
                    totalPausedMs: finalTotalPausedMs,
                    lastPauseReason: null,
                    persistenceStatus: "pending",
                    history: [...(session.history || []), 'Finished']
                };
                const actualDurationMs = Math.max(
                    0,
                    new Date(now).getTime() - new Date(finishedSessionBase.startedAt).getTime()
                );
                const plannedDurationMs = Math.max(
                    actualDurationMs || (25 * 60 * 1000),
                    finishedSessionBase.plannedDurationMs ?? 0
                );
                const activeDurationMs = Math.max(0, actualDurationMs - finalTotalPausedMs);
                const closureType = resolveSessionClosureType({
                    events: finishedSessionBase.events,
                    completionRatio: plannedDurationMs > 0 ? Math.min(1, actualDurationMs / plannedDurationMs) : 1,
                    subjectiveProgress: finishedSessionBase.progressFeelingAfter
                        ? Math.min(1, Math.max(0, (finishedSessionBase.progressFeelingAfter - 1) / 4))
                        : 0.5,
                    exitCount: finishedSessionBase.exitCount ?? 0,
                    inactivityCount: (finishedSessionBase.events ?? []).filter((event) => event.type === "inactivity_detected").length,
                    sustainedWorkRatio: plannedDurationMs > 0
                        ? Math.min(1, Math.max(0, activeDurationMs / plannedDurationMs))
                        : 1,
                });
                const terminalEventType = closureType === "abandoned" ? "session_abandoned" : "session_completed";
                const terminalRuntimeState = closureType === "abandoned" ? "abandoned" : "completed";
                const finishedSession = appendRuntimeEvent(
                    finishedSessionBase,
                    terminalEventType,
                    terminalRuntimeState,
                    finishedAtMs,
                    {
                        plannedDurationMs: finishedSessionBase.plannedDurationMs ?? null,
                        closureType,
                    }
                );

                set({
                    session: finishedSession,
                    lastSession: {
                        id: finishedSession.id,
                        blockType: finishedSession.blockType,
                        intention: finishedSession.intention ?? null,
                        nextStep: finishedSession.nextStep ?? null,
                        minimumViable: finishedSession.minimumViable ?? null,
                        selectedStartMode: finishedSession.entryRitual?.selectedStartMode ?? null,
                        endedAt: now
                    },
                    intervention: null
                });

                try {
                    await persistCompletedSession(finishedSession, interventions);
                    set((state) => ({
                        session: state.session?.id === finishedSession.id
                            ? { ...state.session, persistenceStatus: "persisted" }
                            : state.session,
                    }));
                } catch (error) {
                    console.error('Error saving focus session:', error);
                    set((state) => ({
                        session: state.session?.id === finishedSession.id
                            ? { ...state.session, persistenceStatus: "failed" }
                            : state.session,
                    }));
                }

                if (finishedSession.mode === "block" && finishedSession.blockId) {
                    await useBlocksStore.getState().updateBlock(finishedSession.blockId, {
                        status: "completed"
                    });
                }
            },

            extendBlock: (additionalMinutes) => {
                const { session } = get();
                if (!session) return;
                set({ session: { ...session, history: [...(session.history || []), `Extended block by ${additionalMinutes}m`] } });
            },

            setLayer: (layer) => {
                const { session } = get();
                if (!session) return;
                const interactionState = noteSessionInteraction(session);
                const nextSession = {
                    ...session,
                    activeLayer: layer,
                    ...interactionState,
                    history: [...(session.history || []), layer ? `Activated layer ${layer.kind}` : 'Layer cleared']
                };
                set({ session: nextSession });
                syncActiveSession(nextSession);
            },

            dangerouslyInjectRemoteSession: (remoteSession) => {
                set({ session: remoteSession });
            },

            setSessionIntention: (intention) => {
                const { session } = get();
                if (!session) return;
                set({
                    session: appendRuntimeEvent({
                        ...session,
                        intention,
                        ...noteSessionInteraction(session)
                    }, "task_changed", "active", Date.now(), {
                        field: "intention",
                    })
                });
            },

            setSessionNextStep: (nextStep) => {
                const { session } = get();
                if (!session) return;
                set({
                    session: appendRuntimeEvent({
                        ...session,
                        nextStep,
                        ...noteSessionInteraction(session)
                    }, "task_changed", "active", Date.now(), {
                        field: "nextStep",
                    })
                });
            },

            setSessionMinimumViable: (minimumViable) => {
                const { session } = get();
                if (!session) return;
                set({
                    session: appendRuntimeEvent({
                        ...session,
                        minimumViable,
                        ...noteSessionInteraction(session)
                    }, "task_changed", "active", Date.now(), {
                        field: "minimumViable",
                    })
                });
            },

            startEntryRitual: () => {
                const { session, lastSession, interventions } = get();
                if (!session) return;
                if (session.entryRitual?.completed || session.entryRitual?.skipped) return;
                if (session.entryRitual?.isActive) return;

                const now = Date.now();
                const entryRitual = createEntryRitualState({
                    session,
                    blocks: useBlocksStore.getState().blocks,
                    lastSession,
                    now,
                });

                set({
                    session: appendRuntimeEvent({
                        ...session,
                        entryRitual,
                        runtimeState: "entry",
                        history: [...(session.history || []), 'Entry ritual started'],
                    }, "entry_started", "entry", now, {
                        suggestedStartMode: entryRitual.suggestedStartMode,
                    }),
                    interventions: [
                        ...interventions,
                        {
                            id: crypto.randomUUID(),
                            sessionId: session.id,
                            timestamp: now,
                            type: "entry_ritual_shown",
                            actionTaken: "shown",
                            result: "started",
                            payload: { suggestedStartMode: entryRitual.suggestedStartMode },
                        },
                        {
                            id: crypto.randomUUID(),
                            sessionId: session.id,
                            timestamp: now,
                            type: "suggested_start_mode",
                            actionTaken: "suggest",
                            result: entryRitual.suggestedStartMode,
                            payload: { suggestedStartMode: entryRitual.suggestedStartMode },
                        }
                    ]
                });
            },

            updateEntryRitual: (updates) => {
                const { session } = get();
                if (!session?.entryRitual) return;

                set({
                    session: {
                        ...session,
                        entryRitual: {
                            ...session.entryRitual,
                            ...updates,
                        },
                    }
                });
            },

            completeEntryRitual: () => {
                const { session, interventions } = get();
                if (!session?.entryRitual) return;

                const now = Date.now();
                const nextStartedAt = createRuntimeStartedAt(session.startedAt);
                const entryRitual = {
                    ...session.entryRitual,
                    isActive: false,
                    completed: true,
                    skipped: false,
                    completedAt: now,
                };
                const selectedStartMode = entryRitual.selectedStartMode ?? entryRitual.suggestedStartMode ?? "normal";
                const appliedLayer = resolveEntryStartLayer(
                    session,
                    useBlocksStore.getState().blocks,
                    selectedStartMode
                );

                set({
                    session: appendRuntimeEvent({
                        ...session,
                        isActive: true,
                        isPaused: false,
                        pausedAt: undefined,
                        totalPausedMs: 0,
                        lastPauseReason: null,
                        consolidatedAt: nextStartedAt,
                        startedAt: nextStartedAt,
                        ...resetRuntimeInteractionState(),
                        intention: entryRitual.objective?.trim() || session.intention,
                        nextStep: entryRitual.nextStep?.trim() || session.nextStep,
                        minimumViable: entryRitual.minimumViable?.trim() || session.minimumViable,
                        activeLayer: appliedLayer,
                        entryRitual,
                        history: [
                            ...(session.history || []),
                            `Entry ritual completed (${selectedStartMode})`
                        ],
                    }, "entry_completed", "active", now, {
                        suggestedStartMode: entryRitual.suggestedStartMode,
                        selectedStartMode,
                    }),
                    interventions: [
                        ...interventions,
                        {
                            id: crypto.randomUUID(),
                            sessionId: session.id,
                            timestamp: now,
                            type: "entry_ritual_completed",
                            actionTaken: "complete",
                            result: "completed",
                            payload: {
                                suggestedStartMode: entryRitual.suggestedStartMode,
                                selectedStartMode,
                            },
                        },
                        {
                            id: crypto.randomUUID(),
                            sessionId: session.id,
                            timestamp: now,
                            type: "selected_start_mode",
                            actionTaken: "select",
                            result: selectedStartMode,
                            payload: {
                                suggestedStartMode: entryRitual.suggestedStartMode,
                                selectedStartMode,
                            },
                        }
                    ]
                });
            },

            skipEntryRitual: () => {
                const { session, interventions } = get();
                if (!session?.entryRitual) return;

                const now = Date.now();
                const nextStartedAt = createRuntimeStartedAt(session.startedAt);
                const selectedStartMode = session.entryRitual.selectedStartMode ?? session.entryRitual.suggestedStartMode ?? null;

                set({
                    session: appendRuntimeEvent({
                        ...session,
                        isActive: true,
                        isPaused: false,
                        pausedAt: undefined,
                        totalPausedMs: 0,
                        lastPauseReason: null,
                        consolidatedAt: nextStartedAt,
                        startedAt: nextStartedAt,
                        ...resetRuntimeInteractionState(),
                        activeLayer: null,
                        entryRitual: {
                            ...session.entryRitual,
                            isActive: false,
                            completed: false,
                            skipped: true,
                            completedAt: now,
                        },
                        history: [...(session.history || []), 'Entry ritual skipped'],
                    }, "entry_skipped", "active", now, {
                        suggestedStartMode: session.entryRitual.suggestedStartMode,
                        selectedStartMode,
                    }),
                    interventions: [
                        ...interventions,
                        {
                            id: crypto.randomUUID(),
                            sessionId: session.id,
                            timestamp: now,
                            type: "entry_ritual_skipped",
                            actionTaken: "skip",
                            result: "skipped",
                            payload: {
                                suggestedStartMode: session.entryRitual.suggestedStartMode,
                                selectedStartMode,
                            },
                        },
                        {
                            id: crypto.randomUUID(),
                            sessionId: session.id,
                            timestamp: now,
                            type: "selected_start_mode",
                            actionTaken: "skip",
                            result: selectedStartMode,
                            payload: {
                                suggestedStartMode: session.entryRitual.suggestedStartMode,
                                selectedStartMode,
                            },
                        }
                    ]
                });
            },

            clearEntryRitual: () => {
                const { session } = get();
                if (!session) return;
                set({
                    session: {
                        ...session,
                        entryRitual: createLegacyEntryRitualState(session),
                    }
                });
            },

            addToHistory: (event) => {
                const { session } = get();
                if (!session) return;
                set({ session: { ...session, history: [...(session.history || []), event] } });
            },

            markClosureBridgeShown: () => {
                const { session } = get();
                if (!session || session.closureBridgeShown) return;

                set({
                    session: {
                        ...session,
                        closureBridgeShown: true,
                    }
                });
            },

            saveClosureNote: (text, timestamp = Date.now()) => {
                const { session } = get();
                if (!session) return;

                const trimmed = text.trim().slice(0, 120);
                if (!trimmed) return;

                set({
                    session: {
                        ...session,
                        closureNote: {
                            text: trimmed,
                            timestamp,
                        },
                    }
                });
            },

            markCardShown: (cardId, now = Date.now()) => {
                const { session } = get();
                if (!session) return;

                set({
                    session: appendRuntimeEvent({
                        ...session,
                        closureBridgeShown: cardId === "card_closure_bridge" ? true : session.closureBridgeShown,
                        cardMemory: updateCardMemoryEntry(session.cardMemory, cardId, (current) => ({
                            cardId: getCardMemoryKey(cardId),
                            shownAt: current?.shownAt ?? now,
                            lastShownAt: now,
                            dismissedAt: current?.dismissedAt ?? null,
                            acceptedAt: current?.acceptedAt ?? null,
                            rejectedAt: current?.rejectedAt ?? null,
                            cooldownUntil: current?.cooldownUntil ?? null,
                            timesShown: (current?.timesShown ?? 0) + 1,
                        })),
                    }, "card_shown", session.runtimeState ?? "active", now, {
                        cardId,
                    })
                });
            },

            recordCardOutcome: (cardId, outcome, now = Date.now()) => {
                const { session } = get();
                if (!session) return;
                const cooldownMs = getOutcomeCooldownMs(cardId, outcome);
                const interactionState = noteSessionInteraction(session, now);

                set({
                    session: appendRuntimeEvent({
                        ...session,
                        ...interactionState,
                        cardMemory: updateCardMemoryEntry(session.cardMemory, cardId, (current) => ({
                            cardId: getCardMemoryKey(cardId),
                            shownAt: current?.shownAt ?? now,
                            lastShownAt: now,
                            dismissedAt: outcome === "dismissed" ? now : current?.dismissedAt ?? null,
                            acceptedAt: outcome === "accepted" ? now : current?.acceptedAt ?? null,
                            rejectedAt: outcome === "rejected" ? now : current?.rejectedAt ?? null,
                            cooldownUntil: cooldownMs ? now + cooldownMs : current?.cooldownUntil ?? null,
                            timesShown: current?.timesShown ?? 1,
                        })),
                    }, "card_outcome", session.runtimeState ?? "active", now, {
                        cardId,
                        outcome,
                    })
                });
            },

            openIntervention: (kind, options) => {
                const { session } = get();
                if (!session) return;
                const timestamp = Date.now();
                const intervention: FocusIntervention = {
                    id: crypto.randomUUID(),
                    kind,
                    timestamp,
                    payload: options?.payload,
                    sourceCard: options?.sourceCard ?? null,
                    sourceToast: options?.sourceToast ?? null,
                    trigger: options?.trigger ?? null,
                };

                set({
                    intervention,
                    session: appendRuntimeEvent(session, "intervention_shown", "intervention", timestamp, {
                        kind,
                        sourceCard: options?.sourceCard ?? null,
                        sourceToast: options?.sourceToast ?? null,
                        trigger: options?.trigger ?? null,
                    })
                });
            },

            resolveIntervention: ({ actionTaken, result, payload }) => {
                const { intervention, session, interventions } = get();
                if (!intervention || !session) return;
                const eventType = result === "dismissed" || result === "ignored"
                    ? "intervention_ignored"
                    : "intervention_accepted";

                set({
                    intervention: null,
                    session: appendRuntimeEvent(session, eventType, "stabilized", Date.now(), {
                        kind: intervention.kind,
                        actionTaken,
                        result,
                    }),
                    interventions: [
                        ...interventions,
                        {
                            id: intervention.id,
                            sessionId: session.id,
                            timestamp: intervention.timestamp,
                            type: intervention.kind,
                            sourceCard: intervention.sourceCard ?? null,
                            sourceToast: intervention.sourceToast ?? null,
                            trigger: intervention.trigger ?? null,
                            actionTaken,
                            result,
                            payload: payload ?? intervention.payload,
                        }
                    ]
                });
            },

            closeIntervention: (result = "dismissed") => {
                const { intervention, session, interventions } = get();
                if (!intervention || !session) {
                    set({ intervention: null });
                    return;
                }

                set({
                    intervention: null,
                    session: appendRuntimeEvent(session, "intervention_ignored", "friction_detected", Date.now(), {
                        kind: intervention.kind,
                        result,
                    }),
                    interventions: [
                        ...interventions,
                        {
                            id: intervention.id,
                            sessionId: session.id,
                            timestamp: intervention.timestamp,
                            type: intervention.kind,
                            sourceCard: intervention.sourceCard ?? null,
                            sourceToast: intervention.sourceToast ?? null,
                            trigger: intervention.trigger ?? null,
                            actionTaken: "close",
                            result,
                            payload: intervention.payload,
                        }
                    ]
                });
            },

            recordIntervention: (record) => {
                const { session, interventions } = get();
                if (!session) return;
                const timestamp = Date.now();
                const eventType = record.actionTaken === "close" || record.result === "dismissed"
                    ? "intervention_ignored"
                    : "intervention_accepted";

                set({
                    session: appendRuntimeEvent(
                        session,
                        eventType,
                        eventType === "intervention_ignored" ? "friction_detected" : "stabilized",
                        timestamp,
                        {
                            type: record.type,
                            actionTaken: record.actionTaken ?? null,
                            result: record.result ?? null,
                        }
                    ),
                    interventions: [
                        ...interventions,
                        {
                            id: crypto.randomUUID(),
                            sessionId: session.id,
                            timestamp,
                            type: record.type,
                            sourceCard: record.sourceCard ?? null,
                            sourceToast: record.sourceToast ?? null,
                            trigger: record.trigger ?? null,
                            actionTaken: record.actionTaken ?? null,
                            result: record.result ?? null,
                            payload: record.payload,
                        }
                    ]
                });
            },

            // ── GYM ACTIONS ────────────────────────────────────────────────

            recordSessionInteraction: (source = "focus_runtime_activity", now = Date.now()) => {
                const { session } = get();
                if (!session || session.isPaused || session.endedAt) return;

                const lastInteractionAtMs = session.lastInteractionAt
                    ? new Date(session.lastInteractionAt).getTime()
                    : 0;
                const interactionState = noteSessionInteraction(session, now);

                if (lastInteractionAtMs > 0 && (now - lastInteractionAtMs) < 15_000) {
                    set({
                        session: {
                            ...session,
                            ...interactionState,
                        }
                    });
                    return;
                }

                set({
                    session: appendRuntimeEvent({
                        ...session,
                        ...interactionState,
                    }, "session_interaction", session.runtimeState ?? "active", now, {
                        source,
                    })
                });
            },

            recordInactivityDetected: (source = "focus_overlay_idle") => {
                const { session } = get();
                if (!session || session.isPaused || session.inactivityStartedAt || session.endedAt) return;
                const timestamp = Date.now();

                set({
                    session: appendRuntimeEvent({
                        ...session,
                        inactivityStartedAt: new Date(timestamp).toISOString(),
                    }, "inactivity_detected", "friction_detected", timestamp, {
                        source,
                    })
                });
            },

            recordStabilityRecovered: (source = "focus_overlay_activity") => {
                const { session } = get();
                if (!session || !session.inactivityStartedAt || session.endedAt) return;
                const timestamp = Date.now();

                set({
                    session: appendRuntimeEvent({
                        ...session,
                        inactivityStartedAt: null,
                        ...noteSessionInteraction(session, timestamp),
                    }, "stability_recovered", "stabilized", timestamp, {
                        source,
                        inactivityDurationMs: Math.max(0, timestamp - new Date(session.inactivityStartedAt).getTime()),
                    })
                });
            },

            activateGymTracker: () => {
                const { session, setLayer } = get();
                if (!session) return;
                setLayer(createGymLayer());
            },

            startGymWorkout: (routine: WorkoutRoutine) => {
                const { session } = get();
                if (!session) return;

                // Initialize exercises from the routine
                const loadedExercises: GymExerciseLog[] = routine.exercises.map((ex) => ({
                    id: crypto.randomUUID(),
                    name: ex.name,
                    programmedRest: routine.rest_timer_sec || 180,
                    sets: []
                }));

                set({
                    session: updateGymConfig(session, cfg => ({
                        ...cfg,
                        activeRoutineId: routine.id,
                        workoutName: routine.name,
                        workoutColor: routine.color,
                        exercises: loadedExercises,
                        activeExerciseId: loadedExercises.length > 0 ? loadedExercises[0].id : null,
                        rest: { isResting: false }
                    }))
                });
            },

            addGymExercise: (name: string) => {
                const { session } = get();
                if (!session) return;
                const newExercise: GymExerciseLog = {
                    id: crypto.randomUUID(),
                    name,
                    sets: []
                };
                addGymRecentExercise(name);
                set({
                    session: updateGymConfig(session, cfg => ({
                        ...cfg,
                        exercises: [...cfg.exercises, newExercise],
                        activeExerciseId: newExercise.id
                    }))
                });
            },

            updateGymExercise: (exerciseId: string, updates: Partial<GymExerciseLog>) => {
                const { session } = get();
                if (!session) return;
                set({
                    session: updateGymConfig(session, cfg => ({
                        ...cfg,
                        exercises: cfg.exercises.map(e => e.id === exerciseId ? { ...e, ...updates } : e)
                    }))
                });
            },

            selectGymExercise: (exerciseId: string) => {
                const { session } = get();
                if (!session) return;
                set({ session: updateGymConfig(session, cfg => ({ ...cfg, activeExerciseId: exerciseId })) });
            },

            addEmptyGymSet: (exerciseId: string) => {
                const { session } = get();
                if (!session) return;
                const cfg = getGymConfig(session);
                if (!cfg) return;

                const exercise = cfg.exercises.find(e => e.id === exerciseId);
                if (!exercise) return;

                // Grab last recorded weight/reps as default if available, else 0
                const last = getGymLast(exercise.name);

                const newSet: GymSet = {
                    id: crypto.randomUUID(),
                    weight: last?.weight || 0,
                    reps: last?.reps || 0,
                    isCompleted: false,
                    createdAt: new Date().toISOString()
                };

                set({
                    session: updateGymConfig(session, c => ({
                        ...c,
                        exercises: c.exercises.map(e =>
                            e.id === exerciseId ? { ...e, sets: [...e.sets, newSet] } : e
                        )
                    }))
                });
            },

            updateGymSet: (exerciseId: string, setId: string, updates: Partial<GymSet>) => {
                const { session } = get();
                if (!session) return;

                let autoRestObj: number | undefined;

                // If it's being marked as completed, update the localStorage map for recents
                // AND trigger auto-rest if configured
                if (updates.isCompleted === true) {
                    const cfg = getGymConfig(session);
                    const exercise = cfg?.exercises.find(e => e.id === exerciseId);
                    const existingSet = exercise?.sets.find(s => s.id === setId);

                    if (exercise && existingSet && !existingSet.isCompleted) {
                        const finalWeight = updates.weight !== undefined ? updates.weight : existingSet.weight;
                        const finalReps = updates.reps !== undefined ? updates.reps : existingSet.reps;
                        const lastMap = getGymLastMap();
                        lastMap[exercise.name.toLowerCase()] = { weight: finalWeight, reps: finalReps, at: existingSet.createdAt };
                        setGymLastMap(lastMap);

                        if (exercise.programmedRest && exercise.programmedRest > 0) {
                            autoRestObj = exercise.programmedRest;
                        }
                    }
                }

                set({
                    session: updateGymConfig(session, cfg => ({
                        ...cfg,
                        exercises: cfg.exercises.map(e =>
                            e.id === exerciseId
                                ? { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, ...updates } : s) }
                                : e
                        )
                    }))
                });

                if (autoRestObj) {
                    get().startGymRest(autoRestObj);
                }
            },

            deleteGymSet: (exerciseId: string, setId: string) => {
                const { session } = get();
                if (!session) return;
                set({
                    session: updateGymConfig(session, cfg => ({
                        ...cfg,
                        exercises: cfg.exercises.map(e =>
                            e.id === exerciseId
                                ? { ...e, sets: e.sets.filter(s => s.id !== setId) }
                                : e
                        )
                    }))
                });
            },

            undoLastGymSet: (exerciseId: string) => {
                const { session } = get();
                if (!session) return;
                set({
                    session: updateGymConfig(session, cfg => ({
                        ...cfg,
                        exercises: cfg.exercises.map(e =>
                            e.id === exerciseId
                                ? { ...e, sets: e.sets.slice(0, -1) }
                                : e
                        )
                    }))
                });
            },

            startGymRest: (selectedSec: number) => {
                const { session } = get();
                if (!session) return;
                set({
                    session: updateGymConfig(session, cfg => ({
                        ...cfg,
                        rest: {
                            isResting: true,
                            selectedSec,
                            restStartedAt: new Date().toISOString()
                        }
                    }))
                });
            },

            cancelGymRest: () => {
                const { session } = get();
                if (!session) return;
                set({
                    session: updateGymConfig(session, cfg => ({
                        ...cfg,
                        rest: { isResting: false, selectedSec: undefined, restStartedAt: null }
                    }))
                });
            },

            finishGymRest: () => {
                const { session } = get();
                if (!session) return;
                set({
                    session: updateGymConfig(session, cfg => ({
                        ...cfg,
                        rest: { isResting: false, selectedSec: undefined, restStartedAt: null }
                    }))
                });
            },
        }),
        {
            name: 'focus-storage',
            partialize: (state) => ({
                session: state.session,
                lastSession: state.lastSession,
                intervention: state.intervention,
                interventions: state.interventions,
            }),
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<FocusState>;

                return {
                    ...currentState,
                    ...persisted,
                    session: normalizeFocusSession(persisted.session),
                    lastSession: persisted.lastSession
                        ? {
                            ...persisted.lastSession,
                            nextStep: persisted.lastSession.nextStep ?? null,
                            minimumViable: persisted.lastSession.minimumViable ?? null,
                            selectedStartMode: persisted.lastSession.selectedStartMode ?? null,
                        }
                        : currentState.lastSession,
                    interventions: Array.isArray(persisted.interventions) ? persisted.interventions : currentState.interventions,
                };
            },
        }
    )
);
