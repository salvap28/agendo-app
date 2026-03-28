import Link from "next/link";
import { ArrowLeft, Clock3, Flame, Gauge, Orbit, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import { BackgroundEclipse } from "@/components/ui/BackgroundEclipse";
import { InsightsDashboardData, WarmupStage } from "@/lib/types/behavior";
import { AppLanguage } from "@/lib/i18n/messages";
import { getIntlLocale } from "@/lib/i18n/app";

type InsightsDashboardProps = {
    data: InsightsDashboardData;
    language: AppLanguage;
};

function getCopy(language: AppLanguage) {
    return language === "es"
        ? {
            topLabel: "Inteligencia personal",
            back: "Volver al inicio",
            updated: "Actualizado",
            heroTitle: "Lo que Agendo ya puede sostener sobre tu manera de enfocarte.",
            heroBody: "Esta capa no intenta adivinarte. Toma tu historial de Focus Mode, valida evidencia y te devuelve lecturas personales que puedan rastrearse a sesiones reales.",
            bestWindow: "Mejor franja",
            duration: "Duracion",
            friction: "Friccion",
            recentState: "Estado reciente",
            mainReading: "Lectura principal",
            activeFindings: "Hallazgos activos",
            activeFindingsTitle: "Lo que hoy ya se sostiene con evidencia",
            recentTrend: "Tendencia reciente",
            recentTrendTitle: "Como se movio tu ritmo estas ultimas dos semanas",
            memory: "Memoria y evidencia",
            profile: "Perfil persistente",
            attendance: "tasa de asistencia",
            nonFocusCompletion: "cierre no-focus",
            postpone: "tasa de postergacion",
            sessionsAnalyzed: "sesiones analizadas",
            sustainedClosures: "cierres sostenidos",
            averageStability: "estabilidad media",
            evidence: "evidencia",
            composite: "senal compuesta",
            vsWeek: "vs semana",
            visible: "visibles",
            noTruth: "Todavia no conviene fijar una verdad persistente",
            noDataYet: "Agendo ya esta registrando datos, pero todavia necesita mas repeticion antes de devolverte patrones persistentes.",
            noSignalsYet: "Todavia no hay evidencia minima",
            noRangeYet: "Sin rango firme",
            noPatternYet: "Todavia no hay un patron estable",
            noWindow: "Sin detectar",
            nonFocus: "Actividad no-focus",
            nonFocusBody: "Estas senales vienen de clases, reuniones, recuperacion, logistica y otras actividades fuera de Focus Mode.",
            progress: "progreso",
            behavior: "estado conductual",
            globalConfidence: "Confianza global",
            daily: "Ultima consolidacion diaria",
            weekly: "Ultima consolidacion semanal",
            improvement: "Mejora",
            caution: "Friccion",
            pattern: "Patron",
            samples: "muestras",
            persistentReady: "El perfil ya usa patrones persistentes y no necesita releer toda la historia cruda en cada request.",
            persistentWarming: "El perfil ya existe, pero Agendo todavia necesita mas muestra y repeticion antes de devolverte conclusiones firmes.",
            notConsolidated: "sin consolidar",
            warmup: { cold: "Warm-up inicial", warming: "Perfil calentando", ready: "Perfil consolidado" } as Record<WarmupStage, string>,
            windows: { morning: "Manana", afternoon: "Tarde", evening: "Atardecer", night: "Noche" } as Record<string, string>,
        }
        : {
            topLabel: "Personal intelligence",
            back: "Back home",
            updated: "Updated",
            heroTitle: "What Agendo can already sustain about the way you focus.",
            heroBody: "This layer does not try to guess you. It uses your Focus Mode history, validates evidence, and returns personal readings that can be traced back to real sessions.",
            bestWindow: "Best window",
            duration: "Duration",
            friction: "Friction",
            recentState: "Recent state",
            mainReading: "Main reading",
            activeFindings: "Active findings",
            activeFindingsTitle: "What is already holding today with evidence",
            recentTrend: "Recent trend",
            recentTrendTitle: "How your rhythm moved over the last two weeks",
            memory: "Memory and evidence",
            profile: "Persistent profile",
            attendance: "attendance rate",
            nonFocusCompletion: "non-focus completion",
            postpone: "postpone rate",
            sessionsAnalyzed: "sessions analyzed",
            sustainedClosures: "sustained closures",
            averageStability: "average stability",
            evidence: "evidence",
            composite: "composite signal",
            vsWeek: "vs week",
            visible: "visible",
            noTruth: "It is still too early to lock in a persistent truth",
            noDataYet: "Agendo is collecting data, but it still needs more repetition before returning persistent patterns.",
            noSignalsYet: "Not enough evidence yet",
            noRangeYet: "No stable range",
            noPatternYet: "No stable pattern yet",
            noWindow: "Not detected",
            nonFocus: "Non-focus activity",
            nonFocusBody: "These signals come from classes, meetings, recovery, logistics, and other activities outside Focus Mode.",
            progress: "progress",
            behavior: "behavior state",
            globalConfidence: "Global confidence",
            daily: "Last daily consolidation",
            weekly: "Last weekly consolidation",
            improvement: "Improvement",
            caution: "Friction",
            pattern: "Pattern",
            samples: "samples",
            persistentReady: "The profile already uses persistent patterns and does not need to reread all raw history on every request.",
            persistentWarming: "The profile already exists, but Agendo still needs more sample and repetition before returning firm conclusions.",
            notConsolidated: "not consolidated",
            warmup: { cold: "Initial warm-up", warming: "Profile warming", ready: "Profile established" } as Record<WarmupStage, string>,
            windows: { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" } as Record<string, string>,
        };
}

function formatRelativeDate(value: string | null, language: AppLanguage, fallback: string) {
    if (!value) return fallback;
    return new Intl.DateTimeFormat(getIntlLocale(language), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value: string, language: AppLanguage) {
    return new Intl.DateTimeFormat(getIntlLocale(language), { day: "numeric", month: "short" }).format(new Date(value));
}

export function InsightsDashboard({ data, language }: InsightsDashboardProps) {
    const copy = getCopy(language);
    const { profile, cards, timeline } = data;
    const visibleTimeline = timeline.slice(-14);
    const leadCard = cards[0] ?? null;
    const topFriction = profile.topFrictionSources[0] ?? null;

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#020205] text-white">
            <BackgroundEclipse />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.14),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(76,29,149,0.18),transparent_40%)]" />
            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-12 pt-24 sm:px-8 lg:px-10">
                <div className="mb-8 flex items-center justify-between gap-4">
                    <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl">
                        <Orbit className="h-4 w-4 text-violet-300" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">{copy.topLabel}</span>
                    </div>
                    <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white">
                        <ArrowLeft className="h-4 w-4" />
                        {copy.back}
                    </Link>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
                    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-3xl sm:p-8">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/60 to-transparent" />
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200">{copy.warmup[profile.warmupStage]}</span>
                            <span className="text-xs uppercase tracking-[0.18em] text-white/35">{copy.updated} {formatRelativeDate(profile.lastUpdatedAt, language, copy.notConsolidated)}</span>
                        </div>
                        <div className="mt-5 max-w-3xl space-y-4">
                            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">{copy.heroTitle}</h1>
                            <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">{copy.heroBody}</p>
                        </div>
                        <div className="mt-8 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-white/40"><Clock3 className="h-4 w-4" /><span className="text-[11px] uppercase tracking-[0.18em]">{copy.bestWindow}</span></div><p className="mt-3 text-xl font-semibold text-white">{copy.windows[profile.bestFocusWindow?.data.window ?? ""] ?? copy.noWindow}</p><p className="mt-1 text-sm text-white/40">{profile.bestFocusWindow ? `${profile.bestFocusWindow.sampleSize} ${copy.sessionsAnalyzed}` : copy.noSignalsYet}</p></div>
                            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-white/40"><Gauge className="h-4 w-4" /><span className="text-[11px] uppercase tracking-[0.18em]">{copy.duration}</span></div><p className="mt-3 text-xl font-semibold text-white">{profile.optimalSessionLength ? `${profile.optimalSessionLength.data.medianMinutes} min` : copy.noRangeYet}</p><p className="mt-1 text-sm text-white/40">{profile.optimalSessionLength ? `Bucket ${profile.optimalSessionLength.data.bucket}` : copy.noRangeYet}</p></div>
                            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-white/40"><ShieldAlert className="h-4 w-4" /><span className="text-[11px] uppercase tracking-[0.18em]">{copy.friction}</span></div><p className="mt-3 text-xl font-semibold text-white">{topFriction ? topFriction.data.label : copy.noPatternYet}</p><p className="mt-1 text-sm text-white/40">{topFriction ? `${topFriction.data.averageFrictionScore} pts` : copy.noPatternYet}</p></div>
                        </div>
                    </section>

                    <section className="grid gap-4">
                        <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-3xl"><div className="flex items-center justify-between text-white/40"><span className="text-[11px] uppercase tracking-[0.18em]">{copy.recentState}</span><Sparkles className="h-4 w-4 text-violet-200" /></div><div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-1"><div><p className="text-3xl font-semibold text-white">{data.weeklySessions}</p><p className="mt-1 text-sm text-white/40">{copy.sessionsAnalyzed}</p></div><div><p className="text-3xl font-semibold text-white">{data.completionRate}%</p><p className="mt-1 text-sm text-white/40">{copy.sustainedClosures}</p></div><div><p className="text-3xl font-semibold text-white">{data.averageStability}</p><p className="mt-1 text-sm text-white/40">{copy.averageStability}</p></div></div></div>
                        <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-3xl"><div className="flex items-center justify-between text-white/40"><span className="text-[11px] uppercase tracking-[0.18em]">{copy.mainReading}</span><TrendingUp className="h-4 w-4 text-emerald-300" /></div><div className="mt-5 space-y-4"><p className="text-xl font-semibold text-white">{leadCard?.title ?? copy.noTruth}</p><p className="text-sm leading-6 text-white/45">{leadCard?.description ?? copy.noDataYet}</p><div className="flex flex-wrap items-center gap-3 text-xs text-white/35"><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">{copy.evidence} {Math.round((leadCard?.confidence ?? profile.confidenceOverview.overall ?? 0) * 100)}%</span><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">{copy.composite} {data.compositeSignalCurrent}</span><span className={`rounded-full border px-3 py-1 ${data.compositeSignalDeltaWeek >= 0 ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-rose-300/20 bg-rose-400/10 text-rose-200"}`}>{data.compositeSignalDeltaWeek >= 0 ? "+" : ""}{data.compositeSignalDeltaWeek} {copy.vsWeek}</span></div></div></div>
                        {data.activityOverview && data.activityOverview.totalCount > 0 && <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-3xl"><div className="flex items-center justify-between text-white/40"><span className="text-[11px] uppercase tracking-[0.18em]">{copy.nonFocus}</span><Orbit className="h-4 w-4 text-cyan-200" /></div><div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-1"><div><p className="text-3xl font-semibold text-white">{Math.round(data.activityOverview.attendanceRate * 100)}%</p><p className="mt-1 text-sm text-white/40">{copy.attendance}</p></div><div><p className="text-3xl font-semibold text-white">{Math.round(data.activityOverview.nonFocusCompletionRate * 100)}%</p><p className="mt-1 text-sm text-white/40">{copy.nonFocusCompletion}</p></div><div><p className="text-3xl font-semibold text-white">{Math.round(data.activityOverview.postponeRate * 100)}%</p><p className="mt-1 text-sm text-white/40">{copy.postpone}</p></div></div><p className="mt-4 text-sm leading-6 text-white/45">{copy.nonFocusBody}</p></div>}
                    </section>
                </div>

                <section className="mt-6 rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-3xl sm:p-8">
                    <div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{copy.activeFindings}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{copy.activeFindingsTitle}</h2></div><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/45">{cards.length} {copy.visible}</span></div>
                    {cards.length === 0 ? <div className="mt-6 rounded-[24px] border border-dashed border-white/12 bg-black/20 p-6 text-sm leading-7 text-white/50">{copy.noDataYet}</div> : <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <article key={card.id} className="rounded-[26px] border border-white/10 bg-black/20 p-5"><div className="flex items-center justify-between gap-3"><span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${card.tone === "positive" ? "border border-emerald-300/25 bg-emerald-400/10 text-emerald-200" : card.tone === "caution" ? "border border-amber-300/25 bg-amber-400/10 text-amber-200" : "border border-violet-300/25 bg-violet-400/10 text-violet-200"}`}>{card.tone === "positive" ? copy.improvement : card.tone === "caution" ? copy.caution : copy.pattern}</span><span className="text-xs text-white/35">{Math.round(card.confidence * 100)}%</span></div><h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3><p className="mt-3 text-sm leading-7 text-white/55">{card.description}</p><div className="mt-5 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/30"><span>{card.sampleSize} {copy.samples}</span><span>{card.type.replace(/_/g, " ")}</span></div></article>)}</div>}
                </section>

                <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-3xl sm:p-8">
                        <div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{copy.recentTrend}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{copy.recentTrendTitle}</h2></div><Flame className="h-5 w-5 text-violet-300" /></div>
                        <div className="mt-8 grid grid-cols-7 gap-3 sm:grid-cols-14">{visibleTimeline.map((point) => <div key={point.date} className="flex flex-col items-center gap-2"><div className="flex h-40 w-full items-end justify-center gap-1 rounded-[18px] border border-white/8 bg-black/20 px-2 py-3"><div className="w-2 rounded-full bg-violet-300/80" style={{ height: `${Math.max(8, (point.progressScore ?? 0) * 0.9)}px` }} /><div className="w-2 rounded-full bg-emerald-300/70" style={{ height: `${Math.max(8, (point.behaviorScore ?? 0) * 0.9)}px` }} /><div className="w-2 rounded-full bg-amber-300/70" style={{ height: `${Math.max(8, (point.frictionScore ?? 0) * 0.9)}px` }} /></div><span className="text-[10px] uppercase tracking-[0.18em] text-white/28">{formatDate(point.date, language)}</span></div>)}</div>
                        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-white/40"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-violet-300/80" /> {copy.progress}</span><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" /> {copy.behavior}</span><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" /> {copy.friction}</span></div>
                    </div>
                    <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-3xl sm:p-8">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{copy.memory}</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{copy.profile}</h2>
                        <div className="mt-6 space-y-4">
                            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4"><p className="text-xs uppercase tracking-[0.18em] text-white/35">{copy.globalConfidence}</p><p className="mt-2 text-3xl font-semibold text-white">{Math.round((profile.confidenceOverview.overall ?? 0) * 100)}%</p></div>
                            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/55">{profile.warmupStage === "ready" ? copy.persistentReady : copy.persistentWarming}</div>
                            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/55">{copy.daily}: <span className="text-white/75">{formatRelativeDate(profile.lastDailyConsolidatedAt, language, copy.notConsolidated)}</span><br />{copy.weekly}: <span className="text-white/75">{formatRelativeDate(profile.lastWeeklyConsolidatedAt, language, copy.notConsolidated)}</span></div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
