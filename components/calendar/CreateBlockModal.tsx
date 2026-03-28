"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { addMinutes } from "date-fns";
import { cn } from "@/lib/cn";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useI18n } from "@/lib/i18n/client";
import { getRecurrenceLabel, getWeekdayInitialsSundayFirst } from "@/lib/i18n/app";
import { getCreateBlockModalCopy } from "@/lib/i18n/ui";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { RecurrencePattern } from "@/lib/types/blocks";
import { enrichNewBlockWithPlanningMetadata } from "@/lib/utils/blockEnrichment";

function TimeDigit({
    value,
    max,
    step = 1,
    onChange,
}: {
    value: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
}) {
    const increment = () => onChange((value + step) % (max + 1));
    const decrement = () => onChange(value - step < 0 ? max - (step - 1) : value - step);

    const handleWheel = (event: React.WheelEvent) => {
        event.preventDefault();
        if (event.deltaY > 0) increment();
        else decrement();
    };

    return (
        <div className="flex select-none flex-col items-center" onWheel={handleWheel}>
            <button
                onClick={decrement}
                className="flex h-5 w-8 items-center justify-center text-white/15 transition-colors hover:text-white/50"
                tabIndex={-1}
            >
                <ChevronUp size={14} />
            </button>
            <span className="font-mono text-[28px] font-semibold leading-none tracking-tight text-white tabular-nums">
                {String(value).padStart(2, "0")}
            </span>
            <button
                onClick={increment}
                className="flex h-5 w-8 items-center justify-center text-white/15 transition-colors hover:text-white/50"
                tabIndex={-1}
            >
                <ChevronDown size={14} />
            </button>
        </div>
    );
}

function InlineTimePicker({
    date,
    onChange,
    label,
}: {
    date: Date;
    onChange: (date: Date) => void;
    label: string;
}) {
    const hours = date.getHours();
    const minutes = date.getMinutes();

    const setHour = (value: number) => {
        const nextDate = new Date(date);
        nextDate.setHours(value);
        onChange(nextDate);
    };

    const setMinute = (value: number) => {
        const nextDate = new Date(date);
        nextDate.setMinutes(value);
        onChange(nextDate);
    };

    return (
        <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/25">
                {label}
            </span>
            <div className="flex items-center gap-0.5">
                <TimeDigit value={hours} max={23} onChange={setHour} />
                <span className="mx-0.5 pb-0.5 text-lg font-bold text-white/15">:</span>
                <TimeDigit value={minutes} max={55} step={5} onChange={setMinute} />
            </div>
        </div>
    );
}

interface CreateBlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialStart?: Date;
    initialEnd?: Date;
}

function getInitialTimes(initialStart?: Date, initialEnd?: Date) {
    if (initialStart) {
        return {
            startAt: initialStart,
            endAt: initialEnd ?? addMinutes(initialStart, 60),
        };
    }

    const now = new Date();
    const next15 = new Date(Math.ceil(now.getTime() / (15 * 60000)) * (15 * 60000));

    return {
        startAt: next15,
        endAt: addMinutes(next15, 60),
    };
}

