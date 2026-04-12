"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CalendarClock, ChevronRight, Flame, MoveRight, RotateCcw, ShieldCheck, TimerReset, Zap } from "lucide-react";
import { createClient, getClientUser } from "@/lib/supabase/client";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useFocusStore } from "@/lib/stores/focusStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { useI18n } from "@/lib/i18n/client";
import { getIntlLocale } from "@/lib/i18n/app";
import { enrichNewBlockWithPlanningMetadata } from "@/lib/utils/blockEnrichment";
import { fetchHabitHome, trackHabitEvent } from "@/lib/services/habitService";
import { recordBlockRescheduleActivity } from "@/lib/services/activityExperienceService";
import { sendNotification } from "@/lib/utils/notifications";
import { HabitActivationSheet } from "@/components/habit/HabitActivationSheet";
import { RadialBlockMenu } from "@/components/calendar/RadialBlockMenu";
import type { Block } from "@/lib/types/blocks";
import type { RescuePlanAction } from "@/lib/types/habit";

type HomeSnapshot = Awaited<ReturnType<typeof fetchHabitHome>>;

function durationMin(block: Pick<Block, "startAt" | "endAt">) {
    return Math.max(5, Math.round((block.endAt.getTime() - block.startAt.getTime()) / 60000));
}

function notificationGuard(key: string) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function setNotificationGuard(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // noop
    }
}

function Ring({ value }: { value: number }) {
    const size = 60;
    const stroke = 5;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;

    return (
        <div className="relative h-[60px] w-[60px]">
            <svg viewBox="0 0 60 60" className="-rotate-90">
                <circle cx="30" cy="30" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
                <circle
                    cx="30"
                    cy="30"
                    r={radius}
                    fill="none"
                    stroke="url(#habit-ring)"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
                <defs>
                    <linearGradient id="habit-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(125,211,252,1)" />
                        <stop offset="100%" stopColor="rgba(110,231,183,1)" />
                    </linearGradient>
                </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white/85">{value}%</span>
        </div>
    );
}

