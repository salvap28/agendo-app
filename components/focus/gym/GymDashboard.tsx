"use client";

import React, { useEffect, useState } from 'react';
import { useGymStore } from '@/lib/stores/gymStore';
import { useFocusStore } from '@/lib/stores/focusStore';
import { GymRoutineConfigModal } from './GymRoutineConfigModal';
import { Plus, Dumbbell, Activity, BarChart2 } from 'lucide-react';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { GlassButton } from '@/components/ui/glass-button';
import { cn } from '@/lib/cn';

export function GymDashboard() {
    const { routines, fetchRoutines, isLoading, isInitialized } = useGymStore();
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const { startGymWorkout } = useFocusStore();

    useEffect(() => {
        if (!isInitialized) fetchRoutines();
    }, [isInitialized, fetchRoutines]);

    return (
        <div className="w-full max-w-[400px] h-[750px] bg-black/40 backdrop-blur-3xl rounded-[40px] border border-white/[0.07] overflow-hidden flex flex-col relative shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
            {/* Dynamic Glow Based on First Routine or Emerald default */}
            <GlowingEffect
                spread={80}
                proximity={120}
                inactiveZone={0.01}
                borderWidth={1}
                disabled={false}
                customGradient={
                    routines.length > 0 && routines[0].color
                        ? `radial-gradient(circle, ${routines[0].color} 10%, transparent 20%),
                       radial-gradient(circle at 40% 40%, ${routines[0].color}aa 5%, transparent 15%),
                       radial-gradient(circle at 60% 60%, ${routines[0].color}dd 10%, transparent 20%),
                       radial-gradient(circle at 40% 60%, ${routines[0].color}88 10%, transparent 20%),
                       repeating-conic-gradient(from 236.84deg at 50% 50%, ${routines[0].color} 0%, ${routines[0].color}aa calc(25% / var(--repeating-conic-gradient-times)), ${routines[0].color}dd calc(50% / var(--repeating-conic-gradient-times)), ${routines[0].color}88 calc(75% / var(--repeating-conic-gradient-times)), ${routines[0].color} calc(100% / var(--repeating-conic-gradient-times)))`
                        : undefined
                }
                variant={routines.length > 0 && routines[0].color ? undefined : "emerald"}
            />

            {/* Header */}
            <div className="px-6 pt-10 pb-6 flex-1 overflow-y-auto scrollbar-none relative z-10">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <Dumbbell className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white/90 tracking-tight">Rutinas</h1>
                    </div>
                    <GlassButton
                        onClick={() => setIsConfigOpen(true)}
                        size="icon"
                        variant="ghost"
                        className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10"
                    >
                        <Plus className="w-5 h-5 text-white/80" />
                    </GlassButton>
                </div>

                {/* Hero / Promoted Action */}
                <div className="w-full rounded-3xl p-5 mb-8 relative overflow-hidden border border-white/10 group cursor-pointer" onClick={() => setIsConfigOpen(true)}>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/5" />
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" style={{ background: routines.length > 0 ? (routines[0].color || '#10b981') : '#10b981' }}></div>
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <h2 className="text-white font-extrabold text-xl mb-1">Nueva Rutina</h2>
                            <p className="text-white/60 text-xs">Crea un plan de ejercicios personalizado</p>
                        </div>
                        <div className="w-10 h-10 rounded-full flex justify-center items-center shadow-lg transition-colors bg-white/10 group-hover:bg-white/20">
                            <Plus className="w-5 h-5 text-white" />
                        </div>
                    </div>
                </div>

                {/* Workouts Grid */}
                <h3 className="text-white font-bold text-lg mb-4">Workouts</h3>

                {isLoading ? (
                    <div className="text-white/40 text-sm">Loading routines...</div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 pb-24">
                        {routines.map(routine => (
                            <div
                                key={routine.id}
                                onClick={() => startGymWorkout?.(routine)}
                                className="bg-white/[0.02] backdrop-blur-md rounded-3xl p-5 border border-white/[0.05] hover:bg-white/[0.05] cursor-pointer transition-all relative overflow-hidden group hover:border-white/10"
                            >
                                <h4 className="text-[15px] font-extrabold mb-3 truncate" style={{ color: routine.color || '#10b981' }}>{routine.name}</h4>

                                <div className="flex items-center gap-2 mb-4">
                                    <Activity className="w-3.5 h-3.5 text-white/30" />
                                    <span className="text-[11px] text-white/40 font-medium">{routine.exercises?.length || 0} ejercicios</span>
                                </div>

                                <div className="flex items-end justify-between">
                                    <div className="flex gap-3">
                                        <div>
                                            <div className="text-lg font-bold text-white leading-none tracking-tight">
                                                {Math.floor(routine.rest_timer_sec / 60)}<span className="text-sm">m</span>
                                            </div>
                                            <div className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Descanso</div>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Plus className="w-4 h-4 text-white/70" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            <GymRoutineConfigModal open={isConfigOpen} onOpenChange={setIsConfigOpen} />
        </div>
    );
}
