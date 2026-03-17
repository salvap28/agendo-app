import { Block } from "@/lib/types/blocks";
import { cn } from "@/lib/cn";
import { useMemo, useState } from "react";
import { getBlockColors } from "@/lib/utils/blockColors";
import { getBlockEffectiveStatus } from "@/lib/utils/blockState";
import { useActivityExperienceStore } from "@/lib/stores/activityExperienceStore";

interface BlockItemProps {
    block: Block;
    top: number;
    height: number;
    now: Date;
    onPointerDown: (e: React.PointerEvent, action: "move" | "resize") => void;
}

export function BlockItem({ block, top, height, now, onPointerDown }: BlockItemProps) {

    const [isHovered, setIsHovered] = useState(false);
    const activityExperience = useActivityExperienceStore((state) => (
        state.experiences.find((experience) => experience.sourceBlockId === block.id) ?? null
    ));

    const accentClass = useMemo(() => {
        switch (block.type) {
            case "deep_work": return "border-l-indigo-400";
            case "meeting": return "border-l-rose-400";
            case "gym": return "border-l-emerald-400";
            case "study": return "border-l-amber-400";
            case "admin": return "border-l-slate-400";
            case "break": return "border-l-orange-400";
            default: return "border-l-neutral-400";
        }
    }, [block.type]);

    const isCurrentlyActive = useMemo(() => {
        return getBlockEffectiveStatus(block, now) === "active";
    }, [block, now]);

    const colors = useMemo(() => getBlockColors(block.type), [block.type]);

    // --- Shared card content ---
    const cardContent = (
        <>
            <div className={cn("flex flex-col min-w-0 flex-1", height < 30 && "flex-row items-center gap-2")}>
                <span className="text-[13px] font-medium text-white/90 leading-tight truncate tracking-wide">
                    {block.title}
                </span>
                {height >= 45 && (
                    <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] text-[#9ca3af] truncate tracking-wide">
                            {block.startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {block.endAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {activityExperience && (
                            <>
                                <span className={`h-2 w-2 rounded-full ${
                                    activityExperience.energyImpact === "draining"
                                        ? "bg-rose-400"
                                        : activityExperience.energyImpact === "restorative" || activityExperience.energyImpact === "energizing"
                                            ? "bg-emerald-400"
                                            : "bg-cyan-300/70"
                                }`} />
                                <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                                    {activityExperience.wasUserConfirmed ? "confirmed" : "inferred"}
                                </span>
                            </>
                        )}
                    </div>
                )}
            </div>

            {height >= 60 && block.type === "meeting" && (
                <div className="absolute bottom-2.5 right-2.5">
                    <button className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 transition-colors text-white/80">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 7l-7 5 7 5V7z" />
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                        <span className="text-[10px] font-medium">Join</span>
                    </button>
                </div>
            )}

            <div
                className="absolute bottom-0 left-0 right-0 h-4 cursor-s-resize flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onPointerDown={(e) => {
                    e.stopPropagation();
                    onPointerDown(e, "resize");
                }}
            >
                <div className="w-10 h-1 bg-white/20 rounded-full mb-1" />
            </div>
        </>
    );

    if (isCurrentlyActive) {
        return (
            <div
                className="absolute left-0 right-1.5 rounded-[16px] overflow-hidden select-none group cursor-pointer transition-shadow duration-300"
                style={{
                    top,
                    height,
                    zIndex: 10,
                    boxShadow: isHovered
                        ? `0 0 20px 4px ${colors.glow1}, 0 0 40px 8px ${colors.glow2}`
                        : "none",
                }}
                onPointerEnter={() => setIsHovered(true)}
                onPointerLeave={() => setIsHovered(false)}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    onPointerDown(e, "move");
                }}
            >
                {/* Spinning conic gradient — Layer 1: main dual-streak */}
                <div
                    className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] animate-[spin_3s_linear_infinite]"
                    style={{ background: `conic-gradient(transparent, ${colors.primary} 5%, transparent 38%, transparent 50%, ${colors.secondary} 62%, transparent 87%)` }}
                />
                {/* Layer 2: faster sharp streak */}
                <div
                    className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] animate-[spin_2s_linear_infinite] opacity-70"
                    style={{
                        background: `conic-gradient(transparent, ${colors.streak} 2%, transparent 18%)`,
                        filter: "blur(1px)",
                    }}
                />

                {/* Inner card — 1.5px inset, opaque bg blocks the gradient center */}
                <div
                    className={cn(
                        "absolute rounded-[14.5px]",
                        "bg-[#0a0b12] backdrop-blur-[16px] transition-colors duration-200",
                        "hover:bg-[#11131e]",
                        height < 30 ? "flex flex-row items-center px-2 py-1 gap-2" : "flex flex-col p-2.5 gap-1"
                    )}
                    style={{ inset: "1.5px", border: `1px solid ${colors.innerBorder}` }}
                >
                    {cardContent}
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "absolute left-0 right-1.5 rounded-[16px] transition-all select-none overflow-hidden group",
                "bg-white/[0.04] backdrop-blur-[16px] border border-white/[0.08] shadow-lg",
                "hover:bg-white/[0.08] hover:border-white/[0.12] hover:shadow-xl hover:z-20",
                "cursor-pointer border-l-[3px]",
                accentClass,
                height < 30 ? "flex flex-row items-center px-2 py-1 gap-2" : "flex flex-col p-2.5 gap-1"
            )}
            style={{ top, height, zIndex: 10 }}
            onPointerDown={(e) => {
                e.stopPropagation();
                onPointerDown(e, "move");
            }}
        >
            {cardContent}
        </div>
    );
}
