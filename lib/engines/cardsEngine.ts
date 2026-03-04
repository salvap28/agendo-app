import { FocusContext, FocusCard, FocusLayer } from '@/lib/types/focus';

export interface EngineResult {
    visibleCards: FocusCard[];
    toastCards: FocusCard[];
    suggestedLayers: FocusLayer[];
}

export function evaluateFocusContext(context: FocusContext): EngineResult {
    const visibleCards: FocusCard[] = [];
    const toastCards: FocusCard[] = [];
    const suggestedLayers: FocusLayer[] = [];

    const { mode, blockType, timeElapsedSec, pauseCount, exitCount, totalPausedSec, nearEndAt, history } = context;
    const timeElapsedMin = Math.floor(timeElapsedSec / 60);

    // 1. TOAST CARDS (Reactive)

    // onPause toast
    if (pauseCount > 0 && history[history.length - 1] === "Paused") {
        toastCards.push({
            id: "toast_pause",
            type: "reactive",
            title: "Tómate tu tiempo",
            description: "Respira profundo. Vuelve cuando estés listo para continuar.",
            isToast: true,
            priority: 100
        });
    }

    // near endAt toast
    if (nearEndAt && mode === "block") {
        toastCards.push({
            id: "toast_near_end",
            type: "reactive",
            title: "Fin del bloque",
            description: "Estás llegando al final del tiempo planificado.",
            action: {
                label: "Extender",
                type: "custom", // Handled in UI
                payload: { action: "extend" }
            },
            secondaryAction: {
                label: "Finalizar",
                type: "custom",
                payload: { action: "finish" }
            },
            isToast: true,
            priority: 110
        });
    }

    // too many exits
    if (exitCount >= 3 && timeElapsedMin < 30) {
        toastCards.push({
            id: "toast_exits",
            type: "reactive",
            title: "Salir seguido rompe el hilo",
            description: "¿Reducimos alcance?",
            isToast: true,
            priority: 95
        });
    }


    // 2. VISIBLE CARDS & SUGGESTED LAYERS (Proactive)

    // Universal: Playlist
    visibleCards.push({
        id: "card_playlist",
        type: "universal",
        title: "Playlist sugerida",
        description: "Música ideal para este momento.",
        action: {
            label: "Abrir Playlist",
            type: "externalLink",
            payload: { url: "https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS" } // placeholder lo-fi
        },
        priority: 10
    });

    // Universal: Simplificar / Next step
    if (timeElapsedMin >= 5) {
        visibleCards.push({
            id: "card_next_step",
            type: "universal",
            title: "¿Cuál es el siguiente paso?",
            description: "Simplificá tu tarea a la mínima acción posible.",
            action: {
                label: "Definir",
                type: "setIntent"
            },
            priority: 20
        });
    }

    // Study Context
    if (blockType === "study") {
        suggestedLayers.push({ id: "pomodoro_25_5", kind: "studyTechnique" });
        suggestedLayers.push({ id: "study_50_10", kind: "studyTechnique" });

        visibleCards.push({
            id: "card_study_technique",
            type: "study",
            title: "Elegí técnica",
            description: "Estructurá tu sesión para máximo aprendizaje.",
            action: {
                label: "Configurar",
                type: "layer",
                payload: { showPicker: true }
            },
            priority: 50
        });

        // Active recall prompt after 20 mins
        if (timeElapsedMin > 0 && timeElapsedMin % 20 === 0) {
            toastCards.push({
                id: `toast_active_recall_${timeElapsedMin}`,
                type: "study",
                title: "Active Recall",
                description: "¿Qué acabás de aprender en una oración?",
                isToast: true,
                priority: 80
            });
        }
    }

    // Gym Context
    if (blockType === "gym") {
        suggestedLayers.push({ id: "gym_set_tracker", kind: "gymMode" });
        visibleCards.push({
            id: "card_gym_mode",
            type: "gym",
            title: "Modo Entrenamiento",
            description: "Registrá tus series y descansos.",
            action: {
                label: "Activar",
                type: "layer",
                payload: { layerId: "gym_set_tracker" }
            },
            priority: 60
        });
    }

    // Work Context
    if (["deep_work", "admin"].includes(blockType || "")) {
        if (pauseCount >= 2 && totalPausedSec < 600) { // 2 pauses, less than 10 mins
            visibleCards.push({
                id: "card_work_unblock",
                type: "work",
                title: "¿Atascado?",
                description: "Elegí una opción rápida para destrabarte.",
                action: {
                    label: "Desbloqueo",
                    type: "custom",
                    payload: { action: "unblockSteps" }
                },
                priority: 70
            });
        }
    }

    // Ensure strict rules: max 4 visible cards
    // We sort by priority descending
    const sortedVisible = visibleCards.sort((a, b) => (b.priority || 0) - (a.priority || 0)).slice(0, 4);

    return {
        visibleCards: sortedVisible,
        toastCards,
        suggestedLayers
    };
}
