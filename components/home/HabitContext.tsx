"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    ArrowRight,
    CalendarClock,
    ChevronRight,
    Flame,
    LoaderCircle,
    RotateCcw,
    Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { createClient, getClientUser } from "@/lib/supabase/client";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useFocusStore } from "@/lib/stores/focusStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { useI18n } from "@/lib/i18n/client";
import { getIntlLocale } from "@/lib/i18n/app";
import { enrichNewBlockWithPlanningMetadata } from "@/lib/utils/blockEnrichment";
import { fetchHabitHome, trackHabitEvent } from "@/lib/services/habitService";
import { recordBlockRescheduleActivity } from "@/lib/services/activityExperienceService";
import {
    applyPlannerProposalRequest,
    requestPlannerProposal,
    revisePlannerProposalRequest,
} from "@/lib/services/planningService";
import { sendNotification } from "@/lib/utils/notifications";
import { HabitActivationSheet } from "@/components/habit/HabitActivationSheet";
import { HabitCaptureCard } from "@/components/habit/HabitCaptureCard";
import { HabitPlanningProposalSheet } from "@/components/habit/HabitPlanningProposalSheet";
import { RadialBlockMenu } from "@/components/calendar/RadialBlockMenu";
import { GuidedPlanningSheet } from "@/components/planning/GuidedPlanningSheet";
import { humanizeBlockTitle } from "@/lib/engines/planner/heuristic";
import { buildHabitDayState, getNextRelevantBlock } from "@/lib/engines/habit/selectors";
import type { Block } from "@/lib/types/blocks";
import type { RescuePlanAction } from "@/lib/types/habit";
import type { PlannerProposal } from "@/lib/types/planner";

type HomeSnapshot = Awaited<ReturnType<typeof fetchHabitHome>>;
type PendingAction =
    | "capture-plan"
    | "start"
    | "prepare"
    | "move"
    | "light"
    | "ritual-confirm"
    | "ritual-skip"
    | "rescue-open"
    | `rescue-apply:${string}`
    | null;

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

function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function plannerTrackingIds(proposal?: PlannerProposal | null, decisionId?: string | null) {
    return {
        plannerSessionId: proposal?.sessionId ?? null,
        plannerProposalId: proposal?.proposalId ?? null,
        plannerDecisionId: decisionId ?? null,
    };
}

