"use client";

import { useEffect, useMemo, useState } from "react";
import {
    addDays,
    addMinutes,
    addMonths,
    endOfMonth,
    endOfWeek,
    format,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subDays,
    subMonths,
} from "date-fns";
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Plus,
    Search,
    X,
} from "lucide-react";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useFocusStore } from "@/lib/stores/focusStore";
import { sortBlocksByStart } from "@/lib/utils/blockState";
import { snapTo15 } from "@/lib/utils/scheduling";
import { enrichNewBlockWithPlanningMetadata } from "@/lib/utils/blockEnrichment";
import { MonthDayCell } from "./glass-calendar-dashboard/MonthDayCell";
import { ScheduledEventCard } from "./glass-calendar-dashboard/ScheduledEventCard";
import { CalendarEvent } from "./glass-calendar-dashboard/types";
import { useI18n } from "@/lib/i18n/client";
import {
    getBlockTypeLabel,
    getDateFnsLocale,
    getIntlLocale,
    getWeekdayNamesSundayFirst,
} from "@/lib/i18n/app";
import { usePerformancePreference } from "@/hooks/usePerformancePreference";
import { cn } from "@/lib/cn";

function buildMonthGrid(month: Date) {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let cursor = calendarStart;

    while (cursor <= calendarEnd) {
        days.push(cursor);
        cursor = addDays(cursor, 1);
    }

    return days;
}

function getDayKey(day: Date) {
    return format(startOfDay(day), "yyyy-MM-dd");
}

interface GlassCalendarDashboardProps {
    onOpenBlock: (blockId: string, isNewBlock?: boolean) => void;
}

