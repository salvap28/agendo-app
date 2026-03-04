"use client";

import React, { useState } from 'react';
import { useFocusStore } from '@/lib/stores/focusStore';
import { useBlocksStore } from '@/lib/stores/blocksStore';
import { CheckCircle, Sparkles, X } from 'lucide-react';
import { GlassButton } from '@/components/ui/glass-button';
import { GlowingEffect } from '@/components/ui/glowing-effect';

const REFLECTION_QUESTIONS = [
    "¿Qué fue lo más valioso de este bloque?",
    "¿Hubo alguna distracción recurrente?",
    "¿Cómo te sentís después de esta sesión?"
];

export function ReflectionSheet() {
    const { session } = useFocusStore();
    const { createBlock } = useBlocksStore();
    const [reflection, setReflection] = useState("");
    const [blockTitle, setBlockTitle] = useState("Focus Block");

    const question = REFLECTION_QUESTIONS[Math.floor(Math.random() * REFLECTION_QUESTIONS.length)];

    const handleClose = () => {
        useFocusStore.setState({ session: null });
    };

    const handleCreateBlock = () => {
        if (!session || !session.endedAt) return;
        createBlock({
            title: blockTitle,
            type: "deep_work",
            startAt: new Date(session.startedAt),
            endAt: new Date(session.endedAt),
            status: "completed",
            notes: reflection,
        });
        useFocusStore.setState({ session: null });
    };

    if (!session || !session.endedAt) return null;

    const isFree = session.mode === "free";

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6 text-white animate-in fade-in duration-500">
            {/* Blurred background inherited from FocusOverlay, plus extra dark veil */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            {/* Card */}
            <div className="relative z-10 w-full max-w-md flex flex-col gap-6 p-8 rounded-3xl bg-white/[0.04] border border-white/[0.08] shadow-[0_32px_64px_rgba(0,0,0,0.5)] backdrop-blur-3xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <GlowingEffect spread={40} proximity={80} inactiveZone={0.01} borderWidth={1} variant="default" />

                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/90 transition-all"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-16 h-16 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center">
                        {isFree
                            ? <Sparkles className="w-7 h-7 text-indigo-300" />
                            : <CheckCircle className="w-7 h-7 text-green-400" />
                        }
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        {isFree ? "Sesión libre completada" : "Bloque completado"}
                    </h2>
                    <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                        {question}
                    </p>
                </div>

                {/* Reflection input */}
                <textarea
                    rows={3}
                    placeholder="Escribí una breve reflexión (opcional)..."
                    value={reflection}
                    onChange={e => setReflection(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-colors resize-none leading-relaxed"
                />

                {/* Actions */}
                <div className="flex flex-col gap-3 mt-2">
                    {isFree && (
                        <GlassButton
                            onClick={handleCreateBlock}
                            variant="primary"
                            className="w-full rounded-xl"
                        >
                            Crear bloque con esta sesión
                        </GlassButton>
                    )}
                    <GlassButton
                        onClick={handleClose}
                        variant={isFree ? "default" : "primary"}
                        className="w-full rounded-xl"
                    >
                        {isFree ? "Solo finalizar" : "Guardar y cerrar"}
                    </GlassButton>
                </div>
            </div>
        </div>
    );
}
