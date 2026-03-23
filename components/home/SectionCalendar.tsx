"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { DailyAgendaView } from "@/components/calendar/DailyAgendaView";
import { GlassCalendarDashboard } from "@/components/calendar/GlassCalendarDashboard";
import { RadialBlockMenu } from "@/components/calendar/RadialBlockMenu";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { findNextFreeSlot, isOverlapping, snapTo15 } from "@/lib/utils/scheduling";
import { OverlapResolutionModal, OverlapResolutionType } from "@/components/calendar/OverlapResolutionModal";
import { resolveOverlapBySlicingUnderlying, resolveOverlapByShrinkingNew } from "@/lib/utils/overlapResolution";
import { isSameDay, startOfDay } from "date-fns";
import { Plus } from "lucide-react";
import { enrichNewBlockWithPlanningMetadata } from "@/lib/utils/blockEnrichment";

export function SectionCalendar() {
    const { blocks, createBlock } = useBlocksStore();
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isNewBlock, setIsNewBlock] = useState(false);
    const [mobileSelectedDate, setMobileSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [pendingConflict, setPendingConflict] = useState<any>(null);

    const handleMobilePlusCreate = () => {
        const selectedDay = startOfDay(mobileSelectedDate);
        const now = new Date();
        const durationMinutes = 60;
        const desiredStart = new Date(selectedDay);

        if (isSameDay(selectedDay, now)) {
            const snappedNow = snapTo15(now);
            desiredStart.setHours(snappedNow.getHours(), snappedNow.getMinutes(), 0, 0);
        } else {
            desiredStart.setHours(9, 0, 0, 0);
        }

        const dayBlocks = blocks.filter((block) => isSameDay(block.startAt, selectedDay) && block.status !== "canceled");
        const endAt = new Date(desiredStart.getTime() + durationMinutes * 60000);
        
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
            if (newBlock) {
                setSelectedBlockId(newBlock.id);
                setIsNewBlock(true);
            }
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
            setSelectedBlockId(resultingId);
            setIsNewBlock(true);
        }
        
        setPendingConflict(null);
    };


    const openDesktopBlockEditor = (blockId: string, shouldGuideCreation = false) => {
        setSelectedBlockId(blockId);
        setIsNewBlock(shouldGuideCreation);
    };

    return (
        <section className="w-full min-h-[100dvh] snap-start flex flex-col items-center justify-start py-8 px-4 md:px-8 bg-transparent">


            {/* Mobile View: Zero-Gravity Daily Agenda */}
            {/* Wrapper is relative so the FAB can be positioned inside it but outside overflow-hidden card */}
            <div className="md:hidden w-full max-w-7xl relative flex flex-col" style={{ minHeight: '85svh' }}>
                {/* The actual card with overflow-hidden */}
                <div className={cn(
                    "w-full flex-1 rounded-[2rem] overflow-hidden relative z-10",
                    "border border-white/5 bg-transparent"
                )}>
                    <DailyAgendaView
                        selectedDate={mobileSelectedDate}
                        onSelectedDateChange={setMobileSelectedDate}
                        setSelectedBlockId={setSelectedBlockId}
                        setIsNewBlock={setIsNewBlock}
                    />
                </div>

                {/* FAB placed OUTSIDE overflow-hidden, but inside the relative wrapper */}
                <div className="flex justify-center py-4 z-20">
                    <button
                        onClick={handleMobilePlusCreate}
                        className={cn(
                            "flex items-center justify-center h-12 w-20 rounded-full",
                            "bg-white/[0.08] backdrop-blur-md border border-white/15",
                            "text-white shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)]",
                            "hover:bg-white/[0.12] active:bg-[#7C3AED]/40 active:border-[#7C3AED]/50",
                            "transition-all duration-300",
                            "disabled:opacity-60 disabled:cursor-not-allowed"
                        )}
                    >
                        <Plus size={24} strokeWidth={1.5} />
                    </button>
                </div>
            </div>

            {/* Desktop View: Glass calendar dashboard */}
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
                    <GlassCalendarDashboard onOpenBlock={openDesktopBlockEditor} />
                </div>
            </div>

            {selectedBlockId && (
                <RadialBlockMenu
                    blockId={selectedBlockId}
                    isNewBlock={isNewBlock}
                    onClose={() => {
                        setSelectedBlockId(null);
                        setIsNewBlock(false);
                    }}
                />
            )}

        
            <OverlapResolutionModal
                isOpen={!!pendingConflict}
                onClose={() => setPendingConflict(null)}
                pendingBlock={pendingConflict?.newBlock || null}
                overlappingCount={pendingConflict?.overlaps?.length || 0}
                onResolve={handleResolveConflict}
            />
        </section>
    );
}
