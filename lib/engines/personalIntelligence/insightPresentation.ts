import {
    BehaviorProfile,
    FocusSessionAnalytics,
    InsightCardData,
    PatternTrend,
} from "@/lib/types/behavior";
import { AppLanguage } from "@/lib/i18n/messages";

function getInsightWindowLabel(language: AppLanguage, window: NonNullable<BehaviorProfile["bestFocusWindow"]>["data"]["window"]) {
    const labels = language === "es"
        ? {
            morning: "la manana",
            afternoon: "la tarde",
            evening: "el atardecer",
            night: "la noche",
            fallback: "tu mejor ventana",
        }
        : {
            morning: "morning",
            afternoon: "afternoon",
            evening: "evening",
            night: "night",
            fallback: "best window",
        };

    return labels[window] ?? labels.fallback;
}

function describeDuration(language: AppLanguage, pattern: NonNullable<BehaviorProfile["optimalSessionLength"]>) {
    const { minMinutes, maxMinutes, medianMinutes } = pattern.data;
    if (pattern.data.bucket === "medium") {
        return language === "es"
            ? `alrededor de ${medianMinutes} minutos`
            : `around ${medianMinutes} minutes`;
    }

    return language === "es"
        ? `${minMinutes}-${maxMinutes} minutos`
        : `${minMinutes}-${maxMinutes} minutes`;
}

function describeTrend(language: AppLanguage, direction: PatternTrend) {
    if (language === "es") {
        switch (direction) {
            case "improving":
                return "se esta afirmando";
            case "declining":
                return "se ve mas fragil";
            case "stable":
                return "se mantiene estable";
            default:
                return "se sostiene";
        }
    }

    switch (direction) {
        case "improving":
            return "is getting steadier";
        case "declining":
            return "looks more fragile";
        case "stable":
            return "is holding steady";
        default:
            return "is holding";
    }
}

