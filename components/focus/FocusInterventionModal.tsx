"use client";

import React from "react";
import { useFocusStore } from "@/lib/stores/focusStore";
import { GlassButton } from "@/components/ui/glass-button";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { createAttentionAidLayer } from "@/lib/engines/layersEngine";
import { useI18n } from "@/lib/i18n/client";
import { getFocusInterventionCopy } from "@/lib/i18n/ui";

type Option = {
    label: string;
    action: () => void;
};

export function FocusInterventionModal({
    onOpenIntentInput,
}: {
    onOpenIntentInput: (field?: "intention" | "nextStep") => void;
}) {
    const { language } = useI18n();
    const {
        intervention,
        closeIntervention,
        resolveIntervention,
        finish,
        saveClosureNote,
        setSessionIntention,
        setSessionNextStep,
        setSessionMinimumViable,
        setLayer,
        recordCardOutcome,
    } = useFocusStore();

    const copy = React.useMemo(() => getFocusInterventionCopy(language), [language]);

    const initialClosureNote = String(intervention?.payload?.closureNote || "").trim();
    const [closureDraft, setClosureDraft] = React.useState(initialClosureNote);

    React.useEffect(() => {
        setClosureDraft(String(intervention?.payload?.closureNote || "").trim());
    }, [intervention?.id, intervention?.kind, intervention?.payload]);

    if (!intervention) return null;

    const payloadIntention = String(intervention.payload?.intention || "").trim();
    const payloadNextStep = String(intervention.payload?.nextStep || "").trim();
    const payloadMinimumViable = String(intervention.payload?.minimumViable || "").trim();
    const fallbackMinimumViable = payloadMinimumViable || payloadNextStep || payloadIntention || copy.defaultMinimumViable;
    const fallbackNextStep = payloadNextStep || payloadMinimumViable || payloadIntention || copy.defaultNextStep;

    let title = "";
    let description = "";
    let options: Option[] = [];

    if (intervention.kind === "reduce_scope") {
        title = copy.reduceScope.title;
        description = copy.reduceScope.description;
        options = [
            {
                label: copy.reduceScope.workFive,
                action: () => {
                    if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "accepted");
                    if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "accepted");
                    setLayer(createAttentionAidLayer("micro_commit_layer"));
                    resolveIntervention({
                        actionTaken: "work_5_minutes",
                        result: "micro_commit_started",
                    });
                },
            },
            {
                label: copy.reduceScope.firstStep,
                action: () => {
                    if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "accepted");
                    if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "accepted");
                    setSessionNextStep(fallbackNextStep);
                    setSessionMinimumViable(fallbackMinimumViable);
                    resolveIntervention({
                        actionTaken: "set_first_step",
                        result: "next_step_and_minimum_viable_set",
                        payload: {
                            nextStep: fallbackNextStep,
                            minimumViable: fallbackMinimumViable,
                        },
                    });
                },
            },
            {
                label: copy.reduceScope.splitTask,
                action: () => {
                    if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "accepted");
                    if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "accepted");
                    setSessionMinimumViable("");
                    setSessionNextStep("");
                    resolveIntervention({
                        actionTaken: "split_task",
                        result: "next_step_editor_opened",
                    });
                    onOpenIntentInput("nextStep");
                },
            },
        ];
    } else if (intervention.kind === "reset_clarity") {
        title = copy.resetClarity.title;
        description = payloadIntention
            ? copy.resetClarity.currentGoal(payloadIntention)
            : copy.resetClarity.noGoal;
        options = [
            {
                label: copy.resetClarity.keepObjective,
                action: () => {
                    if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "accepted");
                    if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "accepted");
                    resolveIntervention({
                        actionTaken: "keep_objective",
                        result: "clarity_restored",
                        payload: { intention: payloadIntention || null },
                    });
                },
            },
            {
                label: copy.resetClarity.rewriteObjective,
                action: () => {
                    if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "accepted");
                    if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "accepted");
                    if (payloadIntention) setSessionIntention("");
                    resolveIntervention({
                        actionTaken: "rewrite_objective",
                        result: "intent_editor_opened",
                    });
                    onOpenIntentInput("intention");
                },
            },
        ];
    } else if (intervention.kind === "refocus_prompt") {
        title = copy.refocus.title;
        description = payloadIntention
            ? copy.refocus.resumeFrom(payloadIntention)
            : copy.refocus.chooseOne;
        options = [
            {
                label: copy.refocus.returnNow,
                action: () => {
                    if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "accepted");
                    if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "accepted");
                    setLayer(createAttentionAidLayer("focus_protection_layer"));
                    resolveIntervention({
                        actionTaken: "return_now",
                        result: "focus_protection_started",
                    });
                },
            },
            {
                label: copy.refocus.defineFocus,
                action: () => {
                    if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "accepted");
                    if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "accepted");
                    if (payloadNextStep) {
                        setSessionNextStep("");
                    } else if (payloadIntention) {
                        setSessionIntention("");
                    }
                    resolveIntervention({
                        actionTaken: "define_focus",
                        result: payloadNextStep ? "next_step_editor_opened" : "intent_editor_opened",
                    });
                    onOpenIntentInput(payloadNextStep ? "nextStep" : "intention");
                },
            },
        ];
    } else if (intervention.kind === "progress_check") {
        title = copy.progress.title;
        description = copy.progress.description;
        options = [
            {
                label: copy.progress.advancing,
                action: () => {
                    if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "accepted");
                    if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "accepted");
                    resolveIntervention({
                        actionTaken: "advancing_well",
                        result: "progress_positive",
                    });
                },
            },
            {
                label: copy.progress.slower,
                action: () => {
                    if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "accepted");
                    if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "accepted");
                    setSessionMinimumViable(fallbackMinimumViable);
                    resolveIntervention({
                        actionTaken: "slower_than_expected",
                        result: "progress_slow_minimum_viable_set",
                        payload: {
                            minimumViable: fallbackMinimumViable,
                        },
                    });
                },
            },
            {
                label: copy.progress.blocked,
                action: () => {
                    if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "accepted");
                    if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "accepted");
                    setSessionMinimumViable(fallbackMinimumViable);
                    setSessionNextStep(fallbackNextStep);
                    resolveIntervention({
                        actionTaken: "blocked",
                        result: "progress_blocked_reframed",
                        payload: {
                            nextStep: fallbackNextStep,
                            minimumViable: fallbackMinimumViable,
                        },
                    });
                },
            },
        ];
    } else if (intervention.kind === "closure_bridge") {
        title = copy.closure.title;
        description = copy.closure.description;
    }

    const shouldFinishAfterClosure = intervention.kind === "closure_bridge" && intervention.trigger === "manual_finish";

    if (intervention.kind === "closure_bridge") {
        const trimmedClosureDraft = closureDraft.trim().slice(0, 120);

        const completeManualFinish = async () => {
            if (shouldFinishAfterClosure) {
                await finish();
            }
        };

        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-6 backdrop-blur-md">
                <div className="relative w-[420px] max-w-full rounded-3xl border border-white/[0.08] bg-black/40 p-6 text-white shadow-2xl backdrop-blur-3xl">
                    <GlowingEffect spread={40} proximity={80} inactiveZone={0.01} borderWidth={1} variant="default" />
                    <div className="relative z-10 flex flex-col gap-3">
                        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                        <p className="text-sm leading-relaxed text-white/55">{description}</p>
                    </div>

                    <div className="relative z-10 mt-5 space-y-3">
                        <input
                            type="text"
                            value={closureDraft}
                            onChange={(event) => setClosureDraft(event.target.value.slice(0, 120))}
                            placeholder={copy.closure.placeholder}
                            className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white/85 outline-none transition-all duration-200 placeholder:text-white/28 focus:border-white/20 focus:bg-black/25"
                            maxLength={120}
                        />
                        <p className="text-xs text-white/35">{closureDraft.length}/120</p>
                    </div>

                    <div className="relative z-10 mt-6 flex flex-col gap-2">
                        <GlassButton
                            onClick={async () => {
                                if (!trimmedClosureDraft) return;
                                if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "accepted");
                                if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "accepted");
                                saveClosureNote(trimmedClosureDraft);
                                resolveIntervention({
                                    actionTaken: "save_note",
                                    result: "closure_note_saved",
                                    payload: { text: trimmedClosureDraft },
                                });
                                await completeManualFinish();
                            }}
                            variant="default"
                            className="h-11 w-full justify-center rounded-xl"
                            disabled={!trimmedClosureDraft}
                        >
                            {copy.closure.save}
                        </GlassButton>
                        <GlassButton
                            onClick={async () => {
                                if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "dismissed");
                                if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "dismissed");
                                closeIntervention("skipped");
                                await completeManualFinish();
                            }}
                            variant="ghost"
                            className="h-10 w-full justify-center rounded-xl"
                        >
                            {copy.closure.skip}
                        </GlassButton>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-6 backdrop-blur-md">
            <div className="relative w-[420px] max-w-full rounded-3xl border border-white/[0.08] bg-black/40 p-6 text-white shadow-2xl backdrop-blur-3xl">
                <GlowingEffect spread={40} proximity={80} inactiveZone={0.01} borderWidth={1} variant="default" />
                <div className="relative z-10 flex flex-col gap-3">
                    <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                    <p className="text-sm leading-relaxed text-white/55">{description}</p>
                </div>

                <div className="relative z-10 mt-6 flex flex-col gap-2">
                    {options.map((option) => (
                        <GlassButton
                            key={option.label}
                            onClick={option.action}
                            variant="default"
                            className="h-11 w-full justify-center rounded-xl"
                        >
                            {option.label}
                        </GlassButton>
                    ))}
                    <GlassButton
                        onClick={() => {
                            if (intervention.sourceCard) recordCardOutcome(intervention.sourceCard, "rejected");
                            if (intervention.sourceToast) recordCardOutcome(intervention.sourceToast, "rejected");
                            closeIntervention("dismissed");
                        }}
                        variant="ghost"
                        className="h-10 w-full justify-center rounded-xl"
                    >
                        {copy.close}
                    </GlassButton>
                </div>
            </div>
        </div>
    );
}
