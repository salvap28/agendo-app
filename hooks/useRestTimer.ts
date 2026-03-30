import { useEffect, useMemo, useState, useRef } from 'react';
import { useFocusStore } from '@/lib/stores/focusStore';
import { sendNotification } from '@/lib/utils/notifications';
import { useFocusNow } from './useFocusNow';

export function useRestTimer() {
    const [targetSecs, setTargetSecs] = useState<number | null>(null);
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const now = useFocusNow({ isRunning: targetSecs !== null, stepMs: 1000 });

    const startRest = (seconds: number) => {
        setTargetSecs(seconds);
        setStartedAt(Date.now());
        useFocusStore.getState().pause({ reason: "manual_rest" });
    };

    const stopRest = () => {
        setTargetSecs(null);
        setStartedAt(null);
        useFocusStore.getState().resume();
    };

    const remainingSecs = useMemo(() => {
        if (targetSecs === null || startedAt === null) return null;
        const elapsedSecs = Math.floor((now - startedAt) / 1000);
        return Math.max(0, targetSecs - elapsedSecs);
    }, [now, startedAt, targetSecs]);

    const warningSentRef = useRef<number | null>(null);

    // 1-minute warning effect
    useEffect(() => {
        if (remainingSecs === null || targetSecs === null || startedAt === null) return;

        if (targetSecs > 60 && remainingSecs <= 60 && remainingSecs > 0) {
            if (warningSentRef.current !== startedAt) {
                warningSentRef.current = startedAt;
                sendNotification("1 minuto restante", {
                    body: "Va terminando tu descanso libre. ¡Alistate!",
                    icon: "/favicon.ico",
                    requireInteraction: true
                });
            }
        }
    }, [remainingSecs, targetSecs, startedAt]);

    useEffect(() => {
        if (remainingSecs === null || remainingSecs > 0) return;

        const timeout = window.setTimeout(() => {
            sendNotification("Tiempo de descanso terminado", {
                body: "Preparado para seguir. ¡A darle!",
                icon: "/favicon.ico",
                requireInteraction: true
            });
            stopRest();
        }, 0);

        return () => window.clearTimeout(timeout);
    }, [remainingSecs]);

    const formatted = useMemo(() => {
        if (remainingSecs === null) return null;
        const minutes = Math.floor(remainingSecs / 60).toString().padStart(2, '0');
        const seconds = (remainingSecs % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    }, [remainingSecs]);

    return { formatted, isActive: targetSecs !== null, startRest, stopRest };
}
