import { useState, useEffect } from 'react';
import { FocusSession } from '@/lib/types/focus';

export function useFocusTimer(session: FocusSession | null) {
    const [elapsedMs, setElapsedMs] = useState(0);

    useEffect(() => {
        if (!session) {
            setElapsedMs(0);
            return;
        }

        const { startedAt, isPaused, pausedAt, totalPausedMs, endedAt } = session;

        // A helper to compute current elapsed time
        const computeElapsed = () => {
            const start = new Date(startedAt).getTime();
            let end = new Date().getTime();

            // If finished, lock the end time to endedAt
            if (endedAt) {
                end = new Date(endedAt).getTime();
                return Math.max(0, end - start - totalPausedMs);
            }

            // If currently paused, compute time until it was paused
            if (isPaused && pausedAt) {
                end = new Date(pausedAt).getTime();
                return Math.max(0, end - start - totalPausedMs);
            }

            // Normal running case
            return Math.max(0, end - start - totalPausedMs);
        };

        // Initial compute
        setElapsedMs(computeElapsed());

        // Only set interval if actively running
        if (!isPaused && !endedAt) {
            const interval = setInterval(() => {
                setElapsedMs(computeElapsed());
            }, 1000); // 1-second update

            return () => clearInterval(interval);
        }
    }, [session]);

    const totalSecs = Math.floor(elapsedMs / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;

    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    const formatted = `${mm}:${ss}`;

    return { elapsedMs, totalSecs, formatted };
}
