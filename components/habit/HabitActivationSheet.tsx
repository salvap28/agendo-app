"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Clock3, Play, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useFocusStore } from "@/lib/stores/focusStore";
import { useI18n } from "@/lib/i18n/client";
import { enrichNewBlockWithPlanningMetadata } from "@/lib/utils/blockEnrichment";
import {
    buildOnboardingSuggestedBlock,
    getDesiredHelpConcreteValues,
    getHardestStartMomentConcreteValues,
    getPrimaryUseCaseConcreteValues,
    resolveDesiredHelpSelection,
    resolveHardestStartMomentSelection,
    resolvePrimaryUseCaseSelection,
    toggleAggregateSelection,
} from "@/lib/engines/habit";
import { saveHabitOnboarding, trackHabitEvent } from "@/lib/services/habitService";
import type {
    HabitDesiredHelp,
    HabitHardestStartMoment,
    HabitPrimaryUseCase,
} from "@/lib/types/habit";

type StepKey = "primaryUseCase" | "hardestStartMoment" | "desiredHelp" | "suggestion";

type ActivationState = {
    primaryUseCaseSelections: HabitPrimaryUseCase[];
    hardestStartMomentSelections: HabitHardestStartMoment[];
    desiredHelpSelections: HabitDesiredHelp[];
};

const INITIAL_STATE: ActivationState = {
    primaryUseCaseSelections: [],
    hardestStartMomentSelections: [],
    desiredHelpSelections: [],
};

const STEP_ORDER: StepKey[] = ["primaryUseCase", "hardestStartMoment", "desiredHelp", "suggestion"];

