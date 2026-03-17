"use client";

import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useActivityExperienceStore } from "@/lib/stores/activityExperienceStore";
import { Block } from "@/lib/types/blocks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Play, Flame, Activity, Clock, Sparkles, CheckCircle2, MinusCircle, SkipForward, BatteryCharging, BatteryMedium, BatteryWarning } from "lucide-react";
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
import { ActivityOutcome, EnergyImpact, PerceivedValue } from "@/lib/types/activity";
import { getDefaultActivityCheckoutOutcome, shouldPromptActivityCheckout } from "@/lib/engines/activityExperience";

import { createClient, getClientUser } from "@/lib/supabase/client";
import { PlanningRecommendation } from "@/lib/types/planning";
import {
    acceptPlanningRecommendation,
    applyPlanningRecommendation,
    canApplyRecommendation,
    dismissPlanningRecommendation,
    fetchDayPlanning,
} from "@/lib/services/planningService";
import { PlanningRecommendationCard } from "@/components/planning/PlanningRecommendationCard";
import { GuidedPlanningSheet } from "@/components/planning/GuidedPlanningSheet";

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
    profile_calibration_progress: number;
    focus_streak: number;
    weekly_sessions_count: number;
    best_focus_window: "morning" | "afternoon" | "evening" | "night" | null;
}

const FOCUS_WINDOW_LABELS: Record<NonNullable<HomeSummaryData["best_focus_window"]>, string> = {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night",
};

function ProfileCalibrationRing({ value }: { value: number }) {
    const size = 58;
    const strokeWidth = 5;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const safeValue = Math.max(0, Math.min(100, value));
    const dashOffset = circumference - ((safeValue / 100) * circumference);

    return (
        <div className="relative flex h-[58px] w-[58px] items-center justify-center">
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="-rotate-90"
            >
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="url(#profile-calibration-gradient)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                />
                <defs>
                    <linearGradient id="profile-calibration-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(255,216,145,1)" />
                        <stop offset="100%" stopColor="rgba(131,176,255,1)" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tracking-tight text-white/88">
                {safeValue}%
            </div>
        </div>
    );
}

