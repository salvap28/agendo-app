"use client";

import React from 'react';
import { useFocusStore } from '@/lib/stores/focusStore';
import { GymLayerConfig } from '@/lib/types/focus';
import { GymDashboard } from './gym/GymDashboard';
import { GymActiveSession } from './gym/GymActiveSession';

export function GymTrackerPanel() {
    const { session } = useFocusStore();

    if (!session?.activeLayer || session.activeLayer.kind !== 'gymMode') return null;

    const cfg = session.activeLayer.config as GymLayerConfig;
    const isWorkoutActive = !!cfg?.activeRoutineId || (cfg?.exercises && cfg.exercises.length > 0);

    return (
        <div className="w-full max-w-4xl mx-auto mb-3 animate-in fade-in duration-500 flex flex-col items-center justify-center min-h-[600px]">
            {isWorkoutActive ? (
                <GymActiveSession config={cfg} />
            ) : (
                <GymDashboard />
            )}
        </div>
    );
}
