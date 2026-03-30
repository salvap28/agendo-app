import { FocusLayer, GymLayerConfig, AttentionAidConfig } from '@/lib/types/focus';
import { useSettingsStore } from '@/lib/stores/settingsStore';

export type StudyTechniqueState = {
    phase: "focus" | "break";
    cycleCount: number;
    phaseStartedAt: string;
};

export const STUDY_CONFIGS = {
    "pomodoro_25_5": { focusMin: 25, breakMin: 5 },
    "study_50_10": { focusMin: 50, breakMin: 10 }
};

export function createStudyLayer(id: "pomodoro_25_5" | "study_50_10" | "custom_pomodoro" | "active_recall"): FocusLayer {
    if (id === "active_recall") {
        return { id, kind: "studyTechnique" };
    }

    let config: { focusMin: number; breakMin: number; longBreakMin?: number; cyclesUntilLongBreak?: number };

    if (id === "custom_pomodoro") {
        const settings = useSettingsStore.getState().settings;
        config = {
            focusMin: settings.pomodoro_custom_focus,
            breakMin: settings.pomodoro_custom_short_break,
            longBreakMin: settings.pomodoro_custom_long_break,
            cyclesUntilLongBreak: settings.pomodoro_custom_cycles,
        };
    } else {
        config = STUDY_CONFIGS[id as keyof typeof STUDY_CONFIGS];
    }

    return {
        id,
        kind: "studyTechnique",
        config: {
            ...config,
            state: {
                phase: "focus",
                cycleCount: 1,
                phaseStartedAt: new Date().toISOString()
            } as StudyTechniqueState
        }
    };
}

export function createGymLayer(): FocusLayer {
    const config: GymLayerConfig = {
        workoutName: null,
        exercises: [],
        activeExerciseId: null,
        rest: {
            isResting: false,
            selectedSec: undefined,
            restStartedAt: null
        }
    };
    return {
        id: "gym_set_tracker",
        kind: "gymMode",
        config
    };
}

export function createAttentionAidLayer(id: "micro_commit_layer" | "focus_protection_layer"): FocusLayer {
    const config: AttentionAidConfig = id === "micro_commit_layer"
        ? {
            startedAt: new Date().toISOString(),
            durationSec: 5 * 60,
            compact: true,
        }
        : {
            compact: true,
        };

    return {
        id,
        kind: "attentionAid",
        config,
    };
}
