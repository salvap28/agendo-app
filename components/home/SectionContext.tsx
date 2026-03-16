"use client";

import { useBlocksStore } from "@/lib/stores/blocksStore";
import { Block } from "@/lib/types/blocks";
import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Play, Flame, Activity, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { isSameDay, isAfter, isBefore } from "date-fns";
import { useFocusStore } from "@/lib/stores/focusStore";
import { GlassButton } from "@/components/ui/glass-button";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { RadialBlockMenu } from "@/components/calendar/RadialBlockMenu";
import { getBlockColors } from "@/lib/utils/blockColors";
import { getBlockEffectiveStatus } from "@/lib/utils/blockState";
import { sendNotification } from "@/lib/utils/notifications";

import { createClient, getClientUser } from "@/lib/supabase/client";

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

interface HomeSummaryData {
    momentum_current: number;
    momentum_delta_week: number;
    main_insight: string;
    progress_signal: "positive" | "quiet" | "neutral";
    soft_recommendation: string;
    focus_streak: number;
    weekly_sessions_count: number;
    best_focus_window: "morning" | "afternoon" | "evening" | "night" | null;
}

export function SectionContext({ onNext }: SectionContextProps) {
    const { blocks } = useBlocksStore();
    const { session, returnToFocus, openFree } = useFocusStore();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [userName, setUserName] = useState("Salva");
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [summaryData, setSummaryData] = useState<HomeSummaryData | null>(null);
    const { settings } = useSettingsStore();

    const sentNotificationsRef = useRef<Set<string>>(new Set());
    const greeting = useMemo(() => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }, [currentTime]);

    const nextBlock = useMemo(() => {
        const todayBlocks = blocks.filter((block) => isSameDay(block.startAt, currentTime));
        const activeBlock = todayBlocks.find((block) => getBlockEffectiveStatus(block, currentTime) === "active");

        if (activeBlock) return activeBlock;

        const upcomingBlocks = todayBlocks
            .filter((block) => {
                const effectiveStatus = getBlockEffectiveStatus(block, currentTime);
                return effectiveStatus === "planned" || effectiveStatus === "active";
            })
            .filter((block) => isAfter(block.startAt, currentTime) || (isBefore(block.startAt, currentTime) && isAfter(block.endAt, currentTime)))
            .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

        return upcomingBlocks[0] || null;
    }, [blocks, currentTime]);

    // Check for block reminders
    useEffect(() => {
        if (!settings.notify_block_reminders) return;

        const nowMs = currentTime.getTime();

        blocks.forEach(block => {
            const effectiveStatus = getBlockEffectiveStatus(block, currentTime);
            if (effectiveStatus === "completed" || effectiveStatus === "canceled") return;
            const diffMin = (block.startAt.getTime() - nowMs) / 60000;
            // By default backwards compatibility: 5 min
            const notificationTimes = block.notifications || [5];

            notificationTimes.forEach(offset => {
                const notifId = `${block.id}-${offset}`;
                // We are within the minute that triggers this offset
                if (diffMin > offset - 0.5 && diffMin <= offset + 0.5) {
                    if (!sentNotificationsRef.current.has(notifId)) {
                        sentNotificationsRef.current.add(notifId);

                        let bodyMsg = `Empezando en ${offset} minutos.`;
                        if (offset === 0) bodyMsg = "¡Tu bloque empieza ahora!";
                        else if (offset === 60) bodyMsg = "Tu bloque empieza en 1 hora.";

                        sendNotification(block.title || "Recordatorio de bloque", {
                            body: bodyMsg,
                            icon: "/favicon.ico"
                        });
                    }
                }
            });
        });
    }, [currentTime, blocks, settings.notify_block_reminders]);

    // Daily Briefing Logic
    useEffect(() => {
        if (!settings.notify_daily_briefing) return;

        const todayStr = new Date().toDateString();
        const lastBriefing = localStorage.getItem('agendo:lastBriefing');

        if (lastBriefing !== todayStr) {
            const hour = new Date().getHours();
            // Show briefing in the morning
            if (hour >= 6 && hour < 12 && blocks.length > 0) {
                const todayBlocks = blocks.filter(b => isSameDay(b.startAt, new Date()));
                if (todayBlocks.length > 0) {
                    sendNotification("☀️ Daily Briefing", {
                        body: `Buen día Salva, tenés ${todayBlocks.length} bloques programados para hoy. ¡A darle con todo!`,
                        icon: "/favicon.ico"
                    });
                    localStorage.setItem('agendo:lastBriefing', todayStr);
                }
            }
        }
    }, [blocks, settings.notify_daily_briefing]);

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const user = await getClientUser(supabase);
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

        const fetchSummary = async () => {
            try {
                const res = await fetch('/api/home/summary');
                if (res.ok) {
                    const data: HomeSummaryData = await res.json();
                    setSummaryData(data);
                }
            } catch (e) {
                console.error("Failed to fetch summary", e);
            }
        };
        fetchSummary();

        // Keep current time updated for block checking (every minute)
        const interval = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <section
            className="relative w-full min-h-[100dvh] snap-start flex flex-col items-center justify-center p-6"
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
                        let displayStatus = displayBlock ? getBlockEffectiveStatus(displayBlock, currentTime) : null;

                        if (session) {
                            if (session.mode === "free") {
                                displayBlock = {
                                    id: "free-session",
                                    type: "other",
                                    title: "Free Focus Session",
                                    startAt: new Date(session.startedAt ?? currentTime.toISOString()),
                                    endAt: currentTime,
                                    status: "active"
                                } as Block;
                                isSessionPaused = !session.isActive;
                                isSessionActive = session.isActive;
                                displayStatus = "active";
                            } else if (session.blockId) {
                                const sessionBlock = blocks.find(b => b.id === session.blockId);
                                if (sessionBlock) {
                                    displayBlock = sessionBlock;
                                    isSessionPaused = !session.isActive;
                                    isSessionActive = session.isActive;
                                    displayStatus = getBlockEffectiveStatus(sessionBlock, currentTime);
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

                        const isFocusCardActive = isSessionActive || displayStatus === "active";

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
                                    {isSessionPaused ? "SESIÓN PAUSADA - CLICK PARA CONTINUAR" : isFocusCardActive ? "CURRENT FOCUS" : "NEXT FOCUS BLOCK"}
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
                                        isFocusCardActive && !isSessionPaused ? "overflow-hidden" : "",
                                        isSessionPaused ? "animate-pulse shadow-[0_0_30px_rgba(124,58,237,0.3)] ring-1 ring-[#a78bfa]/50" : ""
                                    )}
                                    style={{
                                        maxWidth: '420px',
                                        background: isSessionPaused ? 'rgba(124,58,237,0.1)' : 'transparent'
                                    }}
                                >
                                    {isFocusCardActive && !isSessionPaused ? (() => {
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

                {/* V1 Insight Summary Card */}
                {summaryData && (
                    <div className="mt-8 w-full max-w-[420px] rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5 backdrop-blur-md flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <div className="flex justify-between items-center text-white/50 text-[10px] uppercase tracking-[0.15em] font-semibold mb-1">
                            <span>
                                {summaryData.progress_signal === 'positive' ? 'Fluyendo' : summaryData.progress_signal === 'quiet' ? 'En pausa' : 'Construyendo'}
                            </span>
                            <span className="flex items-center gap-1.5">
                                IMPULSO <span className="text-white/80">{summaryData.momentum_current}</span>
                                {summaryData.momentum_delta_week > 0 && <span className="text-emerald-400">+{summaryData.momentum_delta_week}</span>}
                                {summaryData.momentum_delta_week < 0 && <span className="text-rose-400">{summaryData.momentum_delta_week}</span>}
                            </span>
                        </div>
                        <p className="text-white/80 text-sm leading-relaxed font-medium">
                            {summaryData.main_insight}
                        </p>
                        <p className="text-white/40 text-xs">
                            {summaryData.soft_recommendation}
                        </p>

                        {/* Extra Context Row */}
                        <div className="flex items-center gap-4 mt-2 pt-3 border-t border-white/[0.05] text-white/40 text-[11px] font-medium tracking-wide uppercase">
                            {(summaryData.focus_streak || 0) > 0 && (
                                <div className="flex items-center gap-1.5 text-orange-400/80">
                                    <Flame className="w-3.5 h-3.5" />
                                    <span>{summaryData.focus_streak} DÍAS</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 text-indigo-400/80">
                                <Activity className="w-3.5 h-3.5" />
                                <span>{summaryData.weekly_sessions_count || 0} SEMANA</span>
                            </div>
                            {summaryData.best_focus_window && (
                                <div className="flex items-center gap-1.5 ml-auto text-white/50">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{summaryData.best_focus_window === "morning" ? "Mañana" : summaryData.best_focus_window === "afternoon" ? "Tarde" : summaryData.best_focus_window === "evening" ? "Tardecita" : "Noche"}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

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
