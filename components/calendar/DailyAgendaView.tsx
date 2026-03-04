"use client";

import { useBlocksStore } from "@/lib/stores/blocksStore";
import { Block } from "@/lib/types/blocks";
import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Play, MoreHorizontal, Coffee, Dumbbell, Briefcase, BookOpen, Layers, Activity } from "lucide-react";
import { cn } from "@/lib/cn";
import { BlockDrawer } from "./BlockDrawer";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, isBefore, startOfDay, endOfDay } from "date-fns";
import { getBlockColors } from "@/lib/utils/blockColors";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

// UI Config for Block Types (copied to have icons)
const BLOCK_TYPES_UI: Record<string, any> = {
    deep_work: { icon: Layers, color: "text-indigo-400", border: "border-l-indigo-500/50", glow: "shadow-[inset_2px_0_10px_rgba(99,102,241,0.2)]" },
    meeting: { icon: Briefcase, color: "text-blue-400", border: "border-l-blue-500/50", glow: "shadow-[inset_2px_0_10px_rgba(59,130,246,0.2)]" },
    gym: { icon: Dumbbell, color: "text-emerald-400", border: "border-l-emerald-500/50", glow: "shadow-[inset_2px_0_10px_rgba(16,185,129,0.2)]" },
    study: { icon: BookOpen, color: "text-amber-400", border: "border-l-amber-500/50", glow: "shadow-[inset_2px_0_10px_rgba(245,158,11,0.2)]" },
    admin: { icon: Activity, color: "text-slate-400", border: "border-l-slate-400/50", glow: "shadow-[inset_2px_0_10px_rgba(148,163,184,0.2)]" },
    break: { icon: Coffee, color: "text-rose-400", border: "border-l-rose-400/50", glow: "shadow-[inset_2px_0_10px_rgba(244,63,94,0.2)]" },
    other: { icon: MoreHorizontal, color: "text-neutral-400", border: "border-l-neutral-400/50", glow: "shadow-[inset_2px_0_10px_rgba(163,163,163,0.2)]" },
};

interface DailyAgendaViewProps {
    onOpenPlanner?: (startDate: Date) => void;
}

// --- Active Block Card: self-manages hover state for dynamic inline styles ---
interface ActiveBlockCardProps {
    block: Block;
    isDeepWork: boolean;
    colors: ReturnType<typeof getBlockColors>;
    onOpen: () => void;
}

function ActiveBlockCard({ block, isDeepWork, colors, onOpen }: ActiveBlockCardProps) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="relative w-full overflow-hidden rounded-[24px] transition-shadow duration-300"
            style={{
                boxShadow: isHovered
                    ? `0 0 20px 4px ${colors.glow1}, 0 0 40px 8px ${colors.glow2}`
                    : "none",
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Spinning conic gradient — Layer 1: main dual-streak */}
            <div
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] animate-[spin_3s_linear_infinite]"
                style={{ background: `conic-gradient(transparent, ${colors.primary} 5%, transparent 38%, transparent 50%, ${colors.secondary} 62%, transparent 87%)` }}
            />
            {/* Layer 2: faster sharper streak */}
            <div
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] animate-[spin_2s_linear_infinite] opacity-70"
                style={{ background: `conic-gradient(transparent, ${colors.streak} 2%, transparent 18%)`, filter: "blur(1px)" }}
            />
            {/* Inner button sits 1.5px inset — opaque bg blocks the gradient center */}
            <button
                onClick={onOpen}
                className="absolute text-left p-5 rounded-[22.5px] bg-[#0a0b12] backdrop-blur-xl transition-colors duration-200 hover:bg-[#11131e]"
                style={{ inset: "1.5px", border: `1px solid ${colors.innerBorder}` }}
            >
                <div className="flex flex-col gap-1.5">
                    <span className="text-white/90 font-medium text-[16px] tracking-tight">
                        {block.title}
                    </span>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                        <span className="text-[12px] text-white/40 flex items-center gap-1">
                            <span className="opacity-70">⏱</span>
                            {format(block.startAt, "h:mm a")} - {format(block.endAt, "h:mm a")}
                        </span>
                        {isDeepWork && (
                            <span className="text-[10px] font-medium text-indigo-300/80 tracking-wide bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/10">
                                ✨ Optimal focus flow
                            </span>
                        )}
                    </div>
                </div>
            </button>
            {/* Spacer: gives the wrapper its natural height since button is absolute */}
            <div className="invisible p-5">
                <div className="text-[16px]">{block.title}</div>
                <div className="text-[12px] mt-0.5">{format(block.startAt, "h:mm a")} - {format(block.endAt, "h:mm a")}</div>
            </div>
        </div>
    );
}

