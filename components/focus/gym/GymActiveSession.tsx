"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useFocusStore } from "@/lib/stores/focusStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { GymLayerConfig } from "@/lib/types/focus";
import { Check, Play } from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { GlassButton } from "@/components/ui/glass-button";
import { cn } from "@/lib/cn";
import { sendNotification } from "@/lib/utils/notifications";
import { useI18n } from "@/lib/i18n/client";
import { getGymActiveSessionCopy } from "@/lib/i18n/ui";

function RestOverlay({ config, language }: { config: GymLayerConfig; language: "en" | "es" }) {
    const { settings } = useSettingsStore();
    const { cancelGymRest, finishGymRest } = useFocusStore();
    const [left, setLeft] = useState(config.rest.selectedSec || 0);
    const workoutColor = config.workoutColor || "#10b981";
    const copy = getGymActiveSessionCopy(language);
    const warningSentRef = React.useRef<string | null>(null);

    useEffect(() => {
        if (!config.rest.isResting || !config.rest.restStartedAt) return;

        const interval = setInterval(() => {
            const started = new Date(config.rest.restStartedAt!).getTime();
            const elapsed = (Date.now() - started) / 1000;
            const remaining = Math.max(0, (config.rest.selectedSec || 0) - elapsed);
            setLeft(Math.ceil(remaining));

            if (config.rest.selectedSec && config.rest.selectedSec > 60 && remaining <= 60 && remaining > 0) {
                if (warningSentRef.current !== config.rest.restStartedAt) {
                    warningSentRef.current = config.rest.restStartedAt ?? null;
                    sendNotification("Falta 1 minuto", {
                        body: "Tu descanso en el gimnasio está por terminar. ¡Prepárate para la siguiente serie!",
                        icon: "/favicon.ico",
                        requireInteraction: true,
                    });
                }
            }

            if (remaining <= 0) {
                if (settings.notify_gym_rest !== false) {
                    sendNotification(copy.restFinishedTitle, {
                        body: copy.restFinishedBody,
                        icon: "/favicon.ico",
                        requireInteraction: true,
                    });
                }
                finishGymRest();
            }
        }, 250);

        return () => clearInterval(interval);
    }, [
        config.rest.isResting,
        config.rest.restStartedAt,
        config.rest.selectedSec,
        copy.restFinishedBody,
        copy.restFinishedTitle,
        finishGymRest,
        settings.notify_gym_rest,
    ]);

    if (!config.rest.isResting) return null;

    const minutes = Math.floor(left / 60);
    const seconds = left % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    return (
        <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
            <div className="w-48 h-48 rounded-full border-4 border-white/10 flex items-center justify-center mb-8 relative">
                <span className="text-6xl font-black text-white tracking-tighter tabular-nums">{timeStr}</span>
                <svg className="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 100 100">
                    <circle
                        cx="50"
                        cy="50"
                        r="48"
                        fill="none"
                        stroke={workoutColor}
                        strokeWidth="4"
                        strokeDasharray={`${(left / (config.rest.selectedSec || 1)) * 301} 301`}
                        className="transition-all duration-1000 linear drop-shadow-lg"
                        style={{ filter: `drop-shadow(0 0 10px ${workoutColor}80)` }}
                    />
                </svg>
            </div>
            <GlassButton
                onClick={cancelGymRest}
                variant="gym"
                className="px-8 py-5 rounded-full text-black font-bold tracking-wide transition-all border-none"
                style={{ backgroundColor: workoutColor, boxShadow: `0 0 20px ${workoutColor}66` }}
            >
                {copy.skipRest}
            </GlassButton>
        </div>
    );
}

