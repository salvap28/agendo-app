import Link from "next/link";
import {
    ArrowLeft,
    Clock3,
    Flame,
    Gauge,
    Orbit,
    ShieldAlert,
    Sparkles,
    TrendingUp,
} from "lucide-react";
import { BackgroundEclipse } from "@/components/ui/BackgroundEclipse";
import { InsightsDashboardData, WarmupStage } from "@/lib/types/behavior";

type InsightsDashboardProps = {
    data: InsightsDashboardData;
};

function formatWarmup(stage: WarmupStage) {
    switch (stage) {
        case "cold":
            return "Warm-up inicial";
        case "warming":
            return "Perfil calentando";
        case "ready":
            return "Perfil consolidado";
        default:
            return "Perfil";
    }
}

function formatWindow(window?: string | null) {
    switch (window) {
        case "morning":
            return "Manana";
        case "afternoon":
            return "Tarde";
        case "evening":
            return "Tardecita";
        case "night":
            return "Noche";
        default:
            return "Sin detectar";
    }
}

function formatDate(date: string) {
    return new Intl.DateTimeFormat("es-AR", {
        day: "numeric",
        month: "short",
    }).format(new Date(date));
}

function formatRelativeDate(value: string | null) {
    if (!value) return "sin consolidar";
    return new Intl.DateTimeFormat("es-AR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

function buildRecentNarrative(data: InsightsDashboardData) {
    const { profile } = data;
    const recentImprovement = profile.recentImprovements[0];
    const consistencyTrend = profile.consistencyTrend;

    if (data.cards[0]) {
        return data.cards[0].description;
    }

    if (recentImprovement) {
        if (recentImprovement.data.area === "friction") {
            return "La friccion reciente viene aflojando frente a la ventana anterior.";
        }
        if (recentImprovement.data.area === "stability") {
            return "Las sesiones recientes se estan sosteniendo con una base mas firme.";
        }
        if (recentImprovement.data.area === "recovery") {
            return "La recuperacion despues de una ruptura viene mejorando.";
        }
        return "La consistencia reciente subio frente a la ventana previa.";
    }

    if (consistencyTrend) {
        if (consistencyTrend.data.direction === "improving") {
            return "La continuidad reciente se ve mas firme que en la ventana anterior.";
        }
        if (consistencyTrend.data.direction === "declining") {
            return "La continuidad reciente se ve mas fragil y conviene leerla con cuidado.";
        }
        return "La continuidad reciente se mantiene bastante estable.";
    }

    return profile.warmupStage === "ready"
        ? "El perfil esta consolidado, pero hoy no hay un hallazgo dominante para forzar una conclusion."
        : "Agendo sigue separando senal util de ruido antes de consolidar patrones persistentes.";
}

export function InsightsDashboard({ data }: InsightsDashboardProps) {
    const { profile, cards, timeline } = data;
    const visibleTimeline = timeline.slice(-14);
    const topFriction = profile.topFrictionSources[0];
    const leadCard = cards[0] ?? null;
    const recentImprovement = profile.recentImprovements[0] ?? null;
    const consistencyTrend = profile.consistencyTrend;

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#020205] text-white">
            <BackgroundEclipse />

            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.14),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(76,29,149,0.18),transparent_40%)]" />
            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-12 pt-24 sm:px-8 lg:px-10">
                <div className="mb-8 flex items-center justify-between gap-4">
                    <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl">
                        <Orbit className="h-4 w-4 text-violet-300" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                            Personal Intelligence
                        </span>
                    </div>

                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Volver al inicio
                    </Link>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
                    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-3xl sm:p-8">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/60 to-transparent" />
                        <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />

                        <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200">
                                {formatWarmup(profile.warmupStage)}
                            </span>
                            <span className="text-xs uppercase tracking-[0.18em] text-white/35">
                                Actualizado {formatRelativeDate(profile.lastUpdatedAt)}
                            </span>
                        </div>

                        <div className="mt-5 max-w-3xl space-y-4">
                            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
                                Lo que Agendo ya puede sostener sobre tu manera de enfocarte.
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                                Esta capa no intenta adivinarte. Toma tu historial de Focus Mode, valida evidencia y te devuelve lecturas personales que puedan rastrearse a sesiones reales.
                            </p>
                        </div>

                        <div className="mt-8 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                                <div className="flex items-center gap-2 text-white/40">
                                    <Clock3 className="h-4 w-4" />
                                    <span className="text-[11px] uppercase tracking-[0.18em]">Mejor franja</span>
                                </div>
                                <p className="mt-3 text-xl font-semibold text-white">
                                    {formatWindow(profile.bestFocusWindow?.data.window)}
                                </p>
                                <p className="mt-1 text-sm text-white/40">
                                    {profile.bestFocusWindow
                                        ? `${profile.bestFocusWindow.sampleSize} sesiones con evidencia suficiente`
                                        : "Todavia no hay evidencia minima"}
                                </p>
                            </div>

                            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                                <div className="flex items-center gap-2 text-white/40">
                                    <Gauge className="h-4 w-4" />
                                    <span className="text-[11px] uppercase tracking-[0.18em]">Duracion</span>
                                </div>
                                <p className="mt-3 text-xl font-semibold text-white">
                                    {profile.optimalSessionLength
                                        ? `${profile.optimalSessionLength.data.medianMinutes} min`
                                        : "Sin rango firme"}
                                </p>
                                <p className="mt-1 text-sm text-white/40">
                                    {profile.optimalSessionLength
                                        ? `Bucket ${profile.optimalSessionLength.data.bucket}`
                                        : "Agendo sigue comparando duraciones"}
                                </p>
                            </div>

                            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                                <div className="flex items-center gap-2 text-white/40">
                                    <ShieldAlert className="h-4 w-4" />
                                    <span className="text-[11px] uppercase tracking-[0.18em]">Friccion</span>
                                </div>
                                <p className="mt-3 text-xl font-semibold text-white">
                                    {topFriction ? topFriction.data.label : "Sin fuente dominante"}
                                </p>
                                <p className="mt-1 text-sm text-white/40">
                                    {topFriction
                                        ? `${topFriction.data.averageFrictionScore} pts de friccion media`
                                        : "Todavia no hay un patron estable"}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="grid gap-4">
                        <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-3xl">
                            <div className="flex items-center justify-between text-white/40">
                                <span className="text-[11px] uppercase tracking-[0.18em]">Estado reciente</span>
                                <Sparkles className="h-4 w-4 text-violet-200" />
                            </div>
                            <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                                <div>
                                    <p className="text-3xl font-semibold text-white">{data.weeklySessions}</p>
                                    <p className="mt-1 text-sm text-white/40">sesiones analizadas</p>
                                </div>
                                <div>
                                    <p className="text-3xl font-semibold text-white">{data.completionRate}%</p>
                                    <p className="mt-1 text-sm text-white/40">cierres sostenidos</p>
                                </div>
                                <div>
                                    <p className="text-3xl font-semibold text-white">{data.averageStability}</p>
                                    <p className="mt-1 text-sm text-white/40">estabilidad media</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-3xl">
                            <div className="flex items-center justify-between text-white/40">
                                <span className="text-[11px] uppercase tracking-[0.18em]">Lectura principal</span>
                                <TrendingUp className="h-4 w-4 text-emerald-300" />
                            </div>
                            <div className="mt-5 space-y-4">
                                <p className="text-xl font-semibold text-white">
                                    {leadCard?.title ?? "Todavia no conviene fijar una verdad persistente"}
                                </p>
                                <p className="text-sm leading-6 text-white/45">
                                    {buildRecentNarrative(data)}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-white/35">
                                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                                        evidencia {Math.round((leadCard?.confidence ?? profile.confidenceOverview.overall ?? 0) * 100)}%
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                                        senal compuesta {data.compositeSignalCurrent}
                                    </span>
                                    <span className={`rounded-full border px-3 py-1 ${
                                        data.compositeSignalDeltaWeek >= 0
                                            ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                                            : "border-rose-300/20 bg-rose-400/10 text-rose-200"
                                    }`}>
                                        {data.compositeSignalDeltaWeek >= 0 ? "+" : ""}{data.compositeSignalDeltaWeek} vs semana
                                    </span>
                                </div>
                            </div>
                        </div>

                        {data.activityOverview && data.activityOverview.totalCount > 0 && (
                            <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-3xl">
                                <div className="flex items-center justify-between text-white/40">
                                    <span className="text-[11px] uppercase tracking-[0.18em]">Actividad no-focus</span>
                                    <Orbit className="h-4 w-4 text-cyan-200" />
                                </div>
                                <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                                    <div>
                                        <p className="text-3xl font-semibold text-white">
                                            {Math.round(data.activityOverview.attendanceRate * 100)}%
                                        </p>
                                        <p className="mt-1 text-sm text-white/40">attendance rate</p>
                                    </div>
                                    <div>
                                        <p className="text-3xl font-semibold text-white">
                                            {Math.round(data.activityOverview.nonFocusCompletionRate * 100)}%
                                        </p>
                                        <p className="mt-1 text-sm text-white/40">non-focus completion</p>
                                    </div>
                                    <div>
                                        <p className="text-3xl font-semibold text-white">
                                            {Math.round(data.activityOverview.postponeRate * 100)}%
                                        </p>
                                        <p className="mt-1 text-sm text-white/40">postpone rate</p>
                                    </div>
                                </div>
                                <p className="mt-4 text-sm leading-6 text-white/45">
                                    Estas señales vienen de clases, meetings, recovery, logística y otras actividades que no pasan por Focus Mode.
                                </p>
                            </div>
                        )}
                    </section>
                </div>

                <section className="mt-6 rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-3xl sm:p-8">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                                Hallazgos activos
                            </p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                                Lo que hoy ya se sostiene con evidencia
                            </h2>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/45">
                            {cards.length} visibles
                        </span>
                    </div>

                    {cards.length === 0 ? (
                        <div className="mt-6 rounded-[24px] border border-dashed border-white/12 bg-black/20 p-6 text-sm leading-7 text-white/50">
                            Agendo ya esta registrando datos, pero todavia necesita mas repeticion antes de devolverte patrones persistentes. En esta etapa prefiere prudencia antes que conclusiones flojas.
                        </div>
                    ) : (
                        <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                            {cards.map((card) => (
                                <article
                                    key={card.id}
                                    className="rounded-[26px] border border-white/10 bg-black/20 p-5 transition-transform duration-300 hover:-translate-y-0.5"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                                            card.tone === "positive"
                                                ? "border border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                                                : card.tone === "caution"
                                                    ? "border border-amber-300/25 bg-amber-400/10 text-amber-200"
                                                    : "border border-violet-300/25 bg-violet-400/10 text-violet-200"
                                        }`}>
                                            {card.tone === "positive" ? "Mejora" : card.tone === "caution" ? "Friccion" : "Patron"}
                                        </span>
                                        <span className="text-xs text-white/35">
                                            conf. {Math.round(card.confidence * 100)}%
                                        </span>
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3>
                                    <p className="mt-3 text-sm leading-7 text-white/55">{card.description}</p>
                                    <div className="mt-5 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/30">
                                        <span>{card.sampleSize} muestras</span>
                                        <span>{card.type.replace(/_/g, " ")}</span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-3xl sm:p-8">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                                    Tendencia reciente
                                </p>
                                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                                    Como se movio tu ritmo estas ultimas dos semanas
                                </h2>
                            </div>
                            <Flame className="h-5 w-5 text-violet-300" />
                        </div>

                        <div className="mt-8 grid grid-cols-7 gap-3 sm:grid-cols-14">
                            {visibleTimeline.map((point) => (
                                <div key={point.date} className="flex flex-col items-center gap-2">
                                    <div className="flex h-40 w-full items-end justify-center gap-1 rounded-[18px] border border-white/8 bg-black/20 px-2 py-3">
                                        <div
                                            className="w-2 rounded-full bg-violet-300/80"
                                            style={{ height: `${Math.max(8, (point.progressScore ?? 0) * 0.9)}px` }}
                                        />
                                        <div
                                            className="w-2 rounded-full bg-emerald-300/70"
                                            style={{ height: `${Math.max(8, (point.behaviorScore ?? 0) * 0.9)}px` }}
                                        />
                                        <div
                                            className="w-2 rounded-full bg-amber-300/70"
                                            style={{ height: `${Math.max(8, (point.frictionScore ?? 0) * 0.9)}px` }}
                                        />
                                    </div>
                                    <span className="text-[10px] uppercase tracking-[0.18em] text-white/28">
                                        {formatDate(point.date)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-white/40">
                            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-violet-300/80" /> progreso</span>
                            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" /> estado conductual</span>
                            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" /> friccion</span>
                        </div>
                    </div>

                    <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-3xl sm:p-8">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                            Memoria y evidencia
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                            Perfil persistente
                        </h2>

                        <div className="mt-6 space-y-4">
                            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-white/35">Confianza global</p>
                                <p className="mt-2 text-3xl font-semibold text-white">
                                    {Math.round((profile.confidenceOverview.overall ?? 0) * 100)}%
                                </p>
                            </div>

                            {(recentImprovement || consistencyTrend) && (
                                <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/55">
                                    {recentImprovement
                                        ? `Cambio reciente: ${recentImprovement.data.area === "friction" ? "la friccion bajo" : recentImprovement.data.area === "stability" ? "la estabilidad subio" : recentImprovement.data.area === "recovery" ? "la recuperacion mejoro" : "la consistencia subio"} frente a la ventana anterior.`
                                        : `Constancia reciente: ${consistencyTrend?.data.direction === "declining" ? "mas fragil" : consistencyTrend?.data.direction === "improving" ? "mas firme" : "estable"} en comparacion con la semana previa.`}
                                </div>
                            )}

                            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/55">
                                {profile.warmupStage === "ready"
                                    ? "El perfil ya usa patrones persistentes y no necesita releer toda la historia cruda en cada request. La idea es acompanarte con memoria, no con ruido."
                                    : "El perfil ya existe, pero Agendo todavia necesita mas muestra y repeticion antes de devolverte conclusiones firmes."}
                            </div>

                            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/55">
                                Ultima consolidacion diaria: <span className="text-white/75">{formatRelativeDate(profile.lastDailyConsolidatedAt)}</span>
                                <br />
                                Ultima consolidacion semanal: <span className="text-white/75">{formatRelativeDate(profile.lastWeeklyConsolidatedAt)}</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
