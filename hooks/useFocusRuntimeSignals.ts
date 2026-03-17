"use client";

import React from "react";
import { FocusCard, FocusSession } from "@/lib/types/focus";

type UseFocusRuntimeSignalsArgs = {
    session: FocusSession | null;
    isEntryRitualActive: boolean;
    activeCarouselCardId: string | null;
    activeEngineToastId: string | null;
    toastCards: FocusCard[];
    foregroundExposureMs?: number;
    setActiveEngineToastId: (toastId: string | null) => void;
    markCardShown: (cardId: string, now?: number) => void;
    recordSessionInteraction: (source?: string, now?: number) => void;
    recordInactivityDetected: (source?: string) => void;
    recordStabilityRecovered: (source?: string) => void;
};

export function useFocusRuntimeSignals({
    session,
    isEntryRitualActive,
    activeCarouselCardId,
    activeEngineToastId,
    toastCards,
    foregroundExposureMs = 900,
    setActiveEngineToastId,
    markCardShown,
    recordSessionInteraction,
    recordInactivityDetected,
    recordStabilityRecovered,
}: UseFocusRuntimeSignalsArgs) {
    const prevToastIdRef = React.useRef<string | null>(null);
    const foregroundExposureTimeoutRef = React.useRef<number | null>(null);

    const trackedSessionId = session?.id ?? null;
    const trackedSessionPaused = session?.isPaused ?? false;
    const trackedSessionEndedAt = session?.endedAt ?? null;

    React.useEffect(() => {
        if (!trackedSessionId || isEntryRitualActive || trackedSessionPaused || trackedSessionEndedAt) return;

        let lastActivityAt = Date.now();
        let inactivityRaised = false;

        const handleActivity = (source: string) => {
            const timestamp = Date.now();
            lastActivityAt = timestamp;
            recordSessionInteraction(source, timestamp);

            if (inactivityRaised) {
                inactivityRaised = false;
                recordStabilityRecovered(source);
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                handleActivity("visibility_visible");
            }
        };

        const interval = window.setInterval(() => {
            if (!inactivityRaised && Date.now() - lastActivityAt >= 90_000) {
                inactivityRaised = true;
                recordInactivityDetected("focus_runtime_idle");
            }
        }, 15_000);

        const onPointerDown = () => handleActivity("pointerdown");
        const onKeyDown = () => handleActivity("keydown");
        const onTouchStart = () => handleActivity("touchstart");

        window.addEventListener("pointerdown", onPointerDown, { passive: true });
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("touchstart", onTouchStart, { passive: true });
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("touchstart", onTouchStart);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [
        isEntryRitualActive,
        recordInactivityDetected,
        recordSessionInteraction,
        recordStabilityRecovered,
        trackedSessionEndedAt,
        trackedSessionId,
        trackedSessionPaused,
    ]);

    React.useEffect(() => {
        if (foregroundExposureTimeoutRef.current !== null) {
            window.clearTimeout(foregroundExposureTimeoutRef.current);
            foregroundExposureTimeoutRef.current = null;
        }

        if (!activeCarouselCardId) return;

        foregroundExposureTimeoutRef.current = window.setTimeout(() => {
            markCardShown(activeCarouselCardId, Date.now());
        }, foregroundExposureMs);

        return () => {
            if (foregroundExposureTimeoutRef.current !== null) {
                window.clearTimeout(foregroundExposureTimeoutRef.current);
                foregroundExposureTimeoutRef.current = null;
            }
        };
    }, [activeCarouselCardId, foregroundExposureMs, markCardShown]);

    React.useEffect(() => {
        const toastIds = toastCards.map((toast) => toast.id);
        if (toastIds.length === 0) {
            setActiveEngineToastId(null);
            return;
        }

        if (!activeEngineToastId || !toastIds.includes(activeEngineToastId)) {
            setActiveEngineToastId(toastIds[0]);
        }
    }, [activeEngineToastId, setActiveEngineToastId, toastCards]);

    React.useEffect(() => {
        const toastId = activeEngineToastId;
        if (toastId && toastId !== prevToastIdRef.current) {
            markCardShown(toastId, Date.now());
        }
        prevToastIdRef.current = toastId;
    }, [activeEngineToastId, markCardShown]);
}
