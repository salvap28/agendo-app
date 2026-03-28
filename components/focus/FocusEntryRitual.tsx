"use client";

import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { GlassButton } from "@/components/ui/glass-button";
import { useFocusStore } from "@/lib/stores/focusStore";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { BlockType } from "@/lib/types/blocks";
import { FocusEntryStartMode } from "@/lib/types/focus";
import { useI18n } from "@/lib/i18n/client";
import { getFocusEntryCopy } from "@/lib/i18n/ui";

type StartModeOption = {
    id: FocusEntryStartMode;
    label: string;
    hint: string;
};

function getInitialStep(objective: string | null, nextStep: string | null) {
    if (!objective?.trim()) return 0;
    if (!nextStep?.trim()) return 1;
    return 0;
}

function getModeOptions(
    mode: "block" | "free",
    blockType: BlockType | undefined,
    suggested: FocusEntryStartMode | null | undefined,
    copy: ReturnType<typeof getFocusEntryCopy>,
): StartModeOption[] {
    const options: StartModeOption[] = [];

    const pushUnique = (option: StartModeOption) => {
        if (!options.some((item) => item.id === option.id)) {
            options.push(option);
        }
    };

    if (suggested === "study_technique") {
        pushUnique({
            id: "study_technique",
            label: copy.modes.studyTechnique.label,
            hint: copy.modes.studyTechnique.hint,
        });
    }

    if (suggested === "gym") {
        pushUnique({
            id: "gym",
            label: copy.modes.gymTracker.label,
            hint: copy.modes.gymTracker.entryHint,
        });
    }

    if (suggested === "micro_commit") {
        pushUnique({
            id: "micro_commit",
            label: copy.modes.microCommit.label,
            hint: copy.modes.microCommit.hint,
        });
    }

    pushUnique({
        id: "normal",
        label: copy.modes.normal.label,
        hint: copy.modes.normal.hint,
    });

    if (mode === "free") {
        pushUnique({
            id: "study_technique",
            label: copy.modes.studyTechnique.label,
            hint: copy.modes.studyTechnique.hint,
        });
        pushUnique({
            id: "gym",
            label: copy.modes.gymTracker.label,
            hint: copy.modes.gymTracker.hint,
        });
        pushUnique({
            id: "micro_commit",
            label: copy.modes.microCommit.label,
            hint: copy.modes.microCommit.hint,
        });

        return options;
    }

    if (blockType === "study") {
        pushUnique({
            id: "study_technique",
            label: copy.modes.studyTechnique.label,
            hint: copy.modes.studyTechnique.hint,
        });
        pushUnique({
            id: "micro_commit",
            label: copy.modes.microCommit.label,
            hint: copy.modes.microCommit.hint,
        });
    } else if (blockType === "gym") {
        pushUnique({
            id: "gym",
            label: copy.modes.gymTracker.label,
            hint: copy.modes.gymTracker.hint,
        });
    } else {
        pushUnique({
            id: "micro_commit",
            label: copy.modes.microCommit.label,
            hint: copy.modes.microCommit.hint,
        });
    }

    return options;
}

