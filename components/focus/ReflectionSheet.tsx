"use client";

import React, { useState } from 'react';
import { useFocusStore } from '@/lib/stores/focusStore';
import { useBlocksStore } from '@/lib/stores/blocksStore';
import { saveSessionReflection } from '@/lib/services/focusService';
import { CheckCircle, Sparkles, X, Mountain, Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryWarning, Eye, TrendingUp, Frown, Meh, Smile } from 'lucide-react';
import { GlassButton } from '@/components/ui/glass-button';
import { GlowingEffect } from '@/components/ui/glowing-effect';

const REFLECTION_QUESTIONS = [
    "¿Qué fue lo más valioso de este bloque?",
    "¿Hubo alguna distracción recurrente?",
    "¿Cómo te sentís después de esta sesión?"
];

// Reutilizable Scale Selector (1-5) con píldora horizontal unificada
function MetricScale({ label, icon: Icon, value, onChange, dynamicIcon }: { label: string, icon: any, value: number, onChange: (v: number) => void, dynamicIcon?: (v: number) => any }) {
    const DisplayIcon = dynamicIcon && value > 0 ? dynamicIcon(value) : Icon;

    return (
        <div className="flex flex-col gap-3 w-full mt-1">
            <div className={`flex items-center gap-2 text-sm font-medium transition-colors duration-300 ${value > 0 ? 'text-[#7C3AED]' : 'text-white/60'}`}>
                <DisplayIcon className={`w-4 h-4 transition-all duration-300 ${value > 0 ? 'opacity-100 drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]' : 'opacity-70'}`} strokeWidth={value > 0 ? 2 : 1.5} />
                <span>{label}</span>
            </div>
            {/* Píldora de 5 segmentos */}
            <div className="flex w-full bg-black/20 border border-white/5 rounded-full overflow-hidden h-10 p-[3px] gap-1 shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]">
                {[1, 2, 3, 4, 5].map(v => (
                    <button
                        key={v}
                        onClick={() => onChange(v)}
                        className={`flex-1 flex items-center justify-center rounded-full transition-all duration-300 text-sm font-semibold
                            ${value === v
                                ? 'bg-gradient-to-r from-[#7C3AED]/60 to-[#4F46E5]/60 border border-[#7C3AED]/80 text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                                : 'border border-transparent text-white/30 hover:bg-white/10 hover:text-white/70'
                            }`}
                    >
                        {v}
                    </button>
                ))}
            </div>
        </div>
    );
}

// Helpers semánticos para variar los íconos de Ánimo según el valor seleccionado (escala 1-5, sin emojis)
const getMoodIcon = (val: number) => {
    if (val === 0) return Meh;
    if (val <= 2) return Frown;
    if (val === 3) return Meh;
    return Smile;
};

// Helper dinámico para Batería
const getBatteryIcon = (val: number) => {
    if (val === 0) return Battery;
    if (val === 1) return BatteryWarning; // Casi vacía / Alerta
    if (val === 2) return BatteryLow;
    if (val === 3) return BatteryMedium;
    if (val === 4) return BatteryMedium; // Alternativa: BatteryMedium con más carga visual si existiera
    return BatteryFull;
};

