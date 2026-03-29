"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";

interface CircularTimePickerProps {
    startMins: number;
    endMins: number;
    onChange?: (start: number, end: number) => void;
    onChangeEnd?: (start: number, end: number) => void;
    onDragStateChange?: (isDragging: boolean) => void;
    busyBlocks?: { start: number; end: number }[];
    className?: string;
    hideCenterText?: boolean;
}

type DragTarget = "start" | "end" | "arc";
type Range = { start: number; end: number };
type TextAnchor = React.SVGAttributes<SVGTextElement>["textAnchor"];

const DAY_MINUTES = 1440;
const DIAL_MINUTES = 720;
const SNAP_STEP = 5;
const MOBILE_FINE_STEP = 15;
const MIN_DURATION = 5;

function mod(value: number, base: number) {
    return ((value % base) + base) % base;
}

function normalizeRange(range: Range): Range {
    return {
        start: mod(range.start, DAY_MINUTES),
        end: mod(range.end, DAY_MINUTES),
    };
}

function getDurationMinutes(start: number, end: number) {
    let diff = Math.round(end - start);
    if (diff < 0) diff += DAY_MINUTES;
    return diff;
}

function clampStartAgainstEnd(candidateStart: number, end: number) {
    return getDurationMinutes(candidateStart, end) >= MIN_DURATION
        ? mod(candidateStart, DAY_MINUTES)
        : mod(end - MIN_DURATION, DAY_MINUTES);
}

function clampEndAgainstStart(start: number, candidateEnd: number) {
    return getDurationMinutes(start, candidateEnd) >= MIN_DURATION
        ? mod(candidateEnd, DAY_MINUTES)
        : mod(start + MIN_DURATION, DAY_MINUTES);
}

function roundToStep(value: number, step: number) {
    return mod(Math.round(value / step) * step, DAY_MINUTES);
}

function getAngleFromMinutes(minutes: number) {
    const dialMinutes = mod(minutes, DIAL_MINUTES);
    return (dialMinutes / DIAL_MINUTES) * Math.PI * 2 - Math.PI / 2;
}

function getDialMinutesFromPointer(clientX: number, clientY: number, rect: DOMRect) {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(clientY - centerY, clientX - centerX);

    let clockAngle = angle + Math.PI / 2;
    if (clockAngle < 0) clockAngle += Math.PI * 2;

    return (clockAngle / (Math.PI * 2)) * DIAL_MINUTES;
}

function getShortestDialDelta(current: number, previous: number) {
    let delta = current - previous;
    if (delta > DIAL_MINUTES / 2) delta -= DIAL_MINUTES;
    if (delta < -DIAL_MINUTES / 2) delta += DIAL_MINUTES;
    return delta;
}

