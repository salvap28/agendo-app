import { BlockType } from "./blocks";

export type FocusMode = "block" | "free";

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

// ── FocusLayer ─────────────────────────────────────────────────────────────

export interface FocusLayer {
    id: string;
    kind: "studyTechnique" | "gymMode" | "none";
    config?: GymLayerConfig | Record<string, unknown>; // Typed per kind
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

// ── FocusSession ──────────────────────────────────────────────────────────

export interface FocusSession {
    id: string;
    mode: FocusMode;
    blockId?: string;
    blockType?: BlockType;

    startedAt: string; // ISO string for localStorage persistence
    endedAt?: string;

    isActive: boolean;
    isPaused: boolean;
    pausedAt?: string;
    totalPausedMs: number;

    pauseCount: number;
    exitCount: number;

    intention?: string;

    activeLayer?: FocusLayer | null;
    history?: string[];
}

// ── FocusContext ──────────────────────────────────────────────────────────

export interface FocusContext {
    mode: FocusMode;
    blockType?: BlockType;
    timeElapsedSec: number;
    pauseCount: number;
    exitCount: number;
    totalPausedSec: number;
    nearEndAt: boolean;
    timeOfDay: "morning" | "afternoon" | "evening" | "night";
    history: string[];
}
