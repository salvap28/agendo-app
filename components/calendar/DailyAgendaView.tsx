"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    Coffee,
    Dumbbell,
    Briefcase,
    BookOpen,
    Layers,
    Activity,
    type LucideIcon,
} from "lucide-react";
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    isBefore,
    startOfDay,
} from "date-fns";
import { cn } from "@/lib/cn";
import { usePerformancePreference } from "@/hooks/usePerformancePreference";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useActivityExperienceStore } from "@/lib/stores/activityExperienceStore";
import { useFocusStore } from "@/lib/stores/focusStore";
import { Block } from "@/lib/types/blocks";
import { getBlockColors } from "@/lib/utils/blockColors";
import { getBlockRuntimeState, sortBlocksByStart } from "@/lib/utils/blockState";
import { useI18n } from "@/lib/i18n/client";
import { getDateFnsLocale, getWeekdayInitialsMondayFirst } from "@/lib/i18n/app";

type BlockTypeUiConfig = {
    icon: LucideIcon;
    color: string;
    border: string;
    glow: string;
};

const BLOCK_TYPES_UI: Record<string, BlockTypeUiConfig> = {
    deep_work: { icon: Layers, color: "text-indigo-400", border: "border-l-indigo-500/50", glow: "shadow-[inset_2px_0_10px_rgba(99,102,241,0.2)]" },
    meeting: { icon: Briefcase, color: "text-blue-400", border: "border-l-blue-500/50", glow: "shadow-[inset_2px_0_10px_rgba(59,130,246,0.2)]" },
    gym: { icon: Dumbbell, color: "text-emerald-400", border: "border-l-emerald-500/50", glow: "shadow-[inset_2px_0_10px_rgba(16,185,129,0.2)]" },
    study: { icon: BookOpen, color: "text-amber-400", border: "border-l-amber-500/50", glow: "shadow-[inset_2px_0_10px_rgba(245,158,11,0.2)]" },
    admin: { icon: Activity, color: "text-slate-400", border: "border-l-slate-400/50", glow: "shadow-[inset_2px_0_10px_rgba(148,163,184,0.2)]" },
    break: { icon: Coffee, color: "text-rose-400", border: "border-l-rose-400/50", glow: "shadow-[inset_2px_0_10px_rgba(244,63,94,0.2)]" },
    other: { icon: MoreHorizontal, color: "text-neutral-400", border: "border-l-neutral-400/50", glow: "shadow-[inset_2px_0_10px_rgba(163,163,163,0.2)]" },
};

interface DailyAgendaViewProps {
    selectedDate?: Date;
    onSelectedDateChange?: (date: Date) => void;
    setSelectedBlockId?: (id: string | null) => void;
    setIsNewBlock?: (isNew: boolean) => void;
}

interface ActiveBlockCardProps {
    block: Block;
    isDeepWork: boolean;
    colors: ReturnType<typeof getBlockColors>;
    isSessionPaused?: boolean;
    onOpen: () => void;
}