function formatDuration(start: number, end: number) {
    const diff = getDurationMinutes(start, end);
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

function formatTime(minutes: number, locale: string) {
    const normalized = mod(Math.round(minutes), DAY_MINUTES);
    const date = new Date(2000, 0, 1, Math.floor(normalized / 60), normalized % 60);
    return new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function buildArcPath(start: number, end: number, radius: number, center: number) {
    const startAngle = getAngleFromMinutes(start);
    const rawDiff = getDurationMinutes(start, end);
    const visualDiff = Math.min(rawDiff, DIAL_MINUTES - 0.01);

    const startPoint = {
        x: center + radius * Math.cos(startAngle),
        y: center + radius * Math.sin(startAngle),
    };
    const endAngle = startAngle + (visualDiff / DIAL_MINUTES) * Math.PI * 2;
    const endPoint = {
        x: center + radius * Math.cos(endAngle),
        y: center + radius * Math.sin(endAngle),
    };

    if (visualDiff <= 0) {
        return `M ${startPoint.x} ${startPoint.y}`;
    }

    return [
        `M ${startPoint.x} ${startPoint.y}`,
        `A ${radius} ${radius} 0 ${visualDiff > DIAL_MINUTES / 2 ? 1 : 0} 1 ${endPoint.x} ${endPoint.y}`,
    ].join(" ");
}

function getUpdatedRange(range: Range, target: DragTarget, delta: number): Range {
    if (target === "arc") {
        return normalizeRange({
            start: range.start + delta,
            end: range.end + delta,
        });
    }

    if (target === "start") {
        const nextStart = clampStartAgainstEnd(range.start + delta, range.end);
        return { start: nextStart, end: mod(range.end, DAY_MINUTES) };
    }

    const nextEnd = clampEndAgainstStart(range.start, range.end + delta);
    return { start: mod(range.start, DAY_MINUTES), end: nextEnd };
}

function getHandleLabelPosition(point: { x: number; y: number }, center: number): { x: number; align: TextAnchor } {
    const isRightSide = point.x >= center;
    return {
        x: isRightSide ? 18 : -18,
        align: isRightSide ? "start" : "end",
    };
}

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function CircularTimePicker({
    startMins,
    endMins,
    onChange,
    onChangeEnd,
    onDragStateChange,
    busyBlocks = [],
    className,
    hideCenterText,
}: CircularTimePickerProps) {
    const { language } = useI18n();
    const locale = language === "es" ? "es-ES" : "en-US";
    const copy = language === "es"
        ? {
            start: "Inicio",
            end: "Fin",
            duration: "Duracion",
            dragToMove: "Arrastra para mover",
        }
        : {
            start: "Start",
            end: "End",
            duration: "Duration",
            dragToMove: "Drag to move",
        };

    const svgRef = useRef<SVGSVGElement>(null);
    const lastDialMinutesRef = useRef(0);
    const activeRangeRef = useRef<Range>({ start: startMins, end: endMins });
    const dragStartRangeRef = useRef<Range>({ start: startMins, end: endMins });
    const dragDeltaRef = useRef(0);
    const dragMovedRef = useRef(false);
    const pointerIdRef = useRef<number | null>(null);
    const localFrameRef = useRef<number | null>(null);
    const pendingLocalRangeRef = useRef<Range | null>(null);

    const [dragging, setDragging] = useState<DragTarget | null>(null);
    const [hoveredHandle, setHoveredHandle] = useState<"start" | "end" | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [localRange, setLocalRange] = useState<Range>({ start: startMins, end: endMins });

    useEffect(() => {
        const updateMobileState = () => setIsMobile(window.innerWidth < 768);
        updateMobileState();
        window.addEventListener("resize", updateMobileState);
        return () => window.removeEventListener("resize", updateMobileState);
    }, []);

    useEffect(() => {
        if (dragging) return;
        activeRangeRef.current = { start: startMins, end: endMins };
    }, [dragging, endMins, startMins]);

    useEffect(() => {
        return () => {
            if (localFrameRef.current !== null) {
                window.cancelAnimationFrame(localFrameRef.current);
            }
        };
    }, []);

    useEffect(() => {
        return () => {
            onDragStateChange?.(false);
        };
    }, [onDragStateChange]);

    const compact = Boolean(hideCenterText);
    const geometry = useMemo(() => {
        if (isMobile) {
            return { radius: compact ? 72 : 82, strokeWidth: compact ? 12 : 14, handleRadius: 11 };
        }
        return compact
            ? { radius: 88, strokeWidth: 12, handleRadius: 9 }
            : { radius: 120, strokeWidth: 12, handleRadius: 10 };
    }, [compact, isMobile]);

    const center = geometry.radius + geometry.strokeWidth * 2;
    const svgSize = center * 2;
    const gradientId = useId().replace(/:/g, "");

    const displayRange = dragging ? localRange : { start: startMins, end: endMins };
    const displayStart = displayRange.start;
    const displayEnd = displayRange.end;

    const startAngle = getAngleFromMinutes(displayStart);
    const endAngle = getAngleFromMinutes(displayEnd);

    const getPointFromAngle = useCallback((angle: number) => {
        return {
            x: center + geometry.radius * Math.cos(angle),
            y: center + geometry.radius * Math.sin(angle),
        };
    }, [center, geometry.radius]);

    const startPoint = getPointFromAngle(startAngle);
    const endPoint = getPointFromAngle(endAngle);
    const activeArcPath = buildArcPath(displayStart, displayEnd, geometry.radius, center);

    function getDragTargetAtPointer(clientX: number, clientY: number) {
        if (!svgRef.current) return null;

        const rect = svgRef.current.getBoundingClientRect();
        const localPoint = {
            x: (clientX - rect.left) * (svgSize / rect.width),
            y: (clientY - rect.top) * (svgSize / rect.height),
        };

        const handleHitRadius = geometry.handleRadius * (isMobile ? 3.4 : 3);
        const startDistance = getDistance(localPoint, startPoint);
        const endDistance = getDistance(localPoint, endPoint);

        if (startDistance <= handleHitRadius || endDistance <= handleHitRadius) {
            return startDistance <= endDistance ? "start" : "end";
        }

        const centerDistance = getDistance(localPoint, { x: center, y: center });
        const arcHitRadius = geometry.strokeWidth * (isMobile ? 1.8 : 1.55);

        if (Math.abs(centerDistance - geometry.radius) <= arcHitRadius) {
            return "arc";
        }

        return null;
    }

    const getSnappedRange = useCallback((range: Range) => {
        return {
            start: roundToStep(range.start, SNAP_STEP),
            end: roundToStep(range.end, SNAP_STEP),
        };
    }, []);

    const commitRange = useCallback((range: Range, shouldFinalize?: boolean) => {
        const snapped = getSnappedRange(range);
        const hasChanged = snapped.start !== startMins || snapped.end !== endMins;

        if (!hasChanged) return;

        onChange?.(snapped.start, snapped.end);
        if (shouldFinalize) {
            onChangeEnd?.(snapped.start, snapped.end);
        }
    }, [getSnappedRange, onChange, onChangeEnd, startMins, endMins]);

    const scheduleLocalRange = useCallback((range: Range) => {
        pendingLocalRangeRef.current = range;
        if (localFrameRef.current !== null) return;

        localFrameRef.current = window.requestAnimationFrame(() => {
            localFrameRef.current = null;
            if (!pendingLocalRangeRef.current) return;
            setLocalRange(pendingLocalRangeRef.current);
            pendingLocalRangeRef.current = null;
        });
    }, []);

    const finalizeDrag = useCallback((shouldCommit: boolean) => {
        const finalRange = activeRangeRef.current;

        if (localFrameRef.current !== null) {
            window.cancelAnimationFrame(localFrameRef.current);
            localFrameRef.current = null;
        }

        pendingLocalRangeRef.current = null;
        setLocalRange(finalRange);

        if (shouldCommit && dragMovedRef.current) {
            commitRange(finalRange, true);
        }

        pointerIdRef.current = null;
        dragDeltaRef.current = 0;
        dragMovedRef.current = false;
        setDragging(null);
        onDragStateChange?.(false);
    }, [commitRange, onDragStateChange]);

    const updateDrag = useCallback((clientX: number, clientY: number) => {
        if (!dragging || !svgRef.current) return;

        const rect = svgRef.current.getBoundingClientRect();
        const currentDialMinutes = getDialMinutesFromPointer(clientX, clientY, rect);
        const delta = getShortestDialDelta(currentDialMinutes, lastDialMinutesRef.current);

        if (Math.abs(delta) < 0.04) return;

        lastDialMinutesRef.current = currentDialMinutes;
        dragDeltaRef.current += delta;
        dragMovedRef.current = true;

        const updatedRange = getUpdatedRange(dragStartRangeRef.current, dragging, dragDeltaRef.current);
        activeRangeRef.current = updatedRange;
        scheduleLocalRange(updatedRange);
    }, [dragging, scheduleLocalRange]);

    const beginDrag = (target: DragTarget, event: React.PointerEvent<SVGElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (!svgRef.current) return;

        const rect = event.currentTarget.getBoundingClientRect();
        lastDialMinutesRef.current = getDialMinutesFromPointer(event.clientX, event.clientY, rect);

        const nextRange = { start: startMins, end: endMins };
        dragStartRangeRef.current = nextRange;
        dragDeltaRef.current = 0;
        dragMovedRef.current = false;
        pointerIdRef.current = event.pointerId;
        setDragging(target);
        setLocalRange(nextRange);
        activeRangeRef.current = nextRange;
        onDragStateChange?.(true);

        if ("setPointerCapture" in event.currentTarget) {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
    };

    const handleSvgPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
        const target = getDragTargetAtPointer(event.clientX, event.clientY);
        if (!target) return;
        beginDrag(target, event);
    };

    const handleSvgPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
        if (dragging) {
            if (pointerIdRef.current === null || event.pointerId !== pointerIdRef.current) return;
            updateDrag(event.clientX, event.clientY);
            return;
        }

        const target = getDragTargetAtPointer(event.clientX, event.clientY);
        setHoveredHandle(target === "start" || target === "end" ? target : null);
    };

    const nudgeTime = useCallback((target: "start" | "end", delta: number) => {
        const updatedRange = getUpdatedRange(activeRangeRef.current, target, delta);
        activeRangeRef.current = updatedRange;
        setLocalRange(updatedRange);
        commitRange(updatedRange, true);
    }, [commitRange]);

    const busyPaths = useMemo(() => {
        return busyBlocks.map((block, index) => ({
            key: `${block.start}-${block.end}-${index}`,
            path: buildArcPath(block.start, block.end, geometry.radius, center),
        }));
    }, [busyBlocks, center, geometry.radius]);

    const showDesktopHandleLabels = !isMobile && (Boolean(hoveredHandle) || Boolean(dragging));

    return (
        <div className={cn("relative flex flex-col items-center gap-4 select-none pointer-events-auto", className)}>
            <div className="relative flex items-center justify-center">
                <svg
                    ref={svgRef}
                    width={svgSize}
                    height={svgSize}
                    viewBox={`0 0 ${svgSize} ${svgSize}`}
                    className="overflow-visible touch-none pointer-events-auto"
                    onPointerDown={handleSvgPointerDown}
                    onPointerMove={handleSvgPointerMove}
                    onPointerUp={(event) => {
                        if (!dragging) return;
                        if (pointerIdRef.current === null || event.pointerId !== pointerIdRef.current) return;
                        finalizeDrag(true);
                    }}
                    onPointerCancel={(event) => {
                        if (!dragging) return;
                        if (pointerIdRef.current === null || event.pointerId !== pointerIdRef.current) return;
                        finalizeDrag(true);
                    }}
                    onLostPointerCapture={(event) => {
                        if (!dragging) return;
                        if (pointerIdRef.current === null || event.pointerId !== pointerIdRef.current) return;
                        finalizeDrag(true);
                    }}
                    onPointerLeave={() => {
                        if (!dragging) setHoveredHandle(null);
                    }}
                >
                    <defs>
                        <linearGradient id={`arc-gradient-${gradientId}`} x1="8%" y1="8%" x2="92%" y2="92%">
                            <stop offset="0%" stopColor="#a5b4fc" />
                            <stop offset="48%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#d946ef" />
                        </linearGradient>
                    </defs>

                    <circle
                        cx={center}
                        cy={center}
                        r={geometry.radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={geometry.strokeWidth}
                    />

                    {busyPaths.map((block) => (
                        <path
                            key={block.key}
                            d={block.path}
                            fill="none"
                            stroke="rgba(255,255,255,0.18)"
                            strokeWidth={Math.max(geometry.strokeWidth - 4, 5)}
                            strokeLinecap="round"
                        />
                    ))}

                    <path
                        d={activeArcPath}
                        fill="none"
                        stroke="#7c3aed"
                        strokeWidth={geometry.strokeWidth + (isMobile ? 3 : 2)}
                        strokeLinecap="round"
                        className="opacity-25 blur-[8px]"
                        pointerEvents="none"
                    />

                    <path
                        d={activeArcPath}
                        fill="none"
                        stroke={`url(#arc-gradient-${gradientId})`}
                        strokeWidth={geometry.strokeWidth}
                        strokeLinecap="round"
                        className={cn(
                            "cursor-grab transition-opacity duration-200",
                            dragging === "arc" ? "opacity-100" : "opacity-95 hover:opacity-100"
                        )}
                        pointerEvents="none"
                    />

                    {([
                        { id: "start", point: startPoint, time: displayStart },
                        { id: "end", point: endPoint, time: displayEnd },
                    ] as const).map((handle) => {
                        const isActive = dragging === handle.id || hoveredHandle === handle.id;
                        const labelPosition = getHandleLabelPosition(handle.point, center);

                        return (
                            <g
                                key={handle.id}
                                transform={`translate(${handle.point.x}, ${handle.point.y})`}
                                className="cursor-grab"
                                pointerEvents="none"
                            >
                                <circle
                                    r={geometry.handleRadius * (isMobile ? 2.8 : 2.5)}
                                    fill="rgba(255,255,255,0.001)"
                                    pointerEvents="none"
                                />
                                <circle
                                    r={geometry.handleRadius + (isActive ? 3 : 0)}
                                    fill="rgba(255,255,255,0.16)"
                                    className="transition-all duration-200"
                                    pointerEvents="none"
                                />
                                <circle
                                    r={geometry.handleRadius - 1 + (isActive ? 1 : 0)}
                                    fill="white"
                                    className="transition-all duration-200"
                                    pointerEvents="none"
                                />

                                {showDesktopHandleLabels && (dragging === handle.id || hoveredHandle === handle.id) && (
                                    <>
                                        <text
                                            x={labelPosition.x}
                                            y={-10}
                                            fill="rgba(255,255,255,0.42)"
                                            fontSize="10"
                                            fontWeight="600"
                                            dominantBaseline="middle"
                                            textAnchor={labelPosition.align}
                                        >
                                            {handle.id === "start" ? copy.start : copy.end}
                                        </text>
                                        <text
                                            x={labelPosition.x}
                                            y={6}
                                            fill="rgba(255,255,255,0.96)"
                                            fontSize="13"
                                            fontWeight="700"
                                            dominantBaseline="middle"
                                            textAnchor={labelPosition.align}
                                        >
                                            {formatTime(handle.time, locale)}
                                        </text>
                                    </>
                                )}
                            </g>
                        );
                    })}
                </svg>

                {!hideCenterText && !isMobile && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-medium tracking-tight text-white drop-shadow-md">
                            {formatDuration(displayStart, displayEnd)}
                        </span>
                        <span className="mt-1 text-sm font-medium text-white/50">
                            {formatTime(displayStart, locale)} - {formatTime(displayEnd, locale)}
                        </span>
                    </div>
                )}

                {!hideCenterText && isMobile && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-medium tracking-tight text-white">
                            {formatDuration(displayStart, displayEnd)}
                        </span>
                        <span className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/35">
                            {copy.dragToMove}
                        </span>
                    </div>
                )}
            </div>

            {isMobile && (
                <div className="w-full max-w-[292px] space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        {([
                            { id: "start", label: copy.start, value: displayStart },
                            { id: "end", label: copy.end, value: displayEnd },
                        ] as const).map((control) => (
                            <div
                                key={control.id}
                                className="rounded-[22px] border border-white/10 bg-white/[0.05] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                            >
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                                        {control.label}
                                    </span>
                                    <span className="text-sm font-semibold text-white">
                                        {formatTime(control.value, locale)}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => nudgeTime(control.id, -MOBILE_FINE_STEP)}
                                        className="flex h-9 items-center justify-center gap-1 rounded-2xl border border-white/10 bg-black/20 text-xs font-medium text-white/78 transition-colors hover:bg-white/[0.07] hover:text-white"
                                    >
                                        <Minus className="h-3.5 w-3.5" />
                                        15m
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => nudgeTime(control.id, MOBILE_FINE_STEP)}
                                        className="flex h-9 items-center justify-center gap-1 rounded-2xl border border-white/10 bg-black/20 text-xs font-medium text-white/78 transition-colors hover:bg-white/[0.07] hover:text-white"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        15m
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/92">
                        <span className="mr-2 text-[10px] uppercase tracking-[0.18em] text-white/38">
                            {copy.duration}
                        </span>
                        {formatDuration(displayStart, displayEnd)}
                    </div>
                </div>
            )}
        </div>
    );
}