export function HabitContext({ onNext }: { onNext: () => void }) {
    const { language } = useI18n();
    const locale = getIntlLocale(language);
    const searchParams = useSearchParams();
    const blocks = useBlocksStore((state) => state.blocks);
    const createBlock = useBlocksStore((state) => state.createBlock);
    const updateBlock = useBlocksStore((state) => state.updateBlock);
    const { session, openFromBlock, openFree, returnToFocus } = useFocusStore();
    const { settings } = useSettingsStore();
    const [home, setHome] = useState<HomeSnapshot | null>(null);
    const [userName, setUserName] = useState("");
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [showRescue, setShowRescue] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const trackedRef = useRef(false);

    const copy = language === "es"
        ? {
            greeting: ["Buen dia", "Buenas tardes", "Buenas noches"],
            next: "Tu proximo paso ya esta listo",
            paused: "Seguimos desde aca",
            fallback: "Empeza por esto",
            start: "Empezar ahora",
            return: "Volver al foco",
            prepare: "Preparar bloque",
            light: "Version liviana",
            move: "Mover 15 min",
            calendar: "Abrir calendario",
            rescue: "Reordenemos sin empezar de cero",
            ritual: "Esto es lo mas importante de hoy",
            ritualCta: "Confirmar y seguir",
            ritualSkip: "Ahora no",
            weekly: "Consistencia flexible",
            calibration: "Calibracion del perfil",
            daily: "Estado breve del dia",
            keyBlocks: "Bloques clave",
            completed: "Completados",
            fallbackBody: "Si no hay un bloque claro, te dejamos uno chico y accionable.",
        }
        : {
            greeting: ["Good morning", "Good afternoon", "Good evening"],
            next: "Your next step is ready",
            paused: "We continue from here",
            fallback: "Start with this",
            start: "Start now",
            return: "Return to focus",
            prepare: "Prepare block",
            light: "Lighter version",
            move: "Move 15 min",
            calendar: "Open calendar",
            rescue: "Let’s re-order without starting over",
            ritual: "This is the most important thing today",
            ritualCta: "Confirm and continue",
            ritualSkip: "Not now",
            weekly: "Flexible consistency",
            calibration: "Profile calibration",
            daily: "Brief state of the day",
            keyBlocks: "Key blocks",
            completed: "Completed",
            fallbackBody: "If there is no clear block yet, we leave one that is small and actionable.",
        };

    const loadHome = useCallback(async () => {
        const data = await fetchHabitHome();
        setHome(data);
        setShowOnboarding(data.habit.onboarding.shouldShow);
    }, []);

    useEffect(() => {
        void loadHome();
    }, [loadHome]);

    useEffect(() => {
        let cancelled = false;
        async function loadName() {
            const user = await getClientUser(createClient());
            if (!user || cancelled) return;
            const username = user.user_metadata?.username;
            const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
            setUserName(username || (fullName ? String(fullName).split(" ")[0] : user.email?.split("@")[0] || ""));
        }
        void loadName();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!home || trackedRef.current) return;
        trackedRef.current = true;
        void trackHabitEvent({ name: "home_viewed", surface: "habit_home" });
        void trackHabitEvent({ name: "daily_summary_seen", surface: "habit_home" });
        void trackHabitEvent({ name: "weekly_consistency_seen", surface: "habit_home" });
        if (home.habit.nextBlock.block) {
            void trackHabitEvent({ name: "next_block_seen", surface: "habit_home", blockId: home.habit.nextBlock.block.id });
        }
        if (home.habit.nextBlock.adaptiveRecommendation) {
            void trackHabitEvent({
                name: "adaptive_recommendation_shown",
                surface: "habit_home",
                blockId: home.habit.nextBlock.block?.id ?? null,
                metadata: {
                    type: home.habit.nextBlock.adaptiveRecommendation.type,
                },
            });
        }
    }, [home]);

    useEffect(() => {
        const deepLink = searchParams.get("habit");
        const blockId = searchParams.get("blockId");
        const notification = searchParams.get("notification");
        const source = searchParams.get("source");
        if (notification) {
            void trackHabitEvent({ name: "notification_opened", surface: "notification", metadata: { notification } });
        }
        if (source === "widget") {
            void trackHabitEvent({ name: "widget_opened_app", surface: "widget" });
        }
        if (deepLink === "rescue") {
            setShowRescue(true);
        }
        if (blockId) {
            setSelectedBlockId(blockId);
        }
    }, [searchParams]);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? copy.greeting[0] : hour < 18 ? copy.greeting[1] : copy.greeting[2];
    const pausedSession = session && !session.endedAt && !session.isActive;
    const nextBlock = home?.habit.nextBlock.block ? blocks.find((item) => item.id === home.habit.nextBlock.block?.id) ?? null : null;

    useEffect(() => {
        if (!home) return;
        const today = new Date().toISOString().slice(0, 10);

        if (nextBlock && settings.notify_block_reminders) {
            const startsInMin = Math.round((nextBlock.startAt.getTime() - Date.now()) / 60000);
            const guardKey = `agendo:habit:block:${today}:${nextBlock.id}`;
            if (startsInMin >= 0 && startsInMin <= 20 && notificationGuard(guardKey) !== today) {
                setNotificationGuard(guardKey, today);
                void trackHabitEvent({ name: "notification_scheduled", surface: "habit_home", blockId: nextBlock.id, metadata: { type: "before_block" } });
                void sendNotification(language === "es" ? "Tu bloque esta listo" : "Your block is ready", {
                    body: home.habit.nextBlock.context,
                    data: { url: `/?blockId=${encodeURIComponent(nextBlock.id)}&habit=start&notification=before_block`, notificationType: "before_block" },
                });
                void trackHabitEvent({ name: "notification_sent", surface: "habit_home", blockId: nextBlock.id, metadata: { type: "before_block" } });
            }
        }

        if (home.habit.rescuePlan && settings.notify_daily_briefing) {
            const guardKey = `agendo:habit:rescue:${today}`;
            if (notificationGuard(guardKey) !== today) {
                setNotificationGuard(guardKey, today);
                void trackHabitEvent({ name: "notification_scheduled", surface: "habit_home", metadata: { type: "rescue" } });
                void sendNotification(language === "es" ? "Tu dia cambio. Reordenemoslo rapido" : "Your day changed. Let's re-order it quickly", {
                    body: home.habit.rescuePlan.tone,
                    data: { url: "/?habit=rescue&notification=rescue", notificationType: "rescue" },
                });
                void trackHabitEvent({ name: "notification_sent", surface: "habit_home", metadata: { type: "rescue" } });
            }
        }
    }, [home, language, nextBlock, settings.notify_block_reminders, settings.notify_daily_briefing]);

    const startNext = useCallback(async () => {
        if (pausedSession) {
            returnToFocus();
            return;
        }
        if (nextBlock) {
            await trackHabitEvent({ name: "next_block_started_from_home", surface: "habit_home", blockId: nextBlock.id });
            if (searchParams.get("source") === "widget") {
                await trackHabitEvent({ name: "widget_started_block", surface: "widget", blockId: nextBlock.id });
            }
            openFromBlock(nextBlock.id, nextBlock.type);
            return;
        }
        const block = createBlock(enrichNewBlockWithPlanningMetadata({
            title: language === "es" ? "Bloque protegido" : "Protected block",
            type: "deep_work",
            startAt: new Date(Date.now() + 15 * 60000),
            endAt: new Date(Date.now() + 45 * 60000),
        }));
        if (block) {
            await trackHabitEvent({ name: "habit_first_meaningful_action", surface: "habit_home", blockId: block.id });
            setSelectedBlockId(block.id);
            await loadHome();
            return;
        }
        openFree();
    }, [createBlock, language, loadHome, nextBlock, openFree, openFromBlock, pausedSession, returnToFocus]);

    const adjustBlock = useCallback(async (mode: "move" | "light") => {
        if (!nextBlock) return;
        const nextVersion: Block = {
            ...nextBlock,
            startAt: mode === "move" ? new Date(nextBlock.startAt.getTime() + 15 * 60000) : nextBlock.startAt,
            endAt: mode === "move"
                ? new Date(nextBlock.endAt.getTime() + 15 * 60000)
                : new Date(nextBlock.startAt.getTime() + Math.max(20, Math.round(durationMin(nextBlock) * 0.7)) * 60000),
        };
        await updateBlock(nextBlock.id, { startAt: nextVersion.startAt, endAt: nextVersion.endAt });
        await recordBlockRescheduleActivity(nextBlock, nextVersion);
        await trackHabitEvent({
            name: "adaptive_recommendation_accepted",
            surface: "habit_home",
            blockId: nextBlock.id,
            metadata: { action: mode },
        });
        await loadHome();
    }, [loadHome, nextBlock, updateBlock]);

    const applyRescue = useCallback(async (action: RescuePlanAction) => {
        const block = blocks.find((item) => item.id === action.blockId);
        if (!block) return;

        if (action.type === "cancel") {
            await updateBlock(block.id, { status: "canceled" });
        } else {
            const startAt = action.suggestedStart ? new Date(action.suggestedStart) : block.startAt;
            const endAt = new Date(startAt.getTime() + ((action.suggestedDurationMin ?? durationMin(block)) * 60000));
            const nextVersion = { ...block, startAt, endAt };
            await updateBlock(block.id, { startAt, endAt });
            await recordBlockRescheduleActivity(block, nextVersion);
        }

        await trackHabitEvent({
            name: "rescue_plan_applied",
            surface: "habit_home",
            blockId: action.blockId,
            metadata: { action: action.type },
        });
        setShowRescue(false);
        await loadHome();
    }, [blocks, loadHome, updateBlock]);

    const openRescue = useCallback(async (source: string) => {
        setShowRescue(true);
        await trackHabitEvent({ name: "rescue_cta_clicked", surface: "habit_home", metadata: { source } });
        await trackHabitEvent({ name: "rescue_opened", surface: "habit_home", metadata: { source } });
        if (home?.habit.rescuePlan) {
            await trackHabitEvent({
                name: "rescue_plan_generated",
                surface: "habit_home",
                metadata: {
                    overdueBlocks: home.habit.rescuePlan.overdueBlocks.length,
                    priorityCandidates: home.habit.rescuePlan.priorityCandidates.length,
                },
            });
        }
    }, [home?.habit.rescuePlan]);

    const confirmRitual = useCallback(async () => {
        await trackHabitEvent({ name: "daily_ritual_confirmed", surface: "habit_home", blockId: home?.habit.dailyRitual.blockId ?? null });
        await startNext();
        await loadHome();
    }, [home?.habit.dailyRitual.blockId, loadHome, startNext]);

    const skipRitual = useCallback(async () => {
        await trackHabitEvent({ name: "daily_ritual_skipped", surface: "habit_home", blockId: home?.habit.dailyRitual.blockId ?? null });
        setHome((current) => current ? {
            ...current,
            habit: {
                ...current.habit,
                dailyRitual: { ...current.habit.dailyRitual, shouldShow: false },
            },
        } : current);
    }, [home?.habit.dailyRitual.blockId]);

    useEffect(() => {
        if (!home?.habit.dailyRitual.shouldShow) return;
        void trackHabitEvent({ name: "daily_ritual_shown", surface: "habit_home", blockId: home.habit.dailyRitual.blockId ?? null });
    }, [home?.habit.dailyRitual.blockId, home?.habit.dailyRitual.shouldShow]);

    if (!home) {
        return (
            <section className="flex min-h-[100dvh] items-center justify-center px-6">
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-white/50">
                    Loading your next step...
                </div>
            </section>
        );
    }

    return (
        <section className="relative min-h-[100dvh] px-4 pb-12 pt-24 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1160px] flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm text-white/45">{greeting}, {userName || (language === "es" ? "vos" : "there")}.</p>
                        <h1 className="mt-2 text-[clamp(2.3rem,5vw,4.5rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-white/94">
                            {pausedSession ? copy.paused : nextBlock ? copy.next : copy.fallback}
                        </h1>
                        <p className="mt-3 max-w-[40rem] text-sm leading-7 text-white/48">
                            {pausedSession ? home.habit.nextBlock.context : (home.habit.nextBlock.context || copy.fallbackBody)}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onNext}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/72 transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                    >
                        <CalendarClock className="h-4 w-4" />
                        {copy.calendar}
                    </button>
                </div>

                {home.habit.dailyRitual.shouldShow && (
                    <div className="rounded-[28px] border border-cyan-300/15 bg-cyan-400/10 p-5">
                        <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white/92">{copy.ritual}</h2>
                        <p className="mt-2 max-w-[38rem] text-sm leading-7 text-white/60">{home.habit.dailyRitual.body}</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <button type="button" onClick={() => void confirmRitual()} className="inline-flex h-12 items-center justify-center gap-3 rounded-[18px] bg-gradient-to-r from-[#79c2ff] via-[#7dd3fc] to-[#6ee7b7] px-5 text-sm font-semibold text-slate-950">
                                <Flame className="h-4.5 w-4.5" />
                                {copy.ritualCta}
                            </button>
                            <button type="button" onClick={() => void skipRitual()} className="inline-flex h-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-5 text-sm text-white/70">
                                {copy.ritualSkip}
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
                    <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,24,0.96),rgba(6,8,16,0.96))] p-5 sm:p-7">
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">{language === "es" ? "Proximo bloque" : "Next block"}</p>
                            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white/92">
                                {pausedSession ? (session?.intention || copy.return) : (nextBlock?.title || copy.fallback)}
                            </h2>
                            <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/65">
                                {nextBlock && <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2">{nextBlock.startAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>}
                                {nextBlock && <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2">{durationMin(nextBlock)} min</span>}
                                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2">{home.habit.nextBlock.reason}</span>
                            </div>
                            <div className="mt-5 flex flex-wrap gap-3">
                                <button type="button" onClick={() => void startNext()} className="inline-flex h-13 items-center justify-center gap-3 rounded-[18px] bg-gradient-to-r from-[#79c2ff] via-[#7dd3fc] to-[#6ee7b7] px-5 text-sm font-semibold text-slate-950">
                                    <Zap className="h-4.5 w-4.5" />
                                    {pausedSession ? copy.return : copy.start}
                                </button>
                                <button type="button" onClick={() => nextBlock ? setSelectedBlockId(nextBlock.id) : onNext()} className="inline-flex h-13 items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white/78">
                                    <ArrowRight className="h-4 w-4" />
                                    {copy.prepare}
                                </button>
                                {nextBlock && <button type="button" onClick={() => void adjustBlock("move")} className="inline-flex h-13 items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white/78"><MoveRight className="h-4 w-4" />{copy.move}</button>}
                                {nextBlock && <button type="button" onClick={() => void adjustBlock("light")} className="inline-flex h-13 items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white/78"><TimerReset className="h-4 w-4" />{copy.light}</button>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">{copy.daily}</p>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-[20px] border border-white/10 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{copy.keyBlocks}</p><p className="mt-3 text-3xl font-semibold text-white/92">{home.habit.dayState.totalKeyBlocks}</p></div>
                                <div className="rounded-[20px] border border-white/10 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{copy.completed}</p><p className="mt-3 text-3xl font-semibold text-white/92">{home.habit.dayState.completedKeyBlocks}</p></div>
                            </div>
                            <p className="mt-4 text-sm leading-7 text-white/55">{home.habit.dayState.remainingLabel}</p>
                        </div>

                        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">{copy.weekly}</p>
                            <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white/92">{home.habit.weeklyConsistency.headline}</h3>
                            <p className="mt-2 text-sm leading-7 text-white/55">{home.habit.weeklyConsistency.body}</p>
                        </div>

                        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">{copy.calibration}</p>
                                    <p className="mt-2 text-sm leading-7 text-white/55">{home.summary.soft_recommendation}</p>
                                </div>
                                <Ring value={home.summary.profile_calibration_progress} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">{language === "es" ? "Rescate rapido" : "Quick rescue"}</p>
                            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white/92">{home.habit.rescuePlan?.headline || copy.rescue}</h3>
                            <p className="mt-2 max-w-[42rem] text-sm leading-7 text-white/55">{home.habit.rescuePlan?.tone || home.summary.main_insight}</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button type="button" onClick={() => void openRescue("lost_rhythm")} className="inline-flex h-13 items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white/78"><RotateCcw className="h-4 w-4" />{language === "es" ? "Perdi el ritmo" : "Lost the rhythm"}</button>
                            <button type="button" onClick={() => void openRescue("save_priority")} className="inline-flex h-13 items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white/78"><ShieldCheck className="h-4 w-4" />{language === "es" ? "Salvar una prioridad" : "Save a priority"}</button>
                        </div>
                    </div>
                    {showRescue && home.habit.rescuePlan && <div className="mt-5 grid gap-3">{home.habit.rescuePlan.suggestedActions.map((action) => <button key={`${action.blockId}:${action.type}`} type="button" onClick={() => void applyRescue(action)} className="flex items-center justify-between rounded-[22px] border border-white/10 bg-black/20 px-4 py-4 text-left transition-colors hover:border-white/20"><div><p className="text-sm font-semibold text-white/90">{action.title}</p><p className="mt-1 text-sm leading-7 text-white/50">{action.summary}</p></div><ChevronRight className="h-4 w-4 text-white/40" /></button>)}</div>}
                </div>
            </div>

            <HabitActivationSheet open={showOnboarding} onComplete={() => { setShowOnboarding(false); void loadHome(); }} />
            {selectedBlockId && <RadialBlockMenu blockId={selectedBlockId} onClose={() => { setSelectedBlockId(null); void loadHome(); }} />}
        </section>
    );
}
