"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Repeat, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { RecurrencePattern } from "@/lib/types/blocks";
import { enrichNewBlockWithPlanningMetadata } from "@/lib/utils/blockEnrichment";
import { addMinutes } from "date-fns";

/* ────────────────────────────────────────────────────────────
   Inline Time Digit — a minimal scroll-digit for HH : MM
   ──────────────────────────────────────────────────────────── */

function TimeDigit({
    value,
    max,
    step = 1,
    onChange,
}: {
    value: number;
    max: number;
    step?: number;
    onChange: (v: number) => void;
}) {
    const inc = () => onChange((value + step) % (max + 1));
    const dec = () => onChange(value - step < 0 ? max - (step - 1) : value - step);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        if (e.deltaY > 0) inc();
        else dec();
    };

    return (
        <div
            className="flex flex-col items-center select-none"
            onWheel={handleWheel}
        >
            <button
                onClick={dec}
                className="w-8 h-5 flex items-center justify-center text-white/15 hover:text-white/50 transition-colors"
                tabIndex={-1}
            >
                <ChevronUp size={14} />
            </button>
            <span className="text-[28px] font-mono font-semibold text-white tabular-nums leading-none tracking-tight">
                {String(value).padStart(2, "0")}
            </span>
            <button
                onClick={inc}
                className="w-8 h-5 flex items-center justify-center text-white/15 hover:text-white/50 transition-colors"
                tabIndex={-1}
            >
                <ChevronDown size={14} />
            </button>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────
   Inline Time Row — HH : MM  with label
   ──────────────────────────────────────────────────────────── */

function InlineTimePicker({
    date,
    onChange,
    label,
}: {
    date: Date;
    onChange: (d: Date) => void;
    label: string;
}) {
    const h = date.getHours();
    const m = date.getMinutes();

    const setHour = (v: number) => {
        const d = new Date(date);
        d.setHours(v);
        onChange(d);
    };
    const setMinute = (v: number) => {
        const d = new Date(date);
        d.setMinutes(v);
        onChange(d);
    };

    return (
        <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/25">
                {label}
            </span>
            <div className="flex items-center gap-0.5">
                <TimeDigit value={h} max={23} onChange={setHour} />
                <span className="text-white/15 text-lg font-bold pb-0.5 mx-0.5">:</span>
                <TimeDigit value={m} max={55} step={5} onChange={setMinute} />
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────
   CreateBlockModal
   ──────────────────────────────────────────────────────────── */

interface CreateBlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialStart?: Date;
    initialEnd?: Date;
}

export function CreateBlockModal({ isOpen, onClose, initialStart, initialEnd }: CreateBlockModalProps) {
    const { createBlock } = useBlocksStore();
    const [mounted, setMounted] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const [title, setTitle] = useState("");
    const [startAt, setStartAt] = useState<Date>(new Date());
    const [endAt, setEndAt] = useState<Date>(new Date());
    const [recurrence, setRecurrence] = useState<RecurrencePattern | undefined>();

    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            setIsClosing(false);
            setTitle("");
            setRecurrence(undefined);

            if (initialStart) {
                setStartAt(initialStart);
                setEndAt(initialEnd ?? addMinutes(initialStart, 60));
            } else {
                const now = new Date();
                const next15 = new Date(Math.ceil(now.getTime() / (15 * 60000)) * (15 * 60000));
                setStartAt(next15);
                setEndAt(addMinutes(next15, 60));
            }
        }
    }, [isOpen, initialStart, initialEnd]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            setMounted(false);
            onClose();
        }, 250);
    }, [onClose]);

    const handleSave = useCallback(() => {
        let finalEnd = endAt;
        if (finalEnd.getTime() <= startAt.getTime()) {
            finalEnd = addMinutes(startAt, 15);
        }

        const enriched = enrichNewBlockWithPlanningMetadata({
            title: title.trim() || "Nuevo bloque",
            startAt,
            endAt: finalEnd,
            recurrencePattern: recurrence,
            type: "other",
        });

        createBlock(enriched);
        handleClose();
    }, [title, startAt, endAt, recurrence, createBlock, handleClose]);

    const handleTimeUpdate = (type: 'start' | 'end', newDate: Date) => {
        if (type === 'start') {
            setStartAt(newDate);
            if (endAt.getTime() <= newDate.getTime()) setEndAt(addMinutes(newDate, 15));
        } else {
            setEndAt(newDate);
        }
    };

    // Duration string
    const diffMs = endAt.getTime() - startAt.getTime();
    let diffMins = Math.round(diffMs / 60000);
    if (diffMins < 0) diffMins += 1440;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const durationStr = hrs === 0 ? `${mins}m` : mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;

    if (!mounted) return null;

    return createPortal(
        <div className={cn("fixed inset-0 z-[250] flex items-center justify-center", isClosing && "pointer-events-none")}>
            {/* Backdrop */}
            <div
                className={cn("absolute inset-0 bg-black/70 backdrop-blur-2xl transition-opacity duration-250", isClosing ? "opacity-0" : "opacity-100")}
                onClick={handleClose}
            />

            {/* Card */}
            <div
                className={cn(
                    "relative w-[320px] max-w-[90vw] flex flex-col",
                    "rounded-[2rem] overflow-hidden",
                    "bg-[#09090b]/95 backdrop-blur-3xl",
                    "border border-white/[0.06]",
                    "shadow-[0_32px_80px_-16px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)]",
                    "transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    isClosing ? "opacity-0 scale-95 translate-y-4" : "opacity-100 scale-100 translate-y-0"
                )}
            >
                <GlowingEffect spread={50} proximity={100} inactiveZone={0.01} borderWidth={1} variant="subtle" />

                {/* Title */}
                <div className="relative px-6 pt-6 pb-4">
                    <button
                        onClick={handleClose}
                        className="absolute top-5 right-5 w-7 h-7 rounded-full flex items-center justify-center text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                    >
                        <X size={14} />
                    </button>

                    <input
                        type="text"
                        placeholder="Nuevo bloque"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                        className="w-full bg-transparent text-[20px] font-semibold tracking-tight text-white placeholder:text-white/20 border-none outline-none p-0 caret-indigo-400"
                        autoFocus
                    />
                </div>

                {/* Divider */}
                <div className="mx-6 h-px bg-white/[0.05]" />

                {/* Time */}
                <div className="px-6 py-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Horario</span>
                        <span className="text-[10px] font-semibold text-indigo-400/50 tabular-nums">{durationStr}</span>
                    </div>

                    <div className="flex flex-col gap-1 rounded-2xl bg-white/[0.02] p-3">
                        <InlineTimePicker date={startAt} onChange={d => handleTimeUpdate('start', d)} label="Inicio" />
                        <div className="h-px bg-white/[0.04] my-1" />
                        <InlineTimePicker date={endAt} onChange={d => handleTimeUpdate('end', d)} label="Fin" />
                    </div>
                </div>

                {/* Divider */}
                <div className="mx-6 h-px bg-white/[0.05]" />

                {/* Recurrence */}
                <div className="px-6 py-4 flex flex-col gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Repetición</span>

                    <div className="grid grid-cols-2 gap-1.5">
                        {[
                            { label: "Una vez", value: undefined },
                            { label: "Diario", value: "daily" },
                            { label: "Semanal", value: "weekly" },
                            { label: "A medida", value: "custom" },
                        ].map((opt) => {
                            const isSelected = (!recurrence && !opt.value) || (recurrence?.type === opt.value);
                            return (
                                <button
                                    key={opt.label}
                                    onClick={() => {
                                        if (!opt.value) setRecurrence(undefined);
                                        else setRecurrence({
                                            type: opt.value as any,
                                            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                                            days: opt.value === "custom" ? recurrence?.days || [1, 3, 5] : undefined,
                                        });
                                    }}
                                    className={cn(
                                        "h-9 rounded-xl text-[12px] font-medium transition-all duration-200",
                                        isSelected
                                            ? "bg-white/[0.07] text-white/80 ring-1 ring-white/[0.06]"
                                            : "text-white/25 hover:text-white/50 hover:bg-white/[0.03]"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>

                    {recurrence?.type === "custom" && (
                        <div className="flex justify-between pt-1 animate-in slide-in-from-top-1 fade-in duration-200">
                            {["D", "L", "M", "X", "J", "V", "S"].map((day, idx) => {
                                const isOn = recurrence?.days?.includes(idx);
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            const cur = recurrence?.days || [];
                                            const next = isOn ? cur.filter(d => d !== idx) : [...cur, idx].sort();
                                            setRecurrence({ ...recurrence!, days: next.length ? next : [idx] });
                                        }}
                                        className={cn(
                                            "w-8 h-8 rounded-full text-[11px] font-bold transition-all duration-200",
                                            isOn
                                                ? "bg-indigo-500 text-white shadow-[0_0_14px_rgba(99,102,241,0.4)]"
                                                : "bg-white/[0.03] text-white/20 hover:bg-white/[0.06] hover:text-white/60"
                                        )}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/[0.04] flex items-center justify-between">
                    <button
                        onClick={handleClose}
                        className="text-[13px] font-medium text-white/25 hover:text-white/60 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className={cn(
                            "gradient-button gradient-button-agendo",
                            "h-10 px-6 rounded-full text-[13px] font-semibold text-white tracking-wide",
                            "shadow-[0_6px_20px_-4px_rgba(99,102,241,0.45)]",
                            "hover:shadow-[0_10px_28px_-4px_rgba(99,102,241,0.65)] hover:scale-[1.02]",
                            "active:scale-[0.97] transition-all duration-200"
                        )}
                    >
                        Crear bloque
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
