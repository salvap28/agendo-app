"use client";

import React, { useState } from 'react';
import { useGymStore } from '@/lib/stores/gymStore';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GlassButton } from '@/components/ui/glass-button';

const COLORS = [
    '#5E5CE6', '#32ADE6', '#FF9500', '#34C759',
    '#FF2D55', '#00C7BE', '#FF3B30', '#FFCC00',
    '#A2845E', '#8E8E93'
];

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function GymRoutineConfigModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const { addRoutine } = useGymStore();

    const [name, setName] = useState('');
    const [color, setColor] = useState(COLORS[2]);
    const [plannedDays, setPlannedDays] = useState<number[]>([]);
    const [restSec, setRestSec] = useState(180);

    // Mocking an exercise add
    const [exInput, setExInput] = useState('');
    const [exercises, setExercises] = useState<{ id: string, name: string }[]>([]);

    if (!open) return null;

    const handleSave = () => {
        if (!name.trim()) return;
        addRoutine({
            name,
            color,
            rep_type: 'Reps',
            planned_days: plannedDays,
            rest_timer_sec: restSec,
            exercises
        });
        onOpenChange(false);
        // Reset
        setName('');
        setExercises([]);
        setPlannedDays([]);
    };

    const toggleDay = (idx: number) => {
        setPlannedDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-[400px] bg-black/60 backdrop-blur-3xl rounded-[40px] border border-white/[0.07] overflow-hidden flex flex-col shadow-[0_8px_40px_rgba(0,0,0,0.5)] relative">

                {/* Header */}
                <div className="px-6 pt-6 pb-2 flex justify-between items-center text-white">
                    <div className="text-white/40 text-sm font-medium">Nueva rutina</div>
                    <GlassButton
                        onClick={() => onOpenChange(false)}
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10"
                    >
                        <X className="w-4 h-4 text-white/50" />
                    </GlassButton>
                </div>

                <div className="px-6 pb-6 mt-2 flex-1 max-h-[70vh] overflow-y-auto scrollbar-none">
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Nombre de la rutina"
                        className="w-full bg-transparent text-3xl font-bold text-white placeholder:text-white/20 focus:outline-none mb-8"
                    />

                    {/* Color Picker */}
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-5 mb-4 group transition-all">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: color }}>
                                <div className="w-2 h-2 rounded-full bg-black/40"></div>
                            </div>
                            <span className="text-white font-medium text-sm">Color</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    className={cn("w-8 h-8 rounded-full transition-transform hover:scale-110", color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#1c1c1e]" : "")}
                                    style={{ background: c }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Planning */}
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-5 mb-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <span className="text-white font-medium text-sm">Planning</span>
                        </div>
                        <div className="flex gap-1.5">
                            {DAYS.map((d, i) => {
                                const active = plannedDays.includes(i);
                                return (
                                    <button
                                        key={i}
                                        onClick={() => toggleDay(i)}
                                        className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all", active ? "bg-white text-black" : "bg-white/5 text-white/40")}
                                    >
                                        {d}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Rest Timer */}
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-5 mb-4 flex justify-between items-center">
                        <div className="flex flex-col">
                            <span className="text-white font-medium text-sm">Rest timer</span>
                        </div>
                        <select
                            value={restSec}
                            onChange={e => setRestSec(Number(e.target.value))}
                            className="bg-transparent text-white/60 text-sm font-medium focus:outline-none cursor-pointer text-right appearance-none"
                        >
                            <option value={60}>1 min</option>
                            <option value={90}>1 min 30 s</option>
                            <option value={120}>2 min</option>
                            <option value={180}>3 min</option>
                            <option value={300}>5 min</option>
                        </select>
                    </div>

                    {/* Exercises */}
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-5 mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-white font-medium text-sm">Ejercicios ({exercises.length})</span>
                        </div>
                        <div className="flex flex-col gap-2 mb-4">
                            {exercises.map((ex, i) => (
                                <div key={ex.id} className="text-sm text-white/80 bg-white/[0.05] px-3 py-2 rounded-xl flex justify-between items-center border border-white/[0.05]">
                                    <span>{i + 1}. {ex.name}</span>
                                    <button onClick={() => setExercises(prev => prev.filter(e => e.id !== ex.id))} className="text-white/20 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                                </div>
                            ))}
                        </div>
                        <input
                            type="text"
                            value={exInput}
                            onChange={e => setExInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && exInput.trim()) {
                                    setExercises(prev => [...prev, { id: crypto.randomUUID(), name: exInput.trim() }]);
                                    setExInput('');
                                }
                            }}
                            placeholder="Añadir ejercicio (Enter)..."
                            className="w-full bg-black/40 border border-white/[0.05] text-sm text-white/80 rounded-xl px-4 py-3 placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 mt-auto">
                    <GlassButton
                        onClick={handleSave}
                        variant="gym"
                        className="w-full py-6 rounded-3xl font-extrabold text-black text-lg bg-emerald-500 hover:bg-emerald-400 border-none shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all"
                    >
                        Guardar Rutina
                    </GlassButton>
                </div>
            </div>
        </div>
    );
}
