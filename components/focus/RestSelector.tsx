"use client";

import React, { useState } from 'react';
import { useRestTimer } from '@/hooks/useRestTimer';
import { Timer, X, Bell } from 'lucide-react';
import { GlassButton } from '@/components/ui/glass-button';

/**
 * Inline rest selector — renders as a standalone button row.
 * Active state: shows a compact timer badge.
 * Idle state: shows a subtle text button, with duration options popping up above.
 */
export function RestSelector() {
    const { formatted, isActive, startRest, stopRest } = useRestTimer();
    const [isOpen, setIsOpen] = useState(false);

    if (isActive) {
        return (
            <div className="relative flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-300 animate-in fade-in">
                <Bell className="w-3.5 h-3.5 animate-pulse" />
                <span className="tabular-nums text-sm font-medium tracking-widest">{formatted}</span>
                <GlassButton
                    onClick={stopRest}
                    variant="ghost"
                    size="icon"
                    className="w-5 h-5 flex items-center justify-center p-0 rounded-full text-sky-300/60 hover:text-sky-300 hover:bg-sky-400/20 hover:border-transparent min-w-0"
                >
                    <X className="w-3 h-3" />
                </GlassButton>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Duration picker — pops up above */}
            {isOpen && (
                <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 flex items-center bg-black/70 backdrop-blur-xl border border-white/10 rounded-full overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {[
                        { label: '1m', secs: 60 },
                        { label: '90s', secs: 90 },
                        { label: '2m', secs: 120 },
                    ].map(({ label, secs }, i) => (
                        <React.Fragment key={secs}>
                            {i > 0 && <div className="w-px h-5 bg-white/10 shrink-0" />}
                            <GlassButton
                                variant="ghost"
                                className="px-5 h-10 text-sm text-white/70 hover:text-white hover:bg-white/10 whitespace-nowrap rounded-none border-transparent w-auto min-w-0"
                                onClick={() => { startRest(secs); setIsOpen(false); }}
                            >
                                {label}
                            </GlassButton>
                        </React.Fragment>
                    ))}
                    <div className="w-px h-5 bg-white/10 shrink-0" />
                    <GlassButton
                        variant="ghost"
                        size="icon"
                        className="w-10 h-10 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 rounded-none border-transparent min-w-0"
                        onClick={() => setIsOpen(false)}
                    >
                        <X className="w-3.5 h-3.5" />
                    </GlassButton>
                </div>
            )}

            {/* Main trigger */}
            <GlassButton
                variant="ghost"
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent hover:border-white/10 w-auto min-w-0 h-auto"
                onClick={() => setIsOpen(prev => !prev)}
            >
                <Timer className="w-3.5 h-3.5" />
                <span>Descanso</span>
            </GlassButton>
        </div>
    );
}
