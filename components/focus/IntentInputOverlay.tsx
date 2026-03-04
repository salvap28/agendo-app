"use client";

import React, { useState } from 'react';
import { useFocusStore } from '@/lib/stores/focusStore';
import { cn } from '@/lib/cn';
import { Target, CheckCircle2 } from 'lucide-react';
import { GlassButton } from '@/components/ui/glass-button';
import { GlowingEffect } from '@/components/ui/glowing-effect';

interface IntentInputOverlayProps {
    onClose: () => void;
    defaultIsCompletion?: boolean;
}

export function IntentInputOverlay({ onClose, defaultIsCompletion = false }: IntentInputOverlayProps) {
    const { setSessionIntention } = useFocusStore();
    const [value, setValue] = useState("");
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 200);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (value.trim()) {
            setSessionIntention(value.trim());
            handleClose();
        }
    };

    return (
        <div
            className={cn(
                "w-[420px] max-w-full flex flex-col p-6 sm:p-8 bg-black/40 backdrop-blur-3xl border border-white/[0.08] shadow-2xl rounded-3xl overflow-hidden text-white transition-all duration-300",
                isClosing ? "animate-out fade-out zoom-out-95 duration-200" : "animate-in fade-in zoom-in-95 duration-300"
            )}
        >
            <GlowingEffect spread={40} proximity={80} inactiveZone={0.01} borderWidth={1} variant="default" />
            <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 shrink-0 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                    {defaultIsCompletion ? (
                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                    ) : (
                        <Target className="w-6 h-6 text-indigo-300" />
                    )}
                </div>
                <div className="pt-1">
                    <h3 className="font-semibold text-lg tracking-tight leading-tight">
                        {defaultIsCompletion ? "¡Objetivo cumplido!" : "¿Cuál es el siguiente paso?"}
                    </h3>
                    <p className="text-white/50 text-xs mt-1">
                        {defaultIsCompletion
                            ? "Escribí tu próximo paso para mantener el impulso, o cerrá para continuar libremente."
                            : "Definí una acción concreta y alcanzable para mantener el foco."}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                    type="text"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder={defaultIsCompletion ? "Ej: Repasar el siguiente capítulo..." : "Ej: Leer página 10 a 20..."}
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
                />

                <div className="flex items-center gap-3 mt-2">
                    <GlassButton
                        type="button"
                        onClick={handleClose}
                        variant="ghost"
                        className="flex-1 w-full justify-center rounded-xl h-10"
                    >
                        {defaultIsCompletion ? "Quizás luego" : "Cancelar"}
                    </GlassButton>
                    <GlassButton
                        type="submit"
                        disabled={!value.trim()}
                        variant="primary"
                        className="flex-[2] w-full justify-center rounded-xl h-11"
                    >
                        Fijar objetivo
                    </GlassButton>
                </div>
            </form>
        </div>
    );
}
