import { useState, useEffect } from 'react';
import { useFocusStore } from '@/lib/stores/focusStore';

export function useRestTimer() {
    const [targetSecs, setTargetSecs] = useState<number | null>(null);
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [formatted, setFormatted] = useState<string | null>(null);

    const startRest = (seconds: number) => {
        setTargetSecs(seconds);
        setStartedAt(new Date().getTime());

        // Auto-pause the main focus timer
        useFocusStore.getState().pause();

        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        setFormatted(`${m}:${s}`);
    };

    const stopRest = () => {
        setTargetSecs(null);
        setStartedAt(null);
        setFormatted(null);

        // Auto-resume the main focus timer
        useFocusStore.getState().resume();
    };

    useEffect(() => {
        if (targetSecs === null || startedAt === null) return;

        const interval = setInterval(() => {
            const now = new Date().getTime();
            const elapsedSecs = Math.floor((now - startedAt) / 1000);
            const remaining = Math.max(0, targetSecs - elapsedSecs);

            if (remaining <= 0) {
                // Usually trigger alarm/toast here
                stopRest();
            } else {
                const m = Math.floor(remaining / 60).toString().padStart(2, '0');
                const s = (remaining % 60).toString().padStart(2, '0');
                setFormatted(`${m}:${s}`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [targetSecs, startedAt]);

    return { formatted, isActive: targetSecs !== null, startRest, stopRest };
}
