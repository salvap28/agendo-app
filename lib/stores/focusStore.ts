import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FocusSession, FocusLayer, GymLayerConfig, GymExerciseLog, GymSet } from '@/lib/types/focus';
import { createGymLayer } from '@/lib/engines/layersEngine';
import { BlockType } from '@/lib/types/blocks';
import { createClient } from '@/lib/supabase/client';
import { syncDailyMetrics } from '@/lib/engines/patternEngine/metricsSync';

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

    // General
    openFromBlock: (blockId: string, blockType: BlockType) => void;
    openFree: () => void;
    pause: () => void;
    resume: () => void;
    exit: () => void;
    returnToFocus: () => void;
    finish: () => void;
    extendBlock: (additionalMinutes: number) => void;
    setLayer: (layer: FocusLayer | null) => void;
    setSessionIntention: (intention: string) => void;
    addToHistory: (event: string) => void;
    saveReflection: (metrics: {
        energyBefore?: number;
        clarity?: number;
        difficulty?: number;
        progressFeelingAfter?: number;
        moodAfter?: number;
        notes?: string;
    }) => Promise<void>;

    // Gym tracker
    activateGymTracker: () => void;
    startGymWorkout: (routine: any) => void;
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
    const cfg = session.activeLayer.config as any;
    return {
        workoutName: cfg?.workoutName || null,
        exercises: cfg?.exercises || [],
        activeExerciseId: cfg?.activeExerciseId || null,
        rest: cfg?.rest || { isResting: false }
    } as GymLayerConfig;
}