export function HabitContext({ onNext }: { onNext: () => void }) {
    const { language } = useI18n();
    const locale = getIntlLocale(language);
    const searchParams = useSearchParams();
    const blocks = useBlocksStore((state) => state.blocks);
    const createBlock = useBlocksStore((state) => state.createBlock);
    const fetchBlocks = useBlocksStore((state) => state.fetchBlocks);
    const updateBlock = useBlocksStore((state) => state.updateBlock);
    const { session, openFromBlock, openFree, returnToFocus } = useFocusStore();
    const { settings } = useSettingsStore();
    const [home, setHome] = useState<HomeSnapshot | null>(null);
    const [userName, setUserName] = useState("");
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [showRescue, setShowRescue] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [planningOpen, setPlanningOpen] = useState(false);
    const [plannerProposal, setPlannerProposal] = useState<PlannerProposal | null>(null);
    const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const trackedRef = useRef(false);

    const copy = language === "es"
        ? {
            greeting: ["Buen dia", "Buenas tardes", "Buenas noches"],
            next: "Tu proximo paso",
            paused: "Seguimos desde aca",
            fallback: "Empeza por esto",
            nextBlockLabel: "Tu proximo paso",
            start: "Empezar ahora",
            startLoading: "Abriendo foco...",
            return: "Volver al foco",
            prepare: "Preparar bloque",
            prepareLoading: "Abriendo bloque...",
            calendar: "Calendario",
            rescue: "Reordenemos rapido",
            rescueBody: "Salvamos lo importante.",
            ritual: "Esto es lo importante de hoy",
            ritualCta: "Confirmar y seguir",
            ritualCtaLoading: "Confirmando...",
            ritualSkip: "Omitir",
            ritualSkipLoading: "Cerrando...",
            weekly: "Ritmo",
            daily: "Hoy",
            fallbackBody: "Protege uno y empeza.",
            noBlocksToday: "Falta proteger el primero.",
            openRescue: "Abrir",
            timeFallback: "Ahora",
            captureTitle: "Contame que tenes hoy",
            captureHelper: "Texto o voz. Agendo lo ordena.",
            capturePlaceholder: "Ej: estudiar fisica 90 min, gym 19:00, mails 30 min",
            captureSubmit: "Planear con Agendo",
            captureSubmitLoading: "Armando tu dia...",
            captureVoice: "Voz",
            captureListening: "Escuchando",
            captureFeedbackSingle: "Listo. Deje 1 bloque.",
            captureFeedbackMany: (count: number) => `Listo. Deje ${count} bloques.`,
            openPlanning: "Abrir planning",
            summaryWeekDone: "Semana solida.",
            summaryWeekLeft: (days: number) => `Falta ${days} dia${days === 1 ? "" : "s"}.`,
            loading: "Cargando tu proximo paso...",
            capturePlanned: "Planea con Agendo",
        }
        : {
            greeting: ["Good morning", "Good afternoon", "Good evening"],
            next: "Your next step",
            paused: "We continue from here",
            fallback: "Start with this",
            nextBlockLabel: "Your next step",
            start: "Start now",
            startLoading: "Opening focus...",
            return: "Return to focus",
            prepare: "Prepare block",
            prepareLoading: "Opening block...",
            calendar: "Calendar",
            rescue: "Re-order quickly",
            rescueBody: "Save what matters.",
            ritual: "This is what matters today",
            ritualCta: "Confirm and continue",
            ritualCtaLoading: "Confirming...",
            ritualSkip: "Skip",
            ritualSkipLoading: "Closing...",
            weekly: "Rhythm",
            daily: "Today",
            fallbackBody: "Protect one and start.",
            noBlocksToday: "The first block is still open.",
            openRescue: "Open",
            timeFallback: "Now",
            captureTitle: "Tell me what you have today",
            captureHelper: "Text or voice. Agendo sorts it.",
            capturePlaceholder: "Ex: study physics 90 min, gym 7 pm, emails 30 min",
            captureSubmit: "Plan with Agendo",
            captureSubmitLoading: "Building your day...",
            captureVoice: "Voice",
            captureListening: "Listening",
            captureFeedbackSingle: "Done. I left 1 block ready.",
            captureFeedbackMany: (count: number) => `Done. I left ${count} blocks ready.`,
            openPlanning: "Open planning",
            summaryWeekDone: "Solid week.",
            summaryWeekLeft: (days: number) => `${days} more day${days === 1 ? "" : "s"}.`,
            loading: "Loading your next step...",
            capturePlanned: "Plan with Agendo",
        };

    const loadHome = useCallback(async () => {
        const data = await fetchHabitHome();
        setHome(data);
        setShowOnboarding(data.habit.onboarding.shouldShow);
        trackedRef.current = false;
    }, []);

    const withPending = useCallback(async (key: NonNullable<PendingAction>, action: () => Promise<void> | void) => {
        setPendingAction(key);
        try {
            await action();
        } finally {
            setPendingAction((current) => (current === key ? null : current));
        }
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
        void trackHabitEvent({ name: "planner_entry_seen", surface: "habit_home" });
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
                metadata: { type: home.habit.nextBlock.adaptiveRecommendation.type },
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
    const localNextRelevant = useMemo(() => getNextRelevantBlock({
        blocks,
        language,
    }), [blocks, language]);
    const displayedNext = useMemo(() => {
        if (!home) return localNextRelevant;

        const remoteBlockId = home.habit.nextBlock.block?.id ?? null;
        if (!remoteBlockId) {
            return localNextRelevant.block ? localNextRelevant : home.habit.nextBlock;
        }

        if (localNextRelevant.block && localNextRelevant.block.id !== remoteBlockId) {
            return localNextRelevant;
        }

        const resolvedRemoteBlock = blocks.find((item) => item.id === remoteBlockId) ?? home.habit.nextBlock.block;
        return {
            ...home.habit.nextBlock,
            block: resolvedRemoteBlock,
        };
    }, [blocks, home, localNextRelevant]);
    const nextBlock = displayedNext.block ? blocks.find((item) => item.id === displayedNext.block?.id) ?? displayedNext.block : null;
    const dayState = useMemo(() => buildHabitDayState(blocks, new Date(), language), [blocks, language]);

    useEffect(() => {
        if (!home) return;
        const today = getLocalDateKey();

        if (nextBlock && settings.notify_block_reminders) {
            const startsInMin = Math.round((nextBlock.startAt.getTime() - Date.now()) / 60000);
            const guardKey = `agendo:habit:block:${today}:${nextBlock.id}`;
            if (startsInMin >= 0 && startsInMin <= 20 && notificationGuard(guardKey) !== today) {
                setNotificationGuard(guardKey, today);
                void trackHabitEvent({ name: "notification_scheduled", surface: "habit_home", blockId: nextBlock.id, metadata: { type: "before_block" } });
                void sendNotification(language === "es" ? "Tu bloque esta listo" : "Your block is ready", {
                    body: displayedNext.context,
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
    }, [displayedNext.context, home, language, nextBlock, settings.notify_block_reminders, settings.notify_daily_briefing]);

    const startNext = useCallback(async () => {
        if (pausedSession) {
            returnToFocus();
            return;
        }
        if (nextBlock) {
            await trackHabitEvent({ name: "next_block_started_from_home", surface: "habit_home", blockId: nextBlock.id });
            await trackHabitEvent({ name: "next_step_started", surface: "habit_home", blockId: nextBlock.id });
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
    }, [createBlock, language, loadHome, nextBlock, openFree, openFromBlock, pausedSession, returnToFocus, searchParams]);

    const openBlockPreparation = useCallback(async () => {
        if (nextBlock) {
            setSelectedBlockId(nextBlock.id);
            return;
        }
        onNext();
    }, [nextBlock, onNext]);

    const handleOpenPlanning = useCallback(async () => {
        setPlanningOpen(true);
        await trackHabitEvent({ name: "guided_planning_opened", surface: "habit_home", metadata: { source: "capture_card" } });
    }, []);

    const handleCapturePlan = useCallback(async (input: string, source: "text" | "voice") => {
        await withPending("capture-plan", async () => {
            await trackHabitEvent({
                name: "planner_input_submitted",
                surface: "habit_home",
                metadata: { source, inputLength: input.length },
            });

            const now = new Date();
            const proposal = await requestPlannerProposal({
                input,
                source,
                surface: "habit_home",
                targetDate: getLocalDateKey(now),
                nowIso: now.toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });

            await trackHabitEvent({
                name: "planner_interpretation_completed",
                surface: "habit_home",
                ...plannerTrackingIds(proposal),
                metadata: {
                    source,
                    tasksDetected: proposal.interpretation.items.length,
                    totalDurationMin: proposal.totalDurationMin,
                    engine: proposal.engine,
                },
            });

            if (proposal.drafts.length === 0) {
                setPlanningOpen(true);
                await trackHabitEvent({
                    name: "guided_planning_opened",
                    surface: "habit_home",
                    ...plannerTrackingIds(proposal),
                    metadata: { source: "empty_capture" },
                });
                return;
            }

            await trackHabitEvent({
                name: "planner_proposal_shown",
                surface: "habit_home",
                ...plannerTrackingIds(proposal),
                metadata: {
                    source,
                    blocksProposed: proposal.drafts.length,
                    explicitTimesCount: proposal.explicitTimesCount,
                    engine: proposal.engine,
                },
            });

            setPlannerProposal(proposal);
        });
    }, [withPending]);

    const applyPlannerProposal = useCallback(async () => {
        if (!plannerProposal) return;

        await withPending("capture-plan", async () => {
            const result = await applyPlannerProposalRequest(plannerProposal);

            await trackHabitEvent({
                name: "planner_proposal_accepted",
                surface: "habit_home",
                blockId: result.createdBlockIds[0] ?? null,
                ...plannerTrackingIds(plannerProposal, result.acceptedDecisionId),
                metadata: {
                    blocksCreated: result.totalCreated,
                    engine: plannerProposal.engine,
                },
            });
            await trackHabitEvent({
                name: "planner_plan_applied",
                surface: "habit_home",
                blockId: result.createdBlockIds[0] ?? null,
                ...plannerTrackingIds(plannerProposal, result.appliedDecisionId),
                metadata: {
                    blocksCreated: result.totalCreated,
                    engine: plannerProposal.engine,
                },
            });

            setPlannerProposal(null);
            await fetchBlocks();
            await loadHome();

            if (result.totalCreated > 0) {
                setCaptureFeedback(
                    result.totalCreated <= 1
                        ? copy.captureFeedbackSingle
                        : copy.captureFeedbackMany(result.totalCreated),
                );
                window.setTimeout(() => setCaptureFeedback(null), 5000);
            }

            if (result.guidedPlanningRecommended) {
                setPlanningOpen(true);
                await trackHabitEvent({
                    name: "guided_planning_opened",
                    surface: "habit_home",
                    ...plannerTrackingIds(plannerProposal, result.appliedDecisionId),
                    metadata: { source: "planner_applied" },
                });
            }
        });
    }, [copy.captureFeedbackMany, copy.captureFeedbackSingle, fetchBlocks, loadHome, plannerProposal, withPending]);

    const lightenCurrentPlannerProposal = useCallback(async () => {
        if (!plannerProposal) return;
        const result = await revisePlannerProposalRequest({
            sessionId: plannerProposal.sessionId,
            proposalId: plannerProposal.proposalId,
            action: "lighten",
            targetDate: plannerProposal.targetDate,
            timezone: plannerProposal.context.timezone,
            nowIso: new Date().toISOString(),
        });
        if (result.proposal) {
            setPlannerProposal(result.proposal);
        }
        await trackHabitEvent({
            name: "planner_proposal_lightened",
            surface: "habit_home",
            ...plannerTrackingIds(result.proposal ?? plannerProposal, result.decisionId),
            metadata: { blocksProposed: (result.proposal ?? plannerProposal).drafts.length },
        });
    }, [plannerProposal]);

    const regenerateCurrentPlannerProposal = useCallback(async () => {
        if (!plannerProposal) return;
        const result = await revisePlannerProposalRequest({
            sessionId: plannerProposal.sessionId,
            proposalId: plannerProposal.proposalId,
            action: "regenerate",
            targetDate: plannerProposal.targetDate,
            timezone: plannerProposal.context.timezone,
            nowIso: new Date().toISOString(),
        });
        if (result.proposal) {
            setPlannerProposal(result.proposal);
        }
        await trackHabitEvent({
            name: "planner_proposal_regenerated",
            surface: "habit_home",
            ...plannerTrackingIds(result.proposal ?? plannerProposal, result.decisionId),
            metadata: { blocksProposed: (result.proposal ?? plannerProposal).drafts.length },
        });
    }, [plannerProposal]);

    const editPlannerProposal = useCallback(async (index: number, mode: "earlier" | "later" | "shorter") => {
        if (!plannerProposal) return;
        const result = await revisePlannerProposalRequest({
            sessionId: plannerProposal.sessionId,
            proposalId: plannerProposal.proposalId,
            action: "edit",
            draftIndex: index,
            editMode: mode,
            targetDate: plannerProposal.targetDate,
            timezone: plannerProposal.context.timezone,
            nowIso: new Date().toISOString(),
        });
        if (result.proposal) {
            setPlannerProposal(result.proposal);
        }
        await trackHabitEvent({
            name: "planner_proposal_edited",
            surface: "habit_home",
            ...plannerTrackingIds(result.proposal ?? plannerProposal, result.decisionId),
            metadata: { index, mode },
        });
    }, [plannerProposal]);

    const closePlannerProposal = useCallback(async () => {
        if (!plannerProposal) return;
        const result = await revisePlannerProposalRequest({
            sessionId: plannerProposal.sessionId,
            proposalId: plannerProposal.proposalId,
            action: "reject",
            targetDate: plannerProposal.targetDate,
            timezone: plannerProposal.context.timezone,
            nowIso: new Date().toISOString(),
        });
        await trackHabitEvent({
            name: "planner_proposal_rejected",
            surface: "habit_home",
            ...plannerTrackingIds(plannerProposal, result.decisionId),
            metadata: {
                reason: "dismissed_sheet",
            },
        });
        setPlannerProposal(null);
    }, [plannerProposal]);

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
        await trackHabitEvent({
            name: "rescue_applied",
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
                    {copy.loading}
                </div>
            </section>
        );
    }

    const nextBlockTitle = humanizeBlockTitle(pausedSession ? (session?.intention || copy.return) : (nextBlock?.title || copy.fallback));
    const nextBlockTime = nextBlock
        ? nextBlock.startAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
        : copy.timeFallback;
    const nextBlockDuration = `${displayedNext.suggestedDurationMin ?? (nextBlock ? durationMin(nextBlock) : 30)} min`;
    const isBusy = pendingAction !== null;
    const dayPrimaryValue = dayState.totalKeyBlocks > 0 ? `${dayState.completedKeyBlocks}/${dayState.totalKeyBlocks}` : "0";
    const daySecondaryLine = dayState.totalKeyBlocks > 0
        ? dayState.remainingLabel
        : copy.noBlocksToday;
    const weeklyValue = language === "es"
        ? `${home.habit.weeklyConsistency.meaningfulDays} de 7 dias`
        : `${home.habit.weeklyConsistency.meaningfulDays} of 7 days`;
    const daysToTarget = Math.max(0, 3 - home.habit.weeklyConsistency.meaningfulDays);
    const weeklyLine = daysToTarget === 0
        ? copy.summaryWeekDone
        : copy.summaryWeekLeft(daysToTarget);
    const visibleRescueActions = home.habit.rescuePlan?.suggestedActions.slice(0, 2) ?? [];

    return (
        <section className="relative min-h-[100dvh] px-4 pb-8 pt-16 sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-x-0 top-10 z-0 mx-auto h-[66vh] max-w-[1180px] rounded-[40px] bg-[radial-gradient(circle_at_top,rgba(15,18,30,0.7),rgba(7,10,18,0.18)_42%,transparent_70%)] blur-2xl" />

            <div className="relative z-10 mx-auto flex max-w-[1120px] flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="text-sm text-white/42">{greeting}, {userName || (language === "es" ? "vos" : "there")}.</p>
                    <ActionButton label={copy.calendar} icon={CalendarClock} onClick={onNext} variant="ghost" compact />
                </div>

                <HabitCaptureCard
                    badgeLabel={copy.capturePlanned}
                    title={copy.captureTitle}
                    helper={copy.captureHelper}
                    placeholder={copy.capturePlaceholder}
                    submitLabel={copy.captureSubmit}
                    submitLoadingLabel={copy.captureSubmitLoading}
                    voiceLabel={copy.captureVoice}
                    voiceListeningLabel={copy.captureListening}
                    onSubmit={handleCapturePlan}
                    onTextStart={() => {
                        void trackHabitEvent({ name: "planner_text_started", surface: "habit_home" });
                    }}
                    onVoiceStart={() => {
                        void trackHabitEvent({ name: "planner_voice_started", surface: "habit_home" });
                    }}
                    onVoiceStop={() => {
                        void trackHabitEvent({ name: "planner_voice_stopped", surface: "habit_home" });
                    }}
                    loading={pendingAction === "capture-plan"}
                    disabled={isBusy && pendingAction !== "capture-plan"}
                    feedback={captureFeedback}
                    openPlanningLabel={copy.openPlanning}
                    onOpenPlanning={() => {
                        void handleOpenPlanning();
                    }}
                />

                {home.habit.dailyRitual.shouldShow && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-cyan-300/16 bg-cyan-400/8 px-4 py-3 backdrop-blur-md">
                        <span className="text-sm font-medium text-cyan-50/86">{copy.ritual}</span>
                        <div className="flex flex-wrap gap-2">
                            <ActionButton
                                label={pendingAction === "ritual-confirm" ? copy.ritualCtaLoading : copy.ritualCta}
                                icon={Flame}
                                loading={pendingAction === "ritual-confirm"}
                                disabled={isBusy}
                                onClick={() => void withPending("ritual-confirm", confirmRitual)}
                                variant="primary"
                                compact
                            />
                            <ActionButton
                                label={pendingAction === "ritual-skip" ? copy.ritualSkipLoading : copy.ritualSkip}
                                icon={ArrowRight}
                                loading={pendingAction === "ritual-skip"}
                                disabled={isBusy}
                                onClick={() => void withPending("ritual-skip", skipRitual)}
                                variant="ghost"
                                compact
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,12,22,0.94),rgba(10,14,26,0.88))] p-5 shadow-[0_34px_120px_-64px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-7">
                        <div className="pointer-events-none absolute -right-24 top-0 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.16),transparent_72%)] blur-3xl" />
                        <div className="pointer-events-none absolute left-8 top-8 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(110,231,183,0.1),transparent_72%)] blur-2xl" />

                        <div className="relative flex min-h-[260px] flex-col justify-between gap-8">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/34">{copy.nextBlockLabel}</p>
                                <h1 className="mt-4 max-w-[16ch] text-[clamp(2.45rem,4.4vw,4.35rem)] font-semibold leading-[0.9] tracking-[-0.06em] text-white/97">
                                    {nextBlockTitle}
                                </h1>
                                <p className="mt-3 max-w-[32rem] text-sm text-white/56">{displayedNext.context}</p>
                            </div>

                            <div>
                                <div className="flex flex-wrap gap-2.5">
                                    <DetailPill label={nextBlockTime} />
                                    <DetailPill label={nextBlockDuration} />
                                </div>
                                <div className="mt-6 flex flex-wrap items-center gap-3">
                                    <ActionButton
                                        label={pendingAction === "start" ? copy.startLoading : (pausedSession ? copy.return : copy.start)}
                                        icon={Zap}
                                        loading={pendingAction === "start"}
                                        disabled={isBusy}
                                        onClick={() => void withPending("start", startNext)}
                                        variant="primary"
                                        emphasis
                                    />
                                    <InlineAction
                                        label={pendingAction === "prepare" ? copy.prepareLoading : copy.prepare}
                                        icon={ArrowRight}
                                        onClick={() => void withPending("prepare", openBlockPreparation)}
                                        loading={pendingAction === "prepare"}
                                        disabled={isBusy}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(155deg,rgba(17,12,30,0.84),rgba(10,12,24,0.78))] px-4 py-4 shadow-[0_28px_90px_-70px_rgba(168,85,247,0.45)] backdrop-blur-xl sm:px-5">
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.14),transparent_72%)] blur-3xl" />
                        <div className="relative flex flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/34">{copy.rescue}</p>
                                    <p className="mt-1 text-sm text-white/56">{copy.rescueBody}</p>
                                </div>

                                <ActionButton
                                    label={copy.openRescue}
                                    icon={RotateCcw}
                                    onClick={() => void withPending("rescue-open", () => openRescue("hero_rescue"))}
                                    loading={pendingAction === "rescue-open"}
                                    disabled={isBusy}
                                    variant={showRescue ? "secondary" : "ghost"}
                                    pressed={showRescue}
                                    compact
                                />
                            </div>

                            {showRescue && visibleRescueActions.length > 0 && (
                                <div className="grid gap-2 border-t border-white/10 pt-3">
                                    {visibleRescueActions.map((action) => {
                                        const actionKey = `rescue-apply:${action.blockId}:${action.type}` as const;
                                        return (
                                            <button
                                                key={`${action.blockId}:${action.type}`}
                                                type="button"
                                                onClick={() => void withPending(actionKey, () => applyRescue(action))}
                                                disabled={isBusy}
                                                className={cn(
                                                    "group flex cursor-pointer items-center justify-between gap-4 rounded-[18px] border border-white/10 bg-black/18 px-4 py-3 text-left transition-all duration-200",
                                                    "hover:border-white/18 hover:bg-white/[0.05]",
                                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f1a]",
                                                    "active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60",
                                                )}
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-white/92">{action.title}</p>
                                                    <p className="truncate text-sm text-white/52">{action.summary}</p>
                                                </div>
                                                {pendingAction === actionKey ? (
                                                    <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-white/72" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white/68" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <SummaryStrip
                        items={[
                            { label: copy.daily, value: dayPrimaryValue, detail: daySecondaryLine },
                            { label: copy.weekly, value: weeklyValue, detail: weeklyLine },
                        ]}
                    />
                </div>
            </div>

            <HabitActivationSheet open={showOnboarding} onComplete={() => { setShowOnboarding(false); void loadHome(); }} />
            <HabitPlanningProposalSheet
                open={Boolean(plannerProposal)}
                proposal={plannerProposal}
                busy={pendingAction === "capture-plan"}
                onClose={() => { void withPending("capture-plan", closePlannerProposal); }}
                onAccept={() => { void applyPlannerProposal(); }}
                onLighten={() => { void lightenCurrentPlannerProposal(); }}
                onRegenerate={() => { void regenerateCurrentPlannerProposal(); }}
                onAdjust={(index, mode) => { void editPlannerProposal(index, mode); }}
            />
            <GuidedPlanningSheet open={planningOpen} onOpenChange={setPlanningOpen} date={getLocalDateKey()} />
            {selectedBlockId && <RadialBlockMenu blockId={selectedBlockId} onClose={() => { setSelectedBlockId(null); void loadHome(); }} />}
        </section>
    );
}

function ActionButton({
    label,
    icon: Icon,
    onClick,
    variant = "secondary",
    loading = false,
    disabled = false,
    pressed = false,
    emphasis = false,
    compact = false,
}: {
    label: string;
    icon: typeof CalendarClock;
    onClick: () => void;
    variant?: "primary" | "secondary" | "ghost";
    loading?: boolean;
    disabled?: boolean;
    pressed?: boolean;
    emphasis?: boolean;
    compact?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={pressed || undefined}
            className={cn(
                "group inline-flex cursor-pointer items-center justify-center gap-3 rounded-[18px] border px-4 text-sm font-medium transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16]",
                "active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60",
                emphasis && "min-w-[176px]",
                compact ? "h-10 px-3.5 text-[0.92rem]" : "h-12",
                variant === "primary" && [
                    "border-transparent bg-gradient-to-r from-[#79c2ff] via-[#7dd3fc] to-[#6ee7b7] text-slate-950 shadow-[0_22px_50px_-30px_rgba(125,211,252,0.7)]",
                    "hover:-translate-y-[1px] hover:shadow-[0_28px_58px_-28px_rgba(125,211,252,0.82)]",
                ],
                variant === "secondary" && [
                    "border-white/12 bg-white/[0.045] text-white/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                    "hover:border-white/22 hover:bg-white/[0.08] hover:text-white",
                    pressed && "border-cyan-300/22 bg-cyan-400/10 text-white",
                ],
                variant === "ghost" && [
                    "border-white/10 bg-black/18 text-white/74 backdrop-blur-md",
                    "hover:border-white/18 hover:bg-white/[0.06] hover:text-white",
                    pressed && "border-cyan-300/20 bg-cyan-400/10 text-white",
                ],
            )}
        >
            {loading ? (
                <LoaderCircle className="h-4.5 w-4.5 animate-spin" />
            ) : (
                <Icon className="h-4.5 w-4.5 transition-transform duration-200 group-hover:translate-x-[1px]" />
            )}
            <span className="tracking-[-0.02em]">{label}</span>
        </button>
    );
}

function InlineAction({
    label,
    icon: Icon,
    onClick,
    loading = false,
    disabled = false,
    pressed = false,
    compact = false,
}: {
    label: string;
    icon: typeof CalendarClock;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
    pressed?: boolean;
    compact?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={pressed || undefined}
            className={cn(
                "group inline-flex cursor-pointer items-center gap-2 rounded-full border text-white/74 transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16]",
                "active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60",
                compact ? "h-9 px-3 text-[0.9rem]" : "h-10 px-3.5 text-sm",
                pressed
                    ? "border-cyan-300/18 bg-cyan-400/10 text-white"
                    : "border-white/10 bg-black/18 hover:border-white/18 hover:bg-white/[0.06] hover:text-white",
            )}
        >
            {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Icon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-[1px]" />
            )}
            <span className="tracking-[-0.02em]">{label}</span>
        </button>
    );
}

function DetailPill({ label, subtle = false }: { label: string; subtle?: boolean }) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border px-3 py-2 text-sm",
                subtle
                    ? "border-white/8 bg-white/[0.05] text-white/72"
                    : "border-white/10 bg-black/20 text-white/68",
            )}
        >
            {label}
        </span>
    );
}

function SummaryStrip({
    items,
}: {
    items: Array<{ label: string; value: string; detail: string }>;
}) {
    return (
        <div className="rounded-[24px] border border-white/10 bg-black/18 px-4 py-3 shadow-[0_20px_70px_-60px_rgba(0,0,0,0.85)] backdrop-blur-xl">
            <div className="grid gap-3 md:grid-cols-2">
                {items.map((item) => (
                    <div key={item.label} className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">{item.label}</p>
                        <p className="text-lg font-semibold tracking-[-0.03em] text-white/94">{item.value}</p>
                        <p className="text-sm text-white/54">{item.detail}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
