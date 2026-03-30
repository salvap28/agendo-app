"use client";

import React from 'react';
import { Pause, Play, X, CheckSquare } from 'lucide-react';
import { useFocusStore } from '@/lib/stores/focusStore';
import { useBlocksStore } from '@/lib/stores/blocksStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useFocusTimer } from '@/hooks/useFocusTimer';
import { useStudyCountdown } from '@/hooks/useStudyCountdown';
import { buildFocusContext } from '@/lib/engines/focusContext';
import { evaluateFocusContext, shouldOfferClosureBridgeOnFinish } from '@/lib/engines/cardsEngine';
import { createAttentionAidLayer, createStudyLayer } from '@/lib/engines/layersEngine';
import { isEntryRitualBlockingRuntime } from '@/lib/engines/focusEntryRitual';
import { requestNotificationPermission } from '@/lib/utils/notifications';
import { FocusCard as FocusCardType } from '@/lib/types/focus';
import type { BlockType } from '@/lib/types/blocks';
import { FocusWaveBackground } from './FocusWaveBackground';
import { ReflectionSheet } from './ReflectionSheet';
import { GymTrackerPanel } from './GymTrackerPanel';
import { RestSelector } from './RestSelector';
import { FocusCardsCarousel } from './FocusCardsCarousel';
import { TechniquePickerCard } from './TechniquePickerCard';
import { IntentInputOverlay } from './IntentInputOverlay';
import { FocusInterventionModal } from './FocusInterventionModal';
import { FocusEntryRitual } from './FocusEntryRitual';
import { GlassButton } from '@/components/ui/glass-button';
import { useFocusNow } from '@/hooks/useFocusNow';
import { useFocusRuntimeSignals } from '@/hooks/useFocusRuntimeSignals';
import { useI18n } from "@/lib/i18n/client";
import { getBlockTypeLabel } from "@/lib/i18n/app";
import { getFocusOverlayCopy } from "@/lib/i18n/ui";

type RuntimeToast = FocusCardType & { source: "engine" | "system" };
const CARD_FOREGROUND_EXPOSURE_MS = 900;

function createSystemToast(id: string, title: string, description?: string): RuntimeToast {
    return {
        id,
        type: "reactive",
        title,
        description,
        isToast: true,
        priority: 200,
        source: "system",
    };
}

function ModeBadge({ type, language }: { type?: BlockType | "free"; language: "en" | "es" }) {
    const label = getBlockTypeLabel(language, type === "free" ? "free" : (type ?? "other"));
    return (
        <div
            className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 backdrop-blur-sm"
            style={{ background: "rgba(255,255,255,0.06)" }}
        >
            <span className="text-xs font-medium uppercase tracking-widest text-white/60">
                {label}
            </span>
        </div>
    );
}

function getLayerLabel(
    session: NonNullable<ReturnType<typeof useFocusStore.getState>["session"]>,
    copy: ReturnType<typeof getFocusOverlayCopy>,
) {
    if (!session.activeLayer) return null;
    if (session.activeLayer.kind === "studyTechnique") {
        if (session.activeLayer.id === "study_50_10") return copy.layerLabels.study5010;
        if (session.activeLayer.id === "custom_pomodoro") return copy.layerLabels.custom_pomodoro;
        if (session.activeLayer.id === "active_recall") return "Active Recall";
        return copy.layerLabels.pomodoro;
    }
    if (session.activeLayer.kind === "gymMode") {
        return copy.layerLabels.gymMode;
    }
    if (session.activeLayer.id === "micro_commit_layer") {
        return copy.layerLabels.microCommit;
    }
    if (session.activeLayer.id === "focus_protection_layer") {
        return copy.layerLabels.focusProtection;
    }
    return copy.layerLabels.activeIntervention;
}

function getAttentionAidRemaining(session: NonNullable<ReturnType<typeof useFocusStore.getState>["session"]>, now: number) {
    if (session.activeLayer?.kind !== "attentionAid" || !session.activeLayer.config) return null;

    const config = session.activeLayer.config as { startedAt?: string; durationSec?: number };
    if (!config.startedAt || !config.durationSec) return null;

    const effectiveNow = session.isPaused && session.pausedAt
        ? new Date(session.pausedAt).getTime()
        : now;
    const startedAt = new Date(config.startedAt).getTime();
    const remainingSec = Math.max(0, config.durationSec - Math.floor((effectiveNow - startedAt) / 1000));
    const minutes = Math.floor(remainingSec / 60).toString().padStart(2, '0');
    const seconds = (remainingSec % 60).toString().padStart(2, '0');

    return {
        remainingSec,
        formatted: `${minutes}:${seconds}`,
    };
}

