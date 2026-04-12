"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Flame, MinusCircle, Sparkles, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useFocusStore } from "@/lib/stores/focusStore";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useActivityExperienceStore } from "@/lib/stores/activityExperienceStore";
import { saveSessionReflection } from "@/lib/services/focusService";
import { trackHabitEvent } from "@/lib/services/habitService";
import { useI18n } from "@/lib/i18n/client";

type CompletionState = "yes" | "partial" | "no";
type StartFrictionState = "easy" | "normal" | "hard";
type AdjustmentState = "keep_same" | "shorter" | "earlier" | "later";

const completionToProgress: Record<CompletionState, number> = {
    yes: 5,
    partial: 3,
    no: 1,
};

const frictionToDifficulty: Record<StartFrictionState, number> = {
    easy: 1,
    normal: 3,
    hard: 5,
};

export function MinimalFocusCheckout() {
    const { language } = useI18n();
    const session = useFocusStore((state) => state.session);
    const createBlock = useBlocksStore((state) => state.createBlock);
    const recordCheckout = useActivityExperienceStore((state) => state.recordCheckout);
    const [completion, setCompletion] = useState<CompletionState>("yes");
    const [friction, setFriction] = useState<StartFrictionState>("normal");
    const [adjustment, setAdjustment] = useState<AdjustmentState>("keep_same");
    const [isSaving, setIsSaving] = useState(false);

    const copy = useMemo(() => (
        language === "es"
            ? {
                badge: "Cierre breve",
                title: "Hoy ganaste claridad",
                body: "Un toque mas y Agendo aprende como ayudarte mejor la proxima vez.",
                completed: "¿Lo completaste?",
                startFeel: "¿Como estuvo arrancarlo?",
                adjust: "Si queres, ajustamos lo proximo",
                save: "Guardar y cerrar",
                saving: "Guardando...",
                dismiss: "Cerrar",
                completionOptions: {
                    yes: { label: "Si", hint: "Quedo resuelto" },
                    partial: { label: "A medias", hint: "Avanzo, pero no del todo" },
                    no: { label: "No", hint: "No termino de entrar" },
                },
                frictionOptions: {
                    easy: "Facil",
                    normal: "Normal",
                    hard: "Me costo",
                },
                adjustmentOptions: {
                    keep_same: "Dejar igual",
                    shorter: "Acortar proximos parecidos",
                    earlier: "Mover este tipo mas temprano",
                    later: "Mover este tipo mas tarde",
                },
            }
            : {
                badge: "Quick close",
                title: "You gained clarity today",
                body: "One more tap and Agendo learns how to help better next time.",
                completed: "Did you complete it?",
                startFeel: "How was it to get started?",
                adjust: "If you want, we can adjust the next one",
                save: "Save and close",
                saving: "Saving...",
                dismiss: "Dismiss",
                completionOptions: {
                    yes: { label: "Yes", hint: "It landed" },
                    partial: { label: "Partly", hint: "It moved, but not fully" },
                    no: { label: "No", hint: "It never really clicked" },
                },
                frictionOptions: {
                    easy: "Easy",
                    normal: "Normal",
                    hard: "Hard",
                },
                adjustmentOptions: {
                    keep_same: "Leave it",
                    shorter: "Shorter similar blocks",
                    earlier: "Move this kind earlier",
                    later: "Move this kind later",
                },
            }
    ), [language]);

    useEffect(() => {
        if (!session?.endedAt || session.persistenceStatus !== "persisted") return;
        void trackHabitEvent({
            name: "focus_checkout_opened",
            surface: "focus_checkout",
            blockId: session.blockId ?? null,
            sessionId: session.id,
        });
    }, [session?.blockId, session?.endedAt, session?.id, session?.persistenceStatus]);

    const handleClose = () => {
        useFocusStore.setState({ session: null, isOverlayVisible: false });
    };

    const handleSubmit = async () => {
        if (!session?.endedAt) return;
        setIsSaving(true);

        try {
            await saveSessionReflection(session.id, session.intention, {
                difficulty: frictionToDifficulty[friction],
                progressFeelingAfter: completionToProgress[completion],
            });

            if (session.blockId) {
                await recordCheckout(session.blockId, {
                    outcome: completion === "yes"
                        ? "completed"
                        : completion === "partial"
                            ? "partial"
                            : "interrupted",
                    notes: adjustment === "keep_same" ? undefined : adjustment,
                });
            } else if (session.mode === "free" && completion !== "no") {
                createBlock({
                    title: session.intention?.trim() || (language === "es" ? "Bloque libre" : "Free block"),
                    type: session.blockType ?? "deep_work",
                    startAt: new Date(session.startedAt),
                    endAt: new Date(session.endedAt),
                    status: "completed",
                    notes: adjustment === "keep_same" ? undefined : adjustment,
                });
            }

            await trackHabitEvent({
                name: "focus_checkout_submitted",
                surface: "focus_checkout",
                blockId: session.blockId ?? null,
                sessionId: session.id,
                metadata: {
                    completion,
                    friction,
                    adjustment,
                },
            });

            if (adjustment !== "keep_same") {
                await trackHabitEvent({
                    name: "focus_adjustment_selected",
                    surface: "focus_checkout",
                    blockId: session.blockId ?? null,
                    sessionId: session.id,
                    metadata: {
                        adjustment,
                    },
                });
            }
        } finally {
            useFocusStore.setState({ session: null, isOverlayVisible: false });
            setIsSaving(false);
        }
    };

    if (!session?.endedAt || session.persistenceStatus !== "persisted") return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 px-4 py-4 backdrop-blur-2xl sm:items-center">
            <div className="relative w-full max-w-[560px] overflow-hidden rounded-[30px] border border-white/10 bg-[#070910]/95 shadow-[0_36px_120px_rgba(0,0,0,0.72)]">
                <div className="pointer-events-none absolute inset-x-14 top-0 h-28 rounded-full bg-emerald-400/10 blur-3xl" />

                <div className="relative px-5 py-5 sm:px-7 sm:py-7">
                    <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                            {copy.badge}
                        </span>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/55 transition-colors hover:text-white/85"
                        >
                            {copy.dismiss}
                        </button>
                    </div>

                    <div className="mt-5 space-y-2">
                        <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold tracking-[-0.04em] text-white/92">
                            {copy.title}
                        </h2>
                        <p className="max-w-[34rem] text-sm leading-7 text-white/45">
                            {copy.body}
                        </p>
                    </div>

                    <div className="mt-7 space-y-6">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                                {copy.completed}
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <ChoiceCard
                                    selected={completion === "yes"}
                                    icon={CheckCircle2}
                                    label={copy.completionOptions.yes.label}
                                    hint={copy.completionOptions.yes.hint}
                                    onClick={() => setCompletion("yes")}
                                />
                                <ChoiceCard
                                    selected={completion === "partial"}
                                    icon={MinusCircle}
                                    label={copy.completionOptions.partial.label}
                                    hint={copy.completionOptions.partial.hint}
                                    onClick={() => setCompletion("partial")}
                                />
                                <ChoiceCard
                                    selected={completion === "no"}
                                    icon={XCircle}
                                    label={copy.completionOptions.no.label}
                                    hint={copy.completionOptions.no.hint}
                                    onClick={() => setCompletion("no")}
                                />
                            </div>
                        </div>

                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                                {copy.startFeel}
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <TinyChoice
                                    selected={friction === "easy"}
                                    label={copy.frictionOptions.easy}
                                    onClick={() => setFriction("easy")}
                                />
                                <TinyChoice
                                    selected={friction === "normal"}
                                    label={copy.frictionOptions.normal}
                                    onClick={() => setFriction("normal")}
                                />
                                <TinyChoice
                                    selected={friction === "hard"}
                                    label={copy.frictionOptions.hard}
                                    onClick={() => setFriction("hard")}
                                />
                            </div>
                        </div>

                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                                {copy.adjust}
                            </p>
                            <div className="mt-3 grid gap-2">
                                {(Object.keys(copy.adjustmentOptions) as AdjustmentState[]).map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setAdjustment(option)}
                                        className={cn(
                                            "inline-flex items-center justify-between rounded-[18px] border px-4 py-3 text-left text-sm transition-all duration-200",
                                            adjustment === option
                                                ? "border-emerald-300/25 bg-emerald-400/10 text-white"
                                                : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06]",
                                        )}
                                    >
                                        <span>{copy.adjustmentOptions[option]}</span>
                                        <ChevronRight className="h-4 w-4 opacity-65" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-7">
                        <button
                            type="button"
                            onClick={() => void handleSubmit()}
                            disabled={isSaving}
                            className="inline-flex h-13 w-full items-center justify-center gap-3 rounded-[20px] bg-gradient-to-r from-[#79c2ff] via-[#7dd3fc] to-[#6ee7b7] text-sm font-semibold text-slate-950 shadow-[0_24px_54px_-26px_rgba(125,211,252,0.58)] transition-all duration-300 hover:-translate-y-[1px] disabled:opacity-60"
                        >
                            {isSaving ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Flame className="h-4 w-4" />}
                            {isSaving ? copy.saving : copy.save}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ChoiceCard({
    selected,
    icon: Icon,
    label,
    hint,
    onClick,
}: {
    selected: boolean;
    icon: LucideIcon;
    label: string;
    hint: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "rounded-[22px] border px-4 py-4 text-left transition-all duration-300",
                selected
                    ? "border-transparent bg-gradient-to-br from-[#84cc16]/20 via-[#6ee7b7]/10 to-[#7dd3fc]/12 text-white shadow-[0_20px_40px_-28px_rgba(134,239,172,0.45)]"
                    : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:bg-white/[0.07]",
            )}
        >
            <Icon className={cn("h-5 w-5", selected ? "text-emerald-200" : "text-white/45")} />
            <p className="mt-4 text-[0.98rem] font-semibold tracking-[-0.02em]">
                {label}
            </p>
            <p className="mt-1 text-xs leading-6 text-white/45">
                {hint}
            </p>
        </button>
    );
}

function TinyChoice({
    selected,
    label,
    onClick,
}: {
    selected: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "inline-flex h-12 items-center justify-center rounded-[18px] border px-4 text-sm font-medium transition-all duration-200",
                selected
                    ? "border-cyan-300/25 bg-cyan-400/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06]",
            )}
        >
            {label}
        </button>
    );
}
