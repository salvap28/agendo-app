"use client";

import React, { useEffect, useState } from 'react';
import { useFocusStore, getGymLast, getGymRecentExercises } from '@/lib/stores/focusStore';
import { GymLayerConfig, GymExerciseLog } from '@/lib/types/focus';
import { Dumbbell, Plus, RotateCcw, Trash2, ChevronDown, ChevronRight, X, Save, Music2, ExternalLink, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { GlassButton } from '@/components/ui/glass-button';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const EMERALD = '#10b981';
const EMERALD_DIM = 'rgba(16,185,129,0.15)';

// ─── REST COUNTDOWN HOOK ─────────────────────────────────────────────────────

function useGymRestTimer(rest: GymLayerConfig['rest']) {
    const { finishGymRest } = useFocusStore();
    const [now, setNow] = useState(Date.now());
    const [frozenLeft, setFrozenLeft] = useState<number | null>(null);

    // Keep "now" ticking while resting
    useEffect(() => {
        if (!rest.isResting) return;
        setNow(Date.now());
        const id = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(id);
    }, [rest.isResting]);

    // Handle finish condition and track frozen state
    useEffect(() => {
        if (!rest.isResting || !rest.restStartedAt || !rest.selectedSec) return;

        const started = new Date(rest.restStartedAt).getTime();
        const elapsed = (now - started) / 1000;
        const left = Math.max(0, rest.selectedSec - elapsed);

        setFrozenLeft(Math.ceil(left));

        if (left <= 0) finishGymRest();
    }, [now, rest, finishGymRest]);

    // Synchronously derived state during the render cycle to prevent 1-frame flash to 0
    if (rest.isResting && rest.restStartedAt && rest.selectedSec) {
        const started = new Date(rest.restStartedAt).getTime();
        const elapsed = (now - started) / 1000;
        return Math.ceil(Math.max(0, rest.selectedSec - elapsed));
    }

    // When fading out (not resting), use the frozen number
    return frozenLeft;
}

// ─── SVG CIRCULAR REST RING ──────────────────────────────────────────────────

function CircularRestRing({ rest }: { rest: GymLayerConfig['rest'] }) {
    const { cancelGymRest } = useFocusStore();
    const secondsLeft = useGymRestTimer(rest);
    const total = rest.selectedSec ?? 60;
    const progress = secondsLeft !== null ? secondsLeft / total : 0;

    // Entrance animation state
    const [entrance, setEntrance] = useState(true);
    useEffect(() => {
        let timer: any;
        const frame1 = requestAnimationFrame(() => {
            timer = setTimeout(() => setEntrance(false), 50); // slight delay to ensure DOM is ready
        });
        return () => {
            cancelAnimationFrame(frame1);
            clearTimeout(timer);
        };
    }, []);

    const R = 36;
    const circumference = 2 * Math.PI * R;
    const dash = circumference * (entrance ? 0 : progress);
    const gap = circumference - dash;

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative w-[88px] h-[88px] flex items-center justify-center">
                {/* Glow halo with smooth scale/opacity entrance */}
                <div
                    className={cn(
                        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140px] h-[140px] rounded-full blur-2xl transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1)",
                        entrance ? "opacity-0 scale-50" : "opacity-20 scale-100"
                    )}
                    style={{ background: EMERALD }}
                />
                <svg width="88" height="88" className="absolute inset-0 -rotate-90" overflow="visible">
                    {/* Track */}
                    <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                    {/* Progress */}
                    <circle
                        cx="44" cy="44" r={R}
                        fill="none"
                        stroke={EMERALD}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${gap}`}
                        style={{
                            transition: 'stroke-dasharray 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                            filter: `drop-shadow(0 0 ${entrance ? 0 : 6}px ${EMERALD})`
                        }}
                    />
                </svg>
                <div className={cn("relative z-10 flex flex-col items-center leading-none transition-all duration-700 delay-100", entrance ? "opacity-0 scale-90 translate-y-2" : "opacity-100 scale-100 translate-y-0")}>
                    <span className="text-xl font-bold tabular-nums text-white">{secondsLeft ?? 0}</span>
                    <span className="text-[9px] uppercase tracking-widest text-white/40 mt-0.5">seg</span>
                </div>
            </div>
            <GlassButton
                onClick={cancelGymRest}
                variant="gym"
                size="sm"
                className={cn("mt-2 h-7 px-3 text-[11px] rounded-lg bg-transparent border-transparent hover:bg-white/5 transition-all duration-500 delay-200", entrance ? "opacity-0 translate-y-2" : "opacity-100 text-white/50 translate-y-0")}
            >
                Cancelar

            </GlassButton>
        </div>
    );
}

// ─── PROGRESS BAR ────────────────────────────────────────────────────────────

function ExerciseProgressBar({ completed, total }: { completed: number; total: number }) {
    if (total === 0) return null;
    const progress = Math.max(0, Math.min(completed / total, 1));
    return (
        <div className="w-full h-1.5 rounded-full bg-white/[0.05] overflow-hidden mt-1 mb-4 flex">
            <div
                className="h-full bg-gradient-to-r from-emerald-900/80 via-emerald-600 to-emerald-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                style={{ width: `${progress * 100}%` }}
            />
        </div>
    );
}

// ─── ADD EXERCISE INLINE ─────────────────────────────────────────────────────

function AddExerciseInline({ onAdd }: { onAdd: (name: string) => void }) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('');
    const [recents] = useState<string[]>(() => getGymRecentExercises());

    const filtered = recents.filter(r =>
        !value.length || r.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 4);

    const handle = (name: string) => {
        if (!name.trim()) return;
        onAdd(name.trim());
        setValue('');
        setOpen(false);
    };

    if (!open) {
        return (
            <GlassButton
                onClick={() => setOpen(true)}
                variant="gym"
                style={{ background: "rgba(255,255,255,0.02)" }}
                className="w-full rounded-xl h-11 justify-start border-dashed border-white/10 text-white/40 hover:text-emerald-400 hover:border-emerald-500/40"
            >
                <Plus className="w-3.5 h-3.5 mr-2" />
                Agregar ejercicio
            </GlassButton>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <input
                type="text"
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle(value)}
                placeholder="Nombre del ejercicio..."
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40 focus:bg-emerald-900/10 transition-all"
            />
            {filtered.length > 0 && (
                <div className="flex flex-col gap-0.5">
                    {filtered.map(r => (
                        <button
                            key={r}
                            onClick={() => handle(r)}
                            className="text-left px-2 py-1.5 text-xs text-white/50 hover:text-emerald-300 hover:bg-emerald-900/10 rounded-lg transition-all"
                        >
                            {r}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <GlassButton
                    onClick={() => handle(value)}
                    disabled={!value.trim()}
                    variant="gym"
                    className="flex-1 rounded-xl bg-emerald-500/90 text-black font-semibold hover:bg-emerald-400"
                >
                    Agregar
                </GlassButton>
                <GlassButton
                    onClick={() => setOpen(false)}
                    size="icon"
                    className="w-9 h-9 rounded-xl bg-transparent border-transparent hover:bg-white/5 text-white/30 hover:text-white"
                >
                    <X className="w-4 h-4" />
                </GlassButton>
            </div>
        </div>
    );
}

// ─── EXERCISE ACCORDION ITEM ─────────────────────────────────────────────────

function GymExerciseAccordionItem({
    exercise,
    isActive,
    onSelect,
    isOnly,
}: {
    exercise: GymExerciseLog;
    isActive: boolean;
    onSelect: () => void;
    isOnly: boolean;
}) {
    const { addEmptyGymSet, updateGymSet, deleteGymSet, updateGymExercise } = useFocusStore();
    const last = getGymLast(exercise.name);
    const completedSets = exercise.sets.filter(s => s.isCompleted).length;
    const totalSets = exercise.sets.length;

    return (
        <div className={cn(
            "rounded-2xl border transition-all duration-300",
            isActive
                ? "border-emerald-500/20 bg-emerald-950/20"
                : "border-white/[0.06] bg-white/[0.02]"
        )}
            style={isActive ? { boxShadow: '0 0 24px rgba(16,185,129,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' } : undefined}
        >
            {/* Header row */}
            <GlassButton
                variant="ghost"
                onClick={onSelect}
                className="w-full h-auto py-3 px-4 rounded-none border-transparent justify-between"
            >
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span className={cn(
                        "text-sm font-semibold truncate transition-colors duration-200",
                        isActive ? "text-white" : "text-white/50"
                    )}>
                        {exercise.name}
                    </span>
                    {!isActive && last && (
                        <span className="text-[10px] text-white/25">
                            Última: {last.weight > 0 ? `${last.weight}kg × ` : ''}{last.reps} reps
                        </span>
                    )}
                </div>
                {!isActive && totalSets > 0 && (
                    <span className="text-[11px] text-emerald-400/70 font-medium tabular-nums">
                        {completedSets}/{totalSets} completados
                    </span>
                )}
                {!isOnly && (
                    isActive
                        ? <ChevronDown className="w-3.5 h-3.5 text-white/30" />
                        : <ChevronRight className="w-3.5 h-3.5 text-white/20" />
                )}
            </GlassButton>

            {/* Expanded: set blocks + input + history */}
            {isActive && (
                <div className="px-4 pb-4 flex flex-col gap-4 animate-in slide-in-from-top-1 duration-200">

                    {/* Auto-rest config row */}
                    <div className="flex items-center justify-between pt-2 pb-3 mb-1 border-b border-white/5">
                        <span className="text-[10px] uppercase tracking-widest text-white/30 font-medium">Lanzar descanso auto. al finalizar serie</span>
                        <select
                            value={exercise.programmedRest || 0}
                            onChange={e => updateGymExercise(exercise.id, { programmedRest: Number(e.target.value) })}
                            className="bg-black/40 border border-white/10 rounded-lg text-[11px] text-emerald-400 font-medium px-2 py-1.5 focus:outline-none focus:border-emerald-500/40 cursor-pointer"
                        >
                            <option value={0}>Inactivo</option>
                            <option value={60}>60 seg</option>
                            <option value={90}>90 seg</option>
                            <option value={120}>120 seg</option>
                            <option value={150}>150 seg</option>
                            <option value={180}>180 seg</option>
                        </select>
                    </div>

                    {/* Exercise identity row */}
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-emerald-500/60 font-medium">
                                Set actual
                            </p>
                            <p className="text-3xl font-bold text-white tabular-nums leading-tight">
                                {completedSets}
                                <span className="text-white/20 text-lg font-normal ml-1">/ {totalSets}</span>
                            </p>
                        </div>
                        {last && (
                            <div className="text-right">
                                <p className="text-[10px] uppercase tracking-widest text-white/25 font-medium">Última vez</p>
                                <p className="text-sm text-white/50 tabular-nums">
                                    {last.weight > 0 ? `${last.weight}kg × ` : ''}{last.reps}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Visual set progress bar */}
                    <ExerciseProgressBar completed={completedSets} total={totalSets} />

                    {/* Interactive Sets List */}
                    <div className="flex flex-col gap-2">
                        {exercise.sets.map((set, i) => (
                            <div key={set.id} className={cn(
                                "flex items-center gap-2 py-1 px-2 -mx-2 rounded-xl transition-all",
                                set.isCompleted ? "bg-emerald-950/20" : "hover:bg-white/[0.02]"
                            )}>
                                {/* Set number badge */}
                                <div className={cn(
                                    "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums shrink-0 transition-colors",
                                    set.isCompleted ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/30"
                                )}>
                                    {i + 1}
                                </div>

                                {/* Weight Input */}
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={set.weight || ''}
                                        onChange={e => updateGymSet(exercise.id, set.id, { weight: parseFloat(e.target.value) || 0 })}
                                        disabled={set.isCompleted}
                                        placeholder="0"
                                        className={cn(
                                            "w-full bg-white/[0.05] border border-white/10 rounded-lg pl-3 pr-7 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 transition-all font-medium tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                            set.isCompleted && "opacity-50"
                                        )}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30 uppercase tracking-widest pointer-events-none">
                                        kg
                                    </span>
                                </div>

                                {/* Reps Input */}
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={set.reps || ''}
                                        onChange={e => updateGymSet(exercise.id, set.id, { reps: parseInt(e.target.value, 10) || 0 })}
                                        disabled={set.isCompleted}
                                        placeholder="0"
                                        className={cn(
                                            "w-full bg-white/[0.05] border border-white/10 rounded-lg pl-3 pr-9 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 transition-all font-medium tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                            set.isCompleted && "opacity-50"
                                        )}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30 uppercase tracking-widest pointer-events-none">
                                        reps
                                    </span>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <GlassButton
                                        onClick={() => updateGymSet(exercise.id, set.id, { isCompleted: !set.isCompleted })}
                                        size="icon"
                                        style={set.isCompleted ? { background: "#10b981", color: "black", borderColor: "#34d399", boxShadow: "0 0 12px rgba(16,185,129,0.3)" } : undefined}
                                        className={cn(
                                            "w-9 h-9 rounded-xl",
                                            !set.isCompleted && "bg-white/5 border-white/10 text-white/30 hover:bg-white/10 hover:text-white/80"
                                        )}
                                    >
                                        {set.isCompleted ? <Check className="w-5 h-5" strokeWidth={3} /> : <Check className="w-5 h-5 opacity-50" />}
                                    </GlassButton>
                                    <GlassButton
                                        onClick={() => deleteGymSet(exercise.id, set.id)}
                                        size="icon"
                                        className="w-8 h-8 rounded-lg bg-transparent border-transparent text-white/20 hover:text-red-400 hover:bg-red-400/10"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </GlassButton>
                                </div>
                            </div>
                        ))}

                        {/* Empty state hook */}
                        {totalSets === 0 && (
                            <p className="text-[11px] text-white/20 text-center py-2">No hay series registradas.</p>
                        )}
                    </div>

                    {/* Add empty set button */}
                    <GlassButton
                        onClick={() => addEmptyGymSet(exercise.id)}
                        variant="gym"
                        className="mt-2 w-full rounded-xl text-[12px] bg-white/[0.02] border-dashed border-white/10 text-emerald-400/70 hover:bg-emerald-500/10 hover:border-emerald-500/30"
                    >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Añadir serie
                    </GlassButton>
                </div>
            )}
        </div>
    );
}

// ─── REST SQUARE PANEL ───────────────────────────────────────────────────────

function GymRestSquare({ rest }: { rest: GymLayerConfig['rest'] }) {
    const { startGymRest } = useFocusStore();
    const options = [60, 90, 120, 150];

    return (
        <div
            className="aspect-square bg-black/40 backdrop-blur-3xl border border-white/[0.07] rounded-3xl p-6 relative flex flex-col"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.05)' }}
        >
            <GlowingEffect spread={50} proximity={90} inactiveZone={0.01} borderWidth={1} disabled={false} variant="emerald" />

            {/* Rest Ring (Fades in when resting) */}
            <div className={cn(
                "absolute inset-0 flex items-center justify-center transition-all duration-700 ease-out",
                rest.isResting ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            )}>
                <CircularRestRing key={rest.restStartedAt || 'empty'} rest={rest} />
            </div>

            {/* Options grid (Fades out when resting) */}
            <div className={cn(
                "w-full h-full flex flex-col transition-all duration-500 ease-out",
                rest.isResting ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
            )}>
                <div className="flex items-center justify-between mb-4 px-1">
                    <span className="text-xs uppercase tracking-widest text-emerald-500/80 font-semibold">Descanso manual</span>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                    {options.map(sec => (
                        <GlassButton
                            key={sec}
                            onClick={() => startGymRest(sec)}
                            variant="gym"
                            className="flex flex-col items-center justify-center p-0 h-24 rounded-2xl border border-white/[0.04] bg-white/[0.01] hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 text-white/40"
                        >
                            <span className="text-3xl font-bold tabular-nums z-10">{sec}</span>
                            <span className="text-[9px] uppercase tracking-widest text-white/20 mt-1 z-10">seg</span>
                        </GlassButton>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── MUSIC MINI CARD ─────────────────────────────────────────────────────────

function MusicMiniCard() {
    return (
        <div
            className="bg-black/40 backdrop-blur-3xl border border-white/[0.07] rounded-3xl p-5 flex flex-col gap-4"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.05)' }}
        >
            <GlowingEffect spread={40} proximity={80} inactiveZone={0.01} borderWidth={1} disabled={false} variant="emerald" />
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <Music2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/30 font-medium">Track sugerido</p>
                    <p className="text-sm text-white/80 font-medium">Workout Playlist</p>
                </div>
            </div>
            <a
                href="https://open.spotify.com/playlist/37i9dQZF1DXdxcBWuJkbcy"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2 text-xs font-medium text-white/60 hover:text-white"
            >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir en Spotify
            </a>
        </div>
    );
}

// ─── MAIN PANEL ───────────────────────────────────────────────────────────────

export function GymTrackerPanel() {
    const { session, addGymExercise, selectGymExercise } = useFocusStore();

    if (!session?.activeLayer || session.activeLayer.kind !== 'gymMode') return null;

    const cfg = session.activeLayer.config as GymLayerConfig;
    const exercises = cfg?.exercises || [];
    const activeExerciseId = cfg?.activeExerciseId;
    const rest = cfg?.rest || { isResting: false };

    return (
        <div className="w-full max-w-4xl mx-auto mb-3 animate-in slide-in-from-bottom-4 fade-in duration-500 flex flex-col md:flex-row items-stretch gap-6">

            {/* ── LEFT PANEL: Exercises ── */}
            <div className="flex-1 flex flex-col min-w-0">
                <div
                    className="flex-1 bg-black/40 backdrop-blur-3xl border border-white/[0.07] rounded-3xl flex flex-col"
                    style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.05)' }}
                >
                    <GlowingEffect spread={60} proximity={100} inactiveZone={0.01} borderWidth={1} disabled={false} variant="emerald" />
                    {/* PANEL HEADER */}
                    <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.05]">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{ background: EMERALD_DIM }}
                            >
                                <Dumbbell className="w-4 h-4 text-emerald-400" />
                            </div>
                            <span className="text-base font-semibold text-white/90 tracking-tight">Entrenamiento</span>
                        </div>
                    </div>

                    {/* EXERCISE LIST */}
                    <div className="px-5 py-4 flex flex-col gap-3 flex-1 overflow-y-auto scrollbar-none">
                        {exercises.length === 0 && (
                            <p className="text-center text-white/20 text-sm py-8 tracking-wide">
                                Agregá tu primer ejercicio para comenzar
                            </p>
                        )}
                        {exercises.map(ex => (
                            <GymExerciseAccordionItem
                                key={ex.id}
                                exercise={ex}
                                isActive={ex.id === activeExerciseId}
                                isOnly={exercises.length === 1}
                                onSelect={() => selectGymExercise(ex.id)}
                            />
                        ))}
                        <AddExerciseInline onAdd={addGymExercise} />
                    </div>
                </div>
            </div>

            {/* ── RIGHT COLUMN: Rest & Music ── */}
            <div className="w-full md:w-80 shrink-0 flex flex-col gap-6">
                <GymRestSquare rest={rest} />
                <MusicMiniCard />
            </div>

        </div>
    );
}