export function FocusOverlay() {
    const { language } = useI18n();
    const {
        session,
        lastSession,
        pause,
        resume,
        exit,
        finish,
        setLayer,
        addToHistory,
        setSessionIntention,
        setSessionNextStep,
        activateGymTracker,
        extendBlock,
        openIntervention,
        recordIntervention,
        recordSessionInteraction,
        recordInactivityDetected,
        recordStabilityRecovered,
        markClosureBridgeShown,
        markCardShown,
        recordCardOutcome,
    } = useFocusStore();
    const { blocks, updateBlock } = useBlocksStore();
    const { settings } = useSettingsStore();
    const isEntryRitualActive = isEntryRitualBlockingRuntime(session);

    const now = useFocusNow({
        isRunning: Boolean(session && session.isActive && !session.endedAt && !session.isPaused && !isEntryRitualActive),
        frozenAt: session?.endedAt
            ? new Date(session.endedAt).getTime()
            : session?.isPaused && session.pausedAt
                ? new Date(session.pausedAt).getTime()
                : null,
        stepMs: 1000,
    });
    const { formatted: countUpFormatted } = useFocusTimer(session, now);
    const { countdownFormatted, currentPhase } = useStudyCountdown(now);

    const [showPicker, setShowPicker] = React.useState(() => {
        return session?.entryRitual?.selectedStartMode === "study_technique" && !session.activeLayer;
    });
    const [showIntentInput, setShowIntentInput] = React.useState(false);
    const [isIntentCompletion, setIsIntentCompletion] = React.useState(false);
    const [intentInputField, setIntentInputField] = React.useState<"intention" | "nextStep">("intention");
    const [systemToast, setSystemToast] = React.useState<RuntimeToast | null>(null);
    const [exitGuardArmed, setExitGuardArmed] = React.useState(false);
    const [activeCarouselCardId, setActiveCarouselCardId] = React.useState<string | null>(null);
    const [activeEngineToastId, setActiveEngineToastId] = React.useState<string | null>(null);
    const copy = React.useMemo(() => getFocusOverlayCopy(language), [language]);

    React.useEffect(() => {
        requestNotificationPermission();
    }, []);

    const context = React.useMemo(() => {
        if (!session || isEntryRitualActive) return null;

        return buildFocusContext({
            session,
            blocks,
            defaultFocusMinutes: settings.focus_default_minutes,
            lastSession,
            now,
        });
    }, [blocks, isEntryRitualActive, lastSession, now, session, settings.focus_default_minutes]);

    const engineResult = React.useMemo(() => (
        context
            ? evaluateFocusContext(context, language)
            : { visibleCards: [], toastCards: [], suggestedLayers: [], sessionState: null }
    ), [context, language]);

    const isMicroCommitActive = session?.activeLayer?.kind === "attentionAid" && session.activeLayer.id === "micro_commit_layer";
    const isFocusProtectionActive = session?.activeLayer?.kind === "attentionAid" && session.activeLayer.id === "focus_protection_layer";
    const isAttentionAidActive = isMicroCommitActive || isFocusProtectionActive;
    const attentionAidTimer = session ? getAttentionAidRemaining(session, now) : null;

    React.useEffect(() => {
        if (!isMicroCommitActive || !session || !attentionAidTimer || attentionAidTimer.remainingSec > 0) return;

        setLayer(null);
        addToHistory(copy.microCommitCompleted);
        recordIntervention({
            type: "micro_commit_layer",
            sourceCard: "card_micro_commit",
            actionTaken: "complete",
            result: "completed",
        });
        setSystemToast(createSystemToast(
            "system_micro_commit_complete",
            copy.startedTitle,
            copy.startedBody,
        ));
    }, [addToHistory, attentionAidTimer, copy.microCommitCompleted, copy.startedBody, copy.startedTitle, isMicroCommitActive, recordIntervention, session, setLayer]);

    React.useEffect(() => {
        if (!systemToast) return;
        const timeout = window.setTimeout(() => setSystemToast(null), 2400);
        return () => window.clearTimeout(timeout);
    }, [systemToast]);

    React.useEffect(() => {
        if (!exitGuardArmed) return;
        const timeout = window.setTimeout(() => setExitGuardArmed(false), 1800);
        return () => window.clearTimeout(timeout);
    }, [exitGuardArmed]);

    useFocusRuntimeSignals({
        session,
        isEntryRitualActive,
        activeCarouselCardId,
        activeEngineToastId,
        toastCards: engineResult.toastCards,
        foregroundExposureMs: CARD_FOREGROUND_EXPOSURE_MS,
        setActiveEngineToastId,
        markCardShown,
        recordSessionInteraction,
        recordInactivityDetected,
        recordStabilityRecovered,
    });

    if (!session || (!session.isActive && !session.endedAt)) return null;

    const formatted = attentionAidTimer?.formatted || countdownFormatted || countUpFormatted;
    const formattedChars = formatted.split('');
    const engineToast = activeEngineToastId
        ? engineResult.toastCards.find((toast) => toast.id === activeEngineToastId)
        : null;
    const resolvedEngineToast = engineToast
        ? { ...engineToast, source: "engine" as const }
        : null;
    const activeToast = systemToast || resolvedEngineToast;

    const openIntentEditor = (isCompletion = false, field: "intention" | "nextStep" = "intention") => {
        setIsIntentCompletion(isCompletion);
        setIntentInputField(field);
        setShowIntentInput(true);
    };

    const handleDismissToast = (toast: RuntimeToast) => {
        if (toast.source === "system") {
            setSystemToast(null);
            return;
        }

        recordCardOutcome(toast.id, "dismissed", now);
        setActiveEngineToastId(null);
        recordIntervention({
            type: toast.id,
            sourceToast: toast.id,
            actionTaken: "dismiss",
            result: "dismissed",
        });
    };

    const handleRuntimeAction = (source: "card" | "toast", card: FocusCardType, action: NonNullable<FocusCardType["action"]>) => {
        const interventionSource = source === "toast"
            ? { sourceToast: card.id, trigger: "toast_action" as const }
            : { sourceCard: card.id, trigger: "card_action" as const };
        const interventionPayload = {
            intention: session.intention || null,
            nextStep: session.nextStep || null,
            minimumViable: session.minimumViable || null,
        };

        switch (action.type) {
            case "externalLink":
                if (action.payload?.url) {
                    recordCardOutcome(card.id, "accepted", now);
                    window.open(String(action.payload.url), "_blank");
                    recordIntervention({
                        type: card.id,
                        ...interventionSource,
                        actionTaken: "open_external_link",
                        result: "opened",
                        payload: action.payload,
                    });
                }
                break;

            case "layer":
                if (action.payload?.showPicker) {
                    recordCardOutcome(card.id, "accepted", now);
                    setShowPicker(true);
                    recordIntervention({
                        type: card.id,
                        ...interventionSource,
                        actionTaken: "open_picker",
                        result: "picker_opened",
                    });
                } else if (action.payload?.layerId === 'gym_set_tracker') {
                    recordCardOutcome(card.id, "accepted", now);
                    activateGymTracker();
                    recordIntervention({
                        type: card.id,
                        ...interventionSource,
                        actionTaken: "activate_gym_tracker",
                        result: "layer_started",
                    });
                } else if (action.payload?.layerId === 'micro_commit_layer' || action.payload?.layerId === 'focus_protection_layer') {
                    recordCardOutcome(card.id, "accepted", now);
                    const layerId = String(action.payload.layerId) as "micro_commit_layer" | "focus_protection_layer";
                    setLayer(createAttentionAidLayer(layerId));
                    addToHistory(copy.attentionAidEnabled(layerId));
                    recordIntervention({
                        type: layerId,
                        ...interventionSource,
                        actionTaken: "activate_layer",
                        result: "layer_started",
                    });
                } else if (action.payload?.layerId === 'active_recall') {
                    recordCardOutcome(card.id, "accepted", now);
                    setLayer(createStudyLayer('active_recall'));
                    addToHistory(copy.activeRecallOpened);
                    recordIntervention({
                        type: "active_recall",
                        ...interventionSource,
                        actionTaken: "activate_layer",
                        result: "layer_started",
                    });
                }
                break;

            case "setIntent":
                recordCardOutcome(card.id, "accepted", now);
                openIntentEditor(false);
                recordIntervention({
                    type: card.id,
                    ...interventionSource,
                    actionTaken: "open_intent_editor",
                    result: "intent_editor_opened",
                });
                break;

            case "resolve":
                if (action.payload?.action === "dismiss") {
                    if (source === "toast") {
                        handleDismissToast({ ...card, source: "engine" });
                    } else {
                        recordCardOutcome(card.id, "dismissed", now);
                    }
                }
                break;

            case "custom":
                if (action.payload?.action === "extend") {
                    recordCardOutcome(card.id, "accepted", now);
                    extendBlock(5);
                    if (session.blockId) {
                        const block = blocks.find((item) => item.id === session.blockId);
                        if (block) {
                            const newEnd = new Date(block.endAt.getTime() + 5 * 60000);
                            updateBlock(block.id, { endAt: newEnd });
                        }
                    }
                    recordIntervention({
                        type: card.id,
                        ...interventionSource,
                        actionTaken: "extend_5_minutes",
                        result: "extended",
                    });
                } else if (action.payload?.action === "finish") {
                    recordCardOutcome(card.id, "accepted", now);
                    recordIntervention({
                        type: card.id,
                        ...interventionSource,
                        actionTaken: "finish",
                        result: "session_finishing",
                    });
                    handleFinishPress();
                } else if (action.payload?.action === "restorePreviousIntent") {
                    const previousIntention = String(action.payload?.intention || "").trim();
                    const previousNextStep = String(action.payload?.nextStep || "").trim();
                    if (previousIntention || previousNextStep) {
                        recordCardOutcome(card.id, "accepted", now);
                        if (previousIntention) {
                            setSessionIntention(previousIntention);
                        }
                        if (previousNextStep) {
                            setSessionNextStep(previousNextStep);
                        }
                addToHistory(copy.previousRestored);
                        recordIntervention({
                            type: card.id,
                            ...interventionSource,
                            actionTaken: "restore_previous_intent",
                            result: "intention_restored",
                            payload: { intention: previousIntention, nextStep: previousNextStep || null },
                        });
                    }
                } else if (action.payload?.action === "reduceScopeFlow") {
                    openIntervention("reduce_scope", {
                        payload: interventionPayload,
                        ...interventionSource,
                    });
                } else if (action.payload?.action === "resetClarityFlow") {
                    openIntervention("reset_clarity", {
                        payload: interventionPayload,
                        ...interventionSource,
                    });
                } else if (action.payload?.action === "refocusPrompt") {
                    openIntervention("refocus_prompt", {
                        payload: interventionPayload,
                        ...interventionSource,
                    });
                } else if (action.payload?.action === "progressQuickCheck") {
                    openIntervention("progress_check", {
                        payload: interventionPayload,
                        ...interventionSource,
                    });
                } else if (action.payload?.action === "openNextStepEditor") {
                    recordCardOutcome(card.id, "accepted", now);
                    openIntentEditor(false, "nextStep");
                    recordIntervention({
                        type: card.id,
                        ...interventionSource,
                        actionTaken: "open_next_step_editor",
                        result: "next_step_editor_opened",
                    });
                } else if (action.payload?.action === "completeClosureBridge") {
                    recordCardOutcome(card.id, "accepted", now);
                    addToHistory(copy.closureBridgeAcknowledged);
                    recordIntervention({
                        type: card.id,
                        ...interventionSource,
                        actionTaken: "acknowledge",
                        result: "closure_bridge_acknowledged",
                    });
                } else if (action.payload?.action === "openClosureBridge") {
                    recordCardOutcome(card.id, "accepted", now);
                    openIntervention("closure_bridge", {
                        payload: {
                            closureNote: session.closureNote?.text ?? "",
                        },
                        ...interventionSource,
                    });
                }
                break;

            default:
                break;
        }
    };

    const handleExit = () => {
        if (isFocusProtectionActive && !exitGuardArmed) {
            setExitGuardArmed(true);
            setSystemToast(createSystemToast(
                "system_focus_protection",
                copy.focusProtectionActive,
                language === "es" ? "Presiona otra vez si igual quieres salir." : "Press again if you still want to leave."
            ));
            return;
        }

        setExitGuardArmed(false);
        exit();
    };

    const handleFinishPress = () => {
        if (context && engineResult.sessionState && shouldOfferClosureBridgeOnFinish(context, engineResult.sessionState)) {
            markClosureBridgeShown();
            openIntervention("closure_bridge", {
                payload: {
                    closureNote: session.closureNote?.text ?? "",
                },
                sourceCard: "card_closure_bridge",
                trigger: "manual_finish",
            });
            return;
        }

        finish();
    };

    if (isEntryRitualActive) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col overflow-hidden text-white animate-in fade-in zoom-in-[0.98] duration-1000 ease-out" style={{ background: "#000" }}>
                <FocusWaveBackground mode={session.blockType === "gym" ? "gym" : "default"} />

                <div className="relative z-10 flex shrink-0 items-start justify-between px-4 pb-0 pt-6 sm:px-8 sm:pt-8">
                    <div className="flex flex-col gap-2">
                <ModeBadge type={session.blockType} language={language} />
                    </div>

                    <button
                        onClick={handleExit}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10"
                    >
                        <X className="h-4 w-4 text-white/60" />
                    </button>
                </div>

                <div className="relative z-10 flex min-h-0 flex-1 overflow-y-auto">
                    <FocusEntryRitual />
                </div>

                <FocusInterventionModal
                    onOpenIntentInput={(field = "intention") => openIntentEditor(false, field)}
                />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden text-white animate-in fade-in zoom-in-[0.98] duration-1000 ease-out" style={{ background: "#000" }}>
            <FocusWaveBackground mode={session.activeLayer?.kind === 'gymMode' ? 'gym' : 'default'} />

            <div className="relative z-10 flex shrink-0 items-start justify-between px-4 pb-0 pt-6 animate-in slide-in-from-top-8 fade-in duration-1000 delay-150 fill-mode-both sm:px-8 sm:pt-8">
                <div className="flex flex-col gap-2">
                <ModeBadge type={session.blockType} language={language} />

                    {session.activeLayer && (
                        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 shadow-sm backdrop-blur-md">
                            <span className="text-[11px] font-medium tracking-wide text-white/50">
                            {getLayerLabel(session, copy)}
                            </span>
                            <button
                                onClick={() => setLayer(null)}
                                className="flex h-4 w-4 items-center justify-center rounded-full bg-white/5 text-white/30 transition-colors hover:bg-white/10 hover:text-white/90"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleExit}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10"
                >
                    <X className="h-4 w-4 text-white/60" />
                </button>
            </div>

            <div className="relative z-10 flex w-full flex-1 flex-col overflow-x-hidden overflow-y-auto scrollbar-none">
                <div className="flex min-h-[300px] flex-1 shrink-0 flex-col items-center justify-center gap-4 px-4 py-8 sm:px-8">
                    {session.intention && !isMicroCommitActive && (
                        <div className="group flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 shadow-sm backdrop-blur-md transition-all hover:bg-white/[0.06]">
                                <button
                                    onClick={() => {
                                        openIntentEditor(true, "nextStep");
                                    }}
                                    className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-transparent transition-all hover:border-green-400 hover:bg-green-400/10 hover:text-green-400"
                                title={copy.markProgress}
                                >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                            <span className="text-sm font-medium tracking-wide text-white/80">
                                {session.intention}
                            </span>
                            <button
                                onClick={() => useFocusStore.getState().setSessionIntention("")}
                                className="flex h-5 w-5 items-center justify-center rounded-full text-white/30 opacity-0 transition-all hover:bg-white/10 hover:text-white/80 group-hover:opacity-100"
                                title={copy.remove}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-3">
                        <div
                            className={`flex items-center font-bold tabular-nums select-none transition-colors duration-700 ${currentPhase === "break" ? "text-sky-100" : "text-white"}`}
                            style={{
                                fontSize: "clamp(4.5rem, 18vw, 13rem)",
                                lineHeight: 1.05,
                                letterSpacing: "-0.03em",
                                textShadow: "0 0 50px rgba(255,255,255,0.15)",
                            }}
                        >
                            {formattedChars.map((char, index) => {
                                if (char === ':') {
                                    return (
                                        <div
                                            key={`sep-${index}`}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.22em',
                                                margin: '0 0.06em',
                                                opacity: 0.35,
                                                alignSelf: 'center',
                                                height: '0.65em',
                                            }}
                                        >
                                            <div style={{ width: '0.11em', height: '0.11em', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                                            <div style={{ width: '0.11em', height: '0.11em', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                                        </div>
                                    );
                                }

                                if (char === ' ') return null;

                                return (
                                    <span key={`${index}-${char}`} className="timer-digit">
                                        {char}
                                    </span>
                                );
                            })}
                        </div>

                        {currentPhase && session.activeLayer?.kind === "studyTechnique" && session.activeLayer.id !== "active_recall" && (
                            <span className="text-sm font-medium uppercase tracking-widest text-white/60">
                                {session.activeLayer.id === "study_50_10" ? "50/10" : session.activeLayer.id === "custom_pomodoro" ? "Pom. Personal" : "Pomodoro"} - {currentPhase === "focus" ? copy.currentPhaseFocus : copy.currentPhaseBreak}
                            </span>
                        )}
                        {isMicroCommitActive && (
                            <span className="text-sm font-medium uppercase tracking-widest text-white/60">
                                Micro Commit - 5 minutos sin interrupciones
                            </span>
                        )}
                        {isFocusProtectionActive && (
                            <span className="text-sm font-medium uppercase tracking-widest text-emerald-200/70">
                                {copy.focusProtectionActive}
                            </span>
                        )}
                    </div>
                </div>

                {activeToast && (
                    <div className="absolute left-1/2 top-12 z-50 flex -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out px-4">
                        <div className="min-w-[320px] max-w-[480px] rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
                            <div className="flex items-start gap-4">
                                <div className="min-w-0 flex-1">
                                    <span className="text-sm font-medium text-white">{activeToast.title}</span>
                                    {activeToast.description && (
                                        <p className="mt-1 text-xs leading-relaxed text-white/55">{activeToast.description}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDismissToast(activeToast)}
                                    className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/35 transition-colors hover:bg-white/10 hover:text-white/80"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>

                            {(activeToast.action || activeToast.secondaryAction) && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {activeToast.action && (
                                        <GlassButton
                                            variant="default"
                                            size="sm"
                                            onClick={() => handleRuntimeAction("toast", activeToast, activeToast.action!)}
                                        >
                                            {activeToast.action.label}
                                        </GlassButton>
                                    )}
                                    {activeToast.secondaryAction && (
                                        <GlassButton
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRuntimeAction("toast", activeToast, activeToast.secondaryAction!)}
                                        >
                                            {activeToast.secondaryAction.label}
                                        </GlassButton>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex w-full shrink-0 justify-center px-4 sm:px-6 animate-in slide-in-from-bottom-4 fade-in duration-1000 delay-300 fill-mode-both">
                    <GymTrackerPanel />
                </div>

                {session.activeLayer?.kind !== 'gymMode' && !isAttentionAidActive && (
                    <div className="w-full shrink-0 pb-2 animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-500 fill-mode-both">
                        <FocusCardsCarousel
                            cards={engineResult.visibleCards}
                            onAction={(card, action) => handleRuntimeAction("card", card, action)}
                            onActiveCardChange={(card) => setActiveCarouselCardId(card?.id ?? null)}
                        />
                    </div>
                )}
            </div>

            <div className="relative z-10 flex w-full shrink-0 flex-col items-center gap-4 px-4 pb-6 animate-in slide-in-from-bottom-10 fade-in duration-1000 delay-700 fill-mode-both sm:px-6 sm:pb-8">
                {!isMicroCommitActive && <RestSelector />}

                <div
                    className="flex items-center gap-2 rounded-full border border-white/10 p-1.5"
                    style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}
                >
                    <GlassButton
                        onClick={session.isPaused ? resume : () => pause({ reason: "manual_pause" })}
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 border-white/10 hover:bg-white/10"
                    >
                        {session.isPaused
                            ? <Play fill="white" className="ml-0.5 h-4 w-4" />
                            : <Pause fill="white" className="h-4 w-4" />
                        }
                    </GlassButton>

                    <div className="mx-1 h-6 w-px bg-white/10" />

                    <button
                        onClick={handleFinishPress}
                        className="inline-flex h-10 select-none items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-black shadow-[0_0_24px_rgba(255,255,255,0.25)] transition-colors hover:bg-white/90"
                    >
                        <CheckSquare className="h-4 w-4" />
                        Finalizar
                    </button>
                </div>
            </div>

            {showPicker && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-6 backdrop-blur-md">
                    <TechniquePickerCard onClose={() => setShowPicker(false)} />
                </div>
            )}

            {showIntentInput && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-6 backdrop-blur-md">
                    <IntentInputOverlay
                        onClose={() => setShowIntentInput(false)}
                        defaultIsCompletion={isIntentCompletion}
                        field={intentInputField}
                    />
                </div>
            )}

            <FocusInterventionModal
                onOpenIntentInput={(field = "intention") => openIntentEditor(false, field)}
            />

            <ReflectionSheet />
        </div>
    );
}
