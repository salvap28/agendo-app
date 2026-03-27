"use client";

import { useEffect, useReducer } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";

interface PerformanceConfig {
    isLowEnd: boolean;
    prefersReducedMotion: boolean;
    isLiteMode: boolean;
}

export function usePerformancePreference(): PerformanceConfig {
    const { settings } = useSettingsStore();
    const [, forceRender] = useReducer((value: number) => value + 1, 0);

    useEffect(() => {
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleChange = () => forceRender();

        motionQuery.addEventListener('change', handleChange);

        return () => {
            motionQuery.removeEventListener('change', handleChange);
        };
    }, []);

    const isLiteMode = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get('lite') === 'true'
        : false;
    const prefersReducedMotion = typeof window !== "undefined"
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    return {
        isLowEnd: settings.performance_mode || isLiteMode,
        prefersReducedMotion,
        isLiteMode,
    };
}
