import { useEffect, useMemo, useState } from 'react';
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

    useEffect(() => {
        if (remainingSecs === null || remainingSecs > 0) return;

        const timeout = window.setTimeout(() => {
            sendNotification("Tiempo de descanso terminado", {
                body: "Preparado para seguir.",
                icon: "/favicon.ico"
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
