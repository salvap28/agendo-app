"use client";

import * as React from "react";
import { Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface TimePickerProps {
    date: Date;
    onChange: (date: Date) => void;
    label?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10...
const ITEM_HEIGHT = 40;

export function TimePicker({ date, onChange, label }: TimePickerProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const selectedHour = date.getHours();
    const selectedMinute = date.getMinutes();

    // Refs
    const hourContainerRef = React.useRef<HTMLDivElement>(null);
    const minuteContainerRef = React.useRef<HTMLDivElement>(null);

    // Track user interaction to avoid fighting native scroll
    const isPointerDown = React.useRef(false);

    // Initial Scroll Effect (On Open)
    React.useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                scrollToIndex(hourContainerRef.current, selectedHour, 'auto');
                const minIndex = Math.round(selectedMinute / 5);
                scrollToIndex(minuteContainerRef.current, minIndex, 'auto');
            }, 0);
        }
    }, [isOpen]);

    // Sync Scroll with Value Changes (The "Visual" Fix)
    // We ONLY sync if the user is NOT physically dragging/holding the list (PointerDown).
    // This allows Wheel to work (visual usage) but Touch/Drag to be native.
    React.useEffect(() => {
        if (!isOpen) return;

        if (!isPointerDown.current) {
            scrollToIndex(hourContainerRef.current, selectedHour, 'smooth');
        }

        if (!isPointerDown.current) {
            const minIndex = Math.round(selectedMinute / 5);
            scrollToIndex(minuteContainerRef.current, minIndex, 'smooth');
        }
    }, [selectedHour, selectedMinute, isOpen]);


    const scrollToIndex = (container: HTMLDivElement | null, index: number, behavior: 'auto' | 'smooth') => {
        if (!container) return;
        container.scrollTo({
            top: index * ITEM_HEIGHT,
            behavior
        });
    };

    // Wheel Handlers (Desktop Mouse) - "Ticks"
    const handleWheel = (e: React.WheelEvent, type: 'hour' | 'minute') => {
        e.preventDefault(); // Stop native scroll to control the "tick"

        // Debounce/Throttle? 
        // Logic: Just one tick per event? Or accumulate?
        // Let's do simple direction check.
        const direction = e.deltaY > 0 ? 1 : -1;

        if (type === 'hour') {
            let newHour = selectedHour + direction;
            if (newHour < 0) newHour = 23;
            if (newHour > 23) newHour = 0;

            const newDate = new Date(date);
            newDate.setHours(newHour);
            onChange(newDate);
        } else {
            const currentMinIndex = Math.round(selectedMinute / 5);
            let newMinIndex = currentMinIndex + direction;

            if (newMinIndex < 0) newMinIndex = 11;
            if (newMinIndex > 11) newMinIndex = 0;

            const newMinute = MINUTES[newMinIndex];
            const newDate = new Date(date);
            newDate.setMinutes(newMinute);
            onChange(newDate);
        }
    };

    // Scroll Handler (Touch momentum / Scrollbar drag)
    const handleScroll = (e: React.UIEvent<HTMLDivElement>, type: 'hour' | 'minute') => {
        if (!isPointerDown.current) return; // Ignore programmatic scrolls? 
        // Actually, onScroll fires for smooth scrolls too.
        // We want to detect if this scroll is from USER interaction.
        // isPointerDown handles touch/drag. 
        // But momentum scroll continues after pointer up.
        // If we update state during momentum, useEffect fires and might fight momentum?
        // YES.

        // Solution: While momentum scrolling, we probably shouldn't fight it.
        // But we DO need to update the value so the number highlights.
        // If we update value, useEffect triggers.
        // We need useEffect to NOT scroll if momentum is active? Hard to detect.

        // Compromise: Update state ONLY when snapping finishes?
        // OR: Update state, but simply don't scrollTo if we think we are scrolling.

        // Let's rely on standard scrolling update:
        const scrollTop = e.currentTarget.scrollTop;
        const index = Math.round(scrollTop / ITEM_HEIGHT);

        if (type === 'hour') {
            const newHour = HOURS[Math.min(Math.max(index, 0), 23)];
            if (newHour !== selectedHour) {
                const newDate = new Date(date);
                newDate.setHours(newHour);
                onChange(newDate);
            }
        } else {
            const newMinute = MINUTES[Math.min(Math.max(index, 0), 11)];
            const currentNearest5 = Math.round(selectedMinute / 5) * 5;
            if (newMinute !== currentNearest5 && newMinute !== undefined) {
                const newDate = new Date(date);
                newDate.setMinutes(newMinute);
                onChange(newDate);
            }
        }
    };

    // Interaction tracking
    const onPointerDown = () => { isPointerDown.current = true; };
    const onPointerUp = () => {
        isPointerDown.current = false;
        // Optional: Trigger a final snap here if needed? 
        // CSS snap-type handles the physical snap.
        // We just need to ensure visuals match.
    };

    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button className="group relative w-full overflow-hidden rounded-2xl transition-all duration-300 focus:outline-none">
                    <div className="absolute inset-0 bg-white/5 border border-white/5 group-hover:bg-white/10 group-hover:border-white/10 transition-all duration-300 group-data-[state=open]:bg-white/10 group-data-[state=open]:border-indigo-500/30" />
                    <div className="relative flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-white/40 group-hover:text-white/80 group-data-[state=open]:bg-indigo-500/20 group-data-[state=open]:text-indigo-300 transition-all">
                                <Clock size={16} />
                            </div>
                            <div className="flex flex-col items-start gap-0.5">
                                {label && (
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-white/30 group-hover:text-white/50 transition-colors">
                                        {label}
                                    </span>
                                )}
                                <span className="font-mono text-xl text-white/90 font-medium tracking-wide group-hover:text-white transition-colors">
                                    {timeString}
                                </span>
                            </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors group-data-[state=open]:rotate-180" />
                    </div>
                </button>
            </PopoverTrigger>

            <PopoverContent
                className="w-64 p-0 border-none bg-transparent shadow-none"
                align="center"
                sideOffset={8}
            >
                <div
                    className="relative overflow-hidden rounded-3xl bg-[#0c0c0e]/95 backdrop-blur-3xl border border-white/10 shadow-2xl shadow-black/50"
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp} // Safety
                >

                    <div className="flex items-center justify-center py-3 border-b border-white/5 bg-white/5">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                            Select Time
                        </span>
                    </div>

                    <div className="flex h-56 divide-x divide-white/5 relative">

                        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-[40px] bg-white/5 border-y border-white/5 pointer-events-none z-0" />

                        {/* HOURS */}
                        <div className="flex-1 relative z-10 h-full">
                            <div
                                ref={hourContainerRef}
                                onScroll={(e) => handleScroll(e, 'hour')}
                                onWheel={(e) => handleWheel(e, 'hour')}
                                className="h-full overflow-y-auto snap-y snap-mandatory py-[calc(50%-20px)] scrollbar-hide"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {HOURS.map((hour) => (
                                    <div
                                        key={hour}
                                        onClick={() => {
                                            const newDate = new Date(date);
                                            newDate.setHours(hour);
                                            onChange(newDate);
                                        }}
                                        className={cn(
                                            "h-[40px] flex items-center justify-center snap-center cursor-pointer transition-all duration-100 select-none",
                                            selectedHour === hour
                                                ? "text-white text-xl font-bold"
                                                : "text-white/30 text-sm hover:text-white/60"
                                        )}
                                    >
                                        {hour.toString().padStart(2, '0')}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-center w-6 z-10 pb-1">
                            <span className="text-white/20 font-bold text-lg">:</span>
                        </div>

                        {/* MINUTES */}
                        <div className="flex-1 relative z-10 h-full">
                            <div
                                ref={minuteContainerRef}
                                onScroll={(e) => handleScroll(e, 'minute')}
                                onWheel={(e) => handleWheel(e, 'minute')}
                                className="h-full overflow-y-auto snap-y snap-mandatory py-[calc(50%-20px)] scrollbar-hide"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {MINUTES.map((minute) => {
                                    const nearest5 = Math.round(selectedMinute / 5) * 5;
                                    const isHighlight = (nearest5 === minute) || (nearest5 === 60 && minute === 0);

                                    return (
                                        <div
                                            key={minute}
                                            onClick={() => {
                                                const newDate = new Date(date);
                                                newDate.setMinutes(minute);
                                                onChange(newDate);
                                            }}
                                            className={cn(
                                                "h-[40px] flex items-center justify-center snap-center cursor-pointer transition-all duration-100 select-none",
                                                isHighlight
                                                    ? "text-white text-xl font-bold"
                                                    : "text-white/30 text-sm hover:text-white/60"
                                            )}
                                        >
                                            {minute.toString().padStart(2, '0')}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
