"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, LoaderCircle, Sparkles, X, RefreshCw, Zap, Flame, Clock, Brain, ChevronRight } from "lucide-react";
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
        } catch (error) {
            console.error("Failed to apply planning recommendation", error);
            await refresh();
        } finally {
            setApplyingId(null);
        }
    };

    if (!open) return null;

    // Emphasis label colors
    const emphasisColors: Record<string, { bg: string; border: string; text: string }> = {
        protect: { bg: "rgba(110,231,183,0.1)", border: "rgba(110,231,183,0.2)", text: "rgba(110,231,183,0.85)" },
        lighten: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)", text: "rgba(251,191,36,0.85)" },
        recover: { bg: "rgba(131,176,255,0.1)", border: "rgba(131,176,255,0.2)", text: "rgba(131,176,255,0.85)" },
        pace: { bg: "rgba(193,167,255,0.1)", border: "rgba(193,167,255,0.2)", text: "rgba(193,167,255,0.85)" },
    };

    const getEmphasisStyle = (emphasis: string) => emphasisColors[emphasis] ?? emphasisColors.pace;

    // Load level colors
    const loadColor = guide?.dailyLoad.level === "overload"
        ? "rgba(251,113,133,"
        : guide?.dailyLoad.level === "high"
            ? "rgba(251,191,36,"
            : "rgba(110,231,183,";

    return (
        // Backdrop
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
        >
            {/* Overlay panel */}
            <div
                className="relative flex w-full max-w-[640px] max-h-[90vh] flex-col rounded-[28px] overflow-hidden"
                style={{
                    background: "linear-gradient(180deg, rgba(15,12,25,0.97) 0%, rgba(7,8,11,0.98) 100%)",
                    border: "1px solid rgba(193,167,255,0.12)",
                    boxShadow: "0 40px 120px -30px rgba(0,0,0,0.8), 0 0 80px -20px rgba(193,167,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
            >
                {/* Top shimmer */}
                <div className="absolute top-0 left-[10%] right-[10%] h-[1px]" style={{
                    background: "linear-gradient(90deg, transparent, rgba(193,167,255,0.3), rgba(131,176,255,0.3), transparent)",
                }} />

                {/* Header */}
                <div className="relative flex items-start justify-between px-6 pt-6 pb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{
                                background: "linear-gradient(135deg, rgba(193,167,255,0.15), rgba(131,176,255,0.1))",
                                border: "1px solid rgba(193,167,255,0.15)",
                            }}>
                                <Sparkles className="h-4 w-4 text-[#c1a7ff]" />
                            </div>
                            <h2 className="text-lg font-bold tracking-tight" style={{
                                background: "linear-gradient(90deg, rgba(255,255,255,0.95), rgba(193,167,255,0.8))",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}>
                                Planea con Agendo
                            </h2>
                        </div>
                        <p className="mt-2 text-[13px] leading-relaxed text-white/50 max-w-[480px]">
                            {summary}
                        </p>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full transition-all hover:bg-white/[0.08] hover:scale-110"
                        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                        <X className="h-3.5 w-3.5 text-white/40" />
                    </button>
                </div>

                {/* Separator */}
                <div className="mx-6 h-[1px]" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.08) transparent",
                }}>
                    {/* Context bar: date + filters */}
                    <div className="rounded-[20px] p-3" style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.05)",
                    }}>
                        <div className="flex items-center gap-2 mb-3">
                            <CalendarRange className="h-3 w-3 text-white/30" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                                {new Date(`${date}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}
                            </span>
                        </div>

                        {/* Energy segmented pill */}
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-3 w-3 text-amber-400/50 shrink-0" />
                            <div className="relative flex h-[30px] flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <div className="absolute top-[2px] bottom-[2px] rounded-full pointer-events-none" style={{
                                    width: `calc(${100/3}% - 4px)`,
                                    left: `calc(${(["low","medium","high"].indexOf(energy)) * (100/3)}% + 2px)`,
                                    background: "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(255,214,153,0.08))",
                                    border: "1px solid rgba(251,191,36,0.2)",
                                    boxShadow: "0 0 10px rgba(251,191,36,0.1)",
                                    transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                }} />
                                {(["low","medium","high"] as const).map((level) => (
                                    <div
                                        key={`energy-${level}`}
                                        onClick={() => setEnergy(level)}
                                        className="relative z-10 flex-1 flex items-center justify-center cursor-pointer select-none transition-colors duration-200"
                                        style={{ color: energy === level ? "rgba(255,214,153,0.9)" : "rgba(255,255,255,0.35)" }}
                                    >
                                        <span className="text-[10px] font-semibold capitalize">{level}</span>
                                    </div>
                                ))}
                            </div>
                            <span className="text-[9px] uppercase tracking-wider text-white/25 w-12 text-right">Energy</span>
                        </div>

                        {/* Rigidity segmented pill */}
                        <div className="flex items-center gap-2">
                            <Brain className="h-3 w-3 text-sky-400/50 shrink-0" />
                            <div className="relative flex h-[30px] flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <div className="absolute top-[2px] bottom-[2px] rounded-full pointer-events-none" style={{
                                    width: `calc(${100/3}% - 4px)`,
                                    left: `calc(${(["low","medium","high"].indexOf(rigidity)) * (100/3)}% + 2px)`,
                                    background: "linear-gradient(135deg, rgba(131,176,255,0.18), rgba(131,176,255,0.08))",
                                    border: "1px solid rgba(131,176,255,0.2)",
                                    boxShadow: "0 0 10px rgba(131,176,255,0.1)",
                                    transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                }} />
                                {(["low","medium","high"] as const).map((level) => (
                                    <div
                                        key={`rigidity-${level}`}
                                        onClick={() => setRigidity(level)}
                                        className="relative z-10 flex-1 flex items-center justify-center cursor-pointer select-none transition-colors duration-200"
                                        style={{ color: rigidity === level ? "rgba(131,176,255,0.9)" : "rgba(255,255,255,0.35)" }}
                                    >
                                        <span className="text-[10px] font-semibold capitalize">{level}</span>
                                    </div>
                                ))}
                            </div>
                            <span className="text-[9px] uppercase tracking-wider text-white/25 w-12 text-right">Rigidity</span>
                        </div>
                    </div>

                    {/* Stats grid */}
                    {guide && (
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { label: "Load", value: guide.dailyLoad.level, sub: `${guide.dailyLoad.totalPlannedMinutes} min`, icon: Flame },
                                { label: "Intensity", value: String(guide.dailyLoad.intenseBlocks), sub: `${guide.dailyLoad.intenseSequences} sequences`, icon: Zap },
                                { label: "Focus window", value: guide.bestFocusWindow ?? "Calibrating", sub: "Prime slot", icon: Clock },
                                { label: "Real load", value: String(Math.round(guide.dailyLoad.realDayLoad)), sub: `${Math.round(guide.dailyLoad.residualEnergyEstimate)}% energy`, icon: Brain },
                            ].map((stat) => {
                                const Icon = stat.icon;
                                return (
                                    <div key={stat.label} className="rounded-[16px] p-2.5" style={{
                                        background: "rgba(255,255,255,0.02)",
                                        border: "1px solid rgba(255,255,255,0.05)",
                                    }}>
                                        <div className="flex items-center gap-1 mb-1.5">
                                            <Icon className="h-2.5 w-2.5 text-white/25" />
                                            <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/25">{stat.label}</p>
                                        </div>
                                        <p className="text-[13px] font-bold tracking-tight text-white/90 capitalize leading-tight">{stat.value}</p>
                                        <p className="text-[10px] text-white/35 mt-0.5 leading-tight">{stat.sub}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Loading state */}
                    {loading && (
                        <div className="flex items-center justify-center rounded-[20px] px-4 py-10 text-white/40" style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.05)",
                        }}>
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin text-[#c1a7ff]/50" />
                            <span className="text-[13px] font-medium">Reading your plan...</span>
                        </div>
                    )}

                    {/* No recommendations */}
                    {!loading && guide?.recommendations.length === 0 && (
                        <div className="rounded-[20px] px-4 py-6 text-center" style={{
                            background: "linear-gradient(180deg, rgba(110,231,183,0.04) 0%, rgba(110,231,183,0.01) 100%)",
                            border: "1px solid rgba(110,231,183,0.08)",
                        }}>
                            <p className="text-[13px] leading-6 text-white/50 italic">
                                No strong intervention needed. The day looks reasonable for your recent context.
                            </p>
                        </div>
                    )}

                    {/* Guided structure */}
                    {!loading && guide?.guidedPlan && (
                        <div className="rounded-[20px] p-4" style={{
                            background: "linear-gradient(180deg, rgba(193,167,255,0.04) 0%, rgba(131,176,255,0.02) 100%)",
                            border: "1px solid rgba(193,167,255,0.08)",
                        }}>
                            <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2" style={{
                                background: "linear-gradient(90deg, rgba(193,167,255,0.6), rgba(131,176,255,0.5))",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}>Guided structure</p>
                            <h3 className="text-[15px] font-bold tracking-tight text-white/90 leading-tight">{guide.guidedPlan.headline}</h3>
                            <p className="mt-1.5 text-[12px] leading-5 text-white/50">{guide.guidedPlan.summary}</p>
                            <p className="mt-1 text-[12px] leading-5 text-white/35">{guide.guidedPlan.strategy}</p>

                            {guide.guidedPlan.steps.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {guide.guidedPlan.steps.map((step) => {
                                        const emphasisStyle = getEmphasisStyle(step.emphasis);
                                        return (
                                            <div key={`${step.order}-${step.blockId ?? "day"}`} className="flex items-start gap-2.5 rounded-[14px] px-3 py-2.5" style={{
                                                background: "rgba(255,255,255,0.02)",
                                                border: "1px solid rgba(255,255,255,0.04)",
                                            }}>
                                                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold" style={{
                                                    background: "rgba(193,167,255,0.08)",
                                                    color: "rgba(193,167,255,0.6)",
                                                    border: "1px solid rgba(193,167,255,0.1)",
                                                }}>
                                                    {step.order}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-[12px] font-semibold text-white/85">{step.title}</p>
                                                        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]" style={{
                                                            background: emphasisStyle.bg,
                                                            border: `1px solid ${emphasisStyle.border}`,
                                                            color: emphasisStyle.text,
                                                        }}>
                                                            {step.emphasis === "protect" ? "Protect"
                                                                : step.emphasis === "lighten" ? "Lighten"
                                                                    : step.emphasis === "recover" ? "Recover"
                                                                        : "Pace"}
                                                        </span>
                                                    </div>
                                                    <p className="mt-0.5 text-[11px] leading-5 text-white/45">{step.reason}</p>
                                                    <p className="mt-1 text-[10px] text-white/30">
                                                        {step.recommendedDurationMinutes ? `${step.recommendedDurationMinutes} min suggested` : "No duration change"}
                                                        {step.suggestedStart && ` · ${new Date(step.suggestedStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                                                    </p>
                                                </div>
                                                <ChevronRight className="h-3 w-3 text-white/15 mt-1 shrink-0" />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recommendations */}
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
                </div>

                {/* Footer */}
                <div className="relative px-6 py-3 flex justify-end" style={{
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    background: "rgba(0,0,0,0.2)",
                }}>
                    <button
                        onClick={() => void refresh()}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold transition-all hover:scale-[1.03] disabled:opacity-50"
                        style={{
                            background: "linear-gradient(135deg, rgba(193,167,255,0.15), rgba(131,176,255,0.1))",
                            border: "1px solid rgba(193,167,255,0.2)",
                            color: "rgba(193,167,255,0.9)",
                            boxShadow: "0 4px 16px -4px rgba(193,167,255,0.15)",
                        }}
                    >
                        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>
        </div>
    );
}