function CreateBlockModalContent({
    onClose,
    initialStart,
    initialEnd,
}: Omit<CreateBlockModalProps, "isOpen">) {
    const { language } = useI18n();
    const { createBlock } = useBlocksStore();
    const initialTimes = getInitialTimes(initialStart, initialEnd);
    const weekdayLabels = getWeekdayInitialsSundayFirst(language);
    const copy = getCreateBlockModalCopy(language);

    const [title, setTitle] = useState("");
    const [startAt, setStartAt] = useState<Date>(initialTimes.startAt);
    const [endAt, setEndAt] = useState<Date>(initialTimes.endAt);
    const [recurrence, setRecurrence] = useState<RecurrencePattern | undefined>();

    const handleSave = useCallback(() => {
        let finalEnd = endAt;
        if (finalEnd.getTime() <= startAt.getTime()) {
            finalEnd = addMinutes(startAt, 15);
        }

        const enriched = enrichNewBlockWithPlanningMetadata({
            title: title.trim() || copy.defaultTitle,
            startAt,
            endAt: finalEnd,
            recurrencePattern: recurrence,
            type: "other",
        });

        createBlock(enriched);
        onClose();
    }, [copy.defaultTitle, createBlock, endAt, onClose, recurrence, startAt, title]);

    const handleTimeUpdate = (type: "start" | "end", newDate: Date) => {
        if (type === "start") {
            setStartAt(newDate);
            if (endAt.getTime() <= newDate.getTime()) {
                setEndAt(addMinutes(newDate, 15));
            }
            return;
        }

        setEndAt(newDate);
    };

    const diffMs = endAt.getTime() - startAt.getTime();
    let diffMins = Math.round(diffMs / 60000);
    if (diffMins < 0) diffMins += 1440;
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;
    const durationStr = hours === 0 ? `${minutes}m` : minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;

    return createPortal(
        <div className="fixed inset-0 z-[250] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-2xl" onClick={onClose} />

            <div
                className={cn(
                    "relative flex w-[320px] max-w-[90vw] flex-col overflow-hidden rounded-[2rem]",
                    "border border-white/[0.06] bg-[#09090b]/95 backdrop-blur-3xl",
                    "shadow-[0_32px_80px_-16px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)]",
                )}
            >
                <GlowingEffect spread={50} proximity={100} inactiveZone={0.01} borderWidth={1} variant="subtle" />

                <div className="relative px-6 pb-4 pt-6">
                    <button
                        onClick={onClose}
                        className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full text-white/20 transition-all hover:bg-white/[0.06] hover:text-white/60"
                    >
                        <X size={14} />
                    </button>

                    <input
                        type="text"
                        placeholder={copy.defaultTitle}
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") handleSave();
                        }}
                        className="w-full border-none bg-transparent p-0 text-[20px] font-semibold tracking-tight text-white outline-none caret-indigo-400 placeholder:text-white/20"
                        autoFocus
                    />
                </div>

                <div className="mx-6 h-px bg-white/[0.05]" />

                <div className="flex flex-col gap-2 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">{copy.schedule}</span>
                        <span className="text-[10px] font-semibold tabular-nums text-indigo-400/50">{durationStr}</span>
                    </div>

                    <div className="flex flex-col gap-1 rounded-2xl bg-white/[0.02] p-3">
                        <InlineTimePicker date={startAt} onChange={(date) => handleTimeUpdate("start", date)} label={copy.start} />
                        <div className="my-1 h-px bg-white/[0.04]" />
                        <InlineTimePicker date={endAt} onChange={(date) => handleTimeUpdate("end", date)} label={copy.end} />
                    </div>
                </div>

                <div className="mx-6 h-px bg-white/[0.05]" />

                <div className="flex flex-col gap-2 px-6 py-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">{copy.recurrence}</span>

                    <div className="grid grid-cols-2 gap-1.5">
                        {[
                            { label: copy.once, value: undefined },
                            { label: getRecurrenceLabel(language, "daily"), value: "daily" as const },
                            { label: getRecurrenceLabel(language, "weekly"), value: "weekly" as const },
                            { label: getRecurrenceLabel(language, "custom"), value: "custom" as const },
                        ].map((option) => {
                            const isSelected = (!recurrence && !option.value) || recurrence?.type === option.value;

                            return (
                                <button
                                    key={option.label}
                                    onClick={() => {
                                        if (!option.value) {
                                            setRecurrence(undefined);
                                            return;
                                        }

                                        setRecurrence({
                                            type: option.value,
                                            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                                            days: option.value === "custom" ? recurrence?.days || [1, 3, 5] : undefined,
                                        });
                                    }}
                                    className={cn(
                                        "h-9 rounded-xl text-[12px] font-medium transition-all duration-200",
                                        isSelected
                                            ? "bg-white/[0.07] text-white/80 ring-1 ring-white/[0.06]"
                                            : "text-white/25 hover:bg-white/[0.03] hover:text-white/50",
                                    )}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>

                    {recurrence?.type === "custom" && (
                        <div className="animate-in fade-in slide-in-from-top-1 flex justify-between pt-1 duration-200">
                            {weekdayLabels.map((day, index) => {
                                const isOn = recurrence.days?.includes(index);

                                return (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            const currentDays = recurrence.days || [];
                                            const nextDays = isOn
                                                ? currentDays.filter((value) => value !== index)
                                                : [...currentDays, index].sort();

                                            setRecurrence({
                                                ...recurrence,
                                                days: nextDays.length ? nextDays : [index],
                                            });
                                        }}
                                        className={cn(
                                            "h-8 w-8 rounded-full text-[11px] font-bold transition-all duration-200",
                                            isOn
                                                ? "bg-indigo-500 text-white shadow-[0_0_14px_rgba(99,102,241,0.4)]"
                                                : "bg-white/[0.03] text-white/20 hover:bg-white/[0.06] hover:text-white/60",
                                        )}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-white/[0.04] px-6 py-4">
                    <button
                        onClick={onClose}
                        className="text-[13px] font-medium text-white/25 transition-colors hover:text-white/60"
                    >
                        {copy.cancel}
                    </button>
                    <button
                        onClick={handleSave}
                        className={cn(
                            "gradient-button gradient-button-agendo",
                            "h-10 rounded-full px-6 text-[13px] font-semibold tracking-wide text-white",
                            "shadow-[0_6px_20px_-4px_rgba(99,102,241,0.45)] transition-all duration-200",
                            "hover:scale-[1.02] hover:shadow-[0_10px_28px_-4px_rgba(99,102,241,0.65)]",
                            "active:scale-[0.97]",
                        )}
                    >
                        {copy.save}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

export function CreateBlockModal({ isOpen, onClose, initialStart, initialEnd }: CreateBlockModalProps) {
    if (!isOpen) return null;

    const modalKey = `${initialStart?.toISOString() ?? "default"}-${initialEnd?.toISOString() ?? "default"}`;

    return (
        <CreateBlockModalContent
            key={modalKey}
            onClose={onClose}
            initialStart={initialStart}
            initialEnd={initialEnd}
        />
    );
}
