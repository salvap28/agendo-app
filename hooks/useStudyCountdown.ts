import { useState, useEffect } from 'react';
import { useFocusStore } from '@/lib/stores/focusStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { StudyTechniqueState } from '@/lib/engines/layersEngine';
import { sendNotification } from '@/lib/utils/notifications';

export function useStudyCountdown() {
    const { settings } = useSettingsStore();
    const { session, setLayer } = useFocusStore();
    const [countdownFormatted, setCountdownFormatted] = useState<string | null>(null);
    const [currentPhase, setCurrentPhase] = useState<"focus" | "break" | null>(null);

    useEffect(() => {
        if (!session || !session.activeLayer || session.activeLayer.kind !== "studyTechnique" || session.activeLayer.id === "active_recall") {
            setCountdownFormatted(null);
            setCurrentPhase(null);
            return;
        }

        const config = session.activeLayer.config as { state?: StudyTechniqueState; focusMin: number; breakMin: number };
        if (!config || !config.state) return;

        const state = config.state;
        const focusSecs = config.focusMin * 60;
        const breakSecs = config.breakMin * 60;

        let targetDurationSecs = state.phase === "focus" ? focusSecs : breakSecs;

        // Helper to compute local remaining internally
        const getRemainingSecs = () => {
            const start = new Date(state.phaseStartedAt).getTime();
            let end = new Date().getTime();

            if (session.isPaused && session.pausedAt) {
                end = new Date(session.pausedAt).getTime();
            }

            const elapsedMs = end - start;
            const elapsedSecs = Math.floor(elapsedMs / 1000);
            return Math.max(0, targetDurationSecs - elapsedSecs);
        };

        setCurrentPhase(state.phase);

        if (session.isPaused) {
            return; // don't tick
        }

        const interval = setInterval(() => {
            const remaining = getRemainingSecs();

            if (remaining <= 0) {
                // Auto-switch phase
                const nextPhase = state.phase === "focus" ? "break" : "focus";
                const currentCount = state.cycleCount;

                if (settings.notify_focus_timer) {
                    sendNotification(
                        state.phase === "focus" ? "¡Tiempo de descanso!" : "¡De vuelta al enfoque!",
                        {
                            body: state.phase === "focus"
                                ? "Tómate un respiro, te lo has ganado."
                                : "Es hora de volver a concentrarte.",
                            icon: "/favicon.ico"
                        }
                    );
                }
                useFocusStore.setState((state) => {
                    const currentLayer = state.session?.activeLayer;
                    if (!currentLayer || !state.session) return state;

                    return {
                        session: {
                            ...state.session,
                            activeLayer: {
                                id: currentLayer.id,
                                kind: currentLayer.kind,
                                config: {
                                    ...config,
                                    state: {
                                        phase: nextPhase,
                                        cycleCount: nextPhase === "focus" ? currentCount + 1 : currentCount,
                                        phaseStartedAt: new Date().toISOString()
                                    }
                                } as any // Cast as any because Zustand store typing enforces GymLayerConfig | Record<string, unknown>
                            }
                        }
                    };
                });
            }

            const m = Math.floor(remaining / 60).toString().padStart(2, '0');
            const s = (remaining % 60).toString().padStart(2, '0');
            setCountdownFormatted(`${m}:${s}`);

        }, 1000);

        return () => clearInterval(interval);
    }, [session]);

    return { countdownFormatted, currentPhase };
}
