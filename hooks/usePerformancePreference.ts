"use client";

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";

interface PerformanceConfig {
    isLowEnd: boolean;
    prefersReducedMotion: boolean;
    isLiteMode: boolean; // Explicit opt-in via URL ?lite=true
}

export function usePerformancePreference(): PerformanceConfig {
    const { settings } = useSettingsStore();
    const [config, setConfig] = useState<PerformanceConfig>({
        isLowEnd: settings.performance_mode,
        prefersReducedMotion: false,
        isLiteMode: false,
    });

    useEffect(() => {
        // 1. Check URL Parameter explicitly
        const urlParams = new URLSearchParams(window.location.search);
        const isLiteMode = urlParams.get('lite') === 'true';

        // 2. Check Reduced Motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // 3. User toggle preference from Settings!
        let isLowEnd = settings.performance_mode;

        setConfig({
            isLowEnd: isLowEnd || isLiteMode,
            prefersReducedMotion,
            isLiteMode,
        });
    }, [settings.performance_mode]);

    return config;
}
