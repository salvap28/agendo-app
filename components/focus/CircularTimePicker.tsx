"use client";

import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { cn } from "@/lib/cn";

interface CircularTimePickerProps {
    startMins: number; // 0 to 1439 (minutes since midnight)
    endMins: number;   // 0 to 1440+
    onChange: (start: number, end: number) => void;
    onChangeEnd?: (start: number, end: number) => void; // Added onChangeEnd
    busyBlocks?: { start: number; end: number }[];
    className?: string;
    hideCenterText?: boolean;
}

// Helper to convert minutes to an angle (0 to 2PI)
// 12 hours = 720 minutes = 2PI
// Top (0, -RADIUS) is 0 minutes
function getAngleFromMins(mins: number) {
    const clockMins = mins % 720;
    const angle = (clockMins / 720) * 2 * Math.PI;
    // We want 0 at top (-y), so we subtract PI/2
    return angle - Math.PI / 2;
}

// Format duration
function formatDuration(start: number, end: number) {
    let diff = Math.round(end - start);
    if (diff < 0) diff += 1440;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
}

// Format time string
function formatTime(mins: number) {
    const m = Math.round(((mins % 1440) + 1440) % 1440);
    const hrs = Math.floor(m / 60);
    const mnt = m % 60;
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    const h12 = hrs % 12 || 12;
    return `${h12}:${mnt.toString().padStart(2, '0')} ${ampm}`;
}

// Format just time without AM/PM
function formatTimeShort(mins: number) {
    const m = Math.round(((mins % 1440) + 1440) % 1440);
    const hrs = Math.floor(m / 60);
    const mnt = m % 60;
    const h12 = hrs % 12 || 12;
    return `${h12}:${mnt.toString().padStart(2, '0')}`;
}