export function buildInsightCards(profile: BehaviorProfile, language: AppLanguage = "en"): InsightCardData[] {
    const cards: InsightCardData[] = [];
    const canSurfacePersistentPatterns = profile.warmupStage === "ready";
    const canSurfaceComparativeSignals = profile.warmupStage !== "cold";

    if (canSurfacePersistentPatterns && profile.bestFocusWindow) {
        cards.push({
            id: "best_focus_window",
            patternKey: profile.bestFocusWindow.patternKey,
            type: "best_focus_window",
            tone: "positive",
            title: language === "es" ? "Tu ventana mas fuerte" : "Your strongest window",
            description: language === "es"
                ? `${getInsightWindowLabel(language, profile.bestFocusWindow.data.window)} es donde tu foco suele sostenerse con menos friccion.`
                : `${getInsightWindowLabel(language, profile.bestFocusWindow.data.window)} is where focus tends to hold with less friction.`,
            confidence: profile.bestFocusWindow.confidence,
            sampleSize: profile.bestFocusWindow.sampleSize,
        });
    }

    if (canSurfacePersistentPatterns && profile.optimalSessionLength) {
        cards.push({
            id: "optimal_session_length",
            patternKey: profile.optimalSessionLength.patternKey,
            type: "optimal_session_length",
            tone: "neutral",
            title: language === "es" ? "Tu duracion sostenible" : "Your sustainable session length",
            description: language === "es"
                ? `${describeDuration(language, profile.optimalSessionLength)} parece ser tu rango mas confiable hoy.`
                : `${describeDuration(language, profile.optimalSessionLength)} looks like your most reliable range right now.`,
            confidence: profile.optimalSessionLength.confidence,
            sampleSize: profile.optimalSessionLength.sampleSize,
        });
    }

    const topFriction = profile.topFrictionSources[0];
    if (canSurfacePersistentPatterns && topFriction) {
        cards.push({
            id: "friction_source",
            patternKey: topFriction.patternKey,
            type: "friction_source",
            tone: "caution",
            title: language === "es" ? "Donde sube la friccion" : "Where friction rises",
            description: language === "es"
                ? `${topFriction.data.label} aparece como un contexto mas dificil de sostener ahora.`
                : `${topFriction.data.label} is showing up as a harder context to sustain right now.`,
            confidence: topFriction.confidence,
            sampleSize: topFriction.sampleSize,
        });
    }

    if (canSurfaceComparativeSignals && profile.consistencyTrend && profile.consistencyTrend.confidence >= 0.72) {
        const direction = profile.consistencyTrend.data.direction;
        cards.push({
            id: "consistency_trend",
            patternKey: profile.consistencyTrend.patternKey,
            type: "consistency_trend",
            tone: direction === "declining" ? "caution" : "positive",
            title: language === "es" ? "Tendencia de consistencia" : "Consistency trend",
            description: language === "es"
                ? `La continuidad reciente ${describeTrend(language, direction)} frente a la ventana anterior (${profile.consistencyTrend.data.delta > 0 ? "+" : ""}${profile.consistencyTrend.data.delta}).`
                : `Recent follow-through ${describeTrend(language, direction)} vs the previous window (${profile.consistencyTrend.data.delta > 0 ? "+" : ""}${profile.consistencyTrend.data.delta}).`,
            confidence: profile.consistencyTrend.confidence,
            sampleSize: profile.consistencyTrend.sampleSize,
        });
    }

    const recentImprovement = profile.recentImprovements[0];
    if (canSurfaceComparativeSignals && recentImprovement && recentImprovement.confidence >= 0.72) {
        cards.push({
            id: "recent_improvement",
            patternKey: recentImprovement.patternKey,
            type: "recent_improvement",
            tone: "positive",
            title: language === "es" ? "Una mejora reciente" : "A recent lift",
            description: recentImprovement.data.area === "friction"
                ? language === "es"
                    ? `La friccion reciente bajo ${recentImprovement.data.delta} puntos frente a la semana pasada.`
                    : `Recent friction is down ${recentImprovement.data.delta} points vs last week.`
                : recentImprovement.data.area === "stability"
                    ? language === "es"
                        ? "Las sesiones recientes recuperaron estabilidad frente a la ventana anterior."
                        : "Recent sessions recovered stability vs the previous window."
                    : recentImprovement.data.area === "recovery"
                        ? language === "es"
                            ? "Estas volviendo al foco mas rapido despues de una interrupcion."
                            : "You are returning to focus faster after disruptions."
                        : language === "es"
                            ? `La consistencia semanal subio ${recentImprovement.data.delta} puntos.`
                            : `Weekly consistency is up ${recentImprovement.data.delta} points.`,
            confidence: recentImprovement.confidence,
            sampleSize: recentImprovement.sampleSize,
        });
    }

    const activityPattern = profile.activityPatterns[0];
    if (activityPattern && activityPattern.confidence >= 0.68) {
        cards.push({
            id: activityPattern.patternKey,
            patternKey: activityPattern.patternKey,
            type: activityPattern.patternType,
            tone: activityPattern.patternType === "recovery_boost" || activityPattern.patternType === "preferred_light_execution_window"
                ? "positive"
                : activityPattern.patternType === "attendance_reliability"
                    ? "neutral"
                    : "caution",
            title: activityPattern.title,
            description: activityPattern.description,
            confidence: activityPattern.confidence,
            sampleSize: activityPattern.sampleSize,
        });
    }

    if (profile.activitySignals.attendanceReliability !== null && profile.activitySignals.attendanceReliability < 0.62) {
        cards.push({
            id: "attendance_reliability",
            patternKey: "activity_signal:attendance_reliability",
            type: "activity_signal",
            tone: "caution",
            title: language === "es" ? "La asistencia es menos estable de lo que parece" : "Attendance is less stable than it looks",
            description: language === "es"
                ? "Clases, reuniones o bloques de asistencia no se estan cumpliendo tan seguido como se programan."
                : "Classes, meetings or attendance-style blocks are not landing as consistently as they are being scheduled.",
            confidence: 0.7,
            sampleSize: Math.max(2, profile.activityAnalytics?.totalCount ?? 0),
        });
    }

    if (profile.activitySignals.preferredLightExecutionWindows[0] && cards.length < 5) {
        const preferredWindow = profile.activitySignals.preferredLightExecutionWindows[0];
        cards.push({
            id: "preferred_light_execution_window",
            patternKey: `activity_signal:${preferredWindow.window}`,
            type: "activity_signal",
            tone: "neutral",
            title: language === "es" ? "Una ventana mas limpia para trabajo liviano" : "A cleaner window for lighter work",
            description: language === "es"
                ? `${preferredWindow.window} aparece como una mejor franja para admin o ejecucion ligera.`
                : `${preferredWindow.window} is reading as a better slot for admin or lighter execution blocks.`,
            confidence: preferredWindow.confidence,
            sampleSize: preferredWindow.sampleSize,
        });
    }

    return cards;
}

export function buildProfileSummary(
    profile: BehaviorProfile,
    recentAnalytics: FocusSessionAnalytics[],
    language: AppLanguage = "en",
) {
    if (recentAnalytics.length === 0) {
        return language === "es"
            ? "Unas cuantas sesiones mas van a volver este perfil mas preciso."
            : "A few more sessions will make this profile sharper.";
    }

    if (profile.warmupStage !== "ready") {
        return language === "es"
            ? "Agendo sigue calibrando tu perfil antes de fijar patrones mas fuertes."
            : "Agendo is calibrating your profile before locking in stronger patterns.";
    }

    if (profile.bestFocusWindow && profile.optimalSessionLength) {
        return language === "es"
            ? "Ya se esta marcando una ventana de foco mas fuerte y una duracion mas sostenible."
            : "A stronger focus window and a more sustainable session length are already emerging.";
    }

    if (profile.topFrictionSources.length > 0) {
        return language === "es"
            ? "Ya se empieza a notar un contexto de friccion recurrente."
            : "A recurring friction context is already becoming clear.";
    }

    if (profile.activityPatterns.length > 0) {
        return language === "es"
            ? "Agendo tambien esta aprendiendo de reuniones, recuperacion y actividades livianas fuera de Focus Mode."
            : "Agendo is also learning from meetings, recovery and lighter activities beyond Focus Mode.";
    }

    return language === "es"
        ? "Tu perfil ya junta suficiente evidencia para orientarte con mas claridad."
        : "Your profile is gathering enough evidence to guide you more clearly.";
}
