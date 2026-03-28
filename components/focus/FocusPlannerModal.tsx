"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { CircularTimePicker } from "./CircularTimePicker";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { startOfDay, addMinutes } from "date-fns";
import { GlassButton } from "@/components/ui/glass-button";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useI18n } from "@/lib/i18n/client";
import { getFocusPlannerCopy } from "@/lib/i18n/ui";

interface FocusPlannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialStart?: Date;
    initialEnd?: Date;
}

function getInitialMinutes(initialStart?: Date, initialEnd?: Date) {
    const now = new Date();
    const next15 = new Date(Math.ceil(now.getTime() / (15 * 60000)) * (15 * 60000));
    const resolvedStart = initialStart ?? next15;
    const resolvedEnd = initialEnd ?? addMinutes(resolvedStart, 60);

    return {
        startMins: resolvedStart.getHours() * 60 + resolvedStart.getMinutes(),
        endMins: resolvedEnd.getHours() * 60 + resolvedEnd.getMinutes(),
    };
}

function FocusPlannerModalContent({
    onClose,
    initialStart,
    initialEnd,
}: Omit<FocusPlannerModalProps, "isOpen">) {
    const { language } = useI18n();
    const { blocks, createBlock } = useBlocksStore();
    const initialMinutes = getInitialMinutes(initialStart, initialEnd);
    const copy = getFocusPlannerCopy(language);

    const [startMins, setStartMins] = useState(initialMinutes.startMins);
    const [endMins, setEndMins] = useState(initialMinutes.endMins);
    const [title, setTitle] = useState("");

    const baseDate = initialStart ? startOfDay(initialStart) : startOfDay(new Date());
    const dailyBlocks = blocks.filter((block) => startOfDay(block.startAt).getTime() === baseDate.getTime());
    const busyBlocks = dailyBlocks.map((block) => ({
        start: block.startAt.getHours() * 60 + block.startAt.getMinutes(),
        end: block.endAt.getHours() * 60 + block.endAt.getMinutes(),
    }));

    const handleSave = () => {
        const normalizedEnd = endMins < startMins ? endMins + 1440 : endMins;
        const startAt = addMinutes(baseDate, startMins);
        const endAt = addMinutes(baseDate, normalizedEnd);

        createBlock({
            title: title || copy.defaultTitle,
            type: "deep_work",
            startAt,
            endAt,
        });

        onClose();
    };

    return (
        <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div
                className={cn(
                    "absolute inset-0 pointer-events-auto bg-black/40 backdrop-blur-md transition-opacity duration-250 ease-out",
                    "opacity-100"
                )}
                onClick={onClose}
            />

            <div
                className={cn(
                    "relative flex w-full max-w-sm flex-col pointer-events-auto",
                    "bg-white/[0.06] p-6 pb-4 backdrop-blur-[16px]",
                    "rounded-[28px] border border-white/10",
                    "shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),_0_25px_50px_-12px_rgba(0,0,0,0.5)]"
                )}
            >
                <GlowingEffect spread={40} proximity={80} inactiveZone={0.01} borderWidth={1} variant="default" />

                <div className="mb-2 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="-ml-2 rounded-full p-2 text-white/40 transition-colors hover:text-white"
                    >
                        <X size={20} />
                    </button>
                    <span className="text-xl font-medium tracking-tight text-white">{copy.modalTitle}</span>
                    <GlassButton onClick={handleSave} variant="primary" size="sm">
                        {copy.save}
                    </GlassButton>
                </div>

                <div className="mb-8 mt-6 flex justify-center">
                    <CircularTimePicker
                        startMins={startMins}
                        endMins={endMins}
                        busyBlocks={busyBlocks}
                        onChange={(start, end) => {
                            setStartMins(start);
                            setEndMins(end);
                        }}
                    />
                </div>

                <div className="flex flex-col gap-4">
                    <div className="group relative">
                        <input
                            type="text"
                            placeholder={copy.placeholder}
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            className={cn(
                                "w-full rounded-xl border border-transparent bg-white/[0.03] px-4 py-3.5 text-white outline-none transition-all duration-300",
                                "placeholder:text-white/30 focus:border-indigo-500/30 focus:bg-white/[0.05]",
                                "focus:shadow-[0_4px_20px_-5px_rgba(124,58,237,0.15)]"
                            )}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function FocusPlannerModal({ isOpen, onClose, initialStart, initialEnd }: FocusPlannerModalProps) {
    if (!isOpen) return null;

    const modalKey = `${initialStart?.toISOString() ?? "default"}-${initialEnd?.toISOString() ?? "default"}`;

    return (
        <FocusPlannerModalContent
            key={modalKey}
            onClose={onClose}
            initialStart={initialStart}
            initialEnd={initialEnd}
        />
    );
}