export function DailyAgendaView({ onOpenPlanner }: DailyAgendaViewProps = {}) {
    const { blocks } = useBlocksStore();

    const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
    const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

    // --- Animation Key ---
    // Change this key every time selectedDate changes to force re-render the timeline
    // for the 180ms ease-out fade transition.
    const [animKey, setAnimKey] = useState(0);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const handleDateClick = (day: Date) => {
        setSelectedDate(day);
        setAnimKey(prev => prev + 1);
    };

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = useMemo(() => {
        const days = [];
        let day = startDate;
        while (day <= endDate) {
            days.push(day);
            day = addDays(day, 1);
        }
        return days;
    }, [startDate, endDate]);

    // --- Timeline Logic ---
    const dailyBlocks = useMemo(() => {
        return blocks
            .filter(b => isSameDay(b.startAt, selectedDate))
            .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    }, [blocks, selectedDate]);

    return (
        <div className="flex flex-col h-full w-full bg-transparent text-neutral-200 select-none relative">
            {/* --- MONTH VIEW GRID --- */}
            <div className="w-full px-4 pt-4 pb-2 shrink-0">
                {/* Header (Diciembre 2023) */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium text-white/90 capitalize pl-2 drop-shadow-sm">
                        {format(currentMonth, "MMMM yyyy")}
                    </h2>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={prevMonth}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/50 hover:text-white"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={nextMonth}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/50 hover:text-white"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Days of week */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {DAYS.map((d, i) => (
                        <div key={i} className="text-center">
                            <span className="text-[10px] text-white/40 uppercase font-semibold tracking-widest">{d}</span>
                        </div>
                    ))}
                </div>

                {/* Dates Grid */}
                <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                    {calendarDays.map((day, i) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const isPast = isBefore(day, startOfDay(new Date()));
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div key={i} className="flex justify-center items-center h-10 relative">
                                <button
                                    onClick={() => handleDateClick(day)}
                                    className={cn(
                                        "w-8 h-8 flex items-center justify-center rounded-full text-[15px] transition-all duration-200",
                                        // Active State (Agendo Rule)
                                        isSelected
                                            ? "bg-white/5 border border-white/15 shadow-[inset_0_0_12px_rgba(124,58,237,0.3)] text-white font-medium"
                                            : "border border-transparent hover:border-white/5",
                                        // Text color
                                        !isSelected && isToday ? "text-indigo-300 font-semibold" : "",
                                        !isSelected && !isCurrentMonth ? "text-white/10" : "",
                                        !isSelected && isCurrentMonth && isPast ? "text-white/30" : "",
                                        !isSelected && isCurrentMonth && !isPast && !isToday ? "text-white/80" : ""
                                    )}
                                >
                                    {format(day, "d")}
                                </button>
                                {/* Indicator Dot for events? (Optional) */}
                                {!isSelected && blocks.some(b => isSameDay(b.startAt, day)) && (
                                    <div className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-500/50" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- AGENDA VIEW (VERTICAL TIMELINE) --- */}
            <div
                className="flex-1 overflow-y-auto touch-pan-y [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] px-4 pt-4 pb-24"
                key={animKey}
            >
                {/* 180ms ease-out dominant transition container */}
                <div className="flex w-full min-h-full animate-in fade-in slide-in-from-bottom-2 duration-[250ms] ease-out fill-mode-both">

                    {/* Time Axis (Left) */}
                    <div className="w-[60px] shrink-0 relative">
                        {/* Vertical line fading to transparent */}
                        <div className="absolute top-2 bottom-0 right-4 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />

                        {/* Time labels inside axis */}
                        <div className="flex flex-col h-full absolute w-full right-3 pr-2" style={{ top: '0px' }}>
                            {dailyBlocks.map((block, idx) => (
                                <div key={`time-${block.id}`} className="absolute w-full text-right" style={{
                                    // Use index relative positioning for now, we will map them linearly or as a list
                                    // Actually, in a pure agenda view, we don't place them absolutely by time, 
                                    // we just list them and put the start time on the left in the flow.
                                    display: 'none'
                                }}>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Timeline Flow (List of Cards) */}
                    <div className="flex-1 flex flex-col gap-6 pt-2">
                        {dailyBlocks.length === 0 ? (
                            <div className="h-40 flex items-center justify-center">
                                <span className="text-white/30 text-sm tracking-wide">No events scheduled.</span>
                            </div>
                        ) : (
                            dailyBlocks.map((block, index) => {
                                const ui = BLOCK_TYPES_UI[block.type] || BLOCK_TYPES_UI.other;
                                const isDeepWork = block.type === "deep_work";
                                const now = new Date();
                                const isCurrentlyActive = isSameDay(block.startAt, now) && block.startAt <= now && block.endAt > now;
                                const colors = getBlockColors(block.type);

                                return (
                                    <div key={block.id} className="relative flex w-full">

                                        {/* Time Label on left side within the flow */}
                                        <div className="absolute -left-[54px] top-3 w-10 text-right">
                                            <span className="text-[11px] font-medium text-white/40 tracking-wider">
                                                {format(block.startAt, "h:mm")}
                                            </span>
                                            <div className="text-[9px] text-white/20 mt-0.5">
                                                {format(block.startAt, "a")}
                                            </div>
                                        </div>

                                        {/* Dot on the timeline */}
                                        <div className="absolute -left-[16.5px] top-[18px] w-1.5 h-1.5 rounded-full bg-white/30 shadow-[0_0_8px_rgba(255,255,255,0.3)]" />

                                        {/* Glass System Card */}
                                        {isCurrentlyActive ? (
                                            // OUTER: animated gradient wrapper
                                            <ActiveBlockCard
                                                block={block}
                                                isDeepWork={isDeepWork}
                                                colors={colors}
                                                onOpen={() => setSelectedBlockId(block.id)}
                                            />
                                        ) : (
                                            <button
                                                onClick={() => setSelectedBlockId(block.id)}
                                                className={cn(
                                                    "w-full text-left p-5 transition-all duration-300 hover:scale-[1.01] hover:bg-white/[0.08]",
                                                    "rounded-[24px] bg-white/[0.04] backdrop-blur-xl border border-white/10",
                                                    "shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
                                                    "border-l-2", ui.border,
                                                )}
                                            >
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white/90 font-medium text-[16px] tracking-tight">
                                                            {block.title}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                                        <span className="text-[12px] text-white/40 flex items-center gap-1">
                                                            <span className="opacity-70">⏱</span>
                                                            {format(block.startAt, "h:mm a")} - {format(block.endAt, "h:mm a")}
                                                        </span>

                                                        {isDeepWork && (
                                                            <span className="text-[10px] font-medium text-indigo-300/80 tracking-wide bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/10 shadow-[0_0_10px_-2px_rgba(99,102,241,0.3)]">
                                                                ✨ Optimal focus flow
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            <BlockDrawer
                blockId={selectedBlockId}
                isOpen={!!selectedBlockId}
                onClose={() => setSelectedBlockId(null)}
            />

        </div>
    );
}
