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
import { RadialBlockMenu } from "@/components/calendar/RadialBlockMenu";
import { getBlockColors } from "@/lib/utils/blockColors";

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
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Try to get username, then first name, fallback to email
                const username = user.user_metadata?.username;
                const fullName = user.user_metadata?.full_name || user.user_metadata?.name;

                if (username) {
                    setUserName(username);
                } else if (fullName) {
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
                    {(() => {
                        let displayBlock = nextBlock;
                        let isSessionPaused = false;
                        let isSessionActive = false;

                        if (session) {
                            if (session.mode === "free") {
                                displayBlock = {
                                    id: "free-session",
                                    type: "other",
                                    title: "Free Focus Session",
                                    startAt: new Date(session.startedAt || Date.now()),
                                    endAt: new Date(),
                                    status: "active"
                                } as Block;
                                isSessionPaused = !session.isActive;
                                isSessionActive = session.isActive;
                            } else if (session.blockId) {
                                const sessionBlock = blocks.find(b => b.id === session.blockId);
                                if (sessionBlock) {
                                    displayBlock = sessionBlock;
                                    isSessionPaused = !session.isActive;
                                    isSessionActive = session.isActive;
                                }
                            }
                        }

                        if (!displayBlock) {
                            return (
                                <div className="flex flex-col items-center text-center w-full">
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
                            );
                        }

                        return (
                            <>
                                {/* Label */}
                                <span
                                    style={{
                                        fontSize: '12px',
                                        letterSpacing: '0.12em',
                                        textTransform: 'uppercase',
                                        opacity: isSessionPaused ? 0.9 : 0.5,
                                        color: isSessionPaused ? '#a78bfa' : '#FFFFFF',
                                        marginBottom: '16px',
                                        fontWeight: isSessionPaused ? 600 : 400
                                    }}
                                    className={isSessionPaused ? "animate-pulse" : ""}
                                >
                                    {isSessionPaused ? "SESIÓN PAUSADA - CLICK PARA CONTINUAR" : (isSessionActive || displayBlock.status === "active") ? "CURRENT FOCUS" : "NEXT FOCUS BLOCK"}
                                </span>

                                {/* Glass Pill for Block */}
                                <div
                                    onClick={() => {
                                        if (isSessionPaused || isSessionActive) {
                                            returnToFocus();
                                        } else {
                                            setSelectedBlockId(displayBlock.id);
                                        }
                                    }}
                                    className={cn(
                                        "relative flex flex-col items-center text-center justify-center w-full cursor-pointer hover:scale-[1.02] transition-transform rounded-[16px]",
                                        (isSessionActive || displayBlock.status === "active") && !isSessionPaused ? "overflow-hidden" : "",
                                        isSessionPaused ? "animate-pulse shadow-[0_0_30px_rgba(124,58,237,0.3)] ring-1 ring-[#a78bfa]/50" : ""
                                    )}
                                    style={{
                                        maxWidth: '420px',
                                        background: isSessionPaused ? 'rgba(124,58,237,0.1)' : 'transparent'
                                    }}
                                >
                                    {(isSessionActive || displayBlock.status === "active") && !isSessionPaused ? (() => {
                                        const colors = getBlockColors(displayBlock.type);
                                    return (
                                        <>
                                            <div
                                                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] animate-[spin_3s_linear_infinite]"
                                                style={{ background: `conic-gradient(transparent, ${colors.primary} 5%, transparent 38%, transparent 50%, ${colors.secondary} 62%, transparent 87%)` }}
                                            />
                                            <div
                                                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] animate-[spin_2s_linear_infinite] opacity-70"
                                                style={{ background: `conic-gradient(transparent, ${colors.streak} 2%, transparent 18%)`, filter: "blur(1px)" }}
                                            />
                                            <div 
                                                className="absolute inset-[1.5px] rounded-[14.5px] bg-[#0a0b12] backdrop-blur-xl pointer-events-none"
                                                style={{ border: `1px solid ${colors.innerBorder}` }}
                                            />
                                        </>
                                    );
                                })() : (
                                    <>
                                        <div className="absolute inset-0 rounded-[16px] pointer-events-none" style={{
                                            background: isSessionPaused ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0.04)',
                                            border: isSessionPaused ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.08)',
                                            backdropFilter: 'blur(8px)',
                                            WebkitBackdropFilter: 'blur(8px)'
                                        }} />
                                        {isSessionPaused ? (
                                            <GlowingEffect spread={40} proximity={60} inactiveZone={0.01} borderWidth={2} variant="default" />
                                        ) : (
                                            <GlowingEffect spread={30} proximity={60} inactiveZone={0.01} borderWidth={1} variant="subtle" />
                                        )}
                                    </>
                                )}

                                <div className="relative z-10 p-[16px_20px] w-full flex flex-col items-center">
                                    <h3
                                        className={cn("text-[16px] font-medium mb-1", isSessionPaused ? "text-[#a78bfa]" : "text-white/90")}
                                    >
                                        {displayBlock.title}
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
                                        {displayBlock.id === "free-session" ? "Unscheduled Focus" : `${displayBlock.startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${displayBlock.endAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                        <span className="mx-2 opacity-30">•</span>
                                        {BLOCK_LABELS[displayBlock.type] || "Focus"}
                                    </p>
                                </div>
                            </div>
                        </>
                    );
                    })()}
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

            {selectedBlockId && (
                <RadialBlockMenu
                    blockId={selectedBlockId}
                    onClose={() => setSelectedBlockId(null)}
                />
            )}

        </section>
    );
}