export function SectionContext({ onNext }: SectionContextProps) {
    const blocks = useBlocksStore((state) => state.blocks);
    const fetchBlocks = useBlocksStore((state) => state.fetchBlocks);
    const activityExperiences = useActivityExperienceStore((state) => state.experiences);
    const fetchDayExperiences = useActivityExperienceStore((state) => state.fetchDayExperiences);
    const recordCheckout = useActivityExperienceStore((state) => state.recordCheckout);
    const { session, returnToFocus, openFree } = useFocusStore();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [userName, setUserName] = useState("Salva");
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [summaryData, setSummaryData] = useState<HomeSummaryData | null>(null);
    const [planningRecommendations, setPlanningRecommendations] = useState<PlanningRecommendation[]>([]);
    const [planningOpen, setPlanningOpen] = useState(false);
    const [applyingRecommendationId, setApplyingRecommendationId] = useState<string | null>(null);
    const [checkoutSaving, setCheckoutSaving] = useState(false);
    const [checkoutOutcome, setCheckoutOutcome] = useState<ActivityOutcome>("completed");
    const [checkoutEnergyImpact, setCheckoutEnergyImpact] = useState<EnergyImpact>("neutral");
    const [checkoutPerceivedValue, setCheckoutPerceivedValue] = useState<PerceivedValue>("medium");
    const [dismissedCheckoutBlockIds, setDismissedCheckoutBlockIds] = useState<string[]>([]);
    const { settings } = useSettingsStore();

    const sentNotificationsRef = useRef<Set<string>>(new Set());
    const greeting = useMemo(() => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }, [currentTime]);

    const planningSignature = useMemo(() => (
        blocks
            .filter((block) => isSameDay(block.startAt, currentTime))
            .map((block) => [
                block.id,
                block.startAt.toISOString(),
                block.endAt.toISOString(),
                block.type,
                block.priority ?? "",
                block.flexibility ?? "",
                block.intensity ?? "",
                block.optional ?? "",
            ].join(":"))
            .join("|")
    ), [blocks, currentTime]);
    const currentDayKey = useMemo(
        () => currentTime.toISOString().slice(0, 10),
        [currentTime],
    );

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

                        let bodyMsg = `Starts in ${offset} minutes.`;
                        if (offset === 0) bodyMsg = "Your block starts now.";
                        else if (offset === 60) bodyMsg = "Your block starts in 1 hour.";

                        sendNotification(block.title || "Block reminder", {
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
                    sendNotification("Daily Briefing", {
                        body: `You have ${todayBlocks.length} blocks lined up for today.`,
                        icon: "/favicon.ico"
                    });
                    localStorage.setItem('agendo:lastBriefing', todayStr);
                }
            }
        }
    }, [blocks, settings.notify_daily_briefing]);

    useEffect(() => {
        void fetchDayExperiences(currentDayKey);
    }, [currentDayKey, fetchDayExperiences]);

    useEffect(() => {
        setDismissedCheckoutBlockIds([]);
    }, [currentDayKey]);

    const pendingCheckoutBlock = useMemo(() => {
        const candidates = blocks
            .filter((block) => isSameDay(block.endAt, currentTime))
            .filter((block) => !dismissedCheckoutBlockIds.includes(block.id))
            .map((block) => ({
                block,
                experience: activityExperiences.find((experience) => experience.sourceBlockId === block.id) ?? null,
            }))
            .filter(({ block, experience }) => shouldPromptActivityCheckout({
                block,
                experience,
                now: currentTime,
            }))
            .sort((left, right) => right.block.endAt.getTime() - left.block.endAt.getTime());

        return candidates[0] ?? null;
    }, [activityExperiences, blocks, currentTime, dismissedCheckoutBlockIds]);

    useEffect(() => {
        if (!pendingCheckoutBlock) return;

        const reminderId = `activity-ended:${pendingCheckoutBlock.block.id}`;
        const msSinceEnd = currentTime.getTime() - pendingCheckoutBlock.block.endAt.getTime();

        if (
            settings.notify_block_reminders
            && msSinceEnd >= 0
            && msSinceEnd <= 15 * 60 * 1000
            && !sentNotificationsRef.current.has(reminderId)
        ) {
            sentNotificationsRef.current.add(reminderId);
            void sendNotification(`${pendingCheckoutBlock.block.title} ended`, {
                body: "Leave a quick check-in in Agendo while it is still fresh.",
                icon: "/favicon.ico",
                tag: reminderId,
            });
        }
    }, [currentTime, pendingCheckoutBlock, settings.notify_block_reminders]);

    useEffect(() => {
        if (!pendingCheckoutBlock) return;
        setCheckoutOutcome(getDefaultActivityCheckoutOutcome(pendingCheckoutBlock.block));
        setCheckoutEnergyImpact("neutral");
        setCheckoutPerceivedValue("medium");
    }, [pendingCheckoutBlock]);

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

    const refreshPlanning = useCallback(async () => {
        try {
            const guide = await fetchDayPlanning(currentTime.toISOString().slice(0, 10));
            setPlanningRecommendations(guide.recommendations.slice(0, 2));
        } catch (error) {
            console.error("Failed to refresh planning", error);
        }
    }, [currentTime]);

    useEffect(() => {
        void refreshPlanning();
    }, [planningSignature, refreshPlanning]);

    const handleDismissRecommendation = async (recommendation: PlanningRecommendation) => {
        await dismissPlanningRecommendation(recommendation.id);
        await refreshPlanning();
    };

    const handleAcceptRecommendation = async (recommendation: PlanningRecommendation) => {
        await acceptPlanningRecommendation(recommendation.id);
        await refreshPlanning();
    };

    const handleApplyRecommendation = async (recommendation: PlanningRecommendation) => {
        setApplyingRecommendationId(recommendation.id);
        try {
            await applyPlanningRecommendation(recommendation.id);
            await fetchBlocks();
            await refreshPlanning();
        } catch (error) {
            console.error("Failed to apply planning recommendation", error);
            await refreshPlanning();
        } finally {
            setApplyingRecommendationId(null);
        }
    };

    const handleSaveQuickCheckout = async () => {
        if (!pendingCheckoutBlock) return;
        setCheckoutSaving(true);
        try {
            await recordCheckout(pendingCheckoutBlock.block.id, {
                outcome: checkoutOutcome,
                energyImpact: checkoutEnergyImpact,
                perceivedValue: checkoutPerceivedValue,
            });
            setDismissedCheckoutBlockIds((current) => current.filter((id) => id !== pendingCheckoutBlock.block.id));
        } finally {
            setCheckoutSaving(false);
        }
    };

    const handleDismissQuickCheckout = () => {
        if (!pendingCheckoutBlock) return;
        setDismissedCheckoutBlockIds((current) => (
            current.includes(pendingCheckoutBlock.block.id)
                ? current
                : [...current, pendingCheckoutBlock.block.id]
        ));
    };

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
                                        Your schedule is clear.
                                    </p>
                                    <p className="mt-2 max-w-[420px] text-center text-sm text-white/48">
                                        Use the dock below to plan or start a clean focus block.
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
                                    {isSessionPaused ? "FOCUS PAUSED - TAP TO RETURN" : isFocusCardActive ? "CURRENT FOCUS" : "NEXT FOCUS BLOCK"}
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

                {/* Home Summary Card */}
                {summaryData && (
                    <div className="mt-8 w-full max-w-[420px] rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                                    {summaryData.progress_signal === "positive"
                                        ? "Sharper"
                                        : summaryData.progress_signal === "quiet"
                                            ? "Quiet"
                                            : "Calibrating"}
                                </p>
                                <p className="mt-2 text-base font-semibold tracking-tight text-white/90">
                                    {summaryData.main_insight}
                                </p>
                            </div>
                            <div className="flex flex-col items-center gap-1 text-center">
                                <ProfileCalibrationRing value={summaryData.profile_calibration_progress} />
                                <span className="text-[10px] uppercase tracking-[0.16em] text-white/38">
                                    Profile fill
                                </span>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/42">
                            <span className="rounded-full border border-white/10 px-2.5 py-1">
                                Composite {summaryData.momentum_current}
                            </span>
                            {summaryData.momentum_delta_week > 0 && (
                                <span className="rounded-full border border-emerald-400/15 bg-emerald-400/8 px-2.5 py-1 text-emerald-300">
                                    +{summaryData.momentum_delta_week} vs last week
                                </span>
                            )}
                            {summaryData.momentum_delta_week < 0 && (
                                <span className="rounded-full border border-rose-400/15 bg-rose-400/8 px-2.5 py-1 text-rose-300">
                                    {summaryData.momentum_delta_week} vs last week
                                </span>
                            )}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-white/56">
                            {summaryData.soft_recommendation}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3 text-[11px] font-medium text-white/46">
                            {(summaryData.focus_streak || 0) > 0 && (
                                <div className="flex items-center gap-1.5 rounded-full border border-orange-400/15 bg-orange-400/8 px-2.5 py-1 text-orange-200/82">
                                    <Flame className="w-3.5 h-3.5" />
                                    <span>{summaryData.focus_streak} day streak</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 rounded-full border border-indigo-400/15 bg-indigo-400/8 px-2.5 py-1 text-indigo-100/82">
                                <Activity className="w-3.5 h-3.5" />
                                <span>{summaryData.weekly_sessions_count || 0} this week</span>
                            </div>
                            {summaryData.best_focus_window && (
                                <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-white/56">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Best {FOCUS_WINDOW_LABELS[summaryData.best_focus_window]}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="mt-6 w-full max-w-[760px] rounded-[30px] border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-2xl">
                    <div className="mb-4 flex flex-col gap-2">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                                Planning assist
                            </p>
                            <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">
                                A few useful moves. Real context only.
                            </h3>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        {planningRecommendations.length === 0 ? (
                            <div className="rounded-[24px] border border-white/[0.08] bg-black/20 px-4 py-5 text-sm leading-6 text-white/55">
                                No strong adjustment stands out right now. If the day tightens, Agendo will surface it here.
                            </div>
                        ) : (
                            planningRecommendations.map((recommendation) => (
                                <PlanningRecommendationCard
                                    key={recommendation.id}
                                    compact
                                    recommendation={recommendation}
                                    onAccept={handleAcceptRecommendation}
                                    onDismiss={handleDismissRecommendation}
                                    onApply={canApplyRecommendation(recommendation) ? handleApplyRecommendation : undefined}
                                    applying={applyingRecommendationId === recommendation.id}
                                />
                            ))
                        )}
                    </div>
                </div>

                {pendingCheckoutBlock && (
                    <div className="mt-6 w-full max-w-[760px] rounded-[30px] border border-amber-300/12 bg-[linear-gradient(180deg,rgba(255,214,153,0.08),rgba(0,0,0,0.22))] p-4 backdrop-blur-2xl shadow-[0_20px_80px_-44px_rgba(255,196,94,0.55)]">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/45">
                                        Quick check-in
                                    </p>
                                    <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">
                                        {pendingCheckoutBlock.block.title} just ended
                                    </h3>
                                    <p className="mt-1 text-sm leading-6 text-white/58">
                                        Mark how it went in a few taps so Agendo can learn from the real outcome.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedBlockId(pendingCheckoutBlock.block.id)}
                                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/62 transition hover:bg-white/[0.08] hover:text-white"
                                >
                                    Open block
                                </button>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-[22px] border border-white/[0.08] bg-black/18 p-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">
                                        Outcome
                                    </p>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {([
                                            {
                                                value: getDefaultActivityCheckoutOutcome(pendingCheckoutBlock.block),
                                                label: getDefaultActivityCheckoutOutcome(pendingCheckoutBlock.block) === "attended" ? "Attended" : "Done",
                                                icon: CheckCircle2,
                                            },
                                            { value: "partial" as ActivityOutcome, label: "Partial", icon: MinusCircle },
                                            { value: "skipped" as ActivityOutcome, label: "Skipped", icon: SkipForward },
                                        ]).map((option) => {
                                            const Icon = option.icon;
                                            const active = checkoutOutcome === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    onClick={() => setCheckoutOutcome(option.value)}
                                                    className={cn(
                                                        "flex flex-col items-start gap-1 rounded-2xl border px-3 py-2 text-left text-[11px] transition",
                                                        active
                                                            ? "border-amber-300/30 bg-amber-300/12 text-amber-100"
                                                            : "border-white/8 bg-white/[0.03] text-white/58 hover:bg-white/[0.06] hover:text-white/80",
                                                    )}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="rounded-[22px] border border-white/[0.08] bg-black/18 p-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">
                                        Energy
                                    </p>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {([
                                            { value: "restorative" as EnergyImpact, label: "Restorative", icon: BatteryCharging },
                                            { value: "neutral" as EnergyImpact, label: "Neutral", icon: BatteryMedium },
                                            { value: "draining" as EnergyImpact, label: "Draining", icon: BatteryWarning },
                                        ]).map((option) => {
                                            const Icon = option.icon;
                                            const active = checkoutEnergyImpact === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    onClick={() => setCheckoutEnergyImpact(option.value)}
                                                    className={cn(
                                                        "flex flex-col items-start gap-1 rounded-2xl border px-3 py-2 text-left text-[11px] transition",
                                                        active
                                                            ? "border-sky-300/25 bg-sky-300/10 text-sky-100"
                                                            : "border-white/8 bg-white/[0.03] text-white/58 hover:bg-white/[0.06] hover:text-white/80",
                                                    )}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="rounded-[22px] border border-white/[0.08] bg-black/18 p-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">
                                        Value
                                    </p>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {(["low", "medium", "high"] as PerceivedValue[]).map((value) => {
                                            const active = checkoutPerceivedValue === value;
                                            return (
                                                <button
                                                    key={value}
                                                    onClick={() => setCheckoutPerceivedValue(value)}
                                                    className={cn(
                                                        "rounded-2xl border px-3 py-2 text-[11px] capitalize transition",
                                                        active
                                                            ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                                                            : "border-white/8 bg-white/[0.03] text-white/58 hover:bg-white/[0.06] hover:text-white/80",
                                                    )}
                                                >
                                                    {value}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <button
                                    onClick={handleDismissQuickCheckout}
                                    className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/56 transition hover:bg-white/[0.05] hover:text-white/78"
                                >
                                    Later
                                </button>
                                <GlassButton
                                    onClick={handleSaveQuickCheckout}
                                    variant="default"
                                    className="justify-center"
                                    disabled={checkoutSaving}
                                >
                                    {checkoutSaving ? "Saving..." : "Save check-in"}
                                </GlassButton>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-7 w-full max-w-[760px] rounded-[30px] border border-white/[0.1] bg-black/30 p-3 backdrop-blur-2xl shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)]">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <GlassButton onClick={() => setPlanningOpen(true)} variant="default" className="justify-center">
                            <Sparkles className="h-4 w-4 opacity-80" />
                            Plan
                        </GlassButton>
                        <GlassButton onClick={onNext} variant="default" className="justify-center">
                            <Calendar className="w-4 h-4 opacity-70" />
                            Open Calendar
                        </GlassButton>
                        {session && !session.isActive ? (
                            <GlassButton onClick={returnToFocus} variant="primary" className="justify-center">
                                Return to Focus
                            </GlassButton>
                        ) : session ? (
                            <GlassButton onClick={returnToFocus} variant="primary" className="justify-center">
                                Back to Focus
                            </GlassButton>
                        ) : (
                            <GlassButton onClick={openFree} variant="default" className="justify-center">
                                <Play className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                Free Focus
                            </GlassButton>
                        )}
                    </div>
                </div>

            </div>

            {selectedBlockId && (
                <RadialBlockMenu
                    blockId={selectedBlockId}
                    onClose={() => setSelectedBlockId(null)}
                />
            )}

            <GuidedPlanningSheet
                open={planningOpen}
                onOpenChange={setPlanningOpen}
                date={currentTime.toISOString().slice(0, 10)}
            />

        </section>
    );
}
