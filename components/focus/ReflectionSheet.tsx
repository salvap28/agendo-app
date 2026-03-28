"use client";

import { useMemo, useState } from "react";
import {
    CheckCircle2,
    Feather,
    Footprints,
    Frown,
    Gauge,
    LucideIcon,
    Meh,
    Mountain,
    Rocket,
    Smile,
    Sparkles,
    Turtle,
    X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { saveSessionReflection } from "@/lib/services/focusService";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useFocusStore } from "@/lib/stores/focusStore";
import { useI18n } from "@/lib/i18n/client";
import { getReflectionCopy } from "@/lib/i18n/ui";

type ReflectionMetrics = {
    difficulty: number;
    progressFeelingAfter: number;
    moodAfter: number;
};

type MetricOption = {
    value: number;
    label: string;
    hint: string;
    icon: LucideIcon;
};

interface MetricChoiceGroupProps {
    label: string;
    description: string;
    value: number;
    options: MetricOption[];
    onChange: (value: number) => void;
    emphasized?: boolean;
    emphasizedLabel: string;
}

function MetricChoiceGroup({
    label,
    description,
    value,
    options,
    onChange,
    emphasized = false,
    emphasizedLabel,
}: MetricChoiceGroupProps) {
    const gridClassName = options.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3";

    return (
        <div className="space-y-3 sm:space-y-3.5">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold tracking-tight text-white/90">{label}</h3>
                    {emphasized && (
                        <span className="rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c4b5fd]">
                            {emphasizedLabel}
                        </span>
                    )}
                </div>
                <p className="text-sm text-white/45">{description}</p>
            </div>

            <div className={cn("grid gap-2.5", gridClassName)}>
                {options.map((option) => {
                    const isSelected = value === option.value;
                    const Icon = option.icon;

                    return (
                        <button
                            key={`${label}-${option.value}`}
                            type="button"
                            onClick={() => onChange(option.value)}
                            className={cn(
                                "group flex min-h-[84px] flex-col items-start justify-between rounded-2xl border px-3 py-3 text-left transition-all duration-300 motion-reduce:transition-none sm:min-h-[92px] sm:px-3.5 sm:py-3.5",
                                isSelected
                                    ? "border-transparent bg-gradient-to-r from-[#4c1d95] to-[#6d28d9] text-white shadow-[0_14px_30px_rgba(109,40,217,0.28)]"
                                    : "border-white/10 bg-white/5 text-white/65 hover:border-white/15 hover:bg-white/[0.08]",
                            )}
                            aria-pressed={isSelected}
                        >
                            <span
                                className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-2xl border transition-all duration-300 motion-reduce:transition-none",
                                    isSelected
                                        ? "border-white/15 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                                        : "border-white/10 bg-black/20",
                                )}
                            >
                                <Icon className={cn("h-[18px] w-[18px]", isSelected ? "text-white" : "text-white/70")} />
                            </span>

                            <div className="space-y-0.5">
                                <p className={cn("text-[13px] font-semibold tracking-tight sm:text-sm", isSelected ? "text-white" : "text-white/80")}>
                                    {option.label}
                                </p>
                                <p className={cn("text-[11px]", isSelected ? "text-white/75" : "text-white/40")}>
                                    {option.hint}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function ReflectionSheet() {
    const { language } = useI18n();
    const { session } = useFocusStore();
    const { createBlock } = useBlocksStore();
    const copy = useMemo(() => getReflectionCopy(language), [language]);
    const progressOptions: MetricOption[] = useMemo(() => ([
        { value: 1, ...copy.progressOptions.minimal, icon: Turtle },
        { value: 3, ...copy.progressOptions.solid, icon: Footprints },
        { value: 5, ...copy.progressOptions.strong, icon: Rocket },
    ]), [copy.progressOptions]);
    const difficultyOptions: MetricOption[] = useMemo(() => ([
        { value: 1, ...copy.difficultyOptions.light, icon: Feather },
        { value: 3, ...copy.difficultyOptions.tense, icon: Gauge },
        { value: 5, ...copy.difficultyOptions.heavy, icon: Mountain },
    ]), [copy.difficultyOptions]);
    const moodOptions: MetricOption[] = useMemo(() => ([
        { value: 1, ...copy.moodOptions.low, icon: Frown },
        { value: 3, ...copy.moodOptions.calm, icon: Meh },
        { value: 4, ...copy.moodOptions.good, icon: Smile },
        { value: 5, ...copy.moodOptions.up, icon: Sparkles },
    ]), [copy.moodOptions]);

    const [metrics, setMetrics] = useState<ReflectionMetrics>({
        difficulty: 0,
        progressFeelingAfter: 0,
        moodAfter: 0,
    });
    const [reflection, setReflection] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const question = useMemo(
        () => copy.questions[Math.floor(Math.random() * copy.questions.length)],
        [copy.questions],
    );

    const canFinish = metrics.progressFeelingAfter > 0 && !isSaving;
    const isFree = session?.mode === "free";
    const blockTitle = copy.freeBlockTitle;
    const closureHint = session?.closureNote?.text?.trim() || null;

    const setMetric = (metric: keyof ReflectionMetrics, value: number) => {
        setMetrics((current) => ({
            ...current,
            [metric]: value,
        }));
    };

    const handleClose = () => {
        useFocusStore.setState({ session: null });
    };

    const handleFinish = async () => {
        if (!session || !session.endedAt || !canFinish) return;
        setIsSaving(true);

        try {
            await saveSessionReflection(session.id, session.intention, {
                difficulty: metrics.difficulty > 0 ? metrics.difficulty : undefined,
                progressFeelingAfter: metrics.progressFeelingAfter > 0 ? metrics.progressFeelingAfter : undefined,
                moodAfter: metrics.moodAfter > 0 ? metrics.moodAfter : undefined,
                notes: reflection.trim() || undefined,
            });

            if (session.mode === "free") {
                createBlock({
                    title: blockTitle,
                    type: "deep_work",
                    startAt: new Date(session.startedAt),
                    endAt: new Date(session.endedAt),
                    status: "completed",
                    notes: reflection.trim() || undefined,
                });
            }
        } catch (error) {
            console.error("Failed to save reflection cleanly", error);
        } finally {
            useFocusStore.setState({ session: null });
            setIsSaving(false);
        }
    };

    if (!session || !session.endedAt || session.persistenceStatus !== "persisted") return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto px-4 py-4 text-white animate-in fade-in duration-400 sm:items-center sm:px-6 sm:py-6">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-2xl" />

            <div className="relative z-10 my-auto w-full max-w-[460px] overflow-hidden rounded-[24px] border border-white/10 bg-[#0a0b12]/92 font-sans shadow-[0_28px_80px_rgba(0,0,0,0.72)] backdrop-blur-3xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-400 sm:max-w-[620px]">
                <div className="pointer-events-none absolute inset-x-10 top-0 h-20 rounded-full bg-emerald-400/20 blur-3xl" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/45 to-transparent" />
                <div className="pointer-events-none absolute inset-0 rounded-[24px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />

                <div className="relative z-10 flex max-h-[calc(100dvh-2rem)] flex-col sm:max-h-[min(90dvh,860px)]">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="absolute right-5 top-5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/45 transition-all duration-200 hover:bg-white/10 hover:text-white/90 motion-reduce:transition-none"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    <div className="overflow-y-auto px-5 py-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-7 sm:py-7">
                        <div className="space-y-5 pr-10 sm:space-y-6">
                            <div className="space-y-3">
                                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.16)]">
                                    {isFree ? <Sparkles className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                                </div>

                                <div className="space-y-1.5">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200/70">
                                        {copy.closeBadge}
                                    </p>
                                    <h2 className="text-[1.75rem] font-semibold tracking-tight text-white/90 sm:text-2xl">
                                        {isFree ? copy.sessionCompleted : copy.blockCompleted}
                                    </h2>
                                    <p className="max-w-[36ch] text-sm leading-relaxed text-white/45">{question}</p>
                                </div>
                            </div>

                            <div className="space-y-4 sm:space-y-5">
                                <MetricChoiceGroup
                                    label={copy.progressLabel}
                                    description={copy.progressDescription}
                                    value={metrics.progressFeelingAfter}
                                    options={progressOptions}
                                    onChange={(value) => setMetric("progressFeelingAfter", value)}
                                    emphasized
                                    emphasizedLabel={copy.primary}
                                />

                                <MetricChoiceGroup
                                    label={copy.difficultyLabel}
                                    description={copy.difficultyDescription}
                                    value={metrics.difficulty}
                                    options={difficultyOptions}
                                    onChange={(value) => setMetric("difficulty", value)}
                                    emphasizedLabel={copy.primary}
                                />

                                <MetricChoiceGroup
                                    label={copy.moodLabel}
                                    description={copy.moodDescription}
                                    value={metrics.moodAfter}
                                    options={moodOptions}
                                    onChange={(value) => setMetric("moodAfter", value)}
                                    emphasizedLabel={copy.primary}
                                />
                            </div>

                            {closureHint && (
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                                        {copy.closureHintTitle}
                                    </p>
                                    <p className="mt-1 leading-relaxed text-white/72">
                                        &ldquo;{closureHint}&rdquo;
                                    </p>
                                    <p className="mt-2 text-xs text-white/40">{copy.closureHintBody}</p>
                                </div>
                            )}

                            <textarea
                                rows={3}
                                placeholder={copy.notePlaceholder}
                                value={reflection}
                                onChange={(event) => setReflection(event.target.value)}
                                className="min-h-[88px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-relaxed text-white/85 placeholder:text-white/28 outline-none transition-all duration-200 focus:border-white/20 focus:bg-black/25 motion-reduce:transition-none sm:min-h-[92px]"
                            />
                        </div>
                    </div>

                    <div className="shrink-0 border-t border-white/10 bg-[linear-gradient(180deg,rgba(10,11,18,0.94),rgba(10,11,18,1))] px-5 py-4 backdrop-blur-2xl sm:px-7 sm:py-5">
                        <button
                            type="button"
                            onClick={handleFinish}
                            disabled={!canFinish}
                            className={cn(
                                "inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold tracking-tight transition-all duration-300 motion-reduce:transition-none",
                                canFinish
                                    ? "bg-gradient-to-r from-[#4c1d95] to-[#6d28d9] text-white shadow-[0_16px_34px_rgba(109,40,217,0.32)] hover:from-[#5b21b6] hover:to-[#7c3aed] active:scale-[0.985]"
                                    : "cursor-not-allowed bg-white/8 text-white/55 opacity-50",
                            )}
                        >
                            {isSaving ? copy.saving : copy.saveAndFinish}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