export function ReflectionSheet() {
    const { session } = useFocusStore();
    const { createBlock } = useBlocksStore();

    // Metrics 1-5 scale (0 means no selection)
    const [metrics, setMetrics] = useState({
        energyBefore: 0,
        moodBefore: 0,
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

        try {
            await saveSessionReflection(session.id, session.intention, {
                energyBefore: metrics.energyBefore > 0 ? metrics.energyBefore : undefined,
                moodBefore: metrics.moodBefore > 0 ? metrics.moodBefore : undefined,
                clarity: metrics.clarity > 0 ? metrics.clarity : undefined,
                difficulty: metrics.difficulty > 0 ? metrics.difficulty : undefined,
                progressFeelingAfter: metrics.progressFeelingAfter > 0 ? metrics.progressFeelingAfter : undefined,
                moodAfter: metrics.moodAfter > 0 ? metrics.moodAfter : undefined,
                notes: reflection,
            });

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
        } catch (error) {
            console.error("Failed to save reflection cleanly", error);
        } finally {
            useFocusStore.setState({ session: null });
            setIsSaving(false);
        }
    };

    if (!session || !session.endedAt) return null;

    const isFree = session.mode === "free";

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6 text-white animate-in fade-in duration-500">
            {/* Intensive backdrop-blur para el Dark Glass */}
            <div className="absolute inset-0 bg-[#0B0F1A]/50 backdrop-blur-2xl" />

            {/* Panel Principal Flotante Premium Dark Glass */}
            <div className="relative z-10 w-full max-w-md flex flex-col gap-6 p-8 rounded-3xl bg-[#0B0F1A]/60 border border-white/[0.08] shadow-[0_32px_80px_rgba(0,0,0,0.8),_0_0_60px_rgba(124,58,237,0.15)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 max-h-[95vh] overflow-y-auto no-scrollbar">

                {/* Iluminación ambiental sutil de Violeta en bordes internos */}
                <div className="absolute inset-0 rounded-3xl shadow-[inset_0_0_40px_rgba(124,58,237,0.1)] pointer-events-none" />

                <GlowingEffect spread={40} proximity={80} inactiveZone={0.01} borderWidth={1} variant="default" />

                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/90 transition-all z-20"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="flex flex-col items-center gap-2 text-center mt-2 relative z-10">
                    <div className="w-14 h-14 rounded-full bg-[#0B0F1A]/80 border border-white/10 flex items-center justify-center shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]">
                        {isFree
                            ? <Sparkles className="w-6 h-6 text-[#7C3AED]" />
                            : <CheckCircle className="w-6 h-6 text-green-400" />
                        }
                    </div>
                    <h2 className="text-xl font-medium tracking-tight mt-2 text-white/90">
                        {isFree ? "Sesión completada" : "Bloque completado"}
                    </h2>
                    <p className="text-white/50 text-sm tracking-wide mt-1">
                        {question}
                    </p>
                </div>

                {/* Grilla 3x2 con diseño más limpio y separado */}
                <div className="flex flex-col gap-6 w-full relative z-10">
                    {/* Fila 1: Antes */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        <MetricScale label="Energía Inicial" icon={Battery} dynamicIcon={getBatteryIcon} value={metrics.energyBefore} onChange={v => setMetrics({ ...metrics, energyBefore: v })} />
                        <MetricScale label="Ánimo Inicial" icon={Meh} dynamicIcon={getMoodIcon} value={metrics.moodBefore} onChange={v => setMetrics({ ...metrics, moodBefore: v })} />
                    </div>
                    {/* Fila 2: Durante */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        <MetricScale label="Claridad" icon={Eye} value={metrics.clarity} onChange={v => setMetrics({ ...metrics, clarity: v })} />
                        <MetricScale label="Dificultad" icon={Mountain} value={metrics.difficulty} onChange={v => setMetrics({ ...metrics, difficulty: v })} />
                    </div>
                    {/* Fila 3: Después */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        <MetricScale label="Avance Logrado" icon={TrendingUp} value={metrics.progressFeelingAfter} onChange={v => setMetrics({ ...metrics, progressFeelingAfter: v })} />
                        <MetricScale label="Ánimo Final" icon={Meh} dynamicIcon={getMoodIcon} value={metrics.moodAfter} onChange={v => setMetrics({ ...metrics, moodAfter: v })} />
                    </div>
                </div>

                {/* Textarea Flotante (Glass style) */}
                <textarea
                    rows={2}
                    placeholder="Breve nota mental (opcional)..."
                    value={reflection}
                    onChange={e => setReflection(e.target.value)}
                    className="relative z-10 w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-[#7C3AED]/50 focus:shadow-[0_0_20px_rgba(124,58,237,0.1)] transition-all resize-none leading-relaxed"
                />

                {/* Actions: Botón Premium Glass Violeta */}
                <div className="flex flex-col gap-3 mt-2 relative z-10">
                    <button
                        onClick={handleFinish}
                        disabled={isSaving}
                        className="relative w-full h-12 flex items-center justify-center rounded-2xl bg-[#0B0F1A]/80 border border-[#7C3AED]/40 overflow-hidden group transition-all hover:border-[#7C3AED]/80 active:scale-[0.98]"
                    >
                        {/* Efecto de degradado HOVER */}
                        <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED]/30 to-[#4F46E5]/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {/* Brillo interno constante */}
                        <div className="absolute inset-0 shadow-[inset_0_0_15px_rgba(124,58,237,0.3)]" />
                        {/* Texto */}
                        <span className="relative z-10 text-white font-medium text-sm tracking-wide">
                            {isSaving ? "Guardando..." : "Guardar y finalizar"}
                        </span>
                    </button>
                    {isFree && (
                        <p className="text-xs text-center text-white/30 hidden">
                            Se creará un bloque para esta sesión.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
