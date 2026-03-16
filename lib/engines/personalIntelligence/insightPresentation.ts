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
            return "viene encontrando más continuidad";
        case "declining":
            return "se siente un poco más frágil";
        case "stable":
            return "se viene sosteniendo con bastante calma";
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
            title: "Tu franja que mejor te acompaña",
            description: `En la ${getFocusWindowLabel(profile.bestFocusWindow.data.window)} te suele resultar más fácil sostener el foco. Ahí aparece una combinación más amable de progreso, estabilidad y menos fricción.`,
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
            title: "Tu duración más sostenible",
            description: `Tu punto más sólido aparece ${describeDuration(profile.optimalSessionLength)}. Cuando te corrés mucho de ese rango, sostener la calidad suele costar un poco más.`,
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
            title: "Dónde más se te hace cuesta arriba",
            description: `Cuando aparece ${topFriction.data.label}, sostener la continuidad suele costarte más. No habla de vos en general: sólo marca un contexto que hoy conviene acompañar con un poco más de cuidado.`,
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
            title: "Cómo viene tu constancia",
            description: `Tu continuidad reciente ${describeTrend(direction)} frente a la ventana anterior. Hoy la diferencia es de ${profile.consistencyTrend.data.delta > 0 ? "+" : ""}${profile.consistencyTrend.data.delta} puntos.`,
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
            title: "Una mejora que vale notar",
            description: recentImprovement.data.area === "friction"
                ? `La fricción reciente bajó ${recentImprovement.data.delta} puntos respecto a la semana anterior. Se siente un poco más liviano sostener estas sesiones.`
                : recentImprovement.data.area === "stability"
                    ? "Tus sesiones recientes recuperaron más estabilidad que en la ventana previa. Hay una base un poco más firme para sostener el foco."
                    : recentImprovement.data.area === "recovery"
                        ? "Estás pudiendo volver más rápido al foco después de una ruptura que hace una semana."
                        : `Tu consistencia semanal subió ${recentImprovement.data.delta} puntos frente a la ventana anterior.`,
            confidence: recentImprovement.confidence,
            sampleSize: recentImprovement.sampleSize,
        });
    }

    return cards;
}

export function buildProfileSummary(profile: BehaviorProfile, recentAnalytics: FocusSessionAnalytics[]) {
    if (recentAnalytics.length === 0) {
        return "Todavía faltan algunas sesiones para poder acompañarte con hallazgos firmes.";
    }

    if (profile.warmupStage !== "ready") {
        return "Agendo ya está leyendo tus sesiones y, de a poco, juntando la evidencia necesaria para devolverte señales más claras.";
    }

    if (profile.bestFocusWindow && profile.optimalSessionLength) {
        return "Ya se deja ver una franja que te acompaña mejor y una duración de sesión que se siente más sostenible para vos.";
    }

    if (profile.topFrictionSources.length > 0) {
        return "Ya empieza a asomar un contexto que suele traerte más fricción, y eso puede ayudarte a cuidarte mejor.";
    }

    return "Tu perfil ya está reuniendo señales útiles para acompañarte con más precisión.";
}
