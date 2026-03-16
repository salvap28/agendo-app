import { FocusSession } from '@/lib/types/focus';
import { getFocusElapsedMs } from '@/lib/engines/focusContext';

export function useFocusTimer(session: FocusSession | null, now: number) {
    const elapsedMs = session ? getFocusElapsedMs(session, now) : 0;

    const totalSecs = Math.floor(elapsedMs / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;

    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    const formatted = `${mm}:${ss}`;

    return { elapsedMs, totalSecs, formatted };
}