export function CircularTimePicker({ startMins, endMins, onChange, onChangeEnd, busyBlocks = [], className, hideCenterText }: CircularTimePickerProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState<'start' | 'end' | 'arc' | null>(null);
    const [lastAngle, setLastAngle] = useState(0);

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const RADIUS = isMobile ? 80 : 120;
    const STROKE_WIDTH = isMobile ? 14 : 12;
    const CENTER = RADIUS + STROKE_WIDTH * 2;
    const SVG_SIZE = CENTER * 2;

    const getPointFromAngle = (angle: number) => {
        return {
            x: CENTER + RADIUS * Math.cos(angle),
            y: CENTER + RADIUS * Math.sin(angle)
        };
    };

    // Completely fluid visual state decoupled from the 5-min snap logic
    const [localStart, setLocalStart] = useState(startMins);
    const [localEnd, setLocalEnd] = useState(endMins);

    useEffect(() => {
        if (!dragging) {
            setLocalStart(startMins);
            setLocalEnd(endMins);
        }
    }, [startMins, endMins, dragging]);

    const startAngle = getAngleFromMins(localStart);
    const endAngle = getAngleFromMins(localEnd);

    const startP = getPointFromAngle(startAngle);
    const endP = getPointFromAngle(endAngle);

    // Calculate Arc Path
    // If end is after start, we draw clockwise. 
    let diffMins = localEnd - localStart;

    // Handle cross-day scenario directly: if localEnd < localStart, the duration crosses midnight
    if (diffMins < 0) {
        diffMins += 1440;
    }

    // Since the dial ONLY shows 12 hours (720 mins = 360 degrees),
    // any duration > 12h visually wraps AROUND the circle perfectly causing overlap.
    // So visually, we cap the arc to a full circle minus a tiny gap if >= 12h
    const visualDiff = Math.min(diffMins, 719.99);

    // The arc flag should be 1 if the VISUAL angle goes more than 180 degrees (which is > 6 hours / 360 mins)
    const largeArcFlag = visualDiff > 360 ? 1 : 0;

    // Draw Arc
    const drawEndAngle = startAngle + (visualDiff / 720) * 2 * Math.PI;
    const drawEndP = getPointFromAngle(drawEndAngle);

    let arcPath = `M ${startP.x} ${startP.y}`;
    if (visualDiff > 0) {
        arcPath += ` A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${drawEndP.x} ${drawEndP.y}`;
    }

    const checkCollision = (start: number, end: number) => {
        let testStart = start % 1440;
        let testEnd = end % 1440;
        if (end > 1440 && testEnd === 0) testEnd = 1440; // Allow ending precisely at midnight 

        // Cross-day check wrapper
        const crossesMidnight = end > start && testEnd <= testStart;

        for (const block of busyBlocks) {
            // Block spans are also just start/end minutes
            // We need to check if [testStart, testEnd] overlaps with [block.start, block.end]
            // Simplified for 1 day dial:
            if (crossesMidnight) {
                // If it crosses midnight, check both sides
                if ((testStart < block.end && 1440 > block.start) ||
                    (0 < block.end && testEnd > block.start)) return true;
            } else {
                if (testStart < block.end && testEnd > block.start) return true;
            }
        }
        return false;
    };

    const computeDeltaMins = (clientX: number, clientY: number) => {
        if (!svgRef.current) return 0;
        const rect = svgRef.current.getBoundingClientRect();

        // Use exact local center logic instead of arbitrary rect width based since stroke can affect bounding rect
        const centerX = rect.left + CENTER;
        const centerY = rect.top + CENTER;

        let angle = Math.atan2(clientY - centerY, clientX - centerX);
        // Map space so top is 0
        let clockAngle = angle + Math.PI / 2;
        if (clockAngle < 0) clockAngle += 2 * Math.PI;

        const currentMins = (clockAngle / (2 * Math.PI)) * 720;

        // Calculate shortest path delta from lastMins
        const lastMins = (lastAngle / (2 * Math.PI)) * 720;
        let delta = currentMins - lastMins;

        if (delta > 360) delta -= 720;
        if (delta < -360) delta += 720;

        setLastAngle(clockAngle);
        return delta;
    };

    const handlePointerDown = (type: 'start' | 'end' | 'arc', e: React.PointerEvent) => {
        e.preventDefault();
        setDragging(type);

        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();

        const centerX = rect.left + CENTER;
        const centerY = rect.top + CENTER;

        let angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        let clockAngle = angle + Math.PI / 2;
        if (clockAngle < 0) clockAngle += 2 * Math.PI;

        setLastAngle(clockAngle);

        // Capture pointer to document body to track outside SVG
        document.body.setPointerCapture(e.pointerId);
    };

    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (!dragging) return;
            const delta = computeDeltaMins(e.clientX, e.clientY);
            if (Math.abs(delta) < 0.1) return; // Prevent excessive micro-re-renders

            let newStart = localStart;
            let newEnd = localEnd;

            if (dragging === 'start') {
                newStart += delta;
                if (newStart < 0) newStart += 1440;
                newStart %= 1440;

                let dur = newEnd - newStart;
                if (dur < 0) dur += 1440;
                if (dur < 5) newEnd = newStart + 5;

                if (checkCollision(newStart, newEnd)) return;

            } else if (dragging === 'end') {
                newEnd += delta;
                if (newEnd < 0) newEnd += 1440;
                newEnd %= 1440;

                let dur = newEnd - newStart;
                if (dur < 0) dur += 1440;
                if (dur < 5) newStart = newEnd - 5;

                if (checkCollision(newStart, newEnd)) return;

            } else if (dragging === 'arc') {
                newStart += delta;
                newEnd += delta;

                if (newStart < 0) { newStart += 1440; newEnd += 1440; }
                newStart %= 1440;
                newEnd %= 1440;

                if (checkCollision(newStart, newEnd)) return;
            }

            // Update smooth local visual state instantly
            setLocalStart(newStart);
            setLocalEnd(newEnd);

            // Report the mathematically snapped 5-minute increments back to parent
            const snappedStart = Math.round(newStart / 5) * 5 % 1440;
            const snappedEnd = Math.round(newEnd / 5) * 5 % 1440;

            if (snappedStart !== startMins || snappedEnd !== endMins) {
                onChange(snappedStart, snappedEnd);
            }
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (dragging) {
                document.body.releasePointerCapture(e.pointerId);
                const snappedStart = Math.round(localStart / 5) * 5 % 1440;
                const snappedEnd = Math.round(localEnd / 5) * 5 % 1440;
                onChangeEnd?.(snappedStart, snappedEnd);
                setDragging(null);
            }
        };

        if (dragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [dragging, startMins, endMins, onChange, lastAngle]);

    // Local hover states for better SVG scaling origin control
    const [hoveredNode, setHoveredNode] = useState<'start' | 'end' | null>(null);

    return (
        <div className={cn("relative flex items-center justify-center select-none touch-none", className)}>
            <svg
                ref={svgRef}
                width={SVG_SIZE}
                height={SVG_SIZE}
                viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                className="overflow-visible"
            >

                {/* Base Track */}
                <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={STROKE_WIDTH}
                />

                {/* Busy Tracks (Carved Out) */}
                {busyBlocks.map((block, idx) => {
                    const bStartA = getAngleFromMins(block.start);
                    const bEndA = getAngleFromMins(block.end);

                    let bVisualDiff = block.end - block.start;
                    if (bVisualDiff < 0) bVisualDiff += 1440;
                    bVisualDiff = Math.min(bVisualDiff, 719.99);

                    const dEndA = bStartA + (bVisualDiff / 720) * 2 * Math.PI;
                    const sp = getPointFromAngle(bStartA);
                    const ep = getPointFromAngle(dEndA);

                    let bPath = `M ${sp.x} ${sp.y}`;
                    if (bVisualDiff > 0) {
                        bPath += ` A ${RADIUS} ${RADIUS} 0 ${bVisualDiff > 360 ? 1 : 0} 1 ${ep.x} ${ep.y}`;
                    }

                    return (
                        <path
                            key={idx}
                            d={bPath}
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth={STROKE_WIDTH - 4}
                            className="drop-shadow-none z-0"
                            strokeLinecap="round"
                        />
                    );
                })}

                {/* Active Arc - Glow underlayer */}
                <path
                    d={arcPath}
                    fill="none"
                    stroke="#7C3AED"
                    strokeWidth={STROKE_WIDTH}
                    strokeLinecap="round"
                    className="opacity-40 blur-[8px]"
                />

                {/* Active Arc - Main gradient */}
                <defs>
                    <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="50%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                </defs>
                <path
                    d={arcPath}
                    fill="none"
                    stroke="url(#arcGrad)"
                    strokeWidth={STROKE_WIDTH}
                    strokeLinecap="round"
                    className="cursor-pointer"
                    onPointerDown={(e) => handlePointerDown('arc', e)}
                />

                {/* Start Handle */}
                <g
                    transform={`translate(${startP.x}, ${startP.y})`}
                    className="cursor-pointer"
                    onPointerDown={(e) => handlePointerDown('start', e)}
                    onPointerEnter={() => setHoveredNode('start')}
                    onPointerLeave={() => setHoveredNode(null)}
                >
                    <circle r={STROKE_WIDTH * 4} fill="transparent" /> {/* Massive Hitbox */}
                    <circle
                        r={(dragging === 'start' || hoveredNode === 'start') ? STROKE_WIDTH * (isMobile ? 1.7 : 1.5) : STROKE_WIDTH * (isMobile ? 1.4 : 0.85)}
                        fill="white"
                        className="shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all duration-200"
                    />
                    <text x={-25} y={-12} fill="rgba(255,255,255,0.4)" fontSize="10" fontWeight="500" dominantBaseline="middle" textAnchor="end">
                        start
                    </text>
                    <text x={-25} y={4} fill="rgba(255,255,255,0.9)" fontSize="13" fontWeight="600" dominantBaseline="middle" textAnchor="end">
                        {formatTime(startMins)}
                    </text>
                </g>

                {/* End Handle */}
                <g
                    transform={`translate(${endP.x}, ${endP.y})`}
                    className="cursor-pointer"
                    onPointerDown={(e) => handlePointerDown('end', e)}
                    onPointerEnter={() => setHoveredNode('end')}
                    onPointerLeave={() => setHoveredNode(null)}
                >
                    <circle r={STROKE_WIDTH * 4} fill="transparent" /> {/* Massive Hitbox */}
                    <circle
                        r={(dragging === 'end' || hoveredNode === 'end') ? STROKE_WIDTH * (isMobile ? 1.7 : 1.5) : STROKE_WIDTH * (isMobile ? 1.4 : 0.85)}
                        fill="white"
                        className="shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all duration-200"
                    />
                    <text x={25} y={-12} fill="rgba(255,255,255,0.4)" fontSize="10" fontWeight="500" dominantBaseline="middle" textAnchor="start">
                        end
                    </text>
                    <text x={25} y={4} fill="rgba(255,255,255,0.9)" fontSize="13" fontWeight="600" dominantBaseline="middle" textAnchor="start">
                        {formatTime(endMins)}
                    </text>
                </g>
            </svg>

            {/* Holy Center - Duration & Range */}
            {!hideCenterText && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-medium text-white tracking-tight drop-shadow-md">
                        {formatDuration(startMins, endMins)}
                    </span>
                    <span className="text-sm text-white/50 font-medium mt-1">
                        {formatTime(startMins)} - {formatTime(endMins)}
                    </span>
                </div>
            )}
        </div>
    );
}
