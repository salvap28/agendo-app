"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, LoaderCircle, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GlassButton } from "@/components/ui/glass-button";
import { fetchGuidedPlanning, applyPlanningRecommendation, canApplyRecommendation, dismissPlanningRecommendation, acceptPlanningRecommendation } from "@/lib/services/planningService";
import { PlanningGuideResult, PlanningRecommendation } from "@/lib/types/planning";
import { PlanningRecommendationCard } from "./PlanningRecommendationCard";
import { useBlocksStore } from "@/lib/stores/blocksStore";

interface GuidedPlanningSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    date: string;
}

export function GuidedPlanningSheet({ open, onOpenChange, date }: GuidedPlanningSheetProps) {
    const [energy, setEnergy] = useState<"low" | "medium" | "high">("medium");
    const [rigidity, setRigidity] = useState<"low" | "medium" | "high">("medium");
    const [guide, setGuide] = useState<PlanningGuideResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [applyingId, setApplyingId] = useState<string | null>(null);
    const { blocks, fetchBlocks } = useBlocksStore();

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const nextGuide = await fetchGuidedPlanning(date, {
                preferredDate: date,
                subjectiveEnergy: energy,
                rigidity,
            });
            setGuide(nextGuide);
        } finally {
            setLoading(false);
        }
    }, [date, energy, rigidity]);

    const blockSignature = useMemo(() => (
        blocks
            .filter((block) => block.startAt.toISOString().slice(0, 10) === date)
            .map((block) => [
                block.id,
                block.startAt.toISOString(),
                block.endAt.toISOString(),
                block.type,
                block.priority ?? "",
                block.difficulty ?? "",
                block.flexibility ?? "",
                block.intensity ?? "",
                block.optional ?? "",
            ].join(":"))
            .join("|")
    ), [blocks, date]);

    useEffect(() => {
        if (!open) return;
        void refresh();
    }, [blockSignature, open, refresh]);

    const summary = useMemo(() => {
        if (!guide) return "Agendo checks load, focus windows and friction before suggesting a cleaner plan.";
        if (guide.dailyLoad.level === "overload") return "This day is overloaded. Lower demand before execution.";
        if (guide.dailyLoad.level === "high") return "This day is demanding. Protect the important blocks and leave real air.";
        if (guide.bestFocusWindow) return `Your strongest window right now is ${guide.bestFocusWindow}. Use it for the harder work.`;
        return "The structure is mostly reasonable, but a few small moves could still lower friction.";
    }, [guide]);

    const handleDismiss = async (recommendation: PlanningRecommendation) => {
        await dismissPlanningRecommendation(recommendation.id);
        await refresh();
    };

    const handleAccept = async (recommendation: PlanningRecommendation) => {
        await acceptPlanningRecommendation(recommendation.id);
        await refresh();
    };

    const handleApply = async (recommendation: PlanningRecommendation) => {
        setApplyingId(recommendation.id);
        try {
            await applyPlanningRecommendation(recommendation.id);
            await fetchBlocks();
            await refresh();
        } finally {
            setApplyingId(null);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-2xl border-l border-white/10 bg-[#07080b]/98 px-0 text-white"
            >
                <SheetHeader className="border-b border-white/8 px-6 pb-5 pt-7 text-left">
                    <SheetTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
                        <Sparkles className="h-5 w-5 text-amber-300" />
                        Plan with Agendo
                    </SheetTitle>
                    <SheetDescription className="text-sm leading-6 text-white/55">
                        {summary}
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-5 overflow-y-auto px-6 py-5">
                    <div className="rounded-[26px] border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-black/20 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-white/45">
                                <CalendarRange className="h-3.5 w-3.5" />
                                {new Date(`${date}T12:00:00`).toLocaleDateString()}
                            </div>
                            <div className="ml-auto flex flex-wrap gap-2">
                                {(["low", "medium", "high"] as const).map((level) => (
                                    <button
                                        key={`energy-${level}`}
                                        onClick={() => setEnergy(level)}
                                        className={`rounded-full px-3 py-1.5 text-xs transition-colors ${energy === level ? "bg-amber-400/20 text-amber-100" : "bg-white/[0.04] text-white/45 hover:text-white/80"}`}
                                    >
                                        Energy {level}
                                    </button>
                                ))}
                                {(["low", "medium", "high"] as const).map((level) => (
                                    <button
                                        key={`rigidity-${level}`}
                                        onClick={() => setRigidity(level)}
                                        className={`rounded-full px-3 py-1.5 text-xs transition-colors ${rigidity === level ? "bg-sky-400/20 text-sky-100" : "bg-white/[0.04] text-white/45 hover:text-white/80"}`}
                                    >
                                        Rigidity {level}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {guide && (
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Load</p>
                                    <p className="mt-1 text-lg font-semibold text-white">{guide.dailyLoad.level}</p>
                                    <p className="text-sm text-white/55">{guide.dailyLoad.totalPlannedMinutes} planned min</p>
                                </div>
                                <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Intense blocks</p>
                                    <p className="mt-1 text-lg font-semibold text-white">{guide.dailyLoad.intenseBlocks}</p>
                                    <p className="text-sm text-white/55">{guide.dailyLoad.intenseSequences} demanding runs</p>
                                </div>
                                <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Best window</p>
                                    <p className="mt-1 text-lg font-semibold text-white">{guide.bestFocusWindow ?? "Still calibrating"}</p>
                                    <p className="text-sm text-white/55">Keep it for expensive work</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {loading && (
                        <div className="flex items-center justify-center rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-10 text-white/55">
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            Reading your plan...
                        </div>
                    )}

                    {!loading && guide?.recommendations.length === 0 && (
                        <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-8 text-center text-sm leading-6 text-white/58">
                            No strong intervention is needed right now. The day looks reasonable for your recent context.
                        </div>
                    )}

                    {!loading && guide?.guidedPlan && (
                        <div className="rounded-[26px] border border-white/8 bg-black/20 p-4">
                            <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Guided structure</p>
                                <h3 className="text-lg font-semibold tracking-tight text-white">{guide.guidedPlan.headline}</h3>
                                <p className="text-sm leading-6 text-white/62">{guide.guidedPlan.summary}</p>
                                <p className="text-sm leading-6 text-white/46">{guide.guidedPlan.strategy}</p>
                            </div>

                            {guide.guidedPlan.steps.length > 0 && (
                                <div className="mt-4 space-y-3">
                                    {guide.guidedPlan.steps.map((step) => (
                                        <div key={`${step.order}-${step.blockId ?? "day"}`} className="rounded-[22px] border border-white/8 bg-white/[0.03] px-3 py-3">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/8 text-[11px] font-semibold text-white/65">
                                                    {step.order}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-semibold text-white">{step.title}</p>
                                                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/38">
                                                            {step.emphasis === "protect"
                                                                ? "Protect"
                                                                : step.emphasis === "lighten"
                                                                    ? "Lighten"
                                                                    : step.emphasis === "recover"
                                                                        ? "Recover"
                                                                        : "Pace"}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-sm leading-6 text-white/58">{step.reason}</p>
                                                    <p className="mt-2 text-xs text-white/40">
                                                        {step.recommendedDurationMinutes ? `${step.recommendedDurationMinutes} min suggested` : "No duration change"}
                                                        {step.suggestedStart && ` · ${new Date(step.suggestedStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && guide?.recommendations.map((recommendation) => (
                        <PlanningRecommendationCard
                            key={recommendation.id}
                            recommendation={recommendation}
                            onAccept={handleAccept}
                            onDismiss={handleDismiss}
                            onApply={canApplyRecommendation(recommendation) ? handleApply : undefined}
                            applying={applyingId === recommendation.id}
                        />
                    ))}

                    <div className="flex justify-end">
                        <GlassButton onClick={() => void refresh()} variant="default">
                            Refresh
                        </GlassButton>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
