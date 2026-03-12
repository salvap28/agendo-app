"use client";

import React, { useState } from 'react';
import { useFocusStore } from '@/lib/stores/focusStore';
import { useBlocksStore } from '@/lib/stores/blocksStore';
import { CheckCircle, Sparkles, X, Activity, Droplets, Target, Mountain, Smile } from 'lucide-react';
import { GlassButton } from '@/components/ui/glass-button';
import { GlowingEffect } from '@/components/ui/glowing-effect';

const REFLECTION_QUESTIONS = [
    "¿Qué fue lo más valioso de este bloque?",
    "¿Hubo alguna distracción recurrente?",
    "¿Cómo te sentís después de esta sesión?"
];

// Reutilizable Scale Selector (1-5)
function MetricScale({ label, icon: Icon, value, onChange }: { label: string, icon: any, value: number, onChange: (v: number) => void }) {
    return (
        <div className="flex flex-col gap-2 w-full mt-2">
            <div className="flex items-center gap-2 text-white/70 text-sm">
                <Icon className="w-4 h-4 opacity-70" />
                <span>{label}</span>
            </div>
            <div className="flex justify-between gap-1.5 w-full">
                {[1, 2, 3, 4, 5].map(v => (
                    <button
                        key={v}
                        onClick={() => onChange(v)}
                        className={`flex-1 h-10 rounded-xl border transition-all text-sm font-medium ${value === v
                            ? 'bg-indigo-500/30 border-indigo-400/50 text-indigo-100 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                            : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10'
                            }`}
                    >
                        {v}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function ReflectionSheet() {
    const { session, saveReflection } = useFocusStore();
    const { createBlock } = useBlocksStore();

    // Metrics 1-5 scale (0 means no selection)
    const [metrics, setMetrics] = useState({
        energyBefore: 0,
        clarity: 0,
        difficulty: 0,
        progressFeelingAfter: 0,
        moodAfter: 0,
    });

    const [reflection, setReflection] = useState("");
    const [blockTitle, setBlockTitle] = useState("Focus Block");
    const [isSaving, setIsSaving] = useState(false);

    const question = REFLECTION_QUESTIONS[Math.floor(Math.random() * REFLECTION_QUESTIONS.length)];

    const handleClose = () => {
        useFocusStore.setState({ session: null });
    };

    const handleFinish = async () => {
        if (!session || !session.endedAt || isSaving) return;
        setIsSaving(true);

        // 1. Guardar la data agregada en la sesión actual
        await saveReflection({
            energyBefore: metrics.energyBefore > 0 ? metrics.energyBefore : undefined,
            clarity: metrics.clarity > 0 ? metrics.clarity : undefined,
            difficulty: metrics.difficulty > 0 ? metrics.difficulty : undefined,
            progressFeelingAfter: metrics.progressFeelingAfter > 0 ? metrics.progressFeelingAfter : undefined,
            moodAfter: metrics.moodAfter > 0 ? metrics.moodAfter : undefined,
            notes: reflection,
        });

        // 2. Comportamiento especial si es free session (crear bloque a posteriori)
        if (session.mode === "free") {
            createBlock({
                title: blockTitle,
                type: "deep_work",
                startAt: new Date(session.startedAt),
                endAt: new Date(session.endedAt),
                status: "completed",
                notes: reflection,
            });
        }

        // 3. Cerrar el modal
        useFocusStore.setState({ session: null });
        setIsSaving(false);
    };

    if (!session || !session.endedAt) return null;

    const isFree = session.mode === "free";

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6 text-white animate-in fade-in duration-500">
            {/* Blurred background inherited from FocusOverlay, plus extra dark veil */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            {/* Card */}
            <div className="relative z-10 w-full max-w-md flex flex-col gap-5 p-8 rounded-3xl bg-white/[0.04] border border-white/[0.08] shadow-[0_32px_64px_rgba(0,0,0,0.5)] backdrop-blur-3xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 max-h-[90vh] overflow-y-auto no-scrollbar">
                <GlowingEffect spread={40} proximity={80} inactiveZone={0.01} borderWidth={1} variant="default" />

                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/90 transition-all z-20"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="flex flex-col items-center gap-2 text-center mt-2">
                    <div className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center">
                        {isFree
                            ? <Sparkles className="w-6 h-6 text-indigo-300" />
                            : <CheckCircle className="w-6 h-6 text-green-400" />
                        }
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight">
                        {isFree ? "Sesión libre completada" : "Bloque completado"}
                    </h2>
                    <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                        {question}
                    </p>
                </div>

                {/* Metrics 1-5 Grid */}
                <div className="flex flex-col gap-3 py-2 w-full">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <MetricScale label="Sentimiento Previo" icon={Activity} value={metrics.energyBefore} onChange={v => setMetrics({ ...metrics, energyBefore: v })} />
                        <MetricScale label="Claridad Tarea" icon={Target} value={metrics.clarity} onChange={v => setMetrics({ ...metrics, clarity: v })} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <MetricScale label="Dificultad" icon={Mountain} value={metrics.difficulty} onChange={v => setMetrics({ ...metrics, difficulty: v })} />
                        <MetricScale label="Sentimiento Progreso" icon={Droplets} value={metrics.progressFeelingAfter} onChange={v => setMetrics({ ...metrics, progressFeelingAfter: v })} />
                    </div>
                    <div className="w-full">
                        <MetricScale label="Estado de Ánimo Final" icon={Smile} value={metrics.moodAfter} onChange={v => setMetrics({ ...metrics, moodAfter: v })} />
                    </div>
                </div>

                {/* Reflection input */}
                <textarea
                    rows={2}
                    placeholder="Breve nota mental (opcional)..."
                    value={reflection}
                    onChange={e => setReflection(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-colors resize-none leading-relaxed"
                />

                {/* Actions */}
                <div className="flex flex-col gap-3 mt-1">
                    <GlassButton
                        onClick={handleFinish}
                        variant={"primary"}
                        className="w-full rounded-xl"
                        disabled={isSaving}
                    >
                        {isSaving ? "Guardando..." : "Guardar y finalizar"}
                    </GlassButton>
                    {isFree && (
                        <p className="text-xs text-center text-white/30 hidden">
                            Se creará un bloque histórico para esta sesión.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
