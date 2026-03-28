"use client";

import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useActivityExperienceStore } from "@/lib/stores/activityExperienceStore";
import { Block } from "@/lib/types/blocks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Play, Sparkles, CheckCircle2, MinusCircle, SkipForward, BatteryCharging, BatteryMedium, BatteryWarning, Info } from "lucide-react";
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
import { useI18n } from "@/lib/i18n/client";
import {
    getActivityOutcomeLabel,
    getBlockTypeLabel,
    getEnergyImpactLabel,
    getIntlLocale,
    getPerceivedValueLabel,
} from "@/lib/i18n/app";

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

function ProfileCalibrationRing({ value, large }: { value: number; large?: boolean }) {
    const size = large ? 110 : 58;
    const strokeWidth = large ? 6 : 5;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const safeValue = Math.max(0, Math.min(100, value));
    const dashOffset = circumference - ((safeValue / 100) * circumference);

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            {/* Ambient glow behind the ring */}
            {large && (
                <div
                    className="absolute inset-0 animate-pulse"
                    style={{
                        background: 'radial-gradient(circle, rgba(193,167,255,0.15) 0%, rgba(131,176,255,0.08) 40%, transparent 70%)',
                        filter: 'blur(18px)',
                        transform: 'scale(1.6)',
                    }}
                />
            )}
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="-rotate-90"
                style={{ filter: large ? 'drop-shadow(0 0 8px rgba(193,167,255,0.3))' : undefined }}
            >
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
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
                    style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
                <defs>
                    <linearGradient id="profile-calibration-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(193,167,255,1)" />
                        <stop offset="50%" stopColor="rgba(131,176,255,1)" />
                        <stop offset="100%" stopColor="rgba(110,231,183,0.8)" />
                    </linearGradient>
                </defs>
            </svg>
            <div className={cn(
                "absolute inset-0 flex items-center justify-center font-bold tracking-tight",
                large ? "text-[20px]" : "text-[11px]"
            )}
            style={large ? {
                background: 'linear-gradient(135deg, rgba(193,167,255,1), rgba(131,176,255,1))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
            } : { color: 'rgba(255,255,255,0.88)' }}>
                {safeValue}%
            </div>
        </div>
    );
}

