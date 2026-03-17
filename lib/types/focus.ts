import { BlockType } from "./blocks";

export type FocusMode = "block" | "free";
export type FocusPauseReason = "manual_pause" | "manual_rest" | "overlay_exit";
export type FocusEntryStartMode = "normal" | "study_technique" | "gym" | "micro_commit";
export type FocusInterventionKind =
    | "reduce_scope"
    | "reset_clarity"
    | "refocus_prompt"
    | "progress_check"
    | "closure_bridge";
export type FocusRuntimeState =
    | "inactive"
    | "entry"
    | "active"
    | "friction_detected"
    | "intervention"
    | "stabilized"
    | "completed"
    | "abandoned";
export type FocusSessionEventType =
    | "session_started"
    | "entry_started"
    | "entry_completed"
    | "entry_skipped"
    | "session_paused"
    | "session_resumed"
    | "session_exit"
    | "session_returned"
    | "session_completed"
    | "session_abandoned"
    | "session_interaction"
    | "task_changed"
    | "inactivity_detected"
    | "intervention_shown"
    | "intervention_ignored"
    | "intervention_accepted"
    | "card_shown"
    | "card_outcome"
    | "stability_recovered";

// ── Gym Tracker Types ──────────────────────────────────────────────────────

export type GymSet = {
    id: string;
    weight: number;
    reps: number;
    isCompleted?: boolean;
    createdAt: string; // ISO
};

export type GymExerciseLog = {
    id: string;
    name: string;
    programmedRest?: number; // Auto-rest duration in seconds when a set completes
    sets: GymSet[];
};

export type RoutineExercise = {
    id: string; // unique ID
    name: string;
};

export type WorkoutRoutine = {
    id: string;
    user_id: string;
    name: string;
    color: string;
    rep_type: string;
    planned_days: number[]; // 0-6 (0 = Sun, 1 = Mon...)
    rest_timer_sec: number;
    exercises: RoutineExercise[];
    created_at: string;
};

export type GymLayerConfig = {
    activeRoutineId?: string | null;
    workoutName?: string | null;
    workoutColor?: string | null;
    exercises: GymExerciseLog[];
    activeExerciseId?: string | null;
    rest: {
        isResting: boolean;
        selectedSec?: number;
        restStartedAt?: string | null;
    };
};

export type AttentionAidConfig = {
    startedAt?: string | null;
    durationSec?: number;
    compact?: boolean;
};

// ── FocusLayer ─────────────────────────────────────────────────────────────

export interface FocusLayer {
    id: string;
    kind: "studyTechnique" | "gymMode" | "attentionAid" | "none";
    config?: GymLayerConfig | AttentionAidConfig | Record<string, unknown>; // Typed per kind
}

// ── FocusCard ─────────────────────────────────────────────────────────────

export interface FocusCard {
    id: string;
    type: string;
    title: string;
    description?: string;
    action?: {
        label: string;
        type: "externalLink" | "layer" | "setIntent" | "resolve" | "custom";
        payload?: Record<string, unknown>;
    };
    secondaryAction?: {
        label: string;
        type: "externalLink" | "layer" | "setIntent" | "resolve" | "custom";
        payload?: Record<string, unknown>;
    };
    priority?: number;
    isToast?: boolean;
}

export interface FocusCardMemory {
    cardId: string;
    shownAt: number;
    lastShownAt: number;
    dismissedAt?: number | null;
    acceptedAt?: number | null;
    rejectedAt?: number | null;
    cooldownUntil?: number | null;
    timesShown: number;
}

export interface ClosureNote {
    text: string;
    timestamp: number;
}

export interface FocusEntryRitualState {
    isActive: boolean;
    completed: boolean;
    skipped: boolean;
    objective: string | null;
    nextStep: string | null;
    minimumViable: string | null;
    suggestedStartMode: FocusEntryStartMode | null;
    selectedStartMode: FocusEntryStartMode | null;
    startedAt: number | null;
    completedAt: number | null;
}

export interface FocusSessionEvent {
    id: string;
    sessionId: string;
    type: FocusSessionEventType;
    runtimeState: FocusRuntimeState;
    timestamp: string;
    relativeMs: number;
    payload?: Record<string, unknown>;
}

// ── FocusSession ──────────────────────────────────────────────────────────

export interface FocusSession {
    id: string;
    mode: FocusMode;
    blockId?: string;
    blockType?: BlockType;

    initiatedAt?: string;
    // Marks the effective runtime start after the entry ritual settles.
    consolidatedAt?: string;
    startedAt: string; // ISO string for localStorage persistence
    endedAt?: string;
    plannedDurationMs?: number;

    isActive: boolean;
    isPaused: boolean;
    pausedAt?: string;
    totalPausedMs: number;

    pauseCount: number;
    exitCount: number;
    restCount?: number;
    lastPauseReason?: FocusPauseReason | null;
    pauseEvents?: number[];
    exitEvents?: number[];
    firstInteractionAt?: string;
    lastInteractionAt?: string;

    intention?: string;
    nextStep?: string;
    minimumViable?: string;

    // V1 Tracking metrics
    energyBefore?: number;
    moodBefore?: number;
    moodAfter?: number;
    progressFeelingAfter?: number;
    difficulty?: number;
    clarity?: number;
    startDelayMs?: number;
    previousContext?: string;
    sessionQualityScore?: number;

    activeLayer?: FocusLayer | null;
    history?: string[];
    cardMemory?: Record<string, FocusCardMemory>;
    closureBridgeShown?: boolean;
    closureNote?: ClosureNote | null;
    entryRitual?: FocusEntryRitualState;
    runtimeState?: FocusRuntimeState;
    events?: FocusSessionEvent[];
    inactivityStartedAt?: string | null;
    persistenceStatus?: "draft" | "pending" | "persisted" | "failed";
}

export interface FocusSessionSummary {
    id: string;
    blockType?: BlockType;
    intention?: string | null;
    nextStep?: string | null;
    minimumViable?: string | null;
    selectedStartMode?: FocusEntryStartMode | null;
    endedAt: string;
    age?: number;
}

export interface FocusIntervention {
    id: string;
    kind: FocusInterventionKind;
    timestamp: number;
    payload?: Record<string, unknown>;
    sourceCard?: string | null;
    sourceToast?: string | null;
    trigger?: string | null;
}

export interface FocusInterventionRecord {
    id: string;
    sessionId: string;
    timestamp: number;
    type: string;
    sourceCard?: string | null;
    sourceToast?: string | null;
    trigger?: string | null;
    actionTaken?: string | null;
    result?: string | null;
    payload?: Record<string, unknown>;
}

// ── FocusContext ──────────────────────────────────────────────────────────

export interface FocusContext {
    mode: FocusMode;
    blockType?: BlockType;
    startTime: number;
    now: number;
    plannedDurationMs: number;
    elapsedMs: number;
    totalPausedMs: number;
    sessionProgress: number;
    pauses: number;
    overlayExits: number;
    restPauses: number;
    lastPauseReason?: FocusPauseReason | null;
    recentPauseCount: number;
    recentExitCount: number;
    recentInteractionWindowMs: number;
    recentStabilityMs: number;
    startDelayMs: number;
    intention?: string | null;
    nextStep?: string | null;
    minimumViable?: string | null;
    history: string[];
    cardMemory: Record<string, FocusCardMemory>;
    closureBridgeShown: boolean;
    lastSession?: FocusSessionSummary | null;
    activeLayerId?: string | null;
    activeLayerKind?: FocusLayer["kind"] | null;
}