export function HabitActivationSheet({
    open,
    onComplete,
}: {
    open: boolean;
    onComplete: () => void;
}) {
    const { language } = useI18n();
    const createBlock = useBlocksStore((state) => state.createBlock);
    const openFromBlock = useFocusStore((state) => state.openFromBlock);
    const [state, setState] = useState<ActivationState>(INITIAL_STATE);
    const [currentStep, setCurrentStep] = useState<StepKey>("primaryUseCase");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const suggestionTrackedKeyRef = useRef<string | null>(null);

    const copy = useMemo(() => (
        language === "es"
            ? {
                badge: "Activacion",
                title: "Arranquemos por una sola cosa: empezar mejor.",
                subtitle: "Agendo se tiene que volver el lugar al que vas justo antes de estudiar, trabajar o entrenar.",
                primaryUseCase: "Para que queres usar Agendo?",
                hardestStartMoment: "Cuando te cuesta mas arrancar?",
                desiredHelp: "Que te ayudaria mas ahora?",
                suggestion: "Tu primer bloque sugerido",
                selectionHint: "Podes marcar mas de una. Si todo cambia segun el dia, usa la opcion mixta.",
                continue: "Continuar",
                continueToSuggestion: "Ver sugerencia",
                startNow: "Empezar mi primer bloque",
                leaveReady: "Dejar listo mi proximo bloque",
                suggestionLabel: "Sugerencia inicial",
                reasonLabel: "Por que te lo proponemos",
                duration: "Duracion",
                recommended: "Recomendado",
                at: "a las",
                saving: "Preparando...",
                stepBadge: (index: number) => `Paso ${index + 1} de ${STEP_ORDER.length}`,
                selectedCount: (count: number) => `${count} marcada${count === 1 ? "" : "s"}`,
            }
            : {
                badge: "Activation",
                title: "We start with one thing only: starting better.",
                subtitle: "Agendo should become the place you go right before studying, working, or training.",
                primaryUseCase: "What do you want Agendo for?",
                hardestStartMoment: "When is it hardest to get started?",
                desiredHelp: "What would help most right now?",
                suggestion: "Your suggested first block",
                selectionHint: "You can pick more than one. If it changes day to day, use the mixed option.",
                continue: "Continue",
                continueToSuggestion: "See suggestion",
                startNow: "Start my first block",
                leaveReady: "Leave my next block ready",
                suggestionLabel: "Initial suggestion",
                reasonLabel: "Why this suggestion",
                duration: "Duration",
                recommended: "Recommended",
                at: "at",
                saving: "Setting it up...",
                stepBadge: (index: number) => `Step ${index + 1} of ${STEP_ORDER.length}`,
                selectedCount: (count: number) => `${count} selected`,
            }
    ), [language]);

    const resolvedPrimaryUseCase = useMemo(
        () => resolvePrimaryUseCaseSelection(state.primaryUseCaseSelections),
        [state.primaryUseCaseSelections],
    );
    const resolvedHardestStartMoment = useMemo(
        () => resolveHardestStartMomentSelection(state.hardestStartMomentSelections),
        [state.hardestStartMomentSelections],
    );
    const resolvedDesiredHelp = useMemo(
        () => resolveDesiredHelpSelection(state.desiredHelpSelections),
        [state.desiredHelpSelections],
    );

    useEffect(() => {
        if (!open) return;

        setState(INITIAL_STATE);
        setCurrentStep("primaryUseCase");
        suggestionTrackedKeyRef.current = null;
        void trackHabitEvent({
            name: "habit_onboarding_started",
            surface: "activation_sheet",
        });
    }, [open]);

    const suggestion = useMemo(() => {
        if (!resolvedPrimaryUseCase || !resolvedHardestStartMoment || !resolvedDesiredHelp) return null;
        return buildOnboardingSuggestedBlock({
            primaryUseCase: resolvedPrimaryUseCase,
            hardestStartMoment: resolvedHardestStartMoment,
            desiredHelp: resolvedDesiredHelp,
            language,
        });
    }, [language, resolvedDesiredHelp, resolvedHardestStartMoment, resolvedPrimaryUseCase]);

    useEffect(() => {
        if (!open || !suggestion) return;

        const trackingKey = JSON.stringify({
            title: suggestion.title,
            type: suggestion.type,
            durationMin: suggestion.durationMin,
            startAt: suggestion.startAt,
        });

        if (suggestionTrackedKeyRef.current === trackingKey) return;
        suggestionTrackedKeyRef.current = trackingKey;

        void trackHabitEvent({
            name: "habit_first_block_suggested",
            surface: "activation_sheet",
            metadata: {
                type: suggestion.type,
                durationMin: suggestion.durationMin,
            },
        });
    }, [open, suggestion]);

    const stepIndex = STEP_ORDER.indexOf(currentStep);

    const commitStep = async (args: {
        step: Exclude<StepKey, "suggestion">;
        values: string[];
        canonicalValue: string | null;
    }) => {
        await trackHabitEvent({
            name: "habit_onboarding_step_completed",
            surface: "activation_sheet",
            metadata: {
                step: args.step,
                values: args.values,
                canonicalValue: args.canonicalValue,
            },
        });
    };

    const goToNextStep = (step: StepKey) => {
        const nextIndex = Math.min(STEP_ORDER.length - 1, STEP_ORDER.indexOf(step) + 1);
        setCurrentStep(STEP_ORDER[nextIndex]);
    };

    const continuePrimaryUseCase = async () => {
        if (state.primaryUseCaseSelections.length === 0) return;
        await commitStep({
            step: "primaryUseCase",
            values: state.primaryUseCaseSelections,
            canonicalValue: resolvedPrimaryUseCase,
        });
        goToNextStep("primaryUseCase");
    };

    const continueHardestStartMoment = async () => {
        if (state.hardestStartMomentSelections.length === 0) return;
        await commitStep({
            step: "hardestStartMoment",
            values: state.hardestStartMomentSelections,
            canonicalValue: resolvedHardestStartMoment,
        });
        goToNextStep("hardestStartMoment");
    };

    const continueDesiredHelp = async () => {
        if (state.desiredHelpSelections.length === 0) return;
        await commitStep({
            step: "desiredHelp",
            values: state.desiredHelpSelections,
            canonicalValue: resolvedDesiredHelp,
        });
        goToNextStep("desiredHelp");
    };

    const handleCreate = async (mode: "start" | "ready") => {
        if (!suggestion || !resolvedPrimaryUseCase || !resolvedHardestStartMoment || !resolvedDesiredHelp) return;

        setIsSubmitting(true);
        try {
            const startAt = new Date(suggestion.startAt);
            const endAt = new Date(startAt.getTime() + (suggestion.durationMin * 60 * 1000));
            const block = createBlock(enrichNewBlockWithPlanningMetadata({
                title: suggestion.title,
                type: suggestion.type,
                startAt,
                endAt,
            }));

            const nowIso = new Date().toISOString();
            await saveHabitOnboarding({
                primaryUseCase: resolvedPrimaryUseCase,
                hardestStartMoment: resolvedHardestStartMoment,
                desiredHelp: resolvedDesiredHelp,
                primaryUseCaseSelections: state.primaryUseCaseSelections,
                hardestStartMomentSelections: state.hardestStartMomentSelections,
                desiredHelpSelections: state.desiredHelpSelections,
                onboardingCompletedAt: nowIso,
                firstMeaningfulActionAt: nowIso,
                lastMeaningfulActionAt: nowIso,
                eventName: "habit_onboarding_completed",
                metadata: {
                    action: mode,
                    blockType: suggestion.type,
                    primaryUseCaseSelections: state.primaryUseCaseSelections,
                    hardestStartMomentSelections: state.hardestStartMomentSelections,
                    desiredHelpSelections: state.desiredHelpSelections,
                },
            });
            await trackHabitEvent({
                name: "habit_first_meaningful_action",
                surface: "activation_sheet",
                blockId: block?.id ?? null,
                metadata: {
                    action: mode,
                },
            });

            if (mode === "start" && block) {
                await trackHabitEvent({
                    name: "next_block_started_from_home",
                    surface: "activation_sheet",
                    blockId: block.id,
                });
                openFromBlock(block.id, block.type);
            }

            onComplete();
        } finally {
            setIsSubmitting(false);
        }
    };

    const togglePrimaryUseCase = (value: HabitPrimaryUseCase) => {
        setState((current) => ({
            ...current,
            primaryUseCaseSelections: toggleAggregateSelection({
                current: current.primaryUseCaseSelections,
                value,
                aggregateValue: "mixed",
                concreteValues: getPrimaryUseCaseConcreteValues(),
            }),
        }));
    };

    const toggleHardestStartMoment = (value: HabitHardestStartMoment) => {
        setState((current) => ({
            ...current,
            hardestStartMomentSelections: toggleAggregateSelection({
                current: current.hardestStartMomentSelections,
                value,
                aggregateValue: "mixed",
                concreteValues: getHardestStartMomentConcreteValues(),
            }),
        }));
    };

    const toggleDesiredHelp = (value: HabitDesiredHelp) => {
        setState((current) => ({
            ...current,
            desiredHelpSelections: toggleAggregateSelection({
                current: current.desiredHelpSelections,
                value,
                aggregateValue: "mixed",
                concreteValues: getDesiredHelpConcreteValues(),
            }),
        }));
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/55 px-4 py-4 backdrop-blur-2xl sm:items-center">
            <div className="relative w-full max-w-[680px] overflow-hidden rounded-[32px] border border-white/10 bg-[#070910]/94 shadow-[0_40px_120px_rgba(0,0,0,0.68)]">
                <div className="pointer-events-none absolute inset-x-14 top-0 h-28 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="pointer-events-none absolute left-10 top-10 h-36 w-36 rounded-full bg-[#6ee7b7]/10 blur-[100px]" />

                <div className="relative px-6 py-6 sm:px-8 sm:py-8">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                            {copy.badge}
                        </span>
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
                            {copy.stepBadge(stepIndex)}
                        </span>
                    </div>

                    <div className="mt-5 max-w-[40rem] space-y-3">
                        <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-white/92">
                            {copy.title}
                        </h2>
                        <p className="max-w-[34rem] text-sm leading-7 text-white/45 sm:text-[0.97rem]">
                            {copy.subtitle}
                        </p>
                    </div>

                    <div className="mt-8">
                        {currentStep === "primaryUseCase" && (
                            <SelectionGrid
                                title={copy.primaryUseCase}
                                helperText={copy.selectionHint}
                                selectedCountLabel={copy.selectedCount(state.primaryUseCaseSelections.length)}
                                options={language === "es"
                                    ? [
                                        { value: "study", label: "Estudiar" },
                                        { value: "work", label: "Trabajo" },
                                        { value: "gym", label: "Gym" },
                                        { value: "mixed", label: "Dias mixtos" },
                                    ]
                                    : [
                                        { value: "study", label: "Study" },
                                        { value: "work", label: "Work" },
                                        { value: "gym", label: "Gym" },
                                        { value: "mixed", label: "Mixed days" },
                                    ]}
                                selectedValues={state.primaryUseCaseSelections}
                                continueLabel={copy.continue}
                                onToggle={(value) => togglePrimaryUseCase(value as HabitPrimaryUseCase)}
                                onContinue={() => void continuePrimaryUseCase()}
                            />
                        )}

                        {currentStep === "hardestStartMoment" && (
                            <SelectionGrid
                                title={copy.hardestStartMoment}
                                helperText={copy.selectionHint}
                                selectedCountLabel={copy.selectedCount(state.hardestStartMomentSelections.length)}
                                options={language === "es"
                                    ? [
                                        { value: "morning", label: "Manana" },
                                        { value: "afternoon", label: "Tarde" },
                                        { value: "night", label: "Noche" },
                                        { value: "after_class", label: "Despues de cursar" },
                                        { value: "before_training", label: "Antes de entrenar" },
                                        { value: "mixed", label: "Depende del dia" },
                                    ]
                                    : [
                                        { value: "morning", label: "Morning" },
                                        { value: "afternoon", label: "Afternoon" },
                                        { value: "night", label: "Night" },
                                        { value: "after_class", label: "After class" },
                                        { value: "before_training", label: "Before training" },
                                        { value: "mixed", label: "Depends on the day" },
                                    ]}
                                selectedValues={state.hardestStartMomentSelections}
                                continueLabel={copy.continue}
                                onToggle={(value) => toggleHardestStartMoment(value as HabitHardestStartMoment)}
                                onContinue={() => void continueHardestStartMoment()}
                            />
                        )}

                        {currentStep === "desiredHelp" && (
                            <SelectionGrid
                                title={copy.desiredHelp}
                                helperText={copy.selectionHint}
                                selectedCountLabel={copy.selectedCount(state.desiredHelpSelections.length)}
                                options={language === "es"
                                    ? [
                                        { value: "decide", label: "Decidir que hacer" },
                                        { value: "start_focus", label: "Empezar foco" },
                                        { value: "organize_day", label: "Ordenar el dia" },
                                        { value: "resume_when_lost", label: "Retomar cuando me pierdo" },
                                        { value: "mixed", label: "Un poco de todo" },
                                    ]
                                    : [
                                        { value: "decide", label: "Decide what to do" },
                                        { value: "start_focus", label: "Start focus" },
                                        { value: "organize_day", label: "Organize the day" },
                                        { value: "resume_when_lost", label: "Resume when lost" },
                                        { value: "mixed", label: "A bit of everything" },
                                    ]}
                                selectedValues={state.desiredHelpSelections}
                                continueLabel={copy.continueToSuggestion}
                                onToggle={(value) => toggleDesiredHelp(value as HabitDesiredHelp)}
                                onContinue={() => void continueDesiredHelp()}
                            />
                        )}

                        {currentStep === "suggestion" && suggestion && (
                            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                                        {copy.suggestionLabel}
                                    </p>
                                    <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white/92">
                                        {suggestion.title}
                                    </h3>
                                    <div className="mt-5 flex flex-wrap gap-3">
                                        <MetaPill icon={Clock3} label={`${copy.duration} ${suggestion.durationMin} min`} />
                                        <MetaPill
                                            icon={Sparkles}
                                            label={`${copy.at} ${new Date(suggestion.startAt).toLocaleTimeString(language === "es" ? "es-PY" : "en-US", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}`}
                                        />
                                    </div>
                                    <div className="mt-6 rounded-[22px] border border-white/10 bg-black/20 p-4">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                                            {copy.reasonLabel}
                                        </p>
                                        <p className="mt-2 text-sm leading-7 text-white/68">
                                            {suggestion.reason}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-[28px] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(16,24,40,0.94),rgba(8,12,20,0.96))] p-5">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {copy.recommended}
                                    </div>

                                    <div className="mt-5 space-y-3">
                                        <button
                                            type="button"
                                            onClick={() => void handleCreate("start")}
                                            disabled={isSubmitting}
                                            className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-[20px] bg-gradient-to-r from-[#79c2ff] via-[#7dd3fc] to-[#6ee7b7] px-5 text-sm font-semibold tracking-[-0.02em] text-slate-950 shadow-[0_24px_54px_-26px_rgba(125,211,252,0.58)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_28px_60px_-24px_rgba(125,211,252,0.7)] disabled:opacity-60"
                                        >
                                            <Play className="h-4.5 w-4.5" />
                                            {isSubmitting ? copy.saving : copy.startNow}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => void handleCreate("ready")}
                                            disabled={isSubmitting}
                                            className="inline-flex h-13 w-full items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.05] px-5 text-sm font-semibold tracking-[-0.02em] text-white/85 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-60"
                                        >
                                            <ArrowRight className="h-4.5 w-4.5" />
                                            {copy.leaveReady}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SelectionGrid({
    title,
    helperText,
    selectedCountLabel,
    options,
    selectedValues,
    continueLabel,
    onToggle,
    onContinue,
}: {
    title: string;
    helperText: string;
    selectedCountLabel: string;
    options: Array<{ value: string; label: string }>;
    selectedValues: string[];
    continueLabel: string;
    onToggle: (value: string) => void;
    onContinue: () => void;
}) {
    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-white/88">
                    {title}
                </h3>
                {selectedValues.length > 0 && (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/72">
                        {selectedCountLabel}
                    </span>
                )}
            </div>

            <p className="mt-2 max-w-[34rem] text-sm leading-7 text-white/45">
                {helperText}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {options.map((option) => {
                    const isSelected = selectedValues.includes(option.value);

                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onToggle(option.value)}
                            className={cn(
                                "group flex items-center justify-between rounded-[24px] border px-4 py-4 text-left transition-all duration-300",
                                isSelected
                                    ? "border-cyan-300/35 bg-cyan-400/10 shadow-[0_20px_40px_-30px_rgba(125,211,252,0.45)]"
                                    : "border-white/10 bg-white/[0.04] hover:border-cyan-300/25 hover:bg-white/[0.07] hover:shadow-[0_20px_40px_-30px_rgba(125,211,252,0.4)]",
                            )}
                        >
                            <span className="text-[0.98rem] font-medium tracking-[-0.02em] text-white/88">
                                {option.label}
                            </span>
                            <span
                                className={cn(
                                    "inline-flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-300",
                                    isSelected
                                        ? "border-cyan-200/40 bg-cyan-200/15 text-cyan-50"
                                        : "border-white/12 bg-black/15 text-transparent group-hover:border-white/20",
                                )}
                            >
                                <Check className="h-4 w-4" />
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    type="button"
                    onClick={onContinue}
                    disabled={selectedValues.length === 0}
                    className="inline-flex h-12 items-center justify-center gap-3 rounded-[18px] bg-gradient-to-r from-[#79c2ff] via-[#7dd3fc] to-[#6ee7b7] px-5 text-sm font-semibold text-slate-950 shadow-[0_20px_48px_-28px_rgba(125,211,252,0.58)] transition-all duration-300 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-45"
                >
                    {continueLabel}
                    <ArrowRight className="h-4.5 w-4.5" />
                </button>
            </div>
        </div>
    );
}

function MetaPill({
    icon: Icon,
    label,
}: {
    icon: LucideIcon;
    label: string;
}) {
    return (
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70">
            <Icon className="h-4 w-4" />
            {label}
        </span>
    );
}
