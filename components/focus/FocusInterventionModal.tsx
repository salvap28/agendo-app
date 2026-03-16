"use client";

import React from "react";
import { useFocusStore } from "@/lib/stores/focusStore";
import { GlassButton } from "@/components/ui/glass-button";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { createAttentionAidLayer } from "@/lib/engines/layersEngine";

type Option = {
    label: string;
    action: () => void;
};

export function FocusInterventionModal({
    onOpenIntentInput,
}: {
    onOpenIntentInput: (field?: "intention" | "nextStep") => void;
}) {
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

    const initialClosureNote = String(intervention?.payload?.closureNote || "").trim();
    const [closureDraft, setClosureDraft] = React.useState(initialClosureNote);

    React.useEffect(() => {
        setClosureDraft(String(intervention?.payload?.closureNote || "").trim());
    }, [intervention?.id, intervention?.kind, intervention?.payload]);

    if (!intervention) return null;

    const payloadIntention = String(intervention.payload?.intention || "").trim();
    const payloadNextStep = String(intervention.payload?.nextStep || "").trim();
    const payloadMinimumViable = String(intervention.payload?.minimumViable || "").trim();
    const fallbackMinimumViable = payloadMinimumViable || payloadNextStep || payloadIntention || "Hacer una parte mas chica";
    const fallbackNextStep = payloadNextStep || payloadMinimumViable || payloadIntention || "Definir el siguiente paso";

    let title = "";
    let description = "";
    let options: Option[] = [];

    if (intervention.kind === "reduce_scope") {
        title = "Reduci el alcance";
        description = "Elegi la version minima que todavia te haga avanzar.";
        options = [
            {
                label: "Trabajar 5 min",
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
                label: "Hacer primer paso",
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
                label: "Dividir tarea",
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
        title = "Volve al objetivo";
        description = payloadIntention
            ? `Tu objetivo actual es: "${payloadIntention}".`
            : "No hay un objetivo definido para esta sesion.";
        options = [
            {
                label: "Mantener objetivo",
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
                label: "Reescribir objetivo",
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
        title = "Volve al bloque";
        description = payloadIntention
            ? `Retoma desde: "${payloadIntention}".`
            : "Elegi una sola accion y retoma desde ahi.";
        options = [
            {
                label: "Volver ahora",
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
                label: "Definir foco",
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
        title = "Chequeo rapido";
        description = "Marca como viene la sesion para ajustar el foco sin cortar el ritmo.";
        options = [
            {
                label: "Avanzando bien",
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
                label: "Mas lento",
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
                label: "Estoy trabado",
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
        title = "Cerrando el bloque";
        description = "Si queres, deja en una frase lo mas importante que avanzaste.";
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
                            placeholder="Ej: cerré el algoritmo y dejé listo el siguiente paso"
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
                            Guardar
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
                            Saltar
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
                        Cerrar
                    </GlassButton>
                </div>
            </div>
        </div>
    );
}
