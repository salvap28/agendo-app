import { FocusSession } from "@/lib/types/focus";
import { DailyMetric } from "@/lib/types/metrics";

export interface Insight {
    id: string;
    text: string;
    type: "positive" | "neutral" | "observation";
}

// Generates an array of human, empathetic insights based on user data
export function generateInsights(sessions: FocusSession[], metrics: DailyMetric[]): Insight[] {
    const insights: Insight[] = [];
    
    if (sessions.length === 0) return insights;

    // 1. Time of day insight (Detect if morning or afternoon is better)
    const morningSessions = sessions.filter(s => {
        if (!s.startedAt) return false;
        const h = new Date(s.startedAt).getHours();
        return h >= 6 && h < 12;
    });
    
    if (morningSessions.length >= 3 && morningSessions.length > (sessions.length / 2)) {
        insights.push({
            id: "time_morning",
            text: "Las sesiones de la mañana parecen estar funcionando mejor para vos. Hay un buen ritmo ahí.",
            type: "positive"
        });
    }

    // 2. Clarity -> friction insight
    const highClarityLowFriction = sessions.filter(s => (s.clarity || 0) >= 4 && (s.exitCount === 0 && s.pauseCount === 0));
    if (highClarityLowFriction.length >= 2) {
        insights.push({
            id: "clarity_friction",
            text: "Cuando la tarea está más clara desde el principio, te resulta mucho más fácil mantenerte enfocado.",
            type: "positive"
        });
    }

    // 3. Momentum Delta
    if (metrics.length >= 2) {
        // Assume metrics are sorted newest first
        const latest = metrics[0];
        const previous = metrics[1];
        if (latest.momentumDay && previous.momentumDay && latest.momentumDay > previous.momentumDay + 10) {
            insights.push({
                id: "momentum_up",
                text: "Gran repunte de energía y consistencia positiva en estos últimos días. ¡Bien ahí!",
                type: "positive"
            });
        }
    }
    
    // 4. Progress feeling despite difficulty
    const highProgressHighDifficulty = sessions.filter(s => (s.difficulty || 0) >= 4 && (s.progressFeelingAfter || 0) >= 4);
    if (highProgressHighDifficulty.length > 0) {
        insights.push({
            id: "progress_hard",
            text: "Avanzaste con fuerza en tareas que sentías difíciles. Eso construye resistencia mental real.",
            type: "positive"
        });
    }

    return insights;
}