export function GymActiveSession({ config }: { config: GymLayerConfig }) {
    const { language } = useI18n();
    const { addEmptyGymSet, updateGymSet, selectGymExercise, setLayer } = useFocusStore();
    const workoutColor = config.workoutColor || "#10b981";
    const copy = useMemo(() => getGymActiveSessionCopy(language), [language]);

    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const intervalId = setInterval(() => setSeconds((current) => current + 1), 1000);
        return () => clearInterval(intervalId);
    }, []);

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const activeExercise = config.exercises.find((exercise) => exercise.id === config.activeExerciseId) || config.exercises[0];

    return (
        <div className="w-full max-w-[400px] h-[750px] bg-black/40 backdrop-blur-3xl rounded-[40px] border border-white/[0.07] overflow-hidden flex flex-col relative shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
            <GlowingEffect
                spread={80}
                proximity={120}
                inactiveZone={0.01}
                borderWidth={1}
                disabled={false}
                customGradient={`radial-gradient(circle, ${workoutColor} 10%, transparent 20%),
                       radial-gradient(circle at 40% 40%, ${workoutColor}aa 5%, transparent 15%),
                       radial-gradient(circle at 60% 60%, ${workoutColor}dd 10%, transparent 20%),
                       radial-gradient(circle at 40% 60%, ${workoutColor}88 10%, transparent 20%),
                       repeating-conic-gradient(from 236.84deg at 50% 50%, ${workoutColor} 0%, ${workoutColor}aa calc(25% / var(--repeating-conic-gradient-times)), ${workoutColor}dd calc(50% / var(--repeating-conic-gradient-times)), ${workoutColor}88 calc(75% / var(--repeating-conic-gradient-times)), ${workoutColor} calc(100% / var(--repeating-conic-gradient-times)))`}
            />

            <div className="px-6 pt-10 pb-4 flex justify-between items-center text-white sticky top-0 bg-transparent z-20">
                <div>
                    <h1
                        className="text-[22px] font-extrabold tracking-tight relative"
                        style={{ color: workoutColor, textShadow: `0 0 20px ${workoutColor}80` }}
                    >
                        {activeExercise?.name || copy.workoutFallback}
                    </h1>
                </div>
                <div className="flex items-center gap-2 text-white/50 text-sm font-medium tabular-nums">
                    <Play className="w-3.5 h-3.5" />
                    {minutes.toString().padStart(2, "0")}:{remainingSeconds.toString().padStart(2, "0")}
                </div>
            </div>

            <div className="flex gap-2 px-6 overflow-x-auto scrollbar-none pb-4">
                {config.exercises?.map((exercise) => (
                    <button
                        key={exercise.id}
                        onClick={() => selectGymExercise(exercise.id)}
                        className={cn(
                            "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors",
                            exercise.id === config.activeExerciseId ? "bg-white/20 text-white" : "bg-white/5 text-white/40",
                        )}
                    >
                        {exercise.name}
                    </button>
                ))}
            </div>

            <div className="px-6 flex-1 overflow-y-auto scrollbar-none pb-32">
                <div className="flex justify-between items-center mb-6 px-1">
                    <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest">
                        <Play className="w-3.5 h-3.5" />
                        {Math.floor((activeExercise?.programmedRest || 180) / 60)}:00 {copy.rest}
                    </div>
                    <div className="flex items-center gap-2 text-white/40 text-xs font-bold">
                        {copy.warmUp}
                        <div className="w-8 h-4 rounded-full bg-white/10 relative">
                            <div className="w-3 h-3 rounded-full bg-white/50 absolute left-0.5 top-0.5" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-[3rem_1fr_1fr] gap-4 mb-2 px-2">
                    <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest text-center">{copy.set}</div>
                    <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest text-center">{copy.reps}</div>
                    <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest text-center">{copy.weight}</div>
                </div>

                <div className="flex flex-col gap-2">
                    {activeExercise?.sets.map((set, index) => (
                        <div
                            key={set.id}
                            className={cn(
                                "grid grid-cols-[3rem_1fr_1fr] gap-4 items-center rounded-3xl p-2 border border-white/[0.05] transition-all",
                                set.isCompleted ? "bg-black/50 opacity-50" : "bg-white/[0.02]",
                            )}
                        >
                            <button
                                onClick={() => updateGymSet(activeExercise.id, set.id, { isCompleted: !set.isCompleted })}
                                className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all mx-auto",
                                    set.isCompleted ? "text-white border" : "bg-black/40 text-white/40 border border-white/5",
                                )}
                                style={set.isCompleted ? { backgroundColor: `${workoutColor}33`, borderColor: `${workoutColor}4D`, color: workoutColor, boxShadow: `0 0 15px ${workoutColor}40` } : {}}
                            >
                                {set.isCompleted ? <Check className="w-5 h-5" /> : (index + 1)}
                            </button>

                            <input
                                type="number"
                                value={set.reps || ""}
                                onChange={(event) => updateGymSet(activeExercise.id, set.id, { reps: parseInt(event.target.value, 10) || 0 })}
                                className="w-full bg-transparent text-center text-xl font-bold text-white placeholder:text-white/20 focus:outline-none"
                                placeholder="10"
                            />

                            <div className="relative flex items-center justify-center">
                                <input
                                    type="number"
                                    value={set.weight || ""}
                                    onChange={(event) => updateGymSet(activeExercise.id, set.id, { weight: parseFloat(event.target.value) || 0 })}
                                    className="w-full bg-transparent text-center text-xl font-bold text-white placeholder:text-white/20 focus:outline-none pr-4 mix-w-[60px]"
                                    placeholder="-"
                                />
                                {set.weight > 0 && <span className="absolute right-0 text-[10px] text-white/30 top-1/2 -translate-y-1/2">kg</span>}
                            </div>
                        </div>
                    ))}

                    <GlassButton
                        onClick={() => activeExercise && addEmptyGymSet(activeExercise.id)}
                        variant="ghost"
                        className="w-full py-6 mt-2 rounded-3xl bg-transparent border border-white/10 text-white/40 font-bold text-sm hover:bg-white/5 transition-all"
                    >
                        {copy.addSet}
                    </GlassButton>
                </div>
            </div>

            <div className="absolute bottom-6 left-6 right-6 z-10">
                <GlassButton
                    onClick={() => setLayer(null)}
                    variant="gym"
                    className="w-full py-6 rounded-3xl font-extrabold text-black text-lg border-none transition-all"
                    style={{ backgroundColor: workoutColor, boxShadow: `0 0 30px ${workoutColor}66` }}
                >
                    {copy.finishWorkout}
                </GlassButton>
            </div>

            <RestOverlay config={config} language={language} />
        </div>
    );
}
