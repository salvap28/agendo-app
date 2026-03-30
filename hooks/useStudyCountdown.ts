import { useEffect, useMemo, useRef } from 'react';
import { useFocusStore } from '@/lib/stores/focusStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { StudyTechniqueState } from '@/lib/engines/layersEngine';
import { sendNotification } from '@/lib/utils/notifications';

export function useStudyCountdown(now: number) {
    const { settings } = useSettingsStore();
    const { session } = useFocusStore();

    const studyConfig = useMemo(() => {
        if (!session?.activeLayer || session.activeLayer.kind !== "studyTechnique" || session.activeLayer.id === "active_recall") {
            return null;
        }

        const config = session.activeLayer.config as {
            state?: StudyTechniqueState;
            focusMin: number;
            breakMin: number;
            longBreakMin?: number;
            cyclesUntilLongBreak?: number;
        };

        if (!config?.state?.phaseStartedAt) return null;
        return config;
    }, [session]);

    const currentPhase = studyConfig?.state?.phase ?? null;

    const remainingSecs = useMemo(() => {
        if (!session || !studyConfig?.state?.phaseStartedAt) return null;

        let targetDurationSecs = 0;
        if (studyConfig.state.phase === "focus") {
            targetDurationSecs = studyConfig.focusMin * 60;
        } else {
            const isLongBreak = studyConfig.cyclesUntilLongBreak
                && studyConfig.state.cycleCount > 0
                && studyConfig.state.cycleCount % studyConfig.cyclesUntilLongBreak === 0;

            targetDurationSecs = isLongBreak
                ? (studyConfig.longBreakMin || studyConfig.breakMin) * 60
                : studyConfig.breakMin * 60;
        }

        const effectiveNow = session.isPaused && session.pausedAt
            ? new Date(session.pausedAt).getTime()
            : now;
        const startedAt = new Date(studyConfig.state.phaseStartedAt).getTime();
        const elapsedSecs = Math.floor((effectiveNow - startedAt) / 1000);

        return Math.max(0, targetDurationSecs - elapsedSecs);
    }, [now, session, studyConfig]);

    const warningSentRef = useRef<string | null>(null);

    // 1-minute warning effect (runs autonomously from the phase change effect)
    useEffect(() => {
        if (!session || !studyConfig?.state?.phaseStartedAt || remainingSecs === null || session.isPaused) return;

        let targetDurationSecs = 0;
        if (studyConfig.state.phase === "focus") {
            targetDurationSecs = studyConfig.focusMin * 60;
        } else {
            const isLongBreak = studyConfig.cyclesUntilLongBreak
                && studyConfig.state.cycleCount > 0
                && studyConfig.state.cycleCount % studyConfig.cyclesUntilLongBreak === 0;

            targetDurationSecs = isLongBreak
                ? (studyConfig.longBreakMin || studyConfig.breakMin) * 60
                : studyConfig.breakMin * 60;
        }

        if (targetDurationSecs > 60 && remainingSecs <= 60 && remainingSecs > 0) {
            if (warningSentRef.current !== studyConfig.state.phaseStartedAt) {
                warningSentRef.current = studyConfig.state.phaseStartedAt;
                
                sendNotification("Falta 1 minuto", {
                    body: studyConfig.state.phase === "focus"
                        ? "Queda 1 minuto de estudio. ¡Ve cerrando el ciclo!"
                        : "Queda 1 minuto de descanso. ¡Prepárate para enfocarte!",
                    icon: "/favicon.ico",
                    requireInteraction: true
                });
            }
        }
    }, [remainingSecs, session, studyConfig]);

    useEffect(() => {
        if (!session || !studyConfig || session.isPaused || remainingSecs === null || remainingSecs > 0) {
            return;
        }

        const state = studyConfig.state!;
        const nextPhase = state.phase === "focus" ? "break" : "focus";
        const currentCount = state.cycleCount;

        let title = "";
        let body = "";
        if (state.phase === "focus") {
            const isLongBreak = studyConfig.cyclesUntilLongBreak
                && state.cycleCount > 0
                && state.cycleCount % studyConfig.cyclesUntilLongBreak === 0;

            title = isLongBreak ? "¡Descanso Largo!" : "Tiempo de descanso";
            body = isLongBreak
                ? "Te lo ganaste. Disfruta un merecido descanso extendido."
                : "Tómate un respiro, bien hecho.";
        } else {
            title = "De vuelta al enfoque";
            body = "Es hora de volver a concentrarte. ¡Vamos!";
        }

        if (settings.notify_focus_timer !== false) { // Enforce it to fire by default
            sendNotification(title, {
                body,
                icon: "/icon.png",
                requireInteraction: true
            });
        }

        useFocusStore.setState((currentState) => {
            const currentLayer = currentState.session?.activeLayer;
            if (!currentLayer || currentLayer.kind !== "studyTechnique" || !currentState.session) {
                return currentState;
            }

            return {
                session: {
                    ...currentState.session,
                    activeLayer: {
                        ...currentLayer,
                        config: {
                            ...studyConfig,
                            state: {
                                phase: nextPhase,
                                cycleCount: nextPhase === "focus" ? currentCount + 1 : currentCount,
                                phaseStartedAt: new Date(now).toISOString(),
                            },
                        },
                    },
                },
            };
        });
    }, [now, remainingSecs, session, settings.notify_focus_timer, studyConfig]);

    const countdownFormatted = useMemo(() => {
        if (remainingSecs === null) return null;
        const minutes = Math.floor(remainingSecs / 60).toString().padStart(2, '0');
        const seconds = (remainingSecs % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    }, [remainingSecs]);

    return { countdownFormatted, currentPhase };
}
