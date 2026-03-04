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

export type GymLayerConfig = {
    workoutName?: string | null;
    exercises: GymExerciseLog[];
    activeExerciseId?: string | null;
    rest: {
        isResting: boolean;
        selectedSec?: number;
        restStartedAt?: string | null;
    };
};

// Future schema (not implemented)
export type WorkoutRoutine = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    exercises: { name: string; defaultSets?: { weight: number; reps: number }[] }[];
};

export type WorkoutSession = {
    id: string;
    startedAt: string;
    endedAt: string;
    routineId?: string | null;
    routineName?: string | null;
    exercises: { name: string; sets: { weight: number; reps: number; createdAt: string }[] }[];
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