export function FocusEntryRitual() {
    const { language } = useI18n();
    const { session, lastSession, updateEntryRitual, completeEntryRitual, skipEntryRitual } = useFocusStore();
    const { blocks } = useBlocksStore();
    const ritual = session?.entryRitual;
    const [step, setStep] = React.useState(() => getInitialStep(ritual?.objective ?? null, ritual?.nextStep ?? null));
    const ritualActivationRef = React.useRef<string | null>(null);
    const copy = React.useMemo(() => getFocusEntryCopy(language), [language]);

    const block = session?.blockId
        ? blocks.find((item) => item.id === session.blockId) ?? null
        : null;

    React.useEffect(() => {
        if (!session || !ritual?.isActive) return;
        const activationKey = `${session.id}:${ritual.startedAt ?? "inactive"}`;
        if (ritualActivationRef.current === activationKey) return;

        ritualActivationRef.current = activationKey;
        setStep(getInitialStep(ritual.objective, ritual.nextStep));
    }, [ritual?.isActive, ritual?.startedAt, session, ritual?.objective, ritual?.nextStep]);

    if (!session || !ritual) return null;

    const blockCopy = copy.examples[session.blockType ?? "free"] ?? copy.examples.free;
    const hasCompatibleLastSession = lastSession?.blockType === session.blockType;
    const objective = ritual.objective ?? "";
    const nextStep = ritual.nextStep ?? "";
    const minimumViable = ritual.minimumViable ?? "";
    const selectedMode = ritual.selectedStartMode ?? ritual.suggestedStartMode ?? "normal";
    const modeOptions = getModeOptions(session.mode, session.blockType, ritual.suggestedStartMode, copy);
    const recentObjective = hasCompatibleLastSession ? lastSession?.intention?.trim() || "" : "";
    const recentNextStep = hasCompatibleLastSession ? lastSession?.nextStep?.trim() || "" : "";
    const blockSeed = block?.title?.trim() || "";
    const blockNextStepSeed = block?.notes ? block.notes.trim().split(/\r?\n/)[0]?.trim() || "" : "";

    const applyObjective = (value: string) => updateEntryRitual({ objective: value });
    const applyNextStep = (value: string) => updateEntryRitual({ nextStep: value });

    const handleContinue = () => {
        if (step === 0) {
            if (!objective.trim()) return;
            setStep(1);
            return;
        }

        if (step === 1) {
            if (!nextStep.trim()) return;
            setStep(2);
            return;
        }

        if (selectedMode === "micro_commit" && !minimumViable.trim()) {
            updateEntryRitual({ minimumViable: nextStep.trim() || objective.trim() });
        }

        completeEntryRitual();
    };

    const title = step === 0 ? copy.titles.objective : step === 1 ? copy.titles.nextStep : copy.titles.mode;
    const subtitle = step === 0 ? copy.subtitles.objective : step === 1 ? copy.subtitles.nextStep : copy.subtitles.mode;
    const helperBody = step === 0 ? copy.helpers.objective : step === 1 ? copy.helpers.nextStep : copy.helpers.mode;

    return (
        <div className="relative z-10 flex min-h-full w-full items-center justify-center px-4 py-8 sm:px-8">
            <div className="w-full max-w-[760px] rounded-[32px] border border-white/10 bg-black/40 font-sans shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-3xl">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                <div className="flex flex-col gap-8 p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                            <h2 className="max-w-[14ch] text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[0.92] tracking-tight text-white/90">
                                {title}
                            </h2>
                            <p className="max-w-[48ch] text-sm leading-relaxed text-white/45 sm:text-[15px]">
                                {subtitle}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            {[0, 1, 2].map((index) => (
                                <span
                                    key={index}
                                    className={cn(
                                        "h-2 rounded-full transition-all duration-300",
                                        step === index
                                            ? "w-8 bg-gradient-to-r from-[#4c1d95] to-[#6d28d9] shadow-[0_0_20px_rgba(109,40,217,0.45)]"
                                            : "w-2 bg-white/15",
                                    )}
                                />
                            ))}
                        </div>
                    </div>

                    <div
                        className={cn(
                            step === 2
                                ? "rounded-[30px] border border-white/10 bg-white/[0.025] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6"
                                : "px-0 py-1",
                        )}
                    >
                        {step === 0 && (
                            <div className="mx-auto max-w-[680px] space-y-6">
                                <p className="max-w-[52ch] text-sm leading-relaxed text-white/44">{helperBody}</p>

                                <input
                                    value={objective}
                                    onChange={(event) => applyObjective(event.target.value)}
                                    placeholder={blockCopy.objective}
                                    autoFocus
                                    className="h-16 w-full rounded-[26px] border border-white/[0.08] bg-white/[0.04] px-5 text-base text-white outline-none transition-colors placeholder:text-white/22 focus:border-white/18 focus:bg-white/[0.05]"
                                />

                                <div className="flex flex-wrap gap-2">
                                    {recentObjective && recentObjective !== objective.trim() && (
                                        <button
                                            type="button"
                                            onClick={() => applyObjective(recentObjective)}
                                            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/58 transition-colors hover:bg-white/[0.08] hover:text-white"
                                        >
                                            {copy.actions.resume} {recentObjective}
                                        </button>
                                    )}
                                    {blockSeed && blockSeed !== objective.trim() && !/^(new block|focus block|bloque de foco|nuevo bloque)$/i.test(blockSeed) && (
                                        <button
                                            type="button"
                                            onClick={() => applyObjective(blockSeed)}
                                            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/58 transition-colors hover:bg-white/[0.08] hover:text-white"
                                        >
                                            {copy.actions.useBlockTitle}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="mx-auto max-w-[680px] space-y-6">
                                <p className="max-w-[52ch] text-sm leading-relaxed text-white/44">{helperBody}</p>

                                <input
                                    value={nextStep}
                                    onChange={(event) => applyNextStep(event.target.value)}
                                    placeholder={blockCopy.nextStep}
                                    autoFocus
                                    className="h-16 w-full rounded-[26px] border border-white/[0.08] bg-white/[0.04] px-5 text-base text-white outline-none transition-colors placeholder:text-white/22 focus:border-white/18 focus:bg-white/[0.05]"
                                />

                                <div className="flex flex-wrap gap-2">
                                    {recentNextStep && recentNextStep !== nextStep.trim() && (
                                        <button
                                            type="button"
                                            onClick={() => applyNextStep(recentNextStep)}
                                            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/58 transition-colors hover:bg-white/[0.08] hover:text-white"
                                        >
                                            {copy.actions.continueWith} {recentNextStep}
                                        </button>
                                    )}
                                    {blockNextStepSeed && blockNextStepSeed !== nextStep.trim() && (
                                        <button
                                            type="button"
                                            onClick={() => applyNextStep(blockNextStepSeed)}
                                            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/58 transition-colors hover:bg-white/[0.08] hover:text-white"
                                        >
                                            {copy.actions.useBlockNote}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-5">
                                <p className="max-w-[52ch] text-sm leading-relaxed text-white/44">{helperBody}</p>

                                <div className="grid gap-3 pt-1 sm:grid-cols-2">
                                    {modeOptions.map((option) => {
                                        const isSelected = selectedMode === option.id;
                                        const isSuggested = ritual.suggestedStartMode === option.id;

                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => updateEntryRitual({ selectedStartMode: option.id })}
                                                className={cn(
                                                    "relative rounded-[26px] border p-4 text-left transition-all duration-200",
                                                    isSelected
                                                        ? "border-transparent bg-gradient-to-r from-[#4c1d95] to-[#6d28d9] text-white shadow-[0_16px_36px_rgba(109,40,217,0.3)]"
                                                        : "border-white/[0.08] bg-white/[0.035] text-white/70 hover:border-white/14 hover:bg-white/[0.06]",
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="space-y-1.5">
                                                        <p className={cn("text-sm font-semibold tracking-tight", isSelected ? "text-white" : "text-white/85")}>
                                                            {option.label}
                                                        </p>
                                                        <p className={cn("text-xs leading-relaxed", isSelected ? "text-white/75" : "text-white/45")}>
                                                            {option.hint}
                                                        </p>
                                                    </div>

                                                    {isSuggested && (
                                                        <span
                                                            className={cn(
                                                                "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                                                                isSelected
                                                                    ? "border-white/20 bg-white/10 text-white/80"
                                                                    : "border-[#7C3AED]/30 bg-[#7C3AED]/10 text-[#c4b5fd]",
                                                            )}
                                                        >
                                                            {copy.actions.suggested}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {selectedMode === "micro_commit" && (
                                    <div className="space-y-3 border-t border-white/[0.08] pt-4">
                                        <label className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">
                                            {copy.actions.minimumViable}
                                        </label>
                                        <input
                                            value={minimumViable}
                                            onChange={(event) => updateEntryRitual({ minimumViable: event.target.value })}
                                            placeholder={copy.actions.minimumViablePlaceholder}
                                            className="h-14 w-full rounded-[22px] border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white outline-none transition-colors placeholder:text-white/22 focus:border-white/18 focus:bg-white/[0.05]"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            {step > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setStep((current) => Math.max(0, current - 1))}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    {copy.actions.back}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={skipEntryRitual}
                                className="inline-flex h-11 items-center justify-center rounded-full px-1 text-sm text-white/35 transition-colors hover:text-white/70"
                            >
                                {copy.actions.skipForNow}
                            </button>
                        </div>

                        <GlassButton
                            onClick={handleContinue}
                            className="h-12 rounded-full px-6"
                            disabled={(step === 0 && !objective.trim()) || (step === 1 && !nextStep.trim())}
                        >
                            {step === 2 ? copy.actions.startBlock : copy.actions.continue}
                            <ArrowRight className="h-4 w-4" />
                        </GlassButton>
                    </div>
                </div>
            </div>
        </div>
    );
}