function updateGymConfig(session: FocusSession, updater: (cfg: GymLayerConfig) => GymLayerConfig): FocusSession {
    const layer = session.activeLayer;
    if (!layer || layer.kind !== 'gymMode') return session;
    const rawCfg = layer.config as any;
    const safeCfg: GymLayerConfig = {
        workoutName: rawCfg?.workoutName || null,
        exercises: rawCfg?.exercises || [],
        activeExerciseId: rawCfg?.activeExerciseId || null,
        rest: rawCfg?.rest || { isResting: false }
    };
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

            openFromBlock: (blockId, blockType) => {
                const now = new Date().toISOString();
                set({
                    session: {
                        id: crypto.randomUUID(),
                        mode: "block",
                        blockId,
                        blockType,
                        startedAt: now,
                        isActive: true,
                        isPaused: false,
                        totalPausedMs: 0,
                        pauseCount: 0,
                        exitCount: 0,
                        history: ["Session started from block"],
                        activeLayer: blockType === "gym" ? createGymLayer() : undefined
                    }
                });
            },

            openFree: () => {
                const now = new Date().toISOString();
                set({
                    session: {
                        id: crypto.randomUUID(),
                        mode: "free",
                        startedAt: now,
                        isActive: true,
                        isPaused: false,
                        totalPausedMs: 0,
                        pauseCount: 0,
                        exitCount: 0,
                        history: ["Free session started"]
                    }
                });
            },

            pause: () => {
                const { session } = get();
                if (!session || session.isPaused) return;
                set({
                    session: {
                        ...session,
                        isPaused: true,
                        pausedAt: new Date().toISOString(),
                        pauseCount: session.pauseCount + 1,
                        history: [...(session.history || []), 'Paused']
                    }
                });
            },

            resume: () => {
                const { session } = get();
                if (!session || !session.isPaused || !session.pausedAt) return;
                const now = new Date();
                const pausedAt = new Date(session.pausedAt);
                const pauseDurationMs = now.getTime() - pausedAt.getTime();
                
                let activeLayer = session.activeLayer;
                if (activeLayer) {
                    if (activeLayer.kind === 'studyTechnique' && activeLayer.config) {
                        const cfg = activeLayer.config as any;
                        if (cfg.state && cfg.state.phaseStartedAt) {
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
                        const cfg = activeLayer.config as any;
                        if (cfg.rest && cfg.rest.isResting && cfg.rest.restStartedAt) {
                            const newRestStartedAt = new Date(new Date(cfg.rest.restStartedAt).getTime() + pauseDurationMs).toISOString();
                            activeLayer = {
                                ...activeLayer,
                                config: {
                                    ...cfg,
                                    rest: { ...cfg.rest, restStartedAt: newRestStartedAt }
                                }
                            };
                        }
                    }
                }

                set({
                    session: {
                        ...session,
                        isPaused: false,
                        pausedAt: undefined,
                        totalPausedMs: session.totalPausedMs + pauseDurationMs,
                        activeLayer,
                        history: [...(session.history || []), 'Resumed']
                    }
                });
            },

            exit: () => {
                const { session, pause } = get();
                if (!session) return;
                if (!session.isPaused) pause();
                const currentSession = get().session;
                if (currentSession) {
                    set({
                        session: {
                            ...currentSession,
                            isActive: false,
                            exitCount: currentSession.exitCount + 1,
                            history: [...(currentSession.history || []), 'Exited overlay']
                        }
                    });
                }
            },

            returnToFocus: () => {
                const { session } = get();
                if (!session) return;
                set({ session: { ...session, isActive: true, history: [...(session.history || []), 'Returned to overlay'] } });
            },

            finish: async () => {
                const { session } = get();
                if (!session) return;
                const now = new Date().toISOString();
                let finalTotalPausedMs = session.totalPausedMs;
                if (session.isPaused && session.pausedAt) {
                    finalTotalPausedMs += new Date().getTime() - new Date(session.pausedAt).getTime();
                }

                const finishedSession = {
                    ...session,
                    isPaused: false,
                    isActive: false, // Marked as false so it's completed
                    endedAt: now,
                    totalPausedMs: finalTotalPausedMs,
                    history: [...(session.history || []), 'Finished']
                };

                set({ session: finishedSession });

                // Sync to Supabase
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { error } = await supabase.from('focus_sessions').insert({
                        id: finishedSession.id,
                        user_id: user.id,
                        mode: finishedSession.mode,
                        block_id: finishedSession.blockId,
                        block_type: finishedSession.blockType,
                        started_at: finishedSession.startedAt,
                        ended_at: finishedSession.endedAt,
                        is_active: false,
                        is_paused: false,
                        paused_at: null,
                        total_paused_ms: finishedSession.totalPausedMs,
                        pause_count: finishedSession.pauseCount,
                        exit_count: finishedSession.exitCount,
                        intention: finishedSession.intention,
                        active_layer: finishedSession.activeLayer,
                        history: finishedSession.history
                    });
                    if (error) {
                        console.error('Error saving focus session:', JSON.stringify(error, null, 2));
                    }
                }
            },

            saveReflection: async (metrics) => {
                const { session } = get();
                if (!session) return;
                
                // Intention override if user wrote reflection
                const newIntention = metrics.notes ? `${session.intention ? session.intention + ' | ' : ''}${metrics.notes}` : session.intention;

                const supabase = createClient();
                const { error } = await supabase.from('focus_sessions').update({
                    energy_before: metrics.energyBefore,
                    clarity: metrics.clarity,
                    difficulty: metrics.difficulty,
                    progress_feeling_after: metrics.progressFeelingAfter,
                    mood_after: metrics.moodAfter,
                    intention: newIntention,
                }).eq('id', session.id);

                if (error) {
                    console.error('Error saving reflection:', JSON.stringify(error, null, 2));
                } else {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        await syncDailyMetrics(user.id).catch(e => console.error("Error running daily metrics sync in background:", e));
                    }
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
                set({
                    session: {
                        ...session,
                        activeLayer: layer,
                        history: [...(session.history || []), layer ? `Activated layer ${layer.kind}` : 'Layer cleared']
                    }
                });
            },

            setSessionIntention: (intention) => {
                const { session } = get();
                if (!session) return;
                set({ session: { ...session, intention } });
            },

            addToHistory: (event) => {
                const { session } = get();
                if (!session) return;
                set({ session: { ...session, history: [...(session.history || []), event] } });
            },

            // ── GYM ACTIONS ────────────────────────────────────────────────

            activateGymTracker: () => {
                const { session, setLayer } = get();
                if (!session) return;
                setLayer(createGymLayer());
            },

            startGymWorkout: (routine: any) => {
                const { session } = get();
                if (!session) return;

                // Initialize exercises from the routine
                const loadedExercises: GymExerciseLog[] = routine.exercises.map((ex: any) => ({
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
            partialize: (state) => ({ session: state.session }),
        }
    )
);
