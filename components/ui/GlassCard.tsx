"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { GlowingEffect } from "@/components/ui/glowing-effect";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    intensity?: "low" | "medium" | "high";
    glow?: boolean;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
    ({ className, intensity = "medium", glow = true, children, ...props }, ref) => {
        const opacityMap = {
            low: "bg-white/5 border-white/5",
            medium: "bg-white/5 border-white/10",
            high: "bg-white/10 border-white/15",
        };

        return (
            <div
                ref={ref}
                className={cn(
                    "relative overflow-hidden rounded-[24px] backdrop-blur-2xl shadow-xl transition-all",
                    opacityMap[intensity],
                    "border",
                    // Accessibility: Reduced Transparency
                    "motion-reduce:transition-none",
                    "reduced-transparency-card",
                    className
                )}
                {...props}
            >
                {glow && (
                    <GlowingEffect
                        spread={40}
                        proximity={80}
                        inactiveZone={0.01}
                        borderWidth={1}
                        disabled={false}
                    />
                )}
                {children}
            </div>
        );
    }
);
GlassCard.displayName = "GlassCard";

export { GlassCard };