function ActiveBlockCard({ block, isDeepWork, colors, isSessionPaused, onOpen }: ActiveBlockCardProps) {
    const { language } = useI18n();
    const dateFnsLocale = getDateFnsLocale(language);
    const [isHovered, setIsHovered] = useState(false);
    const { isLowEnd } = usePerformancePreference();

    return (
        <div
            className={cn(
                "relative w-full rounded-[24px] transition-shadow duration-300",
                isSessionPaused ? "animate-pulse ring-2 ring-opacity-50" : "overflow-hidden",
            )}
            style={{
                boxShadow: isSessionPaused
                    ? `0 0 30px ${colors.glow1}`
                    : isHovered
                        ? `0 0 20px 4px ${colors.glow1}, 0 0 40px 8px ${colors.glow2}`
                        : "none",
                "--tw-ring-color": isSessionPaused ? colors.primary : undefined,
            } as CSSProperties}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {!isSessionPaused && !isLowEnd && (
                <>
                    <div
                        className="pointer-events-none absolute top-1/2 left-1/2 h-[300%] w-[300%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3s_linear_infinite]"
                        style={{ background: `conic-gradient(transparent, ${colors.primary} 5%, transparent 38%, transparent 50%, ${colors.secondary} 62%, transparent 87%)` }}
                    />
                    <div
                        className="pointer-events-none absolute top-1/2 left-1/2 h-[300%] w-[300%] -translate-x-1/2 -translate-y-1/2 animate-[spin_2s_linear_infinite] opacity-70"
                        style={{ background: `conic-gradient(transparent, ${colors.streak} 2%, transparent 18%)`, filter: "blur(1px)" }}
                    />
                </>
            )}

            {/* Static background for low-end devices without pause */}
            {!isSessionPaused && isLowEnd && (
                <div
                    className="pointer-events-none absolute inset-0 opacity-40"
                    style={{ background: `linear-gradient(135deg, ${colors.primary}40, ${colors.secondary}20)` }}
                />
            )}

            <button
                onClick={onOpen}
                className={cn(
                    "absolute p-5 text-left transition-colors duration-200",
                    isLowEnd ? "" : "backdrop-blur-xl",
                    isSessionPaused ? "rounded-[24px] bg-[#11131e]/90 hover:bg-[#1a1d2e]/90" : "rounded-[22.5px] bg-[#0a0b12] hover:bg-[#11131e]",
                )}
                style={{
                    inset: isSessionPaused ? "0px" : "1.5px",
                    border: isSessionPaused ? "none" : `1px solid ${colors.innerBorder}`,
                }}
            >
                <div className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-2 text-[16px] font-medium tracking-tight text-white/90">
                        {block.title}
                        {isSessionPaused && (
                            <span
                                className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                                style={{ color: colors.primary, backgroundColor: `${colors.primary}20` }}
                            >
                                {language === "es" ? "Pausado" : "Paused"}
                            </span>
                        )}
                    </span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1 text-[12px] text-white/40">
                            <span className="opacity-70">⏱</span>
                            {format(block.startAt, "h:mm a", { locale: dateFnsLocale })} - {format(block.endAt, "h:mm a", { locale: dateFnsLocale })}
                        </span>
                        {isDeepWork && (
                            <span className="rounded-full border border-indigo-500/10 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-indigo-300/80">
                                ✦ {language === "es" ? "Flujo ideal de foco" : "Optimal focus flow"}
                            </span>
                        )}
                    </div>
                </div>
            </button>

            <div className="invisible p-5">
                <div className="flex items-center gap-2 text-[16px]">
                    {block.title}
                    {isSessionPaused && <span className="px-1.5 py-0.5 text-[9px]">{language === "es" ? "Pausado" : "Paused"}</span>}
                </div>
                <div className="mt-0.5 text-[12px]">
                    {format(block.startAt, "h:mm a", { locale: dateFnsLocale })} - {format(block.endAt, "h:mm a", { locale: dateFnsLocale })}
                </div>
            </div>
        </div>
    );
}

