import {
    BehaviorProfile,
    FocusSessionAnalytics,
    InsightCardData,
    PatternTrend,
} from "@/lib/types/behavior";
import { getFocusWindowLabel } from "./sessionAnalytics";

function describeDuration(pattern: NonNullable<BehaviorProfile["optimalSessionLength"]>) {
    const { minMinutes, maxMinutes, medianMinutes } = pattern.data;
    if (pattern.data.bucket === "medium") {
        return `alrededor de ${medianMinutes} minutos`;
    }

    return `entre ${minMinutes} y ${maxMinutes} minutos`;
}

function describeTrend(direction: PatternTrend) {
    switch (direction) {
        case "improving":
            return "viene mejorando";
        case "declining":
            return "se aflojo un poco";
        case "stable":
            return "se mantiene bastante estable";
        default:
            return "se mantiene";
    }
}

export function buildInsightCards(profile: BehaviorProfile): InsightCardData[] {
    const cards: InsightCardData[] = [];

    if (profile.bestFocusWindow) {
        cards.push({
            id: "best_focus_window",
            patternKey: profile.bestFocusWindow.patternKey,
            type: "best_focus_window",
            tone: "positive",
            title: "Tu franja mas estable",
            description: `Tus sesiones de la ${getFocusWindowLabel(profile.bestFocusWindow.data.window)} suelen sostenerse mejor. Ahi estas combinando mas progreso con menos friccion.`,
            confidence: profile.bestFocusWindow.confidence,
            sampleSize: profile.bestFocusWindow.sampleSize,
        });
    }

    if (profile.optimalSessionLength) {
        cards.push({
            id: "optimal_session_length",
            patternKey: profile.optimalSessionLength.patternKey,
            type: "optimal_session_length",
            tone: "neutral",
            title: "Tu duracion mas sostenible",
            description: `Tu punto mas solido aparece ${describeDuration(profile.optimalSessionLength)}. Cuando estiras mas de eso, la calidad suele caer.`,
            confidence: profile.optimalSessionLength.confidence,
            sampleSize: profile.optimalSessionLength.sampleSize,
        });
    }

    const topFriction = profile.topFrictionSources[0];
    if (topFriction) {
        cards.push({
            id: "friction_source",
            patternKey: topFriction.patternKey,
            type: "friction_source",
            tone: "caution",
            title: "Donde aparece mas friccion",
            description: `La friccion sube cuando el contexto cae en ${topFriction.data.label}. No es una etiqueta fija: es la zona donde mas se te rompe la continuidad.`,
            confidence: topFriction.confidence,
            sampleSize: topFriction.sampleSize,
        });
    }

    if (profile.consistencyTrend) {
        const direction = profile.consistencyTrend.data.direction;
        cards.push({
            id: "consistency_trend",
            patternKey: profile.consistencyTrend.patternKey,
            type: "consistency_trend",
            tone: direction === "declining" ? "caution" : "positive",
            title: "Lectura de consistencia",
            description: `Tu continuidad reciente ${describeTrend(direction)} frente a la ventana anterior. La diferencia actual es de ${profile.consistencyTrend.data.delta > 0 ? "+" : ""}${profile.consistencyTrend.data.delta} puntos.`,
            confidence: profile.consistencyTrend.confidence,
            sampleSize: profile.consistencyTrend.sampleSize,
        });
    }

    const recentImprovement = profile.recentImprovements[0];
    if (recentImprovement) {
        cards.push({
            id: "recent_improvement",
            patternKey: recentImprovement.patternKey,
            type: "recent_improvement",
            tone: "positive",
            title: "Mejora reciente",
            description: recentImprovement.data.area === "friction"
                ? `La friccion reciente bajo ${recentImprovement.data.delta} puntos respecto a la semana anterior.`
                : recentImprovement.data.area === "stability"
                    ? `Tus sesiones recientes recuperaron mas estabilidad que en la ventana previa.`
                    : recentImprovement.data.area === "recovery"
                        ? `Volves mas rapido al foco despues de una ruptura que hace una semana.`
                        : `Tu consistencia semanal subio ${recentImprovement.data.delta} puntos frente a la ventana anterior.`,
            confidence: recentImprovement.confidence,
            sampleSize: recentImprovement.sampleSize,
        });
    }

    return cards;
}

export function buildProfileSummary(profile: BehaviorProfile, recentAnalytics: FocusSessionAnalytics[]) {
    if (recentAnalytics.length === 0) {
        return "Todavia no hay sesiones suficientes para consolidar patrones.";
    }

    if (profile.warmupStage !== "ready") {
        return "Agendo ya esta leyendo tus sesiones, pero todavia esta juntando evidencia antes de afirmar patrones fuertes.";
    }

    if (profile.bestFocusWindow && profile.optimalSessionLength) {
        return `Agendo ya detecto una franja mas favorable y una duracion de sesion mas sostenible para vos.`;
    }

    if (profile.topFrictionSources.length > 0) {
        return "Agendo ya reconoce al menos una fuente recurrente de friccion en tu historial reciente.";
    }

    return "Tu perfil ya esta consolidando patrones utiles y comparables contra tu propio historial.";
}