export function GlassCalendarDashboard({ onOpenBlock }: GlassCalendarDashboardProps) {
    const { language } = useI18n();
    const dateFnsLocale = getDateFnsLocale(language);
    const intlLocale = getIntlLocale(language);
    const dayLabels = getWeekdayNamesSundayFirst(language);
    const copy = language === "es"
        ? {
            untitledBlock: "Bloque sin título",
            searchPlaceholder: "Buscar bloques, notas o tipo",
            searchAria: "Buscar bloques del calendario",
            clearSearchAria: "Limpiar búsqueda del calendario",
            newEvent: "Nuevo evento",
            scheduled: "Programado",
            noMatchingBlocks: "No hay bloques coincidentes",
            noBlocksScheduled: "No hay bloques programados",
            emptySearch: "Prueba otra búsqueda, otro día o limpia el filtro.",
            emptyCalendar: "Crea un bloque y edítalo desde el menú orbital.",
            clearSearch: "Limpiar búsqueda",
            createBlock: "Crear bloque",
        }
        : {
            untitledBlock: "Untitled Block",
            searchPlaceholder: "Search blocks, notes or type",
            searchAria: "Search calendar blocks",
            clearSearchAria: "Clear calendar search",
            newEvent: "New event",
            scheduled: "Scheduled",
            noMatchingBlocks: "No matching blocks",
            noBlocksScheduled: "No blocks scheduled",
            emptySearch: "Try another search, another day, or clear the filter.",
            emptyCalendar: "Create a block and edit it with the orbital menu.",
            clearSearch: "Clear search",
            createBlock: "Create block",
        };

    const { blocks, createBlock } = useBlocksStore();
    const { session, openFromBlock } = useFocusStore();

    const [currentTime, setCurrentTime] = useState(() => new Date());
    const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(new Date()));
    const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
    const [searchQuery, setSearchQuery] = useState("");
    const { isLowEnd } = usePerformancePreference();

    useEffect(() => {
        const interval = window.setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => window.clearInterval(interval);
    }, []);

    const searchableTypeLabels = useMemo<Record<CalendarEvent["type"], string>>(() => ({
        deep_work: getBlockTypeLabel(language, "deep_work").toLowerCase(),
        meeting: getBlockTypeLabel(language, "meeting").toLowerCase(),
        gym: getBlockTypeLabel(language, "gym").toLowerCase(),
        study: getBlockTypeLabel(language, "study").toLowerCase(),
        admin: getBlockTypeLabel(language, "admin").toLowerCase(),
        break: getBlockTypeLabel(language, "break").toLowerCase(),
        other: getBlockTypeLabel(language, "other").toLowerCase(),
    }), [language]);

    const events = useMemo<CalendarEvent[]>(
        () =>
            sortBlocksByStart(
                blocks
                    .filter((block) => block.status !== "canceled")
                    .map((block) => ({
                        ...block,
                        displayTitle: block.title?.trim() || copy.untitledBlock,
                    })),
            ),
        [blocks, copy.untitledBlock],
    );

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const visibleEvents = useMemo(() => {
        if (!normalizedSearch) return events;

        return events.filter((event) => {
            const searchableValue = [
                event.displayTitle,
                event.notes,
                searchableTypeLabels[event.type],
                format(event.startAt, "MMMM d yyyy", { locale: dateFnsLocale }),
                format(event.startAt, "H:mm", { locale: dateFnsLocale }),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableValue.includes(normalizedSearch);
        });
    }, [dateFnsLocale, events, normalizedSearch, searchableTypeLabels]);

    const firstSearchMatch = normalizedSearch ? visibleEvents[0] ?? null : null;

    const effectiveDisplayMonth = useMemo(() => {
        if (!normalizedSearch || !firstSearchMatch) return displayMonth;

        const currentMonthHasMatches = visibleEvents.some(
            (event) => startOfMonth(event.startAt).getTime() === displayMonth.getTime(),
        );

        return currentMonthHasMatches ? displayMonth : startOfMonth(firstSearchMatch.startAt);
    }, [displayMonth, firstSearchMatch, normalizedSearch, visibleEvents]);

    const effectiveSelectedDate = useMemo(() => {
        if (!normalizedSearch || !firstSearchMatch) return selectedDate;

        const selectedDayHasMatches = visibleEvents.some(
            (event) => getDayKey(event.startAt) === getDayKey(selectedDate),
        );

        return selectedDayHasMatches ? selectedDate : startOfDay(firstSearchMatch.startAt);
    }, [firstSearchMatch, normalizedSearch, selectedDate, visibleEvents]);

    const eventsByDay = useMemo(() => {
        const grouped = new Map<string, CalendarEvent[]>();

        visibleEvents.forEach((event) => {
            const key = getDayKey(event.startAt);
            const bucket = grouped.get(key);

            if (bucket) {
                bucket.push(event);
                return;
            }

            grouped.set(key, [event]);
        });

        return grouped;
    }, [visibleEvents]);

    const calendarDays = useMemo(() => buildMonthGrid(effectiveDisplayMonth), [effectiveDisplayMonth]);

    const selectedEvents = useMemo(
        () => eventsByDay.get(getDayKey(effectiveSelectedDate)) ?? [],
        [effectiveSelectedDate, eventsByDay],
    );

    const totalMonthEvents = useMemo(
        () => visibleEvents.reduce((count, event) => (
            startOfMonth(event.startAt).getTime() === effectiveDisplayMonth.getTime() ? count + 1 : count
        ), 0),
        [visibleEvents, effectiveDisplayMonth],
    );

    const dayEvents = (day: Date) => eventsByDay.get(getDayKey(day)) ?? [];

    const selectDate = (day: Date) => {
        const normalizedDay = startOfDay(day);
        setSelectedDate(normalizedDay);
        setDisplayMonth(startOfMonth(normalizedDay));
    };

    const handleCreateBlock = () => {
        const durationMinutes = 60;
        const desiredStart = new Date(effectiveSelectedDate);

        if (getDayKey(effectiveSelectedDate) === getDayKey(currentTime)) {
            const snappedNow = snapTo15(currentTime);
            desiredStart.setHours(snappedNow.getHours(), snappedNow.getMinutes(), 0, 0);
        } else {
            desiredStart.setHours(9, 0, 0, 0);
        }

        const endAt = addMinutes(desiredStart, durationMinutes);

        const enriched = enrichNewBlockWithPlanningMetadata({
            startAt: desiredStart,
            endAt,
            title: "",
            type: "other",
        });

        const newBlock = createBlock(enriched);
        if (newBlock) onOpenBlock(newBlock.id, true);
    };

    const monthSummary = normalizedSearch
        ? language === "es"
            ? `${visibleEvents.length} bloques coinciden, ${totalMonthEvents} en ${format(effectiveDisplayMonth, "MMMM", { locale: dateFnsLocale })}.`
            : `${visibleEvents.length} matching blocks, ${totalMonthEvents} in ${format(effectiveDisplayMonth, "MMMM", { locale: dateFnsLocale })}.`
        : language === "es"
            ? `${totalMonthEvents} bloques reales en ${format(effectiveDisplayMonth, "MMMM", { locale: dateFnsLocale })}.`
            : `${totalMonthEvents} real blocks in ${format(effectiveDisplayMonth, "MMMM", { locale: dateFnsLocale })}.`;

    return (
        <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.18),transparent_38%),radial-gradient(circle_at_70%_30%,rgba(99,102,241,0.12),transparent_26%)]" />
            <div className="relative z-10 flex h-full flex-col p-5 lg:p-6">
                <div className="flex items-center justify-between gap-4 pb-5 lg:pb-6">
                    <div className="space-y-1">
                        <p className="text-sm text-white/40">{monthSummary}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "hidden min-w-[280px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/40 xl:flex",
                            isLowEnd ? "bg-[#11131e]" : "backdrop-blur-md"
                        )}>
                            <Search className="h-4 w-4" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder={copy.searchPlaceholder}
                                className="w-full bg-transparent text-white/80 outline-none placeholder:text-white/30"
                                aria-label={copy.searchAria}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white/35 transition-colors hover:bg-white/8 hover:text-white/75"
                                    aria-label={copy.clearSearchAria}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleCreateBlock}
                            className={cn(
                                "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 px-4 text-sm font-medium text-white/80 transition-all duration-300 motion-reduce:transition-none hover:text-white",
                                isLowEnd ? "bg-[#11131e] hover:bg-[#1a1d2e]" : "bg-white/[0.06] backdrop-blur-md hover:bg-white/[0.1]"
                            )}
                        >
                            <Plus className="h-4 w-4" />
                            {copy.newEvent}
                        </button>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,7fr)_minmax(300px,3fr)] gap-4 xl:gap-5">
                    <div className={cn(
                        "relative flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/10 p-5",
                        isLowEnd ? "bg-[#0b0c16]" : "bg-black/25 backdrop-blur-2xl"
                    )}>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 text-left text-white/85 transition-colors hover:bg-white/[0.06] motion-reduce:transition-none"
                                >
                                    <CalendarDays className="h-4 w-4 text-white/50" />
                                    <span className="text-lg font-semibold tracking-tight">
                                        {format(effectiveDisplayMonth, "MMMM", { locale: dateFnsLocale })}
                                    </span>
                                </button>
                                <span className="text-lg text-white/50">
                                    {format(effectiveDisplayMonth, "yyyy", { locale: dateFnsLocale })}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDisplayMonth(subMonths(effectiveDisplayMonth, 1))}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition-all hover:bg-white/[0.08] hover:text-white motion-reduce:transition-none"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDisplayMonth(addMonths(effectiveDisplayMonth, 1))}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition-all hover:bg-white/[0.08] hover:text-white motion-reduce:transition-none"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-7 gap-2 text-[11px] uppercase tracking-[0.18em] text-white/35">
                            {dayLabels.map((label) => (
                                <div key={label} className="px-2 py-1">
                                    {label}
                                </div>
                            ))}
                        </div>

                        <div className="relative mt-2 grid flex-1 auto-rows-fr grid-cols-7 gap-2">
                            {calendarDays.map((day) => (
                                <MonthDayCell
                                    key={day.toISOString()}
                                    day={day}
                                    displayMonth={effectiveDisplayMonth}
                                    selectedDate={effectiveSelectedDate}
                                    now={currentTime}
                                    eventsForDay={dayEvents(day)}
                                    session={session}
                                    onSelect={selectDate}
                                    onOpenBlock={(blockId) => onOpenBlock(blockId)}
                                />
                            ))}
                        </div>
                    </div>

                    <aside className={cn(
                        "flex min-h-0 flex-col overflow-visible rounded-[2rem] border border-white/10 p-5",
                        isLowEnd ? "bg-[#0b0c16]/95" : "bg-black/30 backdrop-blur-2xl"
                    )}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-2xl font-semibold tracking-tight text-white/90">{copy.scheduled}</h3>
                                <p className="mt-1 text-sm text-white/40">
                                    {new Intl.DateTimeFormat(intlLocale, {
                                        month: "long",
                                        day: "numeric",
                                        year: "numeric",
                                    }).format(effectiveSelectedDate)}
                                </p>
                                {normalizedSearch && (
                                    <p className="mt-1 text-xs text-white/30">
                                        {language === "es"
                                            ? `Filtrando por "${searchQuery.trim()}"`
                                            : `Filtering by "${searchQuery.trim()}"`}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => selectDate(subDays(effectiveSelectedDate, 1))}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white motion-reduce:transition-none"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => selectDate(addDays(effectiveSelectedDate, 1))}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white motion-reduce:transition-none"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="mt-5 flex-1 space-y-4 overflow-y-auto px-2 pb-5 pt-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {selectedEvents.map((event) => (
                                <ScheduledEventCard
                                    key={event.id}
                                    event={event}
                                    now={currentTime}
                                    session={session}
                                    onOpenBlock={(blockId) => onOpenBlock(blockId)}
                                    onOpenFocus={openFromBlock}
                                />
                            ))}

                            {selectedEvents.length === 0 && (
                                <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] text-center">
                                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60">
                                        <Plus className="h-5 w-5" />
                                    </div>
                                    <p className="text-base font-medium text-white/80">
                                        {normalizedSearch ? copy.noMatchingBlocks : copy.noBlocksScheduled}
                                    </p>
                                    <p className="mt-1 max-w-[240px] text-sm text-white/40">
                                        {normalizedSearch ? copy.emptySearch : copy.emptyCalendar}
                                    </p>
                                    {normalizedSearch ? (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery("")}
                                            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/80 transition-all duration-300 hover:bg-white/[0.1] hover:text-white motion-reduce:transition-none"
                                        >
                                            <X className="h-4 w-4" />
                                            {copy.clearSearch}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleCreateBlock}
                                            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/80 transition-all duration-300 hover:bg-white/[0.1] hover:text-white motion-reduce:transition-none"
                                        >
                                            <Plus className="h-4 w-4" />
                                            {copy.createBlock}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </div>

            <style jsx global>{`
                @keyframes agendo-paused-sweep {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(260%);
                    }
                }
            `}</style>
        </div>
    );
}
