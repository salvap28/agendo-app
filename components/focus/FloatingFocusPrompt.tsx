"use client";

import { useEffect, useState } from "react";
import { useFocusStore } from "@/lib/stores/focusStore";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { Play, ArrowRight, Activity } from "lucide-react";
import { isSameDay, isAfter, isBefore } from "date-fns";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { AnimatedGlowingBackground } from "@/components/ui/animated-glowing-background";
import { cn } from "@/lib/cn";

export function FloatingFocusPrompt() {
    const { session, returnToFocus, openFree, openFromBlock } = useFocusStore();
    const { blocks } = useBlocksStore();

    const [isVisible, setIsVisible] = useState(false);
    const [promptType, setPromptType] = useState<"return" | "start_block" | null>(null);
    const [blockTitle, setBlockTitle] = useState<string>("");
    const [targetBlock, setTargetBlock] = useState<{ id: string; type: any } | null>(null);

    useEffect(() => {
        // Condition 1: If there is an active session, but we are not IN the focus view
        // (If we were in the focus view, FocusOverlay would cover the whole screen anyway, 
        // but session.isActive represents if the timer is running or layer is active. 
        // Wait, if FocusOverlay is open, session exists. If it's closed but session exists, it's paused or minimized.)
        if (session && !session.isActive) {
            setPromptType("return");
            const block = session.blockId ? blocks.find((b) => b.id === session.blockId) : null;
            setBlockTitle(block?.title || "Free Focus Session");
            setIsVisible(true);
            return;
        }

        // Condition 2: If there's NO session, check if there's a block happening NOW
        if (!session) {
            const now = new Date();
            const todayBlocks = blocks.filter(b => isSameDay(b.startAt, now));

            // Check for an active block or a planned block currently in its time window
            const currentBlock = todayBlocks.find(b =>
                b.status === "active" ||
                (b.status === "planned" && isAfter(now, b.startAt) && isBefore(now, b.endAt))
            );

            if (currentBlock) {
                setPromptType("start_block");
                setBlockTitle(currentBlock.title);
                setTargetBlock({ id: currentBlock.id, type: currentBlock.type });
                setIsVisible(true);
                return;
            }
        }

        setIsVisible(false);
    }, [session, blocks]);

    if (!isVisible || !promptType) return null;

    const handleAction = () => {
        if (promptType === "return") {
            returnToFocus();
        } else if (targetBlock) {
            openFromBlock(targetBlock.id, targetBlock.type);
        } else {
            openFree();
        }
    };

    return (
        <div className="fixed bottom-28 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-500">
            <button
                onClick={handleAction}
                className={cn(
                    "relative group flex items-center gap-3 px-5 py-3 rounded-full overflow-hidden transition-all duration-300",
                    promptType === "return" ? [
                        "bg-black/80 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                        "hover:scale-105 hover:bg-black/90 hover:border-white/20 hover:shadow-[0_8px_40px_rgba(255,255,255,0.15)]"
                    ] : [
                        "shadow-[0_8px_32px_rgba(99,102,241,0.25)]",
                        "hover:scale-105 hover:shadow-[0_8px_40px_rgba(124,58,237,0.4)] border border-transparent"
                    ]
                )}
            >
                {/* Agendo Glow Effect or Spinning Border Effect */}
                {promptType === "return" ? (
                    <GlowingEffect
                        spread={30}
                        proximity={64}
                        inactiveZone={0.01}
                        borderWidth={1}
                        disabled={false}
                        variant="default"
                    />
                ) : (
                    <AnimatedGlowingBackground />
                )}

                <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 border border-white/5 mr-1 group-hover:bg-white/20 transition-colors">
                    {promptType === "return" ? (
                        <Activity className="w-4 h-4 text-white" />
                    ) : (
                        <Play className="w-4 h-4 text-white ml-0.5" />
                    )}
                </div>

                <div className="relative z-10 flex flex-col text-left mr-2">
                    <span className="text-[10px] font-medium uppercase tracking-widest text-white/50 leading-none mb-1">
                        {promptType === "return" ? "Sesión pausada" : "Bloque actual"}
                    </span>
                    <span className="text-sm font-semibold text-white/90 leading-none truncate max-w-[150px] sm:max-w-[200px]">
                        {blockTitle}
                    </span>
                </div>

                <div className="relative z-10 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-4 h-4" />
                </div>
            </button>
        </div>
    );
}
