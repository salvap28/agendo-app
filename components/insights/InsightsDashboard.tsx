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

export function InsightsDashboard({ data }: InsightsDashboardProps) {
    const { profile, cards, timeline } = data;
    const visibleTimeline = timeline.slice(-14);
    const topFriction = profile.topFrictionSources[0];

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
                        Volver Home
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
                                Lo que Agendo ya entiende de tu forma de trabajar.
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                                Esta capa no genera respuestas libres ni diagnosticos. Consolida patrones medibles de tu historial y los devuelve como hallazgos personales, con evidencia y memoria persistente.
                            </p>
                        </div>

                        <div className="mt-8 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                                <div className="flex items-center gap-2 text-white/40">
                                    <Clock3 className="h-4 w-4" />
                                    <span className="text-[11px] uppercase tracking-[0.18em]">Mejor Franja</span>
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
                                        : "Todavia no hay patron estable"}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="grid gap-4">
                        <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-3xl">
                            <div className="flex items-center justify-between text-white/40">
                                <span className="text-[11px] uppercase tracking-[0.18em]">Semana reciente</span>
                                <Sparkles className="h-4 w-4 text-violet-200" />
                            </div>
                            <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                                <div>
                                    <p className="text-3xl font-semibold text-white">{data.weeklySessions}</p>
                                    <p className="mt-1 text-sm text-white/40">sesiones analizadas</p>
                                </div>
                                <div>
                                    <p className="text-3xl font-semibold text-white">{data.completionRate}%</p>
                                    <p className="mt-1 text-sm text-white/40">cierres consistentes</p>
                                </div>
                                <div>
                                    <p className="text-3xl font-semibold text-white">{data.averageStability}</p>
                                    <p className="mt-1 text-sm text-white/40">estabilidad media</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-3xl">
                            <div className="flex items-center justify-between text-white/40">
                                <span className="text-[11px] uppercase tracking-[0.18em]">Momentum</span>
                                <TrendingUp className="h-4 w-4 text-emerald-300" />
                            </div>
                            <div className="mt-5 flex items-end gap-3">
                                <p className="text-4xl font-semibold text-white">{data.momentumCurrent}</p>
                                <span className={`mb-1 text-sm ${data.momentumDeltaWeek >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                    {data.momentumDeltaWeek >= 0 ? "+" : ""}{data.momentumDeltaWeek} vs semana
                                </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-white/45">
                                La lectura combina progreso, consistencia, friccion y estado conductual. No es una promesa de productividad: es una senal compuesta de tu propio historial.
                            </p>
                        </div>
                    </section>
                </div>

                <section className="mt-6 rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-3xl sm:p-8">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                                Hallazgos activos
                            </p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                                Insights personales validados
                            </h2>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/45">
                            {cards.length} visibles
                        </span>
                    </div>

                    {cards.length === 0 ? (
                        <div className="mt-6 rounded-[24px] border border-dashed border-white/12 bg-black/20 p-6 text-sm leading-7 text-white/50">
                            Agendo ya esta registrando datos, pero todavia no alcanza la evidencia minima para mostrar patrones persistentes. En esta fase se muestra menos a proposito.
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
                                    Evolucion de la capa analitica
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
                            Evidencia y memoria
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

                            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/55">
                                {profile.warmupStage === "ready"
                                    ? "El perfil ya esta usando patrones persistentes y no relee toda la historia cruda en cada request."
                                    : "El perfil existe, pero Agendo sigue exigiendo mas muestra antes de hacer afirmaciones mas fuertes."}
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
