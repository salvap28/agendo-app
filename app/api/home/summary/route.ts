import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInsights } from "@/lib/engines/patternEngine/insights";
import { FocusSession } from "@/lib/types/focus";
import { DailyMetric } from "@/lib/types/metrics";
import { subDays, startOfDay, endOfDay } from "date-fns";

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30).toISOString();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();

    // Fetch recent metrics
    const { data: metricsData } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: false });

    const metrics: DailyMetric[] = (metricsData || []).map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        date: m.date,
        progressScore: m.progress_score,
        frictionScore: m.friction_score,
        consistencyScore: m.consistency_score,
        emotionScore: m.emotion_score,
        momentumDay: m.momentum_day,
        momentumTotal: m.momentum_total,
        createdAt: m.created_at,
        updatedAt: m.updated_at
    }));

    // Fetch today's sessions
    const { data: sessionsData } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', todayStart)
        .lte('started_at', todayEnd)
        .eq('is_active', false);

    const todaySessions: FocusSession[] = (sessionsData || []).map((s: any) => ({
        id: s.id,
        mode: s.mode as any,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        isActive: s.is_active,
        isPaused: s.is_paused,
        totalPausedMs: s.total_paused_ms,
        pauseCount: s.pause_count,
        exitCount: s.exit_count,
        clarity: s.clarity,
        difficulty: s.difficulty,
        progressFeelingAfter: s.progress_feeling_after
    }));

    // Parse and generate
    const currentMetric = metrics.length > 0 ? metrics[0] : null;
    const previousMetric = metrics.length > 1 ? metrics[1] : null;

    const momentumCurrent = currentMetric?.momentumTotal || 0;
    const momentumDeltaWeek = (currentMetric?.momentumTotal || 0) - (metrics.find(m => {
        const d = new Date(m.date);
        return (now.getTime() - d.getTime()) / (1000 * 3600 * 24) >= 7;
    })?.momentumTotal || 0);

    const generatedInsights = generateInsights(todaySessions, metrics);
    const mainInsight = generatedInsights.length > 0 ? generatedInsights[0].text : "Estás construyendo tu historial de actividad. ¡Seguí así!";

    // Simple progress signal: if today's progress > threshold
    let progressSignal = "neutral";
    if (currentMetric?.progressScore && currentMetric.progressScore > 60) progressSignal = "positive";
    if (todaySessions.length === 0) progressSignal = "quiet";

    let softRecommendation = "Un buen momento para planificar un bloque clave.";
    if (todaySessions.length === 0) {
        softRecommendation = "Iniciá con una tarea que te resulte fácil de arrancar para romper el hielo.";
    } else if (currentMetric?.frictionScore && currentMetric.frictionScore > 50) {
        softRecommendation = "Notamos un poco de fricción hoy. Probá simplificar tus tareas.";
    } else if (progressSignal === "positive") {
        softRecommendation = "Venís con buen envión, ¡aprovechalo!";
    }

    const data = {
        greeting: {
            name: user.user_metadata?.username || user.user_metadata?.full_name?.split(' ')[0] || "Usuario",
        },
        momentum_current: momentumCurrent,
        momentum_delta_week: momentumDeltaWeek,
        main_insight: mainInsight,
        progress_signal: progressSignal,
        soft_recommendation: softRecommendation
    };

    return NextResponse.json(data);
}
