"use client";

import { useEffect, useState } from "react";

type UseFocusNowOptions = {
    isRunning?: boolean;
    frozenAt?: number | null;
    stepMs?: number;
};

export function useFocusNow({
    isRunning = true,
    frozenAt = null,
    stepMs = 1000,
}: UseFocusNowOptions = {}) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (frozenAt !== null || !isRunning) return;

        const interval = window.setInterval(() => {
            setNow(Date.now());
        }, stepMs);

        return () => window.clearInterval(interval);
    }, [frozenAt, isRunning, stepMs]);

    return frozenAt ?? now;
}
