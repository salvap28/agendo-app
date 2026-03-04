"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { DailyAgendaView } from "@/components/calendar/DailyAgendaView";
import { WeekView } from "@/components/calendar/WeekView";
import { FocusPlannerModal } from "@/components/focus/FocusPlannerModal";
import { Plus } from "lucide-react";

export function SectionCalendar() {
    const [isPlannerOpen, setIsPlannerOpen] = useState(false);
    const [plannerStart, setPlannerStart] = useState<Date>(new Date());

    return (
        <section className="w-full min-h-[100dvh] snap-start flex flex-col items-center justify-start py-8 px-4 md:px-8 bg-transparent">

            {/* Optional subtle header */}
            <div className="w-full max-w-[1400px] mb-4 opacity-50 select-none pointer-events-none">
                <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">Calendar</span>
            </div>

            {/* Mobile View: Zero-Gravity Daily Agenda */}
            {/* Wrapper is relative so the FAB can be positioned inside it but outside overflow-hidden card */}
            <div className="md:hidden w-full max-w-7xl relative flex flex-col" style={{ minHeight: '85svh' }}>
                {/* The actual card with overflow-hidden */}
                <div className={cn(
                    "w-full flex-1 rounded-[2rem] overflow-hidden relative z-10",
                    "border border-white/5 bg-transparent"
                )}>
                    <DailyAgendaView />
                </div>

                {/* FAB placed OUTSIDE overflow-hidden, but inside the relative wrapper */}
                <div className="flex justify-center py-4 z-20">
                    <button
                        onClick={() => {
                            setPlannerStart(new Date());
                            setIsPlannerOpen(true);
                        }}
                        className={cn(
                            "flex items-center justify-center h-12 w-20 rounded-full",
                            "bg-white/[0.08] backdrop-blur-md border border-white/15",
                            "text-white shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)]",
                            "hover:bg-white/[0.12] active:bg-[#7C3AED]/40 active:border-[#7C3AED]/50",
                            "transition-all duration-300"
                        )}
                    >
                        <Plus size={24} strokeWidth={1.5} />
                    </button>
                </div>
            </div>

            {/* Desktop View: Week Grid */}
            <div className={cn(
                "hidden md:block w-full max-w-[1400px] h-[85vh] overflow-hidden relative z-10",
                "rounded-[2rem] md:rounded-[3rem]",
                "bg-black/20 backdrop-blur-[40px] saturate-150",
                "border border-white/10 ring-1 ring-white/5 inset",
                "shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)]"
            )}>
                {/* Subtle Top Gradient Highlight (Simulated overhead light) */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-0" />
                <div className="relative w-full h-full z-10">
                    <WeekView />
                </div>
            </div>

            {/* Shared FocusPlannerModal (used by both mobile FAB and DailyAgendaView) */}
            <FocusPlannerModal
                isOpen={isPlannerOpen}
                onClose={() => setIsPlannerOpen(false)}
                initialStart={plannerStart}
                initialEnd={new Date(plannerStart.getTime() + 90 * 60000)}
            />

        </section>
    );
}
