"use client";

import { AlertCircle, Check, Clock3, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { PlanningRecommendation } from "@/lib/types/planning";
import { GlassButton } from "@/components/ui/glass-button";

interface PlanningRecommendationCardProps {
    recommendation: PlanningRecommendation;
    compact?: boolean;
    onApply?: (recommendation: PlanningRecommendation) => void;
    onDismiss?: (recommendation: PlanningRecommendation) => void;
    onAccept?: (recommendation: PlanningRecommendation) => void;
    applying?: boolean;
}

function getPriorityTone(priority: PlanningRecommendation["priority"]) {
    switch (priority) {
        case "high":
            return "border-amber-400/25 bg-amber-500/10";
        case "medium":
            return "border-sky-400/20 bg-sky-500/10";
        default:
            return "border-white/10 bg-white/[0.04]";
    }
}

export function PlanningRecommendationCard({
    recommendation,
    compact = false,
    onApply,
    onDismiss,
    onAccept,
    applying = false,
}: PlanningRecommendationCardProps) {
    return (
        <div
            className={cn(
                "rounded-[24px] border p-4 text-left backdrop-blur-xl shadow-[0_18px_55px_-28px_rgba(0,0,0,0.8)]",
                getPriorityTone(recommendation.priority),
                compact ? "space-y-3" : "space-y-4",
            )}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white/80">
                    {recommendation.priority === "high" ? <AlertCircle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                        <span>{recommendation.scope === "day" ? "Day plan" : "Block"}</span>
                        <span className="h-1 w-1 rounded-full bg-white/20" />
                        <span>{Math.round(recommendation.confidence * 100)}% confidence</span>
                    </div>
                    <h3 className="text-sm font-semibold tracking-tight text-white">{recommendation.title}</h3>
                    <p className="text-sm leading-6 text-white/68">{recommendation.message}</p>
                </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Why now</p>
                <p className="mt-1 text-sm leading-6 text-white/64">{recommendation.reason}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/46">
                <span className="rounded-full border border-white/10 px-2.5 py-1">
                    {recommendation.evidence.hypothesisStrength === "stable"
                        ? "Stable pattern"
                        : recommendation.evidence.hypothesisStrength === "recent"
                            ? "Recent signal"
                            : "Soft hypothesis"}
                </span>
                <span className="rounded-full border border-white/10 px-2.5 py-1">
                    {recommendation.evidence.sampleSize} samples
                </span>
                {recommendation.evidence.lastUpdated && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1">
                        <Clock3 className="h-3 w-3" />
                        {new Date(recommendation.evidence.lastUpdated).toLocaleDateString()}
                    </span>
                )}
                <span className="rounded-full border border-white/10 px-2.5 py-1">
                    {recommendation.applyability.mode === "auto"
                        ? "Auto-applicable"
                        : recommendation.applyability.mode === "manual"
                            ? "Manual adjustment"
                            : "Read-only guidance"}
                </span>
            </div>

            <p className="text-xs leading-5 text-white/44">
                {recommendation.applyability.helperText}
            </p>

            <div className="flex flex-wrap gap-2">
                {onApply && recommendation.applyability.mode === "auto" && (
                    <GlassButton
                        onClick={() => onApply(recommendation)}
                        variant="primary"
                        size="sm"
                        className="h-9 rounded-xl border-white/10"
                        disabled={applying}
                    >
                        <Check className="h-4 w-4" />
                        {applying ? "Applying..." : recommendation.suggestedAction.label}
                    </GlassButton>
                )}
                {onAccept && (
                    <GlassButton
                        onClick={() => onAccept(recommendation)}
                        variant="default"
                        size="sm"
                        className="h-9 rounded-xl border-white/10"
                    >
                        {recommendation.applyability.mode === "manual" ? "Handle manually" : "Review later"}
                    </GlassButton>
                )}
                {onDismiss && recommendation.dismissible && (
                    <button
                        onClick={() => onDismiss(recommendation)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 text-xs font-medium text-white/46 transition-colors hover:bg-white/[0.06] hover:text-white/80"
                    >
                        <X className="h-3.5 w-3.5" />
                        Dismiss
                    </button>
                )}
            </div>
        </div>
    );
}
