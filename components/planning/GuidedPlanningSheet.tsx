"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Brain,
    CalendarRange,
    ChevronRight,
    Clock,
    Flame,
    LoaderCircle,
    RefreshCw,
    Sparkles,
    X,
    Zap,
} from "lucide-react";
import {
    acceptPlanningRecommendation,
    applyPlanningRecommendation,
    canApplyRecommendation,
    dismissPlanningRecommendation,
    fetchGuidedPlanning,
} from "@/lib/services/planningService";
import { PlanningGuideResult, PlanningRecommendation } from "@/lib/types/planning";
import { PlanningRecommendationCard } from "./PlanningRecommendationCard";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useI18n } from "@/lib/i18n/client";
import { getIntlLocale } from "@/lib/i18n/app";

interface GuidedPlanningSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    date: string;
}

export function GuidedPlanningSheet({ open, onOpenChange, date }: GuidedPlanningSheetProps) {
    const { language } = useI18n();
    const intlLocale = getIntlLocale(language);
    const copy = useMemo(() => (
        language === "es"
            ? {
                defaultSummary: "Agendo revisa carga, ventanas de foco y friccion antes de sugerir un plan mas limpio.",
                overloadSummary: "El dia esta sobrecargado. Baja demanda antes de ejecutarlo.",
                highLoadSummary: "El dia viene exigente. Protege lo importante y deja aire real.",
                bestWindowSummary: (window: string) => `Tu mejor ventana hoy es ${window}. Usala para el trabajo mas demandante.`,
                lightSummary: "La estructura ya esta bastante bien, pero unos pequenos ajustes pueden bajar la friccion.",
                planningError: "No se pudo aplicar la recomendacion de planning",
                title: "Planifica con Agendo",
                energy: "Energia",
                rigidity: "Rigidez",
                levels: {
                    low: "Baja",
                    medium: "Media",
                    high: "Alta",
                } as const,
                load: "Carga",
                intensity: "Intensidad",
                focusWindow: "Ventana de foco",
                realLoad: "Carga real",
                primeSlot: "Franja ideal",
                sequences: "secuencias",
                energyLeft: (value: number) => `${value}% energia`,
                calibrating: "Calibrando",
                readingPlan: "Leyendo tu plan...",
                noIntervention: "No hace falta intervenir fuerte. El dia se ve razonable para tu contexto reciente.",
                guidedStructure: "Estructura guiada",
                protect: "Proteger",
                lighten: "Aligerar",
                recover: "Recuperar",
                pace: "Ritmo",
                minutesSuggested: (value: number) => `${value} min sugeridos`,
                noDurationChange: "Sin cambio de duracion",
                refresh: "Actualizar",
            }
            : {
                defaultSummary: "Agendo checks load, focus windows, and friction before suggesting a cleaner plan.",
                overloadSummary: "This day is overloaded. Lower demand before execution.",
                highLoadSummary: "This day is demanding. Protect the important blocks and leave real air.",
                bestWindowSummary: (window: string) => `Your strongest window right now is ${window}. Use it for the harder work.`,
                lightSummary: "The structure is mostly reasonable, but a few small moves could still lower friction.",
                planningError: "Failed to apply planning recommendation",
                title: "Plan with Agendo",
                energy: "Energy",
                rigidity: "Rigidity",
                levels: {
                    low: "Low",
                    medium: "Medium",
                    high: "High",
                } as const,
                load: "Load",
                intensity: "Intensity",
                focusWindow: "Focus window",
                realLoad: "Real load",
                primeSlot: "Prime slot",
                sequences: "sequences",
                energyLeft: (value: number) => `${value}% energy`,
                calibrating: "Calibrating",
                readingPlan: "Reading your plan...",
                noIntervention: "No strong intervention needed. The day looks reasonable for your recent context.",
                guidedStructure: "Guided structure",
                protect: "Protect",
                lighten: "Lighten",
                recover: "Recover",
                pace: "Pace",
                minutesSuggested: (value: number) => `${value} min suggested`,
                noDurationChange: "No duration change",
                refresh: "Refresh",
            }
    ), [language]);

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
        if (!guide) return copy.defaultSummary;
        if (guide.dailyLoad.level === "overload") return copy.overloadSummary;
        if (guide.dailyLoad.level === "high") return copy.highLoadSummary;
        if (guide.bestFocusWindow) return copy.bestWindowSummary(guide.bestFocusWindow);
        return copy.lightSummary;
    }, [copy, guide]);

    const handleDismiss = useCallback(async (recommendation: PlanningRecommendation) => {
        await dismissPlanningRecommendation(recommendation.id);
        await refresh();
    }, [refresh]);

    const handleAccept = useCallback(async (recommendation: PlanningRecommendation) => {
        await acceptPlanningRecommendation(recommendation.id);
        await refresh();
    }, [refresh]);

    const handleApply = useCallback(async (recommendation: PlanningRecommendation) => {
        setApplyingId(recommendation.id);
        try {
            await applyPlanningRecommendation(recommendation.id);
            await fetchBlocks();
            await refresh();
        } catch (error) {
            console.error(copy.planningError, error);
            await refresh();
        } finally {
            setApplyingId(null);
        }
    }, [copy.planningError, fetchBlocks, refresh]);

    if (!open) return null;

    const emphasisColors: Record<string, { bg: string; border: string; text: string }> = {
        protect: { bg: "rgba(110,231,183,0.1)", border: "rgba(110,231,183,0.2)", text: "rgba(110,231,183,0.85)" },
        lighten: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)", text: "rgba(251,191,36,0.85)" },
        recover: { bg: "rgba(131,176,255,0.1)", border: "rgba(131,176,255,0.2)", text: "rgba(131,176,255,0.85)" },
        pace: { bg: "rgba(193,167,255,0.1)", border: "rgba(193,167,255,0.2)", text: "rgba(193,167,255,0.85)" },
    };

    const loadColor = guide?.dailyLoad.level === "overload"
        ? "rgba(251,113,133,"
        : guide?.dailyLoad.level === "high"
            ? "rgba(251,191,36,"
            : "rgba(110,231,183,";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
            onClick={(event) => {
                if (event.target === event.currentTarget) onOpenChange(false);
            }}
        >
            <div
                className="relative flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[28px]"
                style={{
                    background: "linear-gradient(180deg, rgba(15,12,25,0.97) 0%, rgba(7,8,11,0.98) 100%)",
                    border: "1px solid rgba(193,167,255,0.12)",
                    boxShadow: "0 40px 120px -30px rgba(0,0,0,0.8), 0 0 80px -20px rgba(193,167,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
            >
                <div
                    className="absolute left-[10%] right-[10%] top-0 h-[1px]"
                    style={{
                        background: "linear-gradient(90deg, transparent, rgba(193,167,255,0.3), rgba(131,176,255,0.3), transparent)",
                    }}
                />

                <div className="relative flex items-start justify-between px-6 pb-4 pt-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-2.5">
                            <div
                                className="flex h-8 w-8 items-center justify-center rounded-xl"
                                style={{
                                    background: "linear-gradient(135deg, rgba(193,167,255,0.15), rgba(131,176,255,0.1))",
                                    border: "1px solid rgba(193,167,255,0.15)",
                                }}
                            >
                                <Sparkles className="h-4 w-4 text-[#c1a7ff]" />
                            </div>
                            <h2
                                className="text-lg font-bold tracking-tight"
                                style={{
                                    background: "linear-gradient(90deg, rgba(255,255,255,0.95), rgba(193,167,255,0.8))",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                }}
                            >
                                {copy.title}
                            </h2>
                        </div>
                        <p className="mt-2 max-w-[480px] text-[13px] leading-relaxed text-white/50">
                            {summary}
                        </p>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full transition-all hover:scale-110 hover:bg-white/[0.08]"
                        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                        <X className="h-3.5 w-3.5 text-white/40" />
                    </button>
                </div>

                <div
                    className="mx-6 h-[1px]"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }}
                />

                <div
                    className="flex-1 space-y-4 overflow-y-auto px-6 py-4"
                    style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "rgba(255,255,255,0.08) transparent",
                    }}
                >
                    <div
                        className="rounded-[20px] p-3"
                        style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.05)",
                        }}
                    >
                        <div className="mb-3 flex items-center gap-2">
                            <CalendarRange className="h-3 w-3 text-white/30" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                                {new Date(`${date}T12:00:00`).toLocaleDateString(intlLocale, {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "short",
                                })}
                            </span>
                        </div>

                        <div className="mb-2 flex items-center gap-2">
                            <Zap className="h-3 w-3 shrink-0 text-amber-400/50" />
                            <div
                                className="relative flex h-[30px] flex-1 overflow-hidden rounded-full"
                                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                            >
                                <div
                                    className="pointer-events-none absolute bottom-[2px] top-[2px] rounded-full"
                                    style={{
                                        width: "calc(33.3333% - 4px)",
                                        left: `calc(${(["low", "medium", "high"].indexOf(energy)) * 33.3333}% + 2px)`,
                                        background: "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(255,214,153,0.08))",
                                        border: "1px solid rgba(251,191,36,0.2)",
                                        boxShadow: "0 0 10px rgba(251,191,36,0.1)",
                                        transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                    }}
                                />
                                {(["low", "medium", "high"] as const).map((level) => (
                                    <div
                                        key={`energy-${level}`}
                                        onClick={() => setEnergy(level)}
                                        className="relative z-10 flex flex-1 cursor-pointer select-none items-center justify-center transition-colors duration-200"
                                        style={{ color: energy === level ? "rgba(255,214,153,0.9)" : "rgba(255,255,255,0.35)" }}
                                    >
                                        <span className="text-[10px] font-semibold">{copy.levels[level]}</span>
                                    </div>
                                ))}
                            </div>
                            <span className="w-12 text-right text-[9px] uppercase tracking-wider text-white/25">{copy.energy}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Brain className="h-3 w-3 shrink-0 text-sky-400/50" />
                            <div
                                className="relative flex h-[30px] flex-1 overflow-hidden rounded-full"
                                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                            >
                                <div
                                    className="pointer-events-none absolute bottom-[2px] top-[2px] rounded-full"
                                    style={{
                                        width: "calc(33.3333% - 4px)",
                                        left: `calc(${(["low", "medium", "high"].indexOf(rigidity)) * 33.3333}% + 2px)`,
                                        background: "linear-gradient(135deg, rgba(131,176,255,0.18), rgba(131,176,255,0.08))",
                                        border: "1px solid rgba(131,176,255,0.2)",
                                        boxShadow: "0 0 10px rgba(131,176,255,0.1)",
                                        transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                    }}
                                />
                                {(["low", "medium", "high"] as const).map((level) => (
                                    <div
                                        key={`rigidity-${level}`}
                                        onClick={() => setRigidity(level)}
                                        className="relative z-10 flex flex-1 cursor-pointer select-none items-center justify-center transition-colors duration-200"
                                        style={{ color: rigidity === level ? "rgba(131,176,255,0.9)" : "rgba(255,255,255,0.35)" }}
                                    >
                                        <span className="text-[10px] font-semibold">{copy.levels[level]}</span>
                                    </div>
                                ))}
                            </div>
                            <span className="w-12 text-right text-[9px] uppercase tracking-wider text-white/25">{copy.rigidity}</span>
                        </div>
                    </div>

                    {guide && (
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { label: copy.load, value: guide.dailyLoad.level, sub: `${guide.dailyLoad.totalPlannedMinutes} min`, icon: Flame },
                                { label: copy.intensity, value: String(guide.dailyLoad.intenseBlocks), sub: `${guide.dailyLoad.intenseSequences} ${copy.sequences}`, icon: Zap },
                                { label: copy.focusWindow, value: guide.bestFocusWindow ?? copy.calibrating, sub: copy.primeSlot, icon: Clock },
                                { label: copy.realLoad, value: String(Math.round(guide.dailyLoad.realDayLoad)), sub: copy.energyLeft(Math.round(guide.dailyLoad.residualEnergyEstimate)), icon: Brain },
                            ].map((stat) => {
                                const Icon = stat.icon;
                                return (
                                    <div
                                        key={stat.label}
                                        className="rounded-[16px] p-2.5"
                                        style={{
                                            background: "rgba(255,255,255,0.02)",
                                            border: "1px solid rgba(255,255,255,0.05)",
                                        }}
                                    >
                                        <div className="mb-1.5 flex items-center gap-1">
                                            <Icon className="h-2.5 w-2.5 text-white/25" />
                                            <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/25">{stat.label}</p>
                                        </div>
                                        <p className="text-[13px] font-bold capitalize leading-tight tracking-tight text-white/90">{stat.value}</p>
                                        <p className="mt-0.5 text-[10px] leading-tight text-white/35">{stat.sub}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {loading && (
                        <div
                            className="flex items-center justify-center rounded-[20px] px-4 py-10 text-white/40"
                            style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.05)",
                            }}
                        >
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin text-[#c1a7ff]/50" />
                            <span className="text-[13px] font-medium">{copy.readingPlan}</span>
                        </div>
                    )}

                    {!loading && guide?.recommendations.length === 0 && (
                        <div
                            className="rounded-[20px] px-4 py-6 text-center"
                            style={{
                                background: "linear-gradient(180deg, rgba(110,231,183,0.04) 0%, rgba(110,231,183,0.01) 100%)",
                                border: "1px solid rgba(110,231,183,0.08)",
                            }}
                        >
                            <p className="text-[13px] italic leading-6 text-white/50">
                                {copy.noIntervention}
                            </p>
                        </div>
                    )}

                    {!loading && guide?.guidedPlan && (
                        <div
                            className="rounded-[20px] p-4"
                            style={{
                                background: "linear-gradient(180deg, rgba(193,167,255,0.04) 0%, rgba(131,176,255,0.02) 100%)",
                                border: "1px solid rgba(193,167,255,0.08)",
                            }}
                        >
                            <p
                                className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em]"
                                style={{
                                    background: "linear-gradient(90deg, rgba(193,167,255,0.6), rgba(131,176,255,0.5))",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                }}
                            >
                                {copy.guidedStructure}
                            </p>
                            <h3 className="text-[15px] font-bold leading-tight tracking-tight text-white/90">{guide.guidedPlan.headline}</h3>
                            <p className="mt-1.5 text-[12px] leading-5 text-white/50">{guide.guidedPlan.summary}</p>
                            <p className="mt-1 text-[12px] leading-5 text-white/35">{guide.guidedPlan.strategy}</p>

                            {guide.guidedPlan.steps.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {guide.guidedPlan.steps.map((step) => {
                                        const emphasisStyle = emphasisColors[step.emphasis] ?? emphasisColors.pace;
                                        const emphasisLabel = step.emphasis === "protect"
                                            ? copy.protect
                                            : step.emphasis === "lighten"
                                                ? copy.lighten
                                                : step.emphasis === "recover"
                                                    ? copy.recover
                                                    : copy.pace;

                                        return (
                                            <div
                                                key={`${step.order}-${step.blockId ?? "day"}`}
                                                className="flex items-start gap-2.5 rounded-[14px] px-3 py-2.5"
                                                style={{
                                                    background: "rgba(255,255,255,0.02)",
                                                    border: "1px solid rgba(255,255,255,0.04)",
                                                }}
                                            >
                                                <div
                                                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
                                                    style={{
                                                        background: "rgba(193,167,255,0.08)",
                                                        color: "rgba(193,167,255,0.6)",
                                                        border: "1px solid rgba(193,167,255,0.1)",
                                                    }}
                                                >
                                                    {step.order}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-[12px] font-semibold text-white/85">{step.title}</p>
                                                        <span
                                                            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                                                            style={{
                                                                background: emphasisStyle.bg,
                                                                border: `1px solid ${emphasisStyle.border}`,
                                                                color: emphasisStyle.text,
                                                            }}
                                                        >
                                                            {emphasisLabel}
                                                        </span>
                                                    </div>
                                                    <p className="mt-0.5 text-[11px] leading-5 text-white/45">{step.reason}</p>
                                                    <p className="mt-1 text-[10px] text-white/30">
                                                        {step.recommendedDurationMinutes
                                                            ? copy.minutesSuggested(step.recommendedDurationMinutes)
                                                            : copy.noDurationChange}
                                                        {step.suggestedStart && ` · ${new Date(step.suggestedStart).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })}`}
                                                    </p>
                                                </div>
                                                <ChevronRight className="mt-1 h-3 w-3 shrink-0 text-white/15" />
                                            </div>
                                        );
                                    })}
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
                </div>

                <div
                    className="relative flex justify-end px-6 py-3"
                    style={{
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                        background: "rgba(0,0,0,0.2)",
                    }}
                >
                    <button
                        onClick={() => void refresh()}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold transition-all hover:scale-[1.03] disabled:opacity-50"
                        style={{
                            background: `linear-gradient(135deg, ${loadColor}0.15), rgba(131,176,255,0.1))`,
                            border: `1px solid ${loadColor}0.2)`,
                            color: "rgba(193,167,255,0.9)",
                            boxShadow: "0 4px 16px -4px rgba(193,167,255,0.15)",
                        }}
                    >
                        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                        {copy.refresh}
                    </button>
                </div>
            </div>
        </div>
    );
}
