"use client";

import { useBlocksStore } from "@/lib/stores/blocksStore";
import { Block } from "@/lib/types/blocks";
import { BlockItem } from "./BlockItem";
import { BlockDrawer } from "./BlockDrawer";
import { findNextFreeSlot, snapTo15 } from "@/lib/utils/scheduling";
import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Grid, ListTodo, Clock, Plus } from "lucide-react";
import { FocusPlannerModal } from "../focus/FocusPlannerModal";

// Constants
const PIXELS_PER_HOUR = 80;
const MINUTES_PER_PIXEL = 60 / PIXELS_PER_HOUR;
const TOTAL_HOURS = 24;
const TOTAL_HEIGHT = TOTAL_HOURS * PIXELS_PER_HOUR;

// Utils
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Current Time Line Component
function CurrentTimeLine() {
    const [top, setTop] = useState<string | null>(null);

    useEffect(() => {
        const updatePosition = () => {
            const now = new Date();
            const minutes = now.getHours() * 60 + now.getMinutes();
            const percentage = (minutes / (24 * 60)) * 100;
            setTop(`${percentage}%`);
        };

        updatePosition();
        const interval = setInterval(updatePosition, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    if (!top) return null;

    return (
        <div
            className="absolute left-0 right-0 z-50 pointer-events-none flex items-center animate-in fade-in duration-1000"
            style={{ top }}
        >
            {/* Violet Time Pill */}
            <div className="absolute -left-12 md:-left-16 w-12 md:w-16 flex justify-end pr-2">
                <div className="bg-[#7C3AED] text-white text-[10px] md:text-[11px] font-semibold px-2 py-0.5 rounded shadow-[0_0_12px_rgba(124,58,237,0.4)]">
                    {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </div>
            </div>

            {/* Glowing Dot on the line */}
            <div className="w-1.5 h-1.5 rounded-full bg-[#9f7aea] shadow-[0_0_8px_rgba(159,122,234,0.8)] -translate-x-[3px]" />

            {/* Full width fine violet line */}
            <div className="w-full h-[1px] bg-indigo-400/40 shadow-[0_0_6px_rgba(124,58,237,0.3)]" />
        </div>
    );
}

export function WeekView() {
    const { blocks, createBlock, updateBlock } = useBlocksStore();

    // State
    const [currentDate, setCurrentDate] = useState(new Date()); // Week reference
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isPlannerOpen, setIsPlannerOpen] = useState(false);

    const handlePrevWeek = () => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() - 7);
            return d;
        });
    };

    const handleNextWeek = () => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + 7);
            return d;
        });
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    // Interaction State
    const [interaction, setInteraction] = useState<{
        type: "create" | "move" | "resize";
        startPoint: { x: number; y: number };
        startTime: Date; // Start time of the click
        startDayIndex: number; // 0-6
        initialBlock?: Block;
        isDragging: boolean;
    } | null>(null);

    // Ghost Block with visual overrides (only created when Dragging starts)
    const [ghostBlock, setGhostBlock] = useState<(Partial<Block> & { visualLeft?: string }) | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);

    // --- Date Logic ---

    const weekStart = useMemo(() => {
        const d = new Date(currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day; // adjust when day is sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }, [currentDate]);

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            return d;
        });
    }, [weekStart]);

    const weekBlocks = useMemo(() => {
        const endOfWeek = new Date(weekStart);
        endOfWeek.setDate(endOfWeek.getDate() + 7);

        return blocks.filter(b =>
            b.startAt >= weekStart && b.startAt < endOfWeek
        );
    }, [blocks, weekStart]);

    // --- Interaction Helpers ---

    const getDayIndexFromX = (x: number) => {
        if (!gridRef.current) return 0;
        const rect = gridRef.current.getBoundingClientRect();
        const relativeX = x - rect.left;
        const colWidth = rect.width / 7;
        return Math.floor(relativeX / colWidth);
    };

    const getYFromRef = (y: number) => {
        if (!containerRef.current) return 0;
        const rect = containerRef.current.getBoundingClientRect();
        const scrollTop = containerRef.current.scrollTop;
        return y - rect.top + scrollTop;
    };

    const getTimeFromY = (y: number) => {
        const minutes = Math.floor(y * MINUTES_PER_PIXEL);
        const date = new Date(weekStart); // Base date, only time matters
        date.setHours(0, 0, 0, 0);
        date.setMinutes(minutes);
        return date;
    };

    // --- Handlers ---

    // 1. Create on Empty Slot -> Now Opens Focus Planner Modal
    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0 || !gridRef.current) return;

        const dayIndex = getDayIndexFromX(e.clientX);
        if (dayIndex < 0 || dayIndex > 6) return;

        const y = getYFromRef(e.clientY);
        const time = getTimeFromY(y);
        const snappedStart = snapTo15(time);

        const finalStart = new Date(weekStart);
        finalStart.setDate(finalStart.getDate() + dayIndex);
        finalStart.setHours(snappedStart.getHours(), snappedStart.getMinutes(), 0, 0);

        // Update the current interaction date to the clicked slot so the Planner Modal picks it up
        setCurrentDate(finalStart);
        setIsPlannerOpen(true);
    };

    // 2. Click/Drag on Existing Block
    const handleBlockPointerDown = (e: React.PointerEvent, block: Block, action: "move" | "resize") => {
        e.stopPropagation();
        // Capture at container level to track movement outside block
        if (containerRef.current) containerRef.current.setPointerCapture(e.pointerId);

        const startY = getYFromRef(e.clientY);
        const dayIndex = block.startAt.getDay();

        setInteraction({
            type: action,
            startPoint: { x: e.clientX, y: startY },
            startTime: block.startAt,
            startDayIndex: dayIndex,
            initialBlock: { ...block },
            isDragging: false, // Wait for threshold
        });

        // DO NOT set ghostBlock yet. Wait for move > threshold.
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!interaction) return;

        const currentY = getYFromRef(e.clientY);
        const currentTime = getTimeFromY(currentY);

        // --- CHECK DRAG THRESHOLD (if not yet dragging) ---
        if (!interaction.isDragging) {
            const distY = Math.abs(currentY - interaction.startPoint.y);
            const distX = Math.abs(e.clientX - interaction.startPoint.x);

            if (distX < 5 && distY < 5) return; // Too small, ignore

            // Threshold Met -> Start Dragging
            setInteraction(prev => prev ? ({ ...prev, isDragging: true }) : null);

            // Init Ghost Block NOW
            if (interaction.initialBlock) {
                const dayIndex = interaction.initialBlock.startAt.getDay();
                const leftPct = (dayIndex / 7) * 100;
                setGhostBlock({ ...interaction.initialBlock, visualLeft: `${leftPct}%` });
            }
            return;
        }

        // --- DRAGGING LOGIC ---
        if (!ghostBlock) return; // Should exist if isDragging is true (except maybe create race condition?)

        // Smooth Horizontal Calculation
        let visualLeft = ghostBlock.visualLeft;
        if (interaction.type === "move" && gridRef.current) {
            const rect = gridRef.current.getBoundingClientRect();
            const relX = e.clientX - rect.left;
            const pct = (relX / rect.width) * 100;
            visualLeft = `${pct}%`;
        }

        if (interaction.type === "create") {
            // Fixed Start, Dynamic End
            let end = currentTime;
            const endFull = new Date(interaction.startTime);
            endFull.setHours(end.getHours(), end.getMinutes());

            // Min duration check
            if (endFull <= interaction.startTime) {
                endFull.setTime(interaction.startTime.getTime() + 15 * 60000);
            }
            setGhostBlock(prev => ({ ...prev, endAt: endFull }));
        }

        else if (interaction.type === "resize" && interaction.initialBlock) {
            // ... (Same resize logic)
            const start = interaction.initialBlock.startAt;
            let end = currentTime;
            const endFull = new Date(start);
            endFull.setHours(end.getHours(), end.getMinutes());

            if (endFull.getTime() - start.getTime() < 15 * 60000) {
                endFull.setTime(start.getTime() + 15 * 60000);
            }
            setGhostBlock(prev => ({ ...prev, endAt: endFull }));
        }

        else if (interaction.type === "move" && interaction.initialBlock) {
            // ... (Same move logic)
            const dayIndex = getDayIndexFromX(e.clientX);
            const clampedDay = Math.max(0, Math.min(6, dayIndex));

            const originalStart = interaction.initialBlock.startAt;
            const duration = interaction.initialBlock.endAt.getTime() - originalStart.getTime();

            const startY_initial = interaction.startPoint.y;
            const deltaY = currentY - startY_initial;
            const deltaMinutes = (deltaY * MINUTES_PER_PIXEL);

            const targetDay = new Date(weekStart);
            targetDay.setDate(targetDay.getDate() + clampedDay);

            const offsetStart = new Date(originalStart);
            offsetStart.setMinutes(offsetStart.getMinutes() + deltaMinutes);

            targetDay.setHours(offsetStart.getHours(), offsetStart.getMinutes());
            const newEnd = new Date(targetDay.getTime() + duration);

            setGhostBlock(prev => ({
                ...prev,
                startAt: targetDay,
                endAt: newEnd,
                visualLeft
            }));
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!interaction) return;

        // Release captures
        if (interaction.type !== "create") {
            if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) containerRef.current.releasePointerCapture(e.pointerId);
        } else {
            if (gridRef.current && gridRef.current.hasPointerCapture(e.pointerId)) gridRef.current.releasePointerCapture(e.pointerId);
        }

        // --- CLICK DETECTION ---
        // If we simply clicked (never met threshold), isDragging is FALSE.
        // We open the drawer for the initial block.
        if (interaction.initialBlock && !interaction.isDragging && interaction.type !== 'create') {
            setSelectedBlockId(interaction.initialBlock.id);
            setInteraction(null);
            setGhostBlock(null);
            return;
        }

        // --- DROP / COMMIT ---
        // Only if we were dragging (and ghostBlock exists)
        if (interaction.isDragging && ghostBlock && ghostBlock.startAt && ghostBlock.endAt) {
            const finalStartSnapped = snapTo15(ghostBlock.startAt);
            const durationMins = (ghostBlock.endAt.getTime() - ghostBlock.startAt.getTime()) / 60000;
            const durationSnapped = Math.round(durationMins / 15) * 15;
            const finalEndSnapped = new Date(finalStartSnapped.getTime() + durationSnapped * 60000);

            const excludeId = interaction.type !== "create" ? interaction.initialBlock?.id : undefined;
            const smartSlot = findNextFreeSlot(blocks, finalStartSnapped, durationSnapped, excludeId);

            const startToUse = smartSlot ? smartSlot.startAt : finalStartSnapped;
            const endToUse = smartSlot ? smartSlot.endAt : finalEndSnapped;

            if (interaction.type === "create") {
                // If create was just a click, we still create a default 1h block?
                // Logic above sets isDragging=true for create immediately, so it always falls here.
                const newBlock = createBlock({ startAt: startToUse, endAt: endToUse });
                // Also open drawer for new block?
                setSelectedBlockId(newBlock.id);
            } else if (interaction.initialBlock) {
                updateBlock(interaction.initialBlock.id, { startAt: startToUse, endAt: endToUse });
            }
        }

        setInteraction(null);
        setGhostBlock(null);
    };

    return (
        <div className="flex flex-col h-full w-full bg-transparent text-neutral-200 select-none">

            {/* TOP BAR: My Tasks */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.03]">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-white drop-shadow-[0_0_8px_rgba(124,58,237,0.4)]">
                        <Grid size={18} className="text-[#a78bfa]" />
                        <h2 className="text-xl font-medium tracking-tight">My Tasks</h2>
                    </div>
                </div>
            </div>

            {/* HEADER: Navigation & Days */}
            <div className="flex flex-col z-20 shrink-0 bg-transparent sticky top-0 relative">
                {/* Subtle bottom separator instead of full border */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/[0.03]" />

                {/* Navigation Controls */}
                <div className="flex items-center px-4 md:px-6 pt-6 pb-4 gap-4">
                    <div className="text-lg font-medium text-white/90 w-44">
                        {weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>

                    <button
                        onClick={handleToday}
                        className="px-4 py-1.5 text-sm font-medium bg-white/[0.05] border border-white/10 hover:bg-white/10 text-white rounded-lg transition-colors shadow-sm"
                    >
                        Today
                    </button>

                    <div className="flex items-center text-white/50 font-medium text-sm ml-2">
                        <button onClick={handlePrevWeek} className="p-1 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                            <ChevronLeft size={18} />
                        </button>
                        <span className="mx-2 tracking-wide">
                            {weekDays[0].getDate().toString().padStart(2, '0')}.{(weekDays[0].getMonth() + 1).toString().padStart(2, '0')} - {weekDays[6].getDate().toString().padStart(2, '0')}.{(weekDays[6].getMonth() + 1).toString().padStart(2, '0')}
                        </span>
                        <button onClick={handleNextWeek} className="p-1 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                {/* Days Grid */}
                <div className="flex flex-row px-0 py-2">
                    <div className="w-12 md:w-16 shrink-0" /> {/* Left Time Axis Spacer */}
                    <div className="flex-1 grid grid-cols-7 gap-0 relative">
                        {/* Upper soft separator */}
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/[0.03]" />

                        {weekDays.map((d, i) => {
                            const isToday = d.toDateString() === new Date().toDateString();
                            return (
                                <div key={i} className={cn(
                                    "text-center flex flex-col items-center justify-center py-3 transition-all duration-300 relative",
                                    isToday ? "" : ""
                                )}>
                                    {/* Vertical Day Separators (Ultra Faint) */}
                                    {i > 0 && <div className="absolute left-0 top-2 bottom-2 w-[1px] bg-white/[0.03]" />}

                                    <span className={cn(
                                        "text-[11px] uppercase tracking-wider",
                                        isToday ? "text-[#a78bfa] font-semibold drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]" : "text-white/40 font-medium"
                                    )}>
                                        {DAYS[d.getDay()]} {d.getDate().toString().padStart(2, '0')}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* BODY: Scrollable */}
            <div
                ref={containerRef}
                className="relative flex-1 overflow-y-auto touch-pan-y [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                style={{
                    maskImage: "linear-gradient(to bottom, transparent, black 4%, black 96%, transparent 100%)",
                    WebkitMaskImage: "-webkit-linear-gradient(top, transparent, black 4%, black 96%, transparent 100%)"
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                <div className="relative w-full flex bg-transparent" style={{ height: TOTAL_HEIGHT }}>
                    <CurrentTimeLine />

                    {/* TIME LABELS */}
                    <div className="w-12 md:w-16 shrink-0 bg-transparent flex flex-col items-center relative">
                        {/* Subtle vertical separator for the time axis */}
                        <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-white/[0.03]" />

                        {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                            <div key={i} className="absolute w-full text-center" style={{ top: i * PIXELS_PER_HOUR - 8 }}>
                                <span className="text-[10px] text-white/30 font-medium tracking-wide">
                                    {i === 0 ? '12AM' : i < 12 ? `${i}AM` : i === 12 ? '12PM' : `${i - 12}PM`}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* EVENT GRID */}
                    <div
                        ref={gridRef}
                        className="flex-1 relative"
                        onPointerDown={handlePointerDown}
                    >
                        {/* Grid Lines (Ultra Faint 0.03) */}
                        {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                            <div key={i} className="absolute w-full border-t border-white/[0.03]" style={{ top: i * PIXELS_PER_HOUR, height: PIXELS_PER_HOUR }}>
                                {/* Removing quarter/half hour lines to prioritize empty space as per Agendo Rules */}
                                <div className="absolute top-[50%] left-0 right-0 h-[1px] bg-white/[0.01]" />
                            </div>
                        ))}
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="absolute h-full border-r border-white/[0.03]" style={{ left: `${(i / 7) * 100}%` }} />
                        ))}

                        {/* BLOCKS */}
                        {weekBlocks.map(block => {
                            // Hide ONLY if dragging this specific block
                            const isBeingDragged = interaction && interaction.initialBlock?.id === block.id && interaction.isDragging;
                            if (isBeingDragged) return null;

                            const dayIndex = block.startAt.getDay();
                            const startMins = block.startAt.getHours() * 60 + block.startAt.getMinutes();
                            const durationMins = (block.endAt.getTime() - block.startAt.getTime()) / 60000;

                            const top = (startMins / 60) * PIXELS_PER_HOUR;
                            const height = (durationMins / 60) * PIXELS_PER_HOUR;
                            const left = `${(dayIndex / 7) * 100}%`;
                            const width = `${100 / 7}%`;

                            return (
                                <div
                                    key={block.id}
                                    style={{ position: 'absolute', top, height, left, width }}
                                    className="px-1"
                                >
                                    <BlockItem
                                        block={block}
                                        top={0}
                                        height={height}
                                        onPointerDown={(e, action) => handleBlockPointerDown(e, block, action)}
                                    />
                                </div>
                            );
                        })}

                        {/* GHOST BLOCK */}
                        {ghostBlock && ghostBlock.startAt && ghostBlock.endAt && (
                            (() => {
                                const dayIndex = ghostBlock.startAt.getDay();
                                const startMins = ghostBlock.startAt.getHours() * 60 + ghostBlock.startAt.getMinutes();
                                const durationMins = (ghostBlock.endAt.getTime() - ghostBlock.startAt.getTime()) / 60000;

                                const top = (startMins / 60) * PIXELS_PER_HOUR;
                                const height = (durationMins / 60) * PIXELS_PER_HOUR;
                                const left = ghostBlock.visualLeft ?? `${(dayIndex / 7) * 100}%`;
                                const width = `${100 / 7}%`;

                                return (
                                    <div
                                        style={{ position: 'absolute', top, height, left, width }}
                                        className={cn(
                                            "px-1 z-50 pointer-events-none transition-transform duration-75 ease-out origin-center",
                                            "scale-[1.02] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] opacity-90"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-full h-full rounded-2xl border flex items-center justify-center backdrop-blur-sm",
                                            interaction?.type === "create" ? "border-indigo-500 bg-indigo-500/20" : "border-white/40 bg-white/20"
                                        )}>
                                            <span className="text-xs font-bold text-white drop-shadow-md">
                                                {ghostBlock.startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()
                        )}

                    </div>
                </div>
            </div>

            <BlockDrawer
                blockId={selectedBlockId}
                isOpen={!!selectedBlockId}
                onClose={() => setSelectedBlockId(null)}
            />

            {/* Desktop FAB for Mobile-style Time Picker Wheel */}
            <button
                onClick={() => setIsPlannerOpen(true)}
                className="absolute bottom-6 right-6 w-14 h-14 bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:scale-105 active:scale-95 transition-all z-[100]"
            >
                <Plus size={28} />
            </button>

            <FocusPlannerModal
                isOpen={isPlannerOpen}
                onClose={() => setIsPlannerOpen(false)}
                initialStart={currentDate}
            />
        </div>
    );
}
