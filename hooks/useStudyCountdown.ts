import { useEffect, useMemo } from 'react';
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
        };

        if (!config?.state?.phaseStartedAt) return null;
        return config;
    }, [session]);

    const currentPhase = studyConfig?.state?.phase ?? null;

    const remainingSecs = useMemo(() => {
        if (!session || !studyConfig?.state?.phaseStartedAt) return null;

        const targetDurationSecs = studyConfig.state.phase === "focus"
            ? studyConfig.focusMin * 60
            : studyConfig.breakMin * 60;
        const effectiveNow = session.isPaused && session.pausedAt
            ? new Date(session.pausedAt).getTime()
            : now;
        const startedAt = new Date(studyConfig.state.phaseStartedAt).getTime();
        const elapsedSecs = Math.floor((effectiveNow - startedAt) / 1000);

        return Math.max(0, targetDurationSecs - elapsedSecs);
    }, [now, session, studyConfig]);

    useEffect(() => {
        if (!session || !studyConfig || session.isPaused || remainingSecs === null || remainingSecs > 0) {
            return;
        }

        const state = studyConfig.state!;
        const nextPhase = state.phase === "focus" ? "break" : "focus";
        const currentCount = state.cycleCount;

        if (settings.notify_focus_timer) {
            sendNotification(
                state.phase === "focus" ? "Tiempo de descanso" : "De vuelta al enfoque",
                {
                    body: state.phase === "focus"
                        ? "Tomate un respiro, te lo ganaste."
                        : "Es hora de volver a concentrarte.",
                    icon: "/favicon.ico"
                }
            );
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
