"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { FocusCard as FocusCardType } from "@/lib/types/focus";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { GlassButton } from "@/components/ui/glass-button";
import {
    Target,
    Brain,
    Dumbbell,
    Lightbulb,
    Lock,
    AlertTriangle,
    type LucideIcon,
} from "lucide-react";

interface FocusCardProps {
    card: FocusCardType;
    isForeground?: boolean;
    onAction: (card: FocusCardType, action: NonNullable<FocusCardType["action"]>) => void;
}

// === Card icon per type ===
const CARD_ICONS: Record<string, LucideIcon> = {
    universal: Lightbulb,
    study: Brain,
    gym: Dumbbell,
    work: Target,
    reactive: AlertTriangle,
    default: Lock,
};

type CardPalette = {
    tintColor: string; // RGB values for subtle tint, e.g. "192, 38, 211"
    iconColor: string;
};

const CARD_PALETTES: Record<string, CardPalette> = {
    universal: {
        tintColor: "192, 38, 211", // Fuchsia
        iconColor: "#e879f9",
    },
    study: {
        tintColor: "109, 40, 217", // Violet
        iconColor: "#a78bfa",
    },
    gym: {
        tintColor: "22, 163, 74", // Green
        iconColor: "#4ade80",
    },
    work: {
        tintColor: "79, 70, 229", // Indigo
        iconColor: "#818cf8",
    },
    reactive: {
        tintColor: "220, 38, 38", // Red
        iconColor: "#f87171",
    },
};

export function FocusCard({ card, isForeground = true, onAction }: FocusCardProps) {
    const palette = CARD_PALETTES[card.type] ?? CARD_PALETTES["universal"];
    const Icon = CARD_ICONS[card.type] ?? CARD_ICONS["default"];

    const isGym = card.type === "gym";

    return (
        <div
            className={cn(
                "relative flex flex-col w-[280px] h-[280px] rounded-2xl overflow-hidden shrink-0 select-none border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] backdrop-blur-2xl bg-white/[0.02] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/[0.15] before:to-transparent transition-all duration-300",
                !isForeground ? "opacity-60" : "hover:scale-[1.03] hover:shadow-[0_16px_48px_0_rgba(0,0,0,0.4)]"
            )}
            style={{
                backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(${palette.tintColor}, 0.05) 100%)`,
            }}
        >
            {/* Glowing border effect */}
            <GlowingEffect
                spread={30}
                proximity={60}
                inactiveZone={0.01}
                borderWidth={1}
                disabled={!isForeground}
                variant={card.type === 'gym' ? 'emerald' : 'default'}
            />

            {/* Soft inner glow from tinted color */}
            <div
                className="absolute inset-x-0 bottom-0 h-1/2 opacity-30 pointer-events-none blur-xl"
                style={{ background: `radial-gradient(ellipse at bottom, rgba(${palette.tintColor}, 0.4), transparent 70%)` }}
            />

            {/* Top content zone */}
            <div className={cn("relative z-10 flex flex-col flex-1 p-6 pt-6 transition-opacity duration-300", !isForeground && "opacity-0")}>
                {/* Title */}
                <h4 className="text-white font-semibold text-base leading-snug tracking-tight mb-2 flex items-center gap-2">
                    <Icon className="w-5 h-5 opacity-70" style={{ color: palette.iconColor }} />
                    {card.title}
                </h4>

                {/* Description */}
                {card.description && (
                    <p className="text-white/50 text-[13px] leading-relaxed line-clamp-3">
                        {card.description}
                    </p>
                )}
            </div>

            {/* Action row — bottom (Only primary action if exists) */}
            <div className={cn("relative z-10 px-6 pb-6 mt-auto transition-opacity duration-300", !isForeground && "opacity-0 pointer-events-none")}>
                <div className={cn("flex gap-2", card.secondaryAction ? "flex-col" : "flex-row")}>
                    {card.action && (
                        <GlassButton
                            variant={isGym ? "gym" : "default"}
                            size="sm"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => onAction(card, card.action!)}
                            className="w-full"
                        >
                            {card.action.label}
                        </GlassButton>
                    )}
                    {card.secondaryAction && (
                        <GlassButton
                            variant="ghost"
                            size="sm"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => onAction(card, card.secondaryAction!)}
                            className="w-full"
                        >
                            {card.secondaryAction.label}
                        </GlassButton>
                    )}
                </div>
            </div>
        </div>
    );
}