export function SectionContext({ onNext }: SectionContextProps) {
    const { language } = useI18n();
    const intlLocale = getIntlLocale(language);
    const blocks = useBlocksStore((state) => state.blocks);
    const fetchBlocks = useBlocksStore((state) => state.fetchBlocks);
    const activityExperiences = useActivityExperienceStore((state) => state.experiences);
    const fetchDayExperiences = useActivityExperienceStore((state) => state.fetchDayExperiences);
    const recordCheckout = useActivityExperienceStore((state) => state.recordCheckout);
    const { session, returnToFocus, openFree } = useFocusStore();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [userName, setUserName] = useState("");
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
    const [showProfileInfo, setShowProfileInfo] = useState(false);
    const { settings } = useSettingsStore();
    const copy = useMemo(() => (
        language === "es"
            ? {
                fallbackName: "amigo",
                goodMorning: "Buen dia",
                goodAfternoon: "Buenas tardes",
                goodEvening: "Buenas noches",
                blockStartsInMinutes: (minutes: number) => `Empieza en ${minutes} minutos.`,
                blockStartsNow: "Tu bloque empieza ahora.",
                blockStartsInHour: "Tu bloque empieza en 1 hora.",
                blockReminder: "Recordatorio de bloque",
                dailyBriefing: "Resumen del dia",
                dailyBriefingBody: (count: number) => `Tienes ${count} bloques preparados para hoy.`,
                blockEndedTitle: (title: string) => `${title} termino`,
                blockEndedBody: "Deja un check-in rapido en Agendo mientras todavia esta fresco.",
                freeFocusSession: "Sesion de foco libre",
                status: "Estado",
                scheduleClear: "Tu agenda esta despejada.",
                scheduleClearHelp: "Usa el dock de abajo para planificar o iniciar un bloque de foco limpio.",
                focusPaused: "FOCO EN PAUSA · TOCA PARA VOLVER",
                currentFocus: "FOCO ACTUAL",
                nextFocusBlock: "SIGUIENTE BLOQUE DE FOCO",
                unscheduledFocus: "Foco sin agenda",
                fallbackFocus: "Foco",
                profileFill: "Perfil cargado",
                profileFillHelpLine1: "Se calibra con cada check-in, sesion de foco y bloque completado.",
                profileFillHelpLine2: "Mas señal significa mejores recomendaciones y predicciones mas precisas.",
                planningAssist: "Asistencia de planning",
                planningAssistBody: "Ajustes inteligentes basados en tus patrones reales.",
                nothingToAdjust: "No hay nada para ajustar ahora. Sigue asi.",
                quickCheckIn: "Check-in rapido",
                blockJustEnded: (title: string) => `${title} acaba de terminar`,
                quickCheckInBody: "Unos pocos toques para capturar el resultado real.",
                openBlock: "Abrir bloque",
                outcome: "Resultado",
                energy: "Energia",
                value: "Valor",
                later: "Despues",
                saving: "Guardando...",
                saveCheckIn: "Guardar check-in",
                openCalendar: "Abrir calendario",
                returnToFocus: "Volver al foco",
                backToFocus: "Regresar al foco",
                freeFocus: "Foco libre",
                planDay: "Planificar dia",
            }
            : {
                fallbackName: "there",
                goodMorning: "Good morning",
                goodAfternoon: "Good afternoon",
                goodEvening: "Good evening",
                blockStartsInMinutes: (minutes: number) => `Starts in ${minutes} minutes.`,
                blockStartsNow: "Your block starts now.",
                blockStartsInHour: "Your block starts in 1 hour.",
                blockReminder: "Block reminder",
                dailyBriefing: "Daily briefing",
                dailyBriefingBody: (count: number) => `You have ${count} blocks lined up for today.`,
                blockEndedTitle: (title: string) => `${title} ended`,
                blockEndedBody: "Leave a quick check-in in Agendo while it is still fresh.",
                freeFocusSession: "Free Focus Session",
                status: "Status",
                scheduleClear: "Your schedule is clear.",
                scheduleClearHelp: "Use the dock below to plan or start a clean focus block.",
                focusPaused: "FOCUS PAUSED · TAP TO RETURN",
                currentFocus: "CURRENT FOCUS",
                nextFocusBlock: "NEXT FOCUS BLOCK",
                unscheduledFocus: "Unscheduled Focus",
                fallbackFocus: "Focus",
                profileFill: "Profile fill",
                profileFillHelpLine1: "It calibrates with every check-in, focus session, and completed block.",
                profileFillHelpLine2: "More signal means better recommendations and sharper predictions.",
                planningAssist: "Planning assist",
                planningAssistBody: "Smart adjustments based on your real patterns.",
                nothingToAdjust: "Nothing to adjust right now. Keep going.",
                quickCheckIn: "Quick check-in",
                blockJustEnded: (title: string) => `${title} just ended`,
                quickCheckInBody: "A few taps to capture the real outcome.",
                openBlock: "Open block",
                outcome: "Outcome",
                energy: "Energy",
                value: "Value",
                later: "Later",
                saving: "Saving...",
                saveCheckIn: "Save check-in",
                openCalendar: "Open Calendar",
                returnToFocus: "Return to Focus",
                backToFocus: "Back to Focus",
                freeFocus: "Free Focus",
                planDay: "Plan day",
            }
    ), [language]);

    const sentNotificationsRef = useRef<Set<string>>(new Set());
    const greeting = useMemo(() => {
        const hour = currentTime.getHours();
        if (hour < 12) return copy.goodMorning;
        if (hour < 18) return copy.goodAfternoon;
        return copy.goodEvening;
    }, [copy, currentTime]);

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

                        let bodyMsg = copy.blockStartsInMinutes(offset);
                        if (offset === 0) bodyMsg = copy.blockStartsNow;
                        else if (offset === 60) bodyMsg = copy.blockStartsInHour;

                        sendNotification(block.title || copy.blockReminder, {
                            body: bodyMsg,
                            icon: "/favicon.ico"
                        });
                    }
                }
            });
        });
    }, [blocks, copy, currentTime, settings.notify_block_reminders]);

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
                    sendNotification(copy.dailyBriefing, {
                        body: copy.dailyBriefingBody(todayBlocks.length),
                        icon: "/favicon.ico"
                    });
                    localStorage.setItem('agendo:lastBriefing', todayStr);
                }
            }
        }
    }, [blocks, copy, settings.notify_daily_briefing]);

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
            void sendNotification(copy.blockEndedTitle(pendingCheckoutBlock.block.title), {
                body: copy.blockEndedBody,
                icon: "/favicon.ico",
                tag: reminderId,
            });
        }
    }, [copy, currentTime, pendingCheckoutBlock, settings.notify_block_reminders]);

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
    }, [language]);

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
            const isManualReviewGuard = error instanceof Error
                && (error.message.toLowerCase().includes("manual review") || error.message.toLowerCase().includes("revision manual"));

            if (isManualReviewGuard) {
                console.info("[Planning] Recommendation requires manual review, skipping auto-apply.");
            } else {
                console.error("Failed to apply planning recommendation", error);
            }
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
            className="relative w-full h-[100dvh] snap-start flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden"
        >
            <div className="flex flex-col items-center w-full z-20 gap-4 md:gap-5">

                {/* Greeting */}
                <h2
                    className="text-center"
                    style={{
                        fontWeight: 700,
                        fontSize: 'clamp(22px, 3vw, 34px)',
                        letterSpacing: '-0.02em',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(193,167,255,0.85) 50%, rgba(131,176,255,0.8) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '0'
                    }}
                >
                    {greeting}, {userName || copy.fallbackName}.
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
                                    title: copy.freeFocusSession,
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
                                        {copy.status}
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
                                        {copy.scheduleClear}
                                    </p>
                                    <p className="mt-2 max-w-[420px] text-center text-sm text-white/48">
                                        {copy.scheduleClearHelp}
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
                                    {isSessionPaused ? copy.focusPaused : isFocusCardActive ? copy.currentFocus : copy.nextFocusBlock}
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
                                            {displayBlock.id === "free-session"
                                                ? copy.unscheduledFocus
                                                : `${displayBlock.startAt.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })} - ${displayBlock.endAt.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })}`}
                                            <span className="mx-2 opacity-30">·</span>
                                            {getBlockTypeLabel(language, displayBlock.type) || copy.fallbackFocus}
                                        </p>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>

                {/* Profile Calibration Ring */}
                {summaryData && (
                    <div className="relative flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <ProfileCalibrationRing value={summaryData.profile_calibration_progress} large />
                        <div className="flex items-center gap-1">
                            <span
                                className="text-[9px] font-bold uppercase tracking-[0.2em]"
                                style={{
                                    background: 'linear-gradient(90deg, rgba(193,167,255,0.6), rgba(131,176,255,0.5))',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                {copy.profileFill}
                            </span>
                            <div
                                className="relative"
                                onMouseEnter={() => setShowProfileInfo(true)}
                                onMouseLeave={() => setShowProfileInfo(false)}
                            >
                                <div
                                    className="flex h-[14px] w-[14px] items-center justify-center rounded-full cursor-help opacity-45 hover:opacity-75 transition-opacity"
                                    style={{
                                        background: 'rgba(193,167,255,0.12)',
                                        border: '1px solid rgba(193,167,255,0.1)',
                                    }}
                                >
                                    <Info className="h-[8px] w-[8px] text-[#c1a7ff]" />
                                </div>

                                {/* Hover tooltip — side panel */}
                                {showProfileInfo && (
                                    <div
                                        className="absolute left-full top-1/2 -translate-y-1/2 ml-3 w-[260px] rounded-[18px] overflow-hidden z-20 pointer-events-none animate-in fade-in slide-in-from-left-2 duration-200"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(15,12,28,0.92), rgba(8,6,18,0.95))',
                                            border: '1px solid rgba(193,167,255,0.1)',
                                            boxShadow: '0 12px 40px -8px rgba(0,0,0,0.6), 0 0 20px -6px rgba(193,167,255,0.08)',
                                            backdropFilter: 'blur(20px)',
                                        }}
                                    >
                                        {/* Top shimmer */}
                                        <div className="h-[1px] w-full" style={{
                                            background: 'linear-gradient(90deg, transparent, rgba(193,167,255,0.2), rgba(131,176,255,0.2), transparent)',
                                        }} />
                                        <div className="px-4 py-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1.5" style={{
                                                background: 'linear-gradient(90deg, rgba(193,167,255,0.7), rgba(131,176,255,0.6))',
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                            }}>
                                                {copy.profileFill}
                                            </p>
                                            <p className="text-[11px] leading-[1.55] text-white/45">
                                                {copy.profileFillHelpLine1}
                                            </p>
                                            <p className="mt-1.5 text-[11px] leading-[1.55] text-white/35">
                                                {copy.profileFillHelpLine2}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Planning Assist */}
                <div className="relative w-full max-w-[760px] rounded-[24px] overflow-hidden p-4 backdrop-blur-2xl"
                    style={{
                        background: 'linear-gradient(180deg, rgba(193,167,255,0.04) 0%, rgba(131,176,255,0.02) 50%, rgba(0,0,0,0.2) 100%)',
                        border: '1px solid rgba(193,167,255,0.12)',
                    }}
                >
                    {/* Subtle shimmer line at top */}
                    <div className="absolute top-0 left-[10%] right-[10%] h-[1px]" style={{
                        background: 'linear-gradient(90deg, transparent, rgba(193,167,255,0.3), rgba(131,176,255,0.3), transparent)',
                    }} />
                    <div className="mb-3 flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-[#c1a7ff]/60" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{
                            background: 'linear-gradient(90deg, rgba(193,167,255,0.7), rgba(131,176,255,0.6))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            {copy.planningAssist}
                        </p>
                    </div>
                    <p className="mb-3 text-[13px] font-medium tracking-tight text-white/55">
                        {copy.planningAssistBody}
                    </p>

                    <div className="grid gap-2">
                        {planningRecommendations.length === 0 ? (
                            <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-[13px] leading-6 text-white/45 italic">
                                {copy.nothingToAdjust}
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
                    <div className="relative w-full max-w-[760px] rounded-[24px] overflow-hidden p-4 backdrop-blur-2xl"
                        style={{
                            background: 'linear-gradient(180deg, rgba(255,214,153,0.06) 0%, rgba(251,191,36,0.03) 40%, rgba(0,0,0,0.25) 100%)',
                            border: '1px solid rgba(251,191,36,0.15)',
                            boxShadow: '0 20px 80px -44px rgba(251,191,36,0.4), inset 0 1px 0 rgba(251,191,36,0.1)',
                        }}
                    >
                        {/* Top shimmer for checkout */}
                        <div className="absolute top-0 left-[10%] right-[10%] h-[1px]" style={{
                            background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.35), rgba(255,214,153,0.35), transparent)',
                        }} />
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-amber-400/80 animate-pulse" />
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{
                                            background: 'linear-gradient(90deg, rgba(251,191,36,0.7), rgba(255,214,153,0.6))',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                        }}>
                                            {copy.quickCheckIn}
                                        </p>
                                    </div>
                                    <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight text-white">
                                        {copy.blockJustEnded(pendingCheckoutBlock.block.title)}
                                    </h3>
                                    <p className="mt-1 text-[13px] leading-5 text-white/50">
                                        {copy.quickCheckInBody}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedBlockId(pendingCheckoutBlock.block.id)}
                                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/55 transition-all hover:bg-white/[0.08] hover:text-white hover:border-white/20 hover:scale-105"
                                >
                                    {copy.openBlock}
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                {/* Outcome — segmented pill */}
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30 mb-2">{copy.outcome}</p>
                                    {(() => {
                                        const outcomeOptions = [
                                            {
                                                value: getDefaultActivityCheckoutOutcome(pendingCheckoutBlock.block),
                                                label: getActivityOutcomeLabel(
                                                    language,
                                                    getDefaultActivityCheckoutOutcome(pendingCheckoutBlock.block),
                                                ),
                                                icon: CheckCircle2,
                                            },
                                            { value: "partial" as ActivityOutcome, label: getActivityOutcomeLabel(language, "partial"), icon: MinusCircle },
                                            { value: "skipped" as ActivityOutcome, label: getActivityOutcomeLabel(language, "skipped"), icon: SkipForward },
                                        ];
                                        const activeIdx = outcomeOptions.findIndex(o => o.value === checkoutOutcome);
                                        return (
                                            <div className="relative flex h-[36px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                {/* Sliding indicator */}
                                                <div
                                                    className="absolute top-[3px] bottom-[3px] rounded-full pointer-events-none"
                                                    style={{
                                                        width: `calc(${100 / outcomeOptions.length}% - 4px)`,
                                                        left: `calc(${(activeIdx >= 0 ? activeIdx : 0) * (100 / outcomeOptions.length)}% + 2px)`,
                                                        background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(255,214,153,0.12))',
                                                        border: '1px solid rgba(251,191,36,0.25)',
                                                        boxShadow: '0 0 12px rgba(251,191,36,0.15)',
                                                        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    }}
                                                />
                                                {outcomeOptions.map((option) => {
                                                    const Icon = option.icon;
                                                    const active = checkoutOutcome === option.value;
                                                    return (
                                                        <div
                                                            key={option.value}
                                                            onClick={() => setCheckoutOutcome(option.value)}
                                                            className="relative z-10 flex-1 flex items-center justify-center gap-1.5 cursor-pointer select-none transition-colors duration-200"
                                                            style={{ color: active ? 'rgba(255,214,153,0.95)' : 'rgba(255,255,255,0.4)' }}
                                                        >
                                                            <Icon className="h-3 w-3" />
                                                            <span className="text-[10px] font-semibold">{option.label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>

                                {checkoutOutcome !== "skipped" && (
                                    <>
                                        {/* Energy — segmented pill */}
                                        <div className="animate-in fade-in zoom-in-95 duration-300">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30 mb-2">{copy.energy}</p>
                                            {(() => {
                                                const energyOptions = [
                                                    { value: "restorative" as EnergyImpact, label: getEnergyImpactLabel(language, "restorative"), icon: BatteryCharging, color: 'rgba(110,231,183,' },
                                                    { value: "neutral" as EnergyImpact, label: getEnergyImpactLabel(language, "neutral"), icon: BatteryMedium, color: 'rgba(131,176,255,' },
                                                    { value: "draining" as EnergyImpact, label: getEnergyImpactLabel(language, "draining"), icon: BatteryWarning, color: 'rgba(251,113,133,' },
                                                ];
                                                const activeIdx = energyOptions.findIndex(o => o.value === checkoutEnergyImpact);
                                                const activeColor = activeIdx >= 0 ? energyOptions[activeIdx].color : energyOptions[1].color;
                                                return (
                                                    <div className="relative flex h-[36px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                        <div
                                                            className="absolute top-[3px] bottom-[3px] rounded-full pointer-events-none"
                                                            style={{
                                                                width: `calc(${100 / energyOptions.length}% - 4px)`,
                                                                left: `calc(${(activeIdx >= 0 ? activeIdx : 1) * (100 / energyOptions.length)}% + 2px)`,
                                                                background: `linear-gradient(135deg, ${activeColor}0.2), ${activeColor}0.1))`,
                                                                border: `1px solid ${activeColor}0.3)`,
                                                                boxShadow: `0 0 12px ${activeColor}0.15)`,
                                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            }}
                                                        />
                                                        {energyOptions.map((option) => {
                                                            const Icon = option.icon;
                                                            const active = checkoutEnergyImpact === option.value;
                                                            return (
                                                                <div
                                                                    key={option.value}
                                                                    onClick={() => setCheckoutEnergyImpact(option.value)}
                                                                    className="relative z-10 flex-1 flex items-center justify-center gap-1.5 cursor-pointer select-none transition-colors duration-200"
                                                                    style={{ color: active ? `${option.color}0.95)` : 'rgba(255,255,255,0.4)' }}
                                                                >
                                                                    <Icon className="h-3 w-3" />
                                                                    <span className="text-[10px] font-semibold">{option.label}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Value — segmented pill */}
                                        <div className="animate-in fade-in zoom-in-95 duration-300 delay-75">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30 mb-2">{copy.value}</p>
                                            {(() => {
                                                const valueOptions = [
                                                    { value: "low" as PerceivedValue, label: getPerceivedValueLabel(language, "low"), color: 'rgba(255,255,255,' },
                                                    { value: "medium" as PerceivedValue, label: getPerceivedValueLabel(language, "medium"), color: 'rgba(131,176,255,' },
                                                    { value: "high" as PerceivedValue, label: getPerceivedValueLabel(language, "high"), color: 'rgba(110,231,183,' },
                                                ];
                                                const activeIdx = valueOptions.findIndex(o => o.value === checkoutPerceivedValue);
                                                const activeColor = activeIdx >= 0 ? valueOptions[activeIdx].color : valueOptions[1].color;
                                                return (
                                                    <div className="relative flex h-[36px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                        <div
                                                            className="absolute top-[3px] bottom-[3px] rounded-full pointer-events-none"
                                                            style={{
                                                                width: `calc(${100 / valueOptions.length}% - 4px)`,
                                                                left: `calc(${(activeIdx >= 0 ? activeIdx : 1) * (100 / valueOptions.length)}% + 2px)`,
                                                                background: `linear-gradient(135deg, ${activeColor}0.18), ${activeColor}0.08))`,
                                                                border: `1px solid ${activeColor}0.25)`,
                                                                boxShadow: `0 0 12px ${activeColor}0.12)`,
                                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            }}
                                                        />
                                                        {valueOptions.map((option) => {
                                                            const active = checkoutPerceivedValue === option.value;
                                                            return (
                                                                <div
                                                                    key={option.value}
                                                                    onClick={() => setCheckoutPerceivedValue(option.value)}
                                                                    className="relative z-10 flex-1 flex items-center justify-center cursor-pointer select-none transition-colors duration-200"
                                                                    style={{ color: active ? `${option.color}0.95)` : 'rgba(255,255,255,0.4)' }}
                                                                >
                                                                    <span className="text-[10px] font-semibold">{option.label}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-2 justify-end">
                                <button
                                    onClick={handleDismissQuickCheckout}
                                    className="rounded-full border border-white/[0.08] px-4 py-1.5 text-[12px] font-medium text-white/45 transition-all hover:bg-white/[0.04] hover:text-white/70 hover:scale-[1.02]"
                                >
                                    {copy.later}
                                </button>
                                <button
                                    onClick={handleSaveQuickCheckout}
                                    disabled={checkoutSaving}
                                    className="rounded-full px-5 py-1.5 text-[12px] font-semibold text-black transition-all hover:scale-[1.03] disabled:opacity-50"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(251,191,36,0.9), rgba(255,214,153,0.85))',
                                        boxShadow: '0 4px 20px -4px rgba(251,191,36,0.4)',
                                    }}
                                >
                                    {checkoutSaving ? copy.saving : copy.saveCheckIn}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bottom Dock */}
                <div className="relative w-full max-w-[760px] rounded-[22px] overflow-hidden p-2 backdrop-blur-2xl"
                    style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.35) 100%)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 24px 80px -40px rgba(0,0,0,0.9)',
                    }}
                >
                    <div className="absolute top-0 left-[15%] right-[15%] h-[1px]" style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
                    }} />
                    <div className="grid gap-2 sm:grid-cols-3">
                        <GlassButton onClick={() => setPlanningOpen(true)} variant="default" className="justify-center">
                            <Sparkles className="h-4 w-4 opacity-80" />
                            {copy.planDay}
                        </GlassButton>
                        <GlassButton onClick={onNext} variant="default" className="justify-center">
                            <Calendar className="w-4 h-4 opacity-70" />
                            {copy.openCalendar}
                        </GlassButton>
                        {session && !session.isActive ? (
                            <GlassButton onClick={returnToFocus} variant="primary" className="justify-center">
                                {copy.returnToFocus}
                            </GlassButton>
                        ) : session ? (
                            <GlassButton onClick={returnToFocus} variant="primary" className="justify-center">
                                {copy.backToFocus}
                            </GlassButton>
                        ) : (
                            <GlassButton onClick={openFree} variant="default" className="justify-center">
                                <Play className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                {copy.freeFocus}
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