export function DailyAgendaView({
    selectedDate,
    onSelectedDateChange,
    setSelectedBlockId,
    setIsNewBlock,
}: DailyAgendaViewProps) {
    const { language } = useI18n();
    const dateFnsLocale = getDateFnsLocale(language);
    const dayLabels = getWeekdayInitialsMondayFirst(language);
    const blocks = useBlocksStore((state) => state.blocks);
    const fetchDayExperiences = useActivityExperienceStore((state) => state.fetchDayExperiences);
    const session = useFocusStore((state) => state.session);
    const returnToFocus = useFocusStore((state) => state.returnToFocus);

    const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
    const [internalSelectedDate, setInternalSelectedDate] = useState(startOfDay(new Date()));
    const [currentTime, setCurrentTime] = useState(() => new Date());
    const [animKey, setAnimKey] = useState(0);

    const effectiveSelectedDateMs = selectedDate
        ? startOfDay(selectedDate).getTime()
        : internalSelectedDate.getTime();
    const effectiveSelectedDate = useMemo(() => new Date(effectiveSelectedDateMs), [effectiveSelectedDateMs]);
    const effectiveSelectedDateKey = useMemo(
        () => format(effectiveSelectedDate, "yyyy-MM-dd"),
        [effectiveSelectedDate],
    );

    useEffect(() => {
        const interval = window.setInterval(() => {
            setCurrentTime(new Date());
        }, 30000);

        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        void fetchDayExperiences(effectiveSelectedDateKey);
    }, [effectiveSelectedDateKey, fetchDayExperiences]);

    const handleDateClick = (day: Date) => {
        const normalizedDay = startOfDay(day);
        if (onSelectedDateChange) {
            onSelectedDateChange(normalizedDay);
        } else {
            setInternalSelectedDate(normalizedDay);
        }
        setAnimKey((prev) => prev + 1);
    };

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = useMemo(() => {
        const days: Date[] = [];
        let cursor = startDate;
        while (cursor <= endDate) {
            days.push(cursor);
            cursor = addDays(cursor, 1);
        }
        return days;
    }, [endDate, startDate]);

    const dailyBlocks = useMemo(() => (
        sortBlocksByStart(
            blocks.filter((block) => isSameDay(block.startAt, effectiveSelectedDate) && block.status !== "canceled"),
        )
    ), [blocks, effectiveSelectedDate]);

    return (
        <div className="relative flex h-full w-full select-none flex-col bg-transparent text-neutral-200">
            <div className="w-full shrink-0 px-4 pt-4 pb-2">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="pl-2 text-lg font-medium capitalize text-white/90 drop-shadow-sm">
                        {format(currentMonth, "MMMM yyyy", { locale: dateFnsLocale })}
                    </h2>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="rounded-full p-2 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="rounded-full p-2 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                <div className="mb-2 grid grid-cols-7 gap-1">
                    {dayLabels.map((label, index) => (
                        <div key={`${label}-${index}`} className="text-center">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{label}</span>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                    {calendarDays.map((day, index) => {
                        const isSelected = isSameDay(day, effectiveSelectedDate);
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const isPast = isBefore(day, startOfDay(new Date()));
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div key={`${day.toISOString()}-${index}`} className="relative flex h-10 items-center justify-center">
                                <button
                                    onClick={() => handleDateClick(day)}
                                    className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-full text-[15px] transition-all duration-200",
                                        isSelected
                                            ? "border border-white/15 bg-white/5 font-medium text-white shadow-[inset_0_0_12px_rgba(124,58,237,0.3)]"
                                            : "border border-transparent hover:border-white/5",
                                        !isSelected && isToday ? "font-semibold text-indigo-300" : "",
                                        !isSelected && !isCurrentMonth ? "text-white/10" : "",
                                        !isSelected && isCurrentMonth && isPast ? "text-white/30" : "",
                                        !isSelected && isCurrentMonth && !isPast && !isToday ? "text-white/80" : "",
                                    )}
                                >
                                    {format(day, "d")}
                                </button>
                                {!isSelected && blocks.some((block) => isSameDay(block.startAt, day) && block.status !== "canceled") && (
                                    <div className="absolute bottom-1 h-1 w-1 rounded-full bg-indigo-500/50" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div
                className="flex-1 overflow-y-auto touch-pan-y px-4 pt-4 pb-24 [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden"
                key={animKey}
            >
                <div className="flex min-h-full w-full animate-in fill-mode-both fade-in slide-in-from-bottom-2 duration-[250ms] ease-out">
                    <div className="relative w-[60px] shrink-0">
                        <div className="absolute top-2 right-4 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                    </div>

                    <div className="flex flex-1 flex-col gap-6 pt-2">
                        {dailyBlocks.length === 0 ? (
                            <div className="flex h-40 items-center justify-center">
                                <span className="text-sm tracking-wide text-white/30">
                                    {language === "es" ? "No hay eventos programados." : "No events scheduled."}
                                </span>
                            </div>
                        ) : (
                            dailyBlocks.map((block) => {
                                const ui = BLOCK_TYPES_UI[block.type] || BLOCK_TYPES_UI.other;
                                const isDeepWork = block.type === "deep_work";
                                const runtimeState = getBlockRuntimeState(block, session, currentTime);
                                const isCurrentlyActive = runtimeState.isActiveNow;
                                const isSessionForThisBlock = runtimeState.isSessionBlock;
                                const isSessionPaused = runtimeState.hasPausedFocus;
                                const isSessionRunning = runtimeState.isFocusRunning;
                                const colors = getBlockColors(block.type);

                                return (
                                    <div key={block.id} className="relative flex w-full">
                                        <div className="absolute top-3 -left-[54px] w-10 text-right">
                                            <span className="text-[11px] font-medium tracking-wider text-white/40">
                                                {format(block.startAt, "h:mm", { locale: dateFnsLocale })}
                                            </span>
                                            <div className="mt-0.5 text-[9px] text-white/20">
                                                {format(block.startAt, "a", { locale: dateFnsLocale })}
                                            </div>
                                        </div>

                                        <div className="absolute top-[18px] -left-[16.5px] h-1.5 w-1.5 rounded-full bg-white/30 shadow-[0_0_8px_rgba(255,255,255,0.3)]" />

                                        {isCurrentlyActive || isSessionForThisBlock ? (
                                            <ActiveBlockCard
                                                block={block}
                                                isDeepWork={isDeepWork}
                                                colors={colors}
                                                isSessionPaused={isSessionPaused}
                                                onOpen={() => {
                                                    if (isSessionPaused || isSessionRunning) {
                                                        returnToFocus();
                                                    } else {
                                                        setIsNewBlock?.(false);
                                                        setSelectedBlockId?.(block.id);
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setIsNewBlock?.(false);
                                                    setSelectedBlockId?.(block.id);
                                                }}
                                                className={cn(
                                                    "w-full rounded-[24px] border border-white/10 border-l-2 bg-white/[0.04] p-5 text-left shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 hover:scale-[1.01] hover:bg-white/[0.08]",
                                                    ui.border,
                                                )}
                                            >
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[16px] font-medium tracking-tight text-white/90">
                                                            {block.title}
                                                        </span>
                                                    </div>

                                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        <span className="flex items-center gap-1 text-[12px] text-white/40">
                                                            <span className="opacity-70">⏱</span>
                                                            {format(block.startAt, "h:mm a", { locale: dateFnsLocale })} - {format(block.endAt, "h:mm a", { locale: dateFnsLocale })}
                                                        </span>

                                                        {isDeepWork && (
                                                            <span className="rounded-full border border-indigo-500/10 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-indigo-300/80 shadow-[0_0_10px_-2px_rgba(99,102,241,0.3)]">
                                                                ✦ {language === "es" ? "Flujo ideal de foco" : "Optimal focus flow"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
