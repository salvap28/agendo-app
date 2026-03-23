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
import { Block } from "@/lib/types/blocks";
import { useFocusStore } from "@/lib/stores/focusStore";
import { sortBlocksByStart } from "@/lib/utils/blockState";
import { findNextFreeSlot, isOverlapping, snapTo15 } from "@/lib/utils/scheduling";
import { enrichNewBlockWithPlanningMetadata } from "@/lib/utils/blockEnrichment";
import { OverlapResolutionModal, OverlapResolutionType } from "./OverlapResolutionModal";
import { resolveOverlapBySlicingUnderlying, resolveOverlapByShrinkingNew } from "@/lib/utils/overlapResolution";
import { MonthDayCell } from "./glass-calendar-dashboard/MonthDayCell";
import { ScheduledEventCard } from "./glass-calendar-dashboard/ScheduledEventCard";
import { CalendarEvent } from "./glass-calendar-dashboard/types";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SEARCHABLE_TYPE_LABELS: Record<CalendarEvent["type"], string> = {
    deep_work: "deep work",
    meeting: "meeting",
    gym: "gym",
    study: "study",
    admin: "admin",
    break: "break",
    other: "other",
};

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
    const { blocks, createBlock, updateBlock } = useBlocksStore();
    const { session, openFromBlock } = useFocusStore();

    const [currentTime, setCurrentTime] = useState(() => new Date());
    const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(new Date()));
    const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
    const [searchQuery, setSearchQuery] = useState("");
    const [pendingConflict, setPendingConflict] = useState<{ newBlock: Partial<Block> & Pick<Block, "startAt" | "endAt">, overlaps: Block[] } | null>(null);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => window.clearInterval(interval);
    }, []);

    const events = useMemo<CalendarEvent[]>(
        () =>
            sortBlocksByStart(
                blocks
                    .filter((block) => block.status !== "canceled")
                    .map((block) => ({
                        ...block,
                        displayTitle: block.title?.trim() || "Untitled Block",
                    }))
            ),
        [blocks]
    );
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const visibleEvents = useMemo(() => {
        if (!normalizedSearch) return events;

        return events.filter((event) => {
            const searchableValue = [
                event.displayTitle,
                event.notes,
                SEARCHABLE_TYPE_LABELS[event.type],
                format(event.startAt, "MMMM d yyyy"),
                format(event.startAt, "H:mm"),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableValue.includes(normalizedSearch);
        });
    }, [events, normalizedSearch]);
    const firstSearchMatch = normalizedSearch ? visibleEvents[0] ?? null : null;
    const effectiveDisplayMonth = useMemo(() => {
        if (!normalizedSearch || !firstSearchMatch) return displayMonth;

        const currentMonthHasMatches = visibleEvents.some(
            (event) => startOfMonth(event.startAt).getTime() === displayMonth.getTime()
        );

        return currentMonthHasMatches ? displayMonth : startOfMonth(firstSearchMatch.startAt);
    }, [displayMonth, firstSearchMatch, normalizedSearch, visibleEvents]);
    const effectiveSelectedDate = useMemo(() => {
        if (!normalizedSearch || !firstSearchMatch) return selectedDate;

        const selectedDayHasMatches = visibleEvents.some(
            (event) => getDayKey(event.startAt) === getDayKey(selectedDate)
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
        [effectiveSelectedDate, eventsByDay]
    );

    const totalMonthEvents = useMemo(
        () =>
            visibleEvents.reduce((count, event) => (
                startOfMonth(event.startAt).getTime() === effectiveDisplayMonth.getTime() ? count + 1 : count
            ), 0),
        [visibleEvents, effectiveDisplayMonth]
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

        const dayBlocks = blocks.filter(
            (block) => getDayKey(block.startAt) === getDayKey(effectiveSelectedDate) && block.status !== "canceled"
        );
        const endAt = addMinutes(desiredStart, durationMinutes);
        
        const overlaps = dayBlocks.filter(b => isOverlapping(desiredStart, endAt, b.startAt, b.endAt));

        const enriched = enrichNewBlockWithPlanningMetadata({
            startAt: desiredStart,
            endAt,
            title: "",
            type: "other"
        });

        if (overlaps.length > 0) {
            setPendingConflict({ newBlock: enriched, overlaps });
        } else {
            const newBlock = createBlock(enriched);
            if (newBlock) onOpenBlock(newBlock.id, true);
        }
    };

    
    const handleResolveConflict = (resolution: OverlapResolutionType) => {
        if (!pendingConflict) return;
        const { newBlock, overlaps } = pendingConflict;
        
        let resultingId = newBlock.id;
        let isCreation = !newBlock.id;

        const _currentBlocks = blocks.filter(b => b.status !== "canceled" && b.id !== newBlock.id);

        if (resolution === 'slice_underlying') {
            const result = resolveOverlapBySlicingUnderlying(newBlock, overlaps, updateBlock, createBlock);
            if (result && isCreation) resultingId = result.id;
        } 
        else if (resolution === 'shrink_new') {
            const result = resolveOverlapByShrinkingNew(newBlock, overlaps, createBlock);
            if (result && isCreation) resultingId = result.id;
        }
        else if (resolution === 'move_forward') {
            const durationMins = (newBlock.endAt.getTime() - newBlock.startAt.getTime()) / 60000;
            const slot = findNextFreeSlot(_currentBlocks, newBlock.startAt, durationMins, newBlock.id);
            
            if (slot) {
                newBlock.startAt = slot.startAt;
                newBlock.endAt = slot.endAt;
                const result = createBlock(newBlock);
                if (result && isCreation) resultingId = result.id;
            }
        }
        else if (resolution === 'keep_overlap') {
            const result = createBlock(newBlock);
            if (result && isCreation) resultingId = result.id;
        }

        if (isCreation && resultingId) {
            onOpenBlock(resultingId, true);
        }
        
        setPendingConflict(null);
    };

    return (
        <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.18),transparent_38%),radial-gradient(circle_at_70%_30%,rgba(99,102,241,0.12),transparent_26%)]" />
            <div className="relative z-10 flex h-full flex-col p-5 lg:p-6">
                <div className="flex items-center justify-between gap-4 pb-5 lg:pb-6">
                    <div className="space-y-1">
                        <p className="text-sm text-white/40">
                            {normalizedSearch
                                ? `${visibleEvents.length} matching blocks, ${totalMonthEvents} in ${format(effectiveDisplayMonth, "MMMM")}.`
                                : `${totalMonthEvents} real blocks in ${format(effectiveDisplayMonth, "MMMM")}.`}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden min-w-[280px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/40 backdrop-blur-md xl:flex">
                            <Search className="h-4 w-4" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search blocks, notes or type"
                                className="w-full bg-transparent text-white/80 outline-none placeholder:text-white/30"
                                aria-label="Search calendar blocks"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white/35 transition-colors hover:bg-white/8 hover:text-white/75"
                                    aria-label="Clear calendar search"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleCreateBlock}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/80 backdrop-blur-md transition-all duration-300 hover:bg-white/[0.1] hover:text-white motion-reduce:transition-none"
                        >
                            <Plus className="h-4 w-4" />
                            New event
                        </button>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,7fr)_minmax(300px,3fr)] gap-4 xl:gap-5">
                    <div className="relative flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 p-5 backdrop-blur-2xl">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 text-left text-white/85 transition-colors hover:bg-white/[0.06] motion-reduce:transition-none"
                                >
                                    <CalendarDays className="h-4 w-4 text-white/50" />
                                    <span className="text-lg font-semibold tracking-tight">{format(effectiveDisplayMonth, "MMMM")}</span>
                                </button>
                                <span className="text-lg text-white/50">{format(effectiveDisplayMonth, "yyyy")}</span>
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
                            {DAY_LABELS.map((label) => (
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

                    <aside className="flex min-h-0 flex-col overflow-visible rounded-[2rem] border border-white/10 bg-black/30 p-5 backdrop-blur-2xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-2xl font-semibold tracking-tight text-white/90">Scheduled</h3>
                                <p className="mt-1 text-sm text-white/40">{format(effectiveSelectedDate, "MMMM d, yyyy")}</p>
                                {normalizedSearch && (
                                    <p className="mt-1 text-xs text-white/30">
                                        Filtering by &quot;{searchQuery.trim()}&quot;
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
                                        {normalizedSearch ? "No matching blocks" : "No blocks scheduled"}
                                    </p>
                                    <p className="mt-1 max-w-[240px] text-sm text-white/40">
                                        {normalizedSearch
                                            ? "Try another search, another day, or clear the filter."
                                            : "Create a block and edit it with the orbital menu."}
                                    </p>
                                    {normalizedSearch ? (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery("")}
                                            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/80 transition-all duration-300 hover:bg-white/[0.1] hover:text-white motion-reduce:transition-none"
                                        >
                                            <X className="h-4 w-4" />
                                            Clear search
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleCreateBlock}
                                            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/80 transition-all duration-300 hover:bg-white/[0.1] hover:text-white motion-reduce:transition-none"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Create block
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
        
            <OverlapResolutionModal
                isOpen={!!pendingConflict}
                onClose={() => setPendingConflict(null)}
                pendingBlock={pendingConflict?.newBlock || null}
                overlappingCount={pendingConflict?.overlaps.length || 0}
                onResolve={handleResolveConflict}
            />
        </div>
    );
}
