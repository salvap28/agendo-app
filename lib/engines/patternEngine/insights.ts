import { FocusSession } from "@/lib/types/focus";
import { DailyMetric } from "@/lib/types/metrics";

export interface Insight {
    id: string;
    text: string;
    type: "positive" | "neutral" | "observation";
}

// Helper to determine time of day
function getTimeOfDay(date: Date): "morning" | "afternoon" | "evening" | "night" {
    const h = date.getHours();
    if (h >= 5 && h < 12) return "morning";
    if (h >= 12 && h < 18) return "afternoon";
    if (h >= 18 && h < 22) return "evening";
    return "night";
}

// Generates an array of human, empathetic insights based on user data
export function generateInsights(sessions: FocusSession[], metrics: DailyMetric[]): Insight[] {
    const insights: Insight[] = [];
    if (sessions.length === 0) return insights;

    // 1. Mejores horarios
    const timeCount = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    
    sessions.forEach(s => {
        if (!s.startedAt || !s.endedAt || s.isActive) return;
        // only count if progress was good
        if ((s.progressFeelingAfter || 0) >= 3 || (s.difficulty || 0) >= 3) {
            const time = getTimeOfDay(new Date(s.startedAt));
            timeCount[time]++;
        }
    });

    const bestTime = Object.entries(timeCount).reduce((a, b) => a[1] > b[1] ? a : b);
    
    if (bestTime[1] >= 3 && bestTime[1] > (sessions.length / 3)) {
        let timeName = "la mañana";
        if (bestTime[0] === "afternoon") timeName = "la tarde";
        if (bestTime[0] === "evening") timeName = "la tardecita";
        if (bestTime[0] === "night") timeName = "la noche";
        
        insights.push({
            id: "best_time",
            text: `Tenés una afinidad notable para entrar en flujo durante ${timeName}. Tu progreso ahí es muy sólido.`,
            type: "positive"
        });
    }

    // 2. Claridad vs Fricción de inicio (Start Delay)
    const highClaritySessions = sessions.filter(s => (s.clarity || 0) >= 4);
    if (highClaritySessions.length >= 2) {
        const avgDelayHighClarity = highClaritySessions.reduce((acc, s) => acc + (s.startDelayMs || 0), 0) / highClaritySessions.length;
        if (avgDelayHighClarity < 60000 * 2) { // Less than 2 min delay
            insights.push({
                id: "clarity_speed",
                text: "Cuando tenés muy en claro qué vas a hacer, empezás casi sin fricción. La claridad mental es tu mejor aliada.",
                type: "observation"
            });
        }
    }

    // 3. Fricción por interrupciones
    const interruptedSessions = sessions.filter(s => (s.pauseCount || 0) > 0 || (s.exitCount || 0) > 0);
    if (interruptedSessions.length >= 3 && interruptedSessions.length > sessions.length * 0.4) {
        insights.push({
            id: "high_interruptions",
            text: "Últimamente hubo varias interrupciones en tus bloques. Quizás sumar ambiente o silenciar notificaciones te ayude a proteger tu foco.",
            type: "neutral"
        });
    }

    // 4. Mejora de consistencia (comparando métricas)
    if (metrics.length >= 2) {
        const sortedMetrics = [...metrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latest = sortedMetrics[0];
        const previous = sortedMetrics[1];
        
        if ((latest.consistencyScore || 0) > (previous.consistencyScore || 0) + 10 && (latest.consistencyScore || 0) >= 40) {
            insights.push({
                id: "consistency_up",
                text: "Estás logrando un ritmo más estable. Aparecer seguido es la mitad de la batalla ganada.",
                type: "positive"
            });
        }
        
        // 5. Progreso real aunque haya menos actividad
        const older = sortedMetrics[2];
        if (older && (latest.progressScore || 0) > (older.progressScore || 0) && sessions.length < 5) {
            insights.push({
                id: "quality_over_quantity",
                text: "Puede que hayas hecho menos sesiones, pero la sensación de avance es mayor. La calidad está primando.",
                type: "positive"
            });
        }
    }

    // 6. Progreso en Dificultad
    const hardSessions = sessions.filter(s => (s.difficulty || 0) >= 4 && (s.progressFeelingAfter || 0) >= 4);
    if (hardSessions.length >= 1) {
        insights.push({
            id: "hard_progress",
            text: "Avanzaste con firmeza en tareas que sentías difíciles. Eso construye resistencia mental real.",
            type: "positive"
        });
    }

    // Limitar a los 2 o 3 mejores insights para no abrumar
    return insights.slice(0, 3);
}
