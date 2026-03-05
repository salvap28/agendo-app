"use client";

import { useBlocksStore } from "@/lib/stores/blocksStore";
import { Block, BlockStatus } from "@/lib/types/blocks";
import { useEffect, useState } from "react";
import { ArrowDown, Calendar, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { isSameDay, isAfter, isBefore } from "date-fns";
import { useFocusStore } from "@/lib/stores/focusStore";
import { GlassButton } from "@/components/ui/glass-button";
import { GlowingEffect } from "@/components/ui/glowing-effect";

import { createClient } from "@/lib/supabase/client";

const BLOCK_LABELS: Record<string, string> = {
    deep_work: "Deep Work",
    meeting: "Meeting",
    gym: "Gym",
    study: "Study",
    admin: "Admin",
    break: "Break",
    other: "Other",
};

interface SectionContextProps {
    onNext: () => void;
}

export function SectionContext({ onNext }: SectionContextProps) {
    const { blocks } = useBlocksStore();
    const { session, returnToFocus, openFree } = useFocusStore();
    const [greeting, setGreeting] = useState("Hello");
    const [nextBlock, setNextBlock] = useState<Block | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [userName, setUserName] = useState("Salva");

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Try to get first name from metadata, fallback to email prefix
                const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
                if (fullName) {
                    setUserName(fullName.split(' ')[0]);
                } else if (user.email) {
                    setUserName(user.email.split('@')[0]);
                }
            }
        };
        fetchUser();

        // Dynamic greeting
        const hour = new Date().getHours();
        if (hour < 12) setGreeting("Good morning");
        else if (hour < 18) setGreeting("Good afternoon");
        else setGreeting("Good evening");

        // Keep current time updated for block checking (every minute)
        const interval = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        // Find next or active block for today
        const todayBlocks = blocks.filter(b => isSameDay(b.startAt, currentTime));

        // Prioritize active, then closest planned future block
        const activeBlock = todayBlocks.find(b => b.status === "active");
        if (activeBlock) {
            setNextBlock(activeBlock);
            return;
        }

        const upcomingBlocks = todayBlocks
            .filter(b => b.status === "planned" || b.status === "active")
            .filter(b => isAfter(b.startAt, currentTime) || (isBefore(b.startAt, currentTime) && isAfter(b.endAt, currentTime)))
            .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

        setNextBlock(upcomingBlocks[0] || null);
    }, [blocks, currentTime]);

    return (
        <section
            className="relative w-full min-h-[100dvh] snap-start flex flex-col items-center justify-center p-6"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.4))' }}
        >
            <div className="flex flex-col items-center w-full z-20">

                {/* Greeting */}
                <h2
                    className="text-center"
                    style={{
                        fontWeight: 600,
                        fontSize: 'clamp(28px, 4vw, 40px)',
                        letterSpacing: '-0.01em',
                        color: 'rgba(255,255,255,0.9)',
                        marginBottom: '32px'
                    }}
                >
                    {greeting}, {userName}.
                </h2>

                {/* Next Block Protagonist */}
                <div className="flex flex-col items-center w-full">
                    {nextBlock ? (
                        <>
                            {/* Label */}
                            <span
                                style={{
                                    fontSize: '12px',
                                    letterSpacing: '0.12em',
                                    textTransform: 'uppercase',
                                    opacity: 0.5,
                                    color: '#FFFFFF',
                                    marginBottom: '16px'
                                }}
                            >
                                {nextBlock.status === "active" ? "CURRENT FOCUS" : "NEXT FOCUS BLOCK"}
                            </span>

                            {/* Glass Pill for Block */}
                            <div
                                className="relative flex flex-col items-center text-center justify-center w-full"
                                style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '16px',
                                    padding: '16px 20px',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                    maxWidth: '420px'
                                }}
                            >
                                <GlowingEffect spread={30} proximity={60} inactiveZone={0.01} borderWidth={1} variant="subtle" />
                                <h3
                                    className="text-[16px] font-medium text-white/90 mb-1"
                                >
                                    {nextBlock.title}
                                </h3>
                                <p
                                    className="line-clamp-2 text-center"
                                    style={{
                                        maxWidth: '420px',
                                        opacity: 0.75,
                                        fontWeight: 400,
                                        color: '#FFFFFF'
                                    }}
                                >
                                    {nextBlock.startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {nextBlock.endAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    <span className="mx-2 opacity-30">•</span>
                                    {BLOCK_LABELS[nextBlock.type] || "Focus"}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center text-center w-full">
                            {/* Label for empty state to keep vertical rhythm consistent */}
                            <span
                                style={{
                                    fontSize: '12px',
                                    letterSpacing: '0.12em',
                                    textTransform: 'uppercase',
                                    opacity: 0.5,
                                    color: '#FFFFFF',
                                    marginBottom: '16px'
                                }}
                            >
                                STATUS
                            </span>
                            <p
                                className="line-clamp-2 text-center"
                                style={{
                                    maxWidth: '420px',
                                    opacity: 0.75,
                                    fontWeight: 500,
                                    color: '#FFFFFF'
                                }}
                            >
                                Your schedule is clear. Plan your day.
                            </p>
                        </div>
                    )}
                </div>

                {/* Actions Group */}
                <div className="flex flex-col sm:flex-row items-center gap-4 mt-7">
                    {/* Open Calendar CTA */}
                    <GlassButton onClick={onNext} variant="default">
                        <Calendar className="w-4 h-4 opacity-70" />
                        Open Calendar
                    </GlassButton>

                    {/* Focus Interactions */}
                    {session && !session.isActive ? (
                        <GlassButton onClick={returnToFocus} variant="primary">
                            Return to Focus
                        </GlassButton>
                    ) : !session ? (
                        <GlassButton onClick={openFree} variant="default">
                            <Play className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                            Free Focus
                        </GlassButton>
                    ) : null}
                </div>

            </div>

        </section>
    );
}
