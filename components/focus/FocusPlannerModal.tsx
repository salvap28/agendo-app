"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { CircularTimePicker } from "./CircularTimePicker";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { startOfDay, addMinutes } from "date-fns";
import { BlockType } from "@/lib/types/blocks";
import { GlassButton } from "@/components/ui/glass-button";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface FocusPlannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialStart?: Date;
    initialEnd?: Date;
}



export function FocusPlannerModal({ isOpen, onClose, initialStart, initialEnd }: FocusPlannerModalProps) {
    const { blocks, createBlock } = useBlocksStore();

    const [isMounted, setIsMounted] = useState(false);

    // Convert Dates to minutes since midnight for the dial
    const [startMins, setStartMins] = useState(0);
    const [endMins, setEndMins] = useState(60);
    const [title, setTitle] = useState("");


    useEffect(() => {
        if (isOpen) {
            setIsMounted(true);
            const now = new Date();

            if (initialStart) {
                setStartMins(initialStart.getHours() * 60 + initialStart.getMinutes());
            } else {
                // Default to top of the next hour or a clean 15m interval
                const next15 = new Date(Math.ceil(now.getTime() / (15 * 60000)) * (15 * 60000));
                setStartMins(next15.getHours() * 60 + next15.getMinutes());
            }

            if (initialEnd) {
                setEndMins(initialEnd.getHours() * 60 + initialEnd.getMinutes());
            } else if (initialStart) {
                // If we have start but no end, default to +1 hour
                setEndMins((initialStart.getHours() * 60 + initialStart.getMinutes() + 60) % 1440);
            } else {
                // Default end: +1 hour from default start
                const next15 = new Date(Math.ceil(now.getTime() / (15 * 60000)) * (15 * 60000));
                setEndMins((next15.getHours() * 60 + next15.getMinutes() + 60) % 1440);
            }
        } else {
            // Unmount after delay to allow exit animation if handled by parent
            const t = setTimeout(() => setIsMounted(false), 300);
            return () => clearTimeout(t);
        }
    }, [isOpen, initialStart, initialEnd]);

    // Calculate busy blocks for the target day
    const baseDate = initialStart ? startOfDay(initialStart) : startOfDay(new Date());

    // Filter blocks that occur on the baseDate
    const dailyBlocks = blocks.filter(b => {
        const bStart = startOfDay(b.startAt);
        return bStart.getTime() === baseDate.getTime();
    });

    const busyBlocks = dailyBlocks.map(b => {
        const start = b.startAt.getHours() * 60 + b.startAt.getMinutes();
        const end = b.endAt.getHours() * 60 + b.endAt.getMinutes();
        return { start, end };
    });

    if (!isOpen && !isMounted) return null;

    const handleSave = () => {
        const baseDate = initialStart ? startOfDay(initialStart) : startOfDay(new Date());
        let endBaseDate = baseDate;

        let sMins = startMins;
        let eMins = endMins;

        // Handle cross-day scenario
        if (eMins < sMins) {
            eMins += 1440;
        }

        const startAt = addMinutes(baseDate, sMins);
        const endAt = addMinutes(baseDate, eMins);

        createBlock({
            title: title || "Focus Session",
            type: "deep_work", // Valid enum block_type
            startAt,
            endAt,
        });

        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none p-4">

            {/* Backdrop Blur slightly denser to isolate attention */}
            <div
                className={cn(
                    "absolute inset-0 bg-black/40 backdrop-blur-md pointer-events-auto transition-opacity duration-250 ease-out",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
            />

            {/* Modal Container */}
            <div
                className={cn(
                    // Modal Animation: ease-out, no spring
                    "relative w-full max-w-sm flex flex-col pointer-events-auto",
                    "transition-all duration-250 ease-out",
                    isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-[0.98]",

                    // Glass System Estricto
                    "bg-white/[0.06] backdrop-blur-[16px]",
                    "border border-white/10 rounded-[28px]",
                    "shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),_0_25px_50px_-12px_rgba(0,0,0,0.5)]",
                    "p-6 pb-4"
                )}
            >
                <GlowingEffect spread={40} proximity={80} inactiveZone={0.01} borderWidth={1} variant="default" />
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={onClose}
                        className="p-2 -ml-2 text-white/40 hover:text-white transition-colors rounded-full"
                    >
                        <X size={20} />
                    </button>
                    <span className="text-xl font-medium text-white tracking-tight">Plan Your Focus</span>
                    <GlassButton
                        onClick={handleSave}
                        variant="primary"
                        size="sm"
                    >
                        Save
                    </GlassButton>
                </div>

                {/* Circular Time Picker */}
                <div className="flex justify-center mt-6 mb-8">
                    <CircularTimePicker
                        startMins={startMins}
                        endMins={endMins}
                        busyBlocks={busyBlocks}
                        onChange={(s, e) => {
                            setStartMins(s);
                            setEndMins(e);
                        }}
                    />
                </div>

                {/* Inputs and Metadata */}
                <div className="flex flex-col gap-4">
                    {/* Subject Input */}
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Focus Subject: (Deep Work Session)"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className={cn(
                                "w-full bg-white/[0.03] text-white placeholder:text-white/30",
                                "rounded-xl px-4 py-3.5 outline-none transition-all duration-300",
                                "border border-transparent focus:border-indigo-500/30 focus:bg-white/[0.05]",
                                "focus:shadow-[0_4px_20px_-5px_rgba(124,58,237,0.15)]"
                            )}
                        />
                    </div>

                </div>

            </div>
        </div>
    );
}
