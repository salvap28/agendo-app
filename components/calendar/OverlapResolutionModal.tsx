import React from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowRight, BrainCircuit, Scissors, Shrink, Layers } from "lucide-react";
import { cn } from "@/lib/cn";
import { Block } from "@/lib/types/blocks";
import { GlowingEffect } from "@/components/ui/glowing-effect";

export type OverlapResolutionType = "intelligent" | "slice_underlying" | "shrink_new" | "move_forward" | "keep_overlap";

interface OverlapResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    pendingBlock: Partial<Block> & Pick<Block, "startAt" | "endAt"> | null;
    overlappingCount: number;
    onResolve: (resolution: OverlapResolutionType) => void;
}

export function OverlapResolutionModal({
    isOpen,
    onClose,
    pendingBlock,
    overlappingCount,
    onResolve
}: OverlapResolutionModalProps) {
    if (!isOpen || !pendingBlock) return null;

    const options = [
        {
            id: "intelligent" as const,
            title: "Reorganización Inteligente",
            description: "La IA buscará la mejor distribución de tu día conservando tu energía.",
            icon: BrainCircuit,
            disabled: true,
            badge: "Próximamente",
            colorText: "text-indigo-400",
            bgHover: "hover:bg-indigo-500/10",
            borderHover: "hover:border-indigo-500/20"
        },
        {
            id: "slice_underlying" as const,
            title: "Recortar bloque subyacente",
            description: "Divide o acorta los bloques existentes para abrir paso a este nuevo.",
            icon: Scissors,
            disabled: false,
            colorText: "text-emerald-400",
            bgHover: "hover:bg-emerald-500/10",
            borderHover: "hover:border-emerald-500/20"
        },
        {
            id: "shrink_new" as const,
            title: "Ajustar duración de este bloque",
            description: "Recorta este bloque para que encaje en el espacio libre disponible.",
            icon: Shrink,
            disabled: false,
            colorText: "text-amber-400",
            bgHover: "hover:bg-amber-500/10",
            borderHover: "hover:border-amber-500/20"
        },
        {
            id: "move_forward" as const,
            title: "Mover al próximo hueco libre",
            description: "Desplaza automáticamente este bloque al siguiente espacio vacío.",
            icon: ArrowRight,
            disabled: false,
            colorText: "text-sky-400",
            bgHover: "hover:bg-sky-500/10",
            borderHover: "hover:border-sky-500/20"
        },
        {
            id: "keep_overlap" as const,
            title: "Mantener superpuestos",
            description: "Ignorar el conflicto y guardar el bloque exactamente aquí.",
            icon: Layers,
            disabled: false,
            colorText: "text-white/70",
            bgHover: "hover:bg-white/10",
            borderHover: "hover:border-white/20"
        }
    ];

    return createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] bg-[#0A0A0A] border border-white/10 shadow-[0_0_80px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/5 zoom-in-95 duration-300">
                <GlowingEffect blur={10} spread={20} glow={true} disabled={false} />
                
                <div className="relative z-10 p-6 sm:p-8 flex flex-col gap-6">
                    {/* Header */}
                    <div className="flex flex-col gap-2 items-center text-center">
                        <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                            <AlertCircle className="w-6 h-6 text-red-400" />
                        </div>
                        <h2 className="text-xl font-medium tracking-tight text-white">Conflicto de Horario</h2>
                        <p className="text-sm text-white/50 leading-relaxed max-w-[280px]">
                            Este bloque se superpone con {overlappingCount > 1 ? `${overlappingCount} bloques existentes` : "1 bloque existente"}. ¿Cómo te gustaría resolverlo?
                        </p>
                    </div>

                    {/* Options */}
                    <div className="flex flex-col gap-2.5">
                        {options.map((opt) => {
                            const Icon = opt.icon;
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => !opt.disabled && onResolve(opt.id)}
                                    disabled={opt.disabled}
                                    className={cn(
                                        "relative flex items-center gap-4 p-3.5 rounded-2xl border transition-all duration-300 text-left",
                                        "bg-white/[0.03] border-white/5",
                                        opt.disabled 
                                            ? "opacity-40 cursor-not-allowed saturate-0" 
                                            : cn("cursor-pointer", opt.bgHover, opt.borderHover)
                                    )}
                                >
                                    <div className={cn("flex-shrink-0 p-2 rounded-xl bg-black/40 border border-white/5", opt.colorText)}>
                                        <Icon className="w-5 h-5" strokeWidth={1.5} />
                                    </div>
                                    <div className="flex flex-col flex-1 gap-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-white/90">{opt.title}</span>
                                            {opt.badge && (
                                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                    {opt.badge}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-white/40 leading-snug">{opt.description}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
