import React from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowRight, BrainCircuit, Layers, Scissors, Shrink } from "lucide-react";
import { cn } from "@/lib/cn";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useI18n } from "@/lib/i18n/client";
import { getOverlapResolutionCopy } from "@/lib/i18n/ui";
import { Block } from "@/lib/types/blocks";

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
    onResolve,
}: OverlapResolutionModalProps) {
    const { language } = useI18n();

    if (!isOpen || !pendingBlock) return null;

    const copy = getOverlapResolutionCopy(language);
    const options = [
        {
            id: "intelligent" as const,
            title: copy.options.intelligent.title,
            description: copy.options.intelligent.description,
            icon: BrainCircuit,
            disabled: true,
            badge: copy.options.intelligent.badge,
            colorText: "text-indigo-400",
            bgHover: "hover:bg-indigo-500/10",
            borderHover: "hover:border-indigo-500/20",
        },
        {
            id: "slice_underlying" as const,
            title: copy.options.sliceUnderlying.title,
            description: copy.options.sliceUnderlying.description,
            icon: Scissors,
            disabled: false,
            colorText: "text-emerald-400",
            bgHover: "hover:bg-emerald-500/10",
            borderHover: "hover:border-emerald-500/20",
        },
        {
            id: "shrink_new" as const,
            title: copy.options.shrinkNew.title,
            description: copy.options.shrinkNew.description,
            icon: Shrink,
            disabled: false,
            colorText: "text-amber-400",
            bgHover: "hover:bg-amber-500/10",
            borderHover: "hover:border-amber-500/20",
        },
        {
            id: "move_forward" as const,
            title: copy.options.moveForward.title,
            description: copy.options.moveForward.description,
            icon: ArrowRight,
            disabled: false,
            colorText: "text-sky-400",
            bgHover: "hover:bg-sky-500/10",
            borderHover: "hover:border-sky-500/20",
        },
        {
            id: "keep_overlap" as const,
            title: copy.options.keepOverlap.title,
            description: copy.options.keepOverlap.description,
            icon: Layers,
            disabled: false,
            colorText: "text-white/70",
            bgHover: "hover:bg-white/10",
            borderHover: "hover:border-white/20",
        },
    ];

    return createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0A0A0A] shadow-[0_0_80px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/5 zoom-in-95 duration-300">
                <GlowingEffect blur={10} spread={20} glow={true} disabled={false} />

                <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8">
                    <div className="flex flex-col items-center gap-2 text-center">
                        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                            <AlertCircle className="h-6 w-6 text-red-400" />
                        </div>
                        <h2 className="text-xl font-medium tracking-tight text-white">{copy.title}</h2>
                        <p className="max-w-[280px] text-sm leading-relaxed text-white/50">
                            {copy.scheduleConflictDescription(overlappingCount)}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        {options.map((option) => {
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.id}
                                    onClick={() => !option.disabled && onResolve(option.id)}
                                    disabled={option.disabled}
                                    className={cn(
                                        "relative flex items-center gap-4 rounded-2xl border p-3.5 text-left transition-all duration-300",
                                        "border-white/5 bg-white/[0.03]",
                                        option.disabled
                                            ? "cursor-not-allowed saturate-0 opacity-40"
                                            : cn("cursor-pointer", option.bgHover, option.borderHover),
                                    )}
                                >
                                    <div className={cn("shrink-0 rounded-xl border border-white/5 bg-black/40 p-2", option.colorText)}>
                                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                                    </div>
                                    <div className="flex flex-1 flex-col gap-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-white/90">{option.title}</span>
                                            {option.badge && (
                                                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-300">
                                                    {option.badge}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs leading-snug text-white/40">{option.description}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
