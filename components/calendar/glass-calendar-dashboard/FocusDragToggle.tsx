"use client";

import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import { type BlockTypeColors } from "@/lib/utils/blockColors";

interface FocusDragToggleProps {
    colors: BlockTypeColors;
    isResume: boolean;
    onTrigger: () => void;
}

export function FocusDragToggle({ colors, isResume, onTrigger }: FocusDragToggleProps) {
    const TRACK_INSET = 6;
    const KNOB_SIZE = 28;

    const trackRef = useRef<HTMLButtonElement>(null);
    const pointerOffsetRef = useRef(0);
    const [trackWidth, setTrackWidth] = useState(0);
    const [offsetPx, setOffsetPx] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isTriggered, setIsTriggered] = useState(false);
    const maxOffset = Math.max(1, trackWidth - KNOB_SIZE - TRACK_INSET * 2);
    const triggerThreshold = maxOffset * 0.84;
    const progress = offsetPx / maxOffset;
    const label = isResume ? "Resume focus" : "Slide to focus";

    useEffect(() => {
        const node = trackRef.current;
        if (!node) return;

        const updateWidth = () => {
            setTrackWidth(node.offsetWidth);
        };

        updateWidth();

        const observer = new ResizeObserver(updateWidth);
        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isDragging) return;

        const handlePointerMove = (event: PointerEvent) => {
            const trackRect = trackRef.current?.getBoundingClientRect();
            if (!trackRect) return;

            const nextOffset = Math.min(
                maxOffset,
                Math.max(0, event.clientX - trackRect.left - TRACK_INSET - pointerOffsetRef.current)
            );

            setOffsetPx(nextOffset);
        };

        const handlePointerUp = () => {
            setIsDragging(false);

            if (offsetPx >= triggerThreshold) {
                setIsTriggered(true);
                setOffsetPx(maxOffset);
                onTrigger();

                window.setTimeout(() => {
                    setOffsetPx(0);
                    setIsTriggered(false);
                }, 260);
                return;
            }

            setOffsetPx(0);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp, { once: true });

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [isDragging, maxOffset, offsetPx, onTrigger, triggerThreshold]);

    return (
        <button
            ref={trackRef}
            type="button"
            className={cn(
                "group/focus relative inline-flex h-9 w-full items-center overflow-hidden rounded-full border bg-black/25 px-1.5 backdrop-blur-xl transition-all duration-300 motion-reduce:transition-none",
                isDragging && "cursor-grabbing",
                !isDragging && "cursor-grab"
            )}
            style={{
                borderColor: colors.innerBorder,
                boxShadow: isResume
                    ? `0 0 16px ${colors.glow1}, inset 0 0 0 1px ${colors.innerBorder}`
                    : `0 0 12px ${colors.glow2}`,
            }}
            aria-label={label}
        >
            <div
                className={cn(
                    "pointer-events-none absolute inset-y-1.5 left-1.5 rounded-full",
                    !isDragging && "transition-[width] duration-150 motion-reduce:transition-none"
                )}
                style={{
                    width: `${offsetPx + KNOB_SIZE / 2}px`,
                    background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`,
                    boxShadow: isTriggered || isResume
                        ? `0 0 14px ${colors.glow1}, 0 0 22px ${colors.glow2}`
                        : `0 0 10px ${colors.glow2}`,
                    opacity: 0.96,
                }}
            />

            <span
                className="pointer-events-none absolute left-10 right-2 overflow-hidden whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.18em] text-white/65 transition-all duration-150 motion-reduce:transition-none"
                style={{
                    opacity: Math.max(0, 1 - progress * 1.35),
                    transform: `translateX(${progress * 10}px)`,
                    clipPath: `inset(0 0 0 ${Math.min(progress * 86, 86)}%)`,
                }}
            >
                {label}
            </span>

            <span
                onPointerDown={(event) => {
                    event.stopPropagation();
                    const trackRect = trackRef.current?.getBoundingClientRect();
                    if (!trackRect) return;

                    const knobLeft = trackRect.left + TRACK_INSET + offsetPx;
                    pointerOffsetRef.current = event.clientX - knobLeft;
                    setIsDragging(true);
                }}
                className={cn(
                    "relative z-10 inline-flex items-center justify-center rounded-full bg-white",
                    !isDragging && "transition-transform duration-150 motion-reduce:transition-none"
                )}
                style={{
                    width: `${KNOB_SIZE}px`,
                    height: `${KNOB_SIZE}px`,
                    transform: `translateX(${offsetPx}px)`,
                    boxShadow: `0 0 0 1px ${colors.innerBorder}, 0 0 12px ${colors.glow1}`,
                    touchAction: "none",
                }}
            >
                <Zap className="h-3.5 w-3.5 text-black" />
            </span>
        </button>
    );
}
