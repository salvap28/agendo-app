"use client";

import { cn } from "@/lib/cn";

export function NoiseOverlay({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "fixed inset-0 z-10 pointer-events-none opacity-[0.03] mix-blend-overlay",
                "forced-colors-hidden print:hidden",
                className
            )}
            style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
            aria-hidden="true"
        />
    );
}
