"use client";

import { cn } from "@/lib/cn";
import { GlowingEffect } from "./glowing-effect";

interface GlassSwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    className?: string;
    activeColor?: string;
}

export function GlassSwitch({ checked, onCheckedChange, className, activeColor = "bg-white/20" }: GlassSwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background border overflow-hidden",
                checked ? `${activeColor} border-white/30 shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]` : "bg-black/40 border-white/5 shadow-inner",
                className
            )}
        >
            <GlowingEffect spread={15} proximity={30} inactiveZone={0.01} borderWidth={1} variant="subtle" />
            <span
                data-state={checked ? "checked" : "unchecked"}
                className={cn(
                    "pointer-events-none block h-6 w-6 rounded-full ring-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10",
                    checked ? "translate-x-7 scale-100 bg-white shadow-[0_0_15px_rgba(255,255,255,0.6)]" : "translate-x-1 scale-90 bg-white/50"
                )}
            />
        </button>
    );
}
