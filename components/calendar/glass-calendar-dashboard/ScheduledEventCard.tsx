import { Check, Clock3, MoreHorizontal, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { format } from "date-fns";
import { FocusSession } from "@/lib/types/focus";
import { getBlockColors } from "@/lib/utils/blockColors";
import { getBlockRuntimeState } from "@/lib/utils/blockState";
import { FocusDragToggle } from "./FocusDragToggle";
import { CalendarEvent } from "./types";

interface ScheduledEventCardProps {
    event: CalendarEvent;
    now: Date;
    session: FocusSession | null;
    onOpenBlock: (blockId: string) => void;
    onOpenFocus: (blockId: string, blockType: CalendarEvent["type"]) => void;
}

export function ScheduledEventCard({
    event,
    now,
    session,
    onOpenBlock,
    onOpenFocus,
}: ScheduledEventCardProps) {
    const colors = getBlockColors(event.type);
    const runtime = getBlockRuntimeState(event, session, now);
    const showResumeFocus = runtime.hasPausedFocus && runtime.isActiveNow;
    const stateBarStyle = runtime.hasPausedFocus
        ? {
            background: `linear-gradient(90deg, ${colors.primary}99, ${colors.secondary}aa, ${colors.primary}99)`,
            boxShadow: `0 0 14px ${colors.glow1}, 0 0 22px ${colors.glow2}`,
        }
        : runtime.isActiveNow
            ? {
                background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`,
                boxShadow: `0 0 16px ${colors.glow1}, 0 0 26px ${colors.glow2}`,
            }
            : {
                background: colors.primary,
                boxShadow: `0 0 10px ${colors.glow2}`,
            };

    return (
        <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-4 pr-4">
            <div className="pt-2">
                <p className="text-lg font-medium tracking-tight text-white/80">{format(event.startAt, "H:mm")}</p>
            </div>

            <div
                onClick={() => onOpenBlock(event.id)}
                onKeyDown={(keyboardEvent) => {
                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                        keyboardEvent.preventDefault();
                        onOpenBlock(event.id);
                    }
                }}
                role="button"
                tabIndex={0}
                className={cn(
                    "relative mr-1 w-full overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] text-left backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.07] motion-reduce:transition-none",
                    runtime.isActiveNow && "group/active-card hover:scale-[1.01] hover:-translate-y-0.5"
                )}
            >
                <div
                    className={cn(
                        "pointer-events-none absolute inset-x-0 top-0 h-1.5 overflow-hidden rounded-t-[24px]",
                        runtime.hasPausedFocus && "animate-pulse motion-reduce:animate-none"
                    )}
                    style={stateBarStyle}
                >
                    {runtime.hasPausedFocus && (
                        <div
                            className="absolute inset-y-0 left-[-35%] w-[55%] animate-[agendo-paused-sweep_2.8s_linear_infinite] motion-reduce:animate-none"
                            style={{
                                background: `linear-gradient(90deg, transparent, ${colors.streak}, ${colors.secondary}, transparent)`,
                                filter: "blur(1px)",
                            }}
                        />
                    )}
                </div>

                <div
                    className={cn(
                        "relative z-10 p-3 pt-4 transition-[padding] duration-300 motion-reduce:transition-none",
                        runtime.isActiveNow && "group-hover/active-card:px-3.5 group-hover/active-card:pb-3.5"
                    )}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h4 className="truncate text-base font-semibold tracking-tight text-white/90">{event.displayTitle}</h4>
                        </div>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2 text-[13px] text-white/40">
                        <Clock3 className="h-4 w-4" />
                        <span>
                            {format(event.startAt, "H:mm")} - {format(event.endAt, "H:mm")}
                        </span>
                        <span
                            className="ml-auto inline-flex items-center justify-center"
                            style={{ color: colors.primary }}
                            aria-label={`Status: ${runtime.effectiveStatus}`}
                        >
                            {runtime.isCompleted ? (
                                <Check className="h-3 w-3" />
                            ) : runtime.isActiveNow ? (
                                <Play className="h-3 w-3 fill-current" />
                            ) : (
                                <MoreHorizontal className="h-3 w-3" />
                            )}
                        </span>
                    </div>

                    {event.notes && (
                        <p className="mt-2 line-clamp-2 text-[11px] text-white/35">{event.notes}</p>
                    )}

                    {runtime.isActiveNow && (
                        <div
                            className={cn(
                                "grid w-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                                "[grid-template-rows:0fr] translate-y-2 opacity-0 pointer-events-none",
                                "group-hover/active-card:mt-2.5 group-hover/active-card:[grid-template-rows:1fr] group-hover/active-card:translate-y-0 group-hover/active-card:opacity-100 group-hover/active-card:pointer-events-auto"
                            )}
                        >
                            <div className="min-h-0 overflow-hidden rounded-full">
                                <FocusDragToggle
                                    colors={colors}
                                    isResume={showResumeFocus}
                                    onTrigger={() => onOpenFocus(event.id, event.type)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
