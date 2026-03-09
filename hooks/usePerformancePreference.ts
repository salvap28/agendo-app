"use client";

import { useState, useEffect } from "react";

interface PerformanceConfig {
    isLowEnd: boolean;
    prefersReducedMotion: boolean;
    isLiteMode: boolean; // Explicit opt-in via URL ?lite=true
}

export function usePerformancePreference(): PerformanceConfig {
    const [config, setConfig] = useState<PerformanceConfig>({
        isLowEnd: false,
        prefersReducedMotion: false,
        isLiteMode: false,
    });

    useEffect(() => {
        // 1. Check URL Parameter explicitly
        const urlParams = new URLSearchParams(window.location.search);
        const isLiteMode = urlParams.get('lite') === 'true';

        // 2. Check Reduced Motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // 3. Hardware heuristics (Basic low-end detection)
        let isLowEnd = false;

        // Safari (iOS/macOS) and some other browsers DO NOT support deviceMemory.
        // @ts-ignore
        const deviceMemory = navigator.deviceMemory; 
        const hardwareConcurrency = navigator.hardwareConcurrency; 

        // Integrated GPUs on laptops (like Intel UHD) often share memory and struggle with heavy WebGL bloom/post-processing.
        // A device explicitly reporting 8GB RAM (or less) is almost certainly sharing RAM with an integrated GPU.
        if (deviceMemory !== undefined && deviceMemory <= 8) {
            isLowEnd = true;
        }
        
        // Mobile browsers (like iOS Safari) often restrict reported hardwareConcurrency to 4 or 6, even on powerful chips (like A15/A16).
        // Therefore, we can't use <= 8 as a strict rule without catching iPhones. 
        // We only trigger low-end if cores are extremely restricted (1 or 2).
        if (hardwareConcurrency !== undefined && hardwareConcurrency <= 2) {
            isLowEnd = true;
        }

        setConfig({
            isLowEnd: isLowEnd || isLiteMode,
            prefersReducedMotion,
            isLiteMode,
        });
    }, []);

    return config;
}
