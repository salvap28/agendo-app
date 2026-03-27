"use client";

import { useState } from 'react';
import { useFocusStore } from '@/lib/stores/focusStore';
import { createStudyLayer, StudyTechniqueState } from '@/lib/engines/layersEngine';
import { Clock, Brain, RefreshCw, Play, Save, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { GlassButton } from '@/components/ui/glass-button';

type TechId = "pomodoro_25_5" | "study_50_10" | "active_recall";

const TECHNIQUES: Record<TechId, { name: string; desc: string; focus: number; break: number; icon: LucideIcon }> = {
    pomodoro_25_5: {
        name: "Pomodoro (25/5)",
        desc: "Trabajá 25 minutos seguidos y descansá 5. Ideal para arrancar de a poco y mantener un ritmo sostenible sin quemarte.",
        focus: 25, break: 5, icon: Clock
    },
    study_50_10: {
        name: "Bloque 50/10",
        desc: "Sesiones largas de 50 minutos con 10 de descanso. Perfecto para tareas de alta concentración profunda como programar o leer.",
        focus: 50, break: 10, icon: Brain
    },
    active_recall: {
        name: "Active Recall",
        desc: "Fomenta la memoria a largo plazo obligándote a recordar lo que leíste cada 20 minutos. (MVP mode)",
        focus: 20, break: 5, icon: RefreshCw
    },
};

export function TechniquePickerCard({ onClose }: { onClose: () => void }) {
    const { session, setLayer } = useFocusStore();
    const [selectedId, setSelectedId] = useState<TechId>("pomodoro_25_5");
    const [isClosing, setIsClosing] = useState(false);

    const isUpdating = session?.activeLayer?.kind === "studyTechnique" && session?.activeLayer?.id !== "active_recall";

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 200);
    };

    const handleApply = (keepTimer: boolean) => {
        const newLayer = createStudyLayer(selectedId);

        if (keepTimer && isUpdating && session?.activeLayer?.config && 'state' in session.activeLayer.config) {
            const oldConfig = session.activeLayer.config as { state: StudyTechniqueState };
            const newConfig = newLayer.config as { state: StudyTechniqueState };

            // Keep the exact timestamp so the countdown doesn't jump
            newConfig.state.phaseStartedAt = oldConfig.state.phaseStartedAt;
            newConfig.state.cycleCount = oldConfig.state.cycleCount || 1;
            // Best effort phase preservation; if the new technique has a different focus length,
            // the countdown will adjust relative to the original start time.
            newConfig.state.phase = oldConfig.state.phase || "focus";
        }

        setLayer(newLayer);
        handleClose();
    };

    const info = TECHNIQUES[selectedId];
    const Icon = info.icon;

    return (
        <div
            className={cn(
                "relative w-[600px] max-w-full flex flex-col sm:flex-row bg-black/40 backdrop-blur-3xl border border-white/[0.08] shadow-2xl rounded-3xl text-white transition-all duration-300",
                isClosing ? "animate-out fade-out zoom-out-95 duration-200" : "animate-in fade-in zoom-in-95 duration-300"
            )}
        >
            <GlowingEffect spread={50} proximity={80} inactiveZone={0.01} borderWidth={1.5} disabled={false} />
            {/* Left side: List */}
            <div className="w-full sm:w-1/2 flex flex-col p-6 pr-4 border-b sm:border-b-0 sm:border-r border-white/5 max-h-[50vh] sm:max-h-none overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-medium text-lg tracking-tight">Elegir técnica</h3>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                    {(Object.keys(TECHNIQUES) as TechId[]).map((id) => {
                        const active = selectedId === id;
                        const t = TECHNIQUES[id];
                        const TIcon = t.icon;
                        return (
                            <GlassButton
                                key={id}
                                onClick={() => setSelectedId(id)}
                                variant="ghost"
                                className={cn(
                                    "w-full h-auto py-3 px-3 rounded-2xl justify-start border-transparent",
                                    active
                                        ? "bg-white/10 text-white"
                                        : "text-white/50"
                                )}
                            >
                                <div className={cn("flex items-center justify-center w-8 h-8 rounded-full", active ? "bg-white/15" : "bg-white/5")}>
                                    <TIcon className={cn("w-4 h-4", active ? "text-white" : "text-white/40")} />
                                </div>
                                <span className={cn("text-sm font-medium", active ? "text-white" : "")}>{t.name}</span>
                            </GlassButton>
                        );
                    })}
                </div>
                <GlassButton
                    onClick={handleClose}
                    variant="ghost"
                    className="mt-6 h-auto py-1 px-2 text-xs text-white/30 hover:text-white/70 border-transparent rounded-lg justify-start"
                >
                    Cancelar
                </GlassButton>
            </div>

            {/* Right side: Info Panel */}
            <div className="w-full sm:w-1/2 flex flex-col p-6 sm:pl-8 bg-gradient-to-br from-white/[0.02] to-transparent">
                <div className="flex items-center justify-between mb-6">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                        <Icon className="w-5 h-5 text-indigo-300" />
                    </div>
                </div>

                <h4 className="text-xl font-bold tracking-tight mb-2">{info.name}</h4>
                <p className="text-sm text-white/50 leading-relaxed mb-6 flex-1">
                    {info.desc}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-medium">Focus</span>
                        <div className="flex items-end gap-1">
                            <span className="text-2xl font-bold leading-none">{info.focus}</span>
                            <span className="text-xs text-white/50 mb-0.5">min</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-medium">Descanso</span>
                        <div className="flex items-end gap-1">
                            <span className="text-2xl font-bold leading-none">{info.break}</span>
                            <span className="text-xs text-white/50 mb-0.5">min</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 mt-auto">
                    {isUpdating ? (
                        <>
                            <GlassButton
                                onClick={() => handleApply(false)}
                                variant="primary"
                                className="w-full h-11 rounded-xl"
                            >
                                <Play className="w-4 h-4 mr-2" />
                                Reiniciar Timer
                            </GlassButton>
                            <GlassButton
                                onClick={() => handleApply(true)}
                                variant="default"
                                className="w-full h-10 rounded-xl border-white/10"
                            >
                                <Save className="w-4 h-4 text-white/60 mr-2" />
                                Mantener Timer
                            </GlassButton>
                        </>
                    ) : (
                        <GlassButton
                            onClick={() => handleApply(false)}
                            variant="primary"
                            className="w-full h-11 rounded-xl"
                        >
                            <Play className="w-4 h-4 mr-2" />
                            Seleccionar
                        </GlassButton>
                    )}
                </div>
            </div>
        </div>
    );
}
