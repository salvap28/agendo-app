"use client";

import { useMemo } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, RefreshCw, TimerReset, WandSparkles, X } from "lucide-react";
import { getIntlLocale } from "@/lib/i18n/app";
import { useI18n } from "@/lib/i18n/client";
import type { PlannerProposal } from "@/lib/types/planner";

interface HabitPlanningProposalSheetProps {
    open: boolean;
    proposal: PlannerProposal | null;
    busy?: boolean;
    onClose: () => void;
    onAccept: () => void;
    onLighten: () => void;
    onRegenerate: () => void;
    onAdjust: (index: number, mode: "earlier" | "later" | "shorter") => void;
}

export function HabitPlanningProposalSheet({
    open,
    proposal,
    busy = false,
    onClose,
    onAccept,
    onLighten,
    onRegenerate,
    onAdjust,
}: HabitPlanningProposalSheetProps) {
    const { language } = useI18n();
    const locale = getIntlLocale(language);
    const copy = useMemo(() => (
        language === "es"
            ? {
                badge: "Planea con Agendo",
                fallbackTitle: "Propuesta de Agendo",
                fallbackBody: "Esto es lo que protegeria primero.",
                apply: "Aplicar plan",
                lighten: "Mas liviano",
                regenerate: "Otra version",
                shorter: "Acortar",
                earlier: "-15 min",
                later: "+15 min",
                duration: (value: number) => `${value} min`,
            }
            : {
                badge: "Plan with Agendo",
                fallbackTitle: "Agendo proposal",
                fallbackBody: "This is what I would protect first.",
                apply: "Apply plan",
                lighten: "Lighter",
                regenerate: "Another version",
                shorter: "Shorter",
                earlier: "-15 min",
                later: "+15 min",
                duration: (value: number) => `${value} min`,
            }
    ), [language]);

    if (!open || !proposal) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-[720px] overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,12,20,0.98),rgba(16,12,26,0.96))] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/34">{copy.badge}</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white/95">{proposal.headline || copy.fallbackTitle}</h2>
                        <p className="mt-1 text-sm text-white/56">{proposal.summary || copy.fallbackBody}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/18 text-white/72 transition-colors hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="max-h-[58vh] space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
                    {proposal.drafts.map((draft, index) => (
                        <div
                            key={`${draft.title}:${draft.startAt}:${index}`}
                            className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-lg font-semibold tracking-[-0.03em] text-white/94">{draft.title}</p>
                                    <p className="mt-1 text-sm text-white/52">
                                        {new Date(draft.startAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} - {copy.duration(draft.durationMin)}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <MiniAction label={copy.earlier} icon={ArrowLeft} disabled={busy} onClick={() => onAdjust(index, "earlier")} />
                                    <MiniAction label={copy.later} icon={ArrowRight} disabled={busy} onClick={() => onAdjust(index, "later")} />
                                    <MiniAction label={copy.shorter} icon={TimerReset} disabled={busy} onClick={() => onAdjust(index, "shorter")} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap gap-2">
                        <MiniAction label={copy.lighten} icon={TimerReset} disabled={busy} onClick={onLighten} />
                        <MiniAction label={copy.regenerate} icon={RefreshCw} disabled={busy} onClick={onRegenerate} />
                    </div>

                    <button
                        type="button"
                        onClick={onAccept}
                        disabled={busy}
                        className="inline-flex h-11 items-center gap-2 rounded-[18px] border border-transparent bg-gradient-to-r from-[#79c2ff] via-[#7dd3fc] to-[#6ee7b7] px-4 text-sm font-semibold text-slate-950 shadow-[0_22px_50px_-30px_rgba(125,211,252,0.7)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_28px_58px_-28px_rgba(125,211,252,0.82)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                        {copy.apply}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MiniAction({
    label,
    icon: Icon,
    onClick,
    disabled = false,
}: {
    label: string;
    icon: typeof ArrowLeft;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-black/18 px-3 text-sm text-white/72 transition-colors hover:border-white/18 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    );
}
