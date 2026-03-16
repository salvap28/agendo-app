import { format, isSameDay, isSameMonth } from "date-fns";
import { cn } from "@/lib/cn";
import { FocusSession } from "@/lib/types/focus";
import { getBlockColors } from "@/lib/utils/blockColors";
import { getBlockRuntimeState } from "@/lib/utils/blockState";
import { CalendarEvent } from "./types";

interface MonthDayCellProps {
    day: Date;
    displayMonth: Date;
    selectedDate: Date;
    now: Date;
    eventsForDay: CalendarEvent[];
    session: FocusSession | null;
    onSelect: (day: Date) => void;
    onOpenBlock: (blockId: string) => void;
}

export function MonthDayCell({
    day,
    displayMonth,
    selectedDate,
    now,
    eventsForDay,
    session,
    onSelect,
    onOpenBlock,
}: MonthDayCellProps) {
    const isSelected = isSameDay(day, selectedDate);
    const isCurrentMonthDay = isSameMonth(day, displayMonth);
    const isToday = isSameDay(day, now);
    const runtimeEvents = eventsForDay.map((event) => ({
        event,
        runtime: getBlockRuntimeState(event, session, now),
    }));
    const currentTimeEvent = runtimeEvents.find(({ runtime }) => runtime.isActiveNow)?.event;
    const pausedFocusEvent = runtimeEvents.find(({ runtime }) => runtime.hasPausedFocus)?.event;
    const stateEvent = currentTimeEvent ?? pausedFocusEvent ?? runtimeEvents[0]?.event;
    const stateColors = stateEvent ? getBlockColors(stateEvent.type) : null;
    const leadEvent = runtimeEvents[0]?.event;
    const dayGlowStyle = currentTimeEvent && stateColors
        ? {
            boxShadow: `0 0 18px ${stateColors.glow1}, 0 0 30px ${stateColors.glow2}`,
            borderColor: stateColors.innerBorder,
        }
        : isToday
            ? {
                boxShadow: "0 0 24px rgba(124,58,237,0.22)",
                borderColor: "rgba(124,58,237,0.25)",
            }
            : undefined;

    return (
        <div
            onClick={() => onSelect(day)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(day);
                }
            }}
            role="button"
            tabIndex={0}
            className={cn(
                "group relative flex min-h-0 flex-col overflow-hidden rounded-2xl border p-3 text-left transition-all duration-300 motion-reduce:transition-none",
                isCurrentMonthDay
                    ? "border-white/10 bg-[#0a0b12]/80 hover:border-white/20 hover:bg-[#10131d]/90"
                    : "border-white/6 bg-black/20 text-white/30",
                isSelected &&
                    "border-[#7C3AED]/50 bg-[linear-gradient(180deg,rgba(76,29,149,0.22),rgba(10,11,18,0.96))] shadow-[0_0_0_1px_rgba(124,58,237,0.22),0_0_26px_rgba(124,58,237,0.25)]"
            )}
            style={dayGlowStyle}
        >
            <div className="relative z-10 flex items-start justify-between gap-2">
                <span
                    className={cn(
                        "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-lg font-medium tracking-tight transition-all duration-300 motion-reduce:transition-none",
                        isSelected
                            ? "bg-gradient-to-r from-[#4c1d95] to-[#6d28d9] text-white shadow-[0_8px_18px_rgba(109,40,217,0.38)]"
                            : isToday
                                ? "text-white drop-shadow-[0_0_8px_rgba(167,139,250,0.45)]"
                                : isCurrentMonthDay
                                    ? "text-white/90"
                                    : "text-white/35"
                    )}
                >
                    {format(day, "d")}
                </span>
            </div>

            <div className="relative z-10 mt-auto flex min-h-[18px] w-full items-center justify-center gap-1 pt-6">
                {runtimeEvents.map(({ event, runtime }, index) => {
                    const colors = getBlockColors(event.type);

                    return (
                        <button
                            key={event.id}
                            type="button"
                            onClick={(clickEvent) => {
                                clickEvent.stopPropagation();
                                onOpenBlock(event.id);
                            }}
                            className={cn(
                                "h-2.5 w-2.5 rounded-full transition-all duration-300 hover:scale-[1.2] motion-reduce:transition-none",
                                runtime.hasPausedFocus ? "border bg-[#0a0b12]" : "",
                                !isCurrentMonthDay && "opacity-45"
                            )}
                            style={{
                                zIndex: eventsForDay.length - index,
                                backgroundColor: runtime.hasPausedFocus ? undefined : colors.primary,
                                boxShadow: runtime.hasPausedFocus
                                    ? `0 0 10px ${colors.glow1}, inset 0 0 0 1px ${colors.primary}`
                                    : runtime.isActiveNow
                                        ? `0 0 10px ${colors.glow1}`
                                        : `0 0 8px ${colors.glow2}`,
                                borderColor: runtime.hasPausedFocus ? colors.primary : undefined,
                            }}
                            aria-label={event.displayTitle}
                        />
                    );
                })}
            </div>

            {isSelected && leadEvent && (
                <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
                    style={{
                        background: `linear-gradient(90deg, transparent, ${getBlockColors(leadEvent.type).primary}, transparent)`,
                    }}
                />
            )}
        </div>
    );
}
