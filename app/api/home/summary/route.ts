import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInsights } from "@/lib/engines/patternEngine/insights";
import { calculateFocusStreak } from "@/lib/engines/patternEngine/consistency";
import { FocusSession } from "@/lib/types/focus";
import { DailyMetric } from "@/lib/types/metrics";
import { subDays, startOfDay, endOfDay, isAfter } from "date-fns";

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

    // Fetch all sessions from the last 30 days to detect patterns and streaks
    const { data: sessionsData } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', thirtyDaysAgo)
        .eq('is_active', false)
        .order('started_at', { ascending: false });

    const allSessions: FocusSession[] = (sessionsData || []).map((s: any) => ({
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
        progressFeelingAfter: s.progress_feeling_after,
        startDelayMs: s.start_delay_ms
    }));

    const todaySessions = allSessions.filter(s => s.startedAt && new Date(s.startedAt) >= new Date(todayStart) && new Date(s.startedAt) <= new Date(todayEnd));

    // Parse and generate
    const currentMetric = metrics.length > 0 ? metrics[0] : null;
    const previousMetric = metrics.length > 1 ? metrics[1] : null;

    const momentumCurrent = currentMetric?.momentumTotal || 0;
    const momentumDeltaWeek = (currentMetric?.momentumTotal || 0) - (metrics.find(m => {
        const d = new Date(m.date);
        return (now.getTime() - d.getTime()) / (1000 * 3600 * 24) >= 7;
    })?.momentumTotal || 0);

    // Compute Streak & Weekly Count
    const focusStreak = calculateFocusStreak(allSessions, now);
    const sevenDaysAgo = subDays(now, 7);
    const weeklySessionsCount = allSessions.filter(s => s.startedAt && isAfter(new Date(s.startedAt), sevenDaysAgo)).length;

    // Determine best focus window
    let bestFocusWindow = null;
    const timeCount = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    allSessions.forEach(s => {
        if (!s.startedAt) return;
        if ((s.progressFeelingAfter || 0) >= 3 || (s.difficulty || 0) >= 3) {
            const h = new Date(s.startedAt).getHours();
            if (h >= 5 && h < 12) timeCount.morning++;
            else if (h >= 12 && h < 18) timeCount.afternoon++;
            else if (h >= 18 && h < 22) timeCount.evening++;
            else timeCount.night++;
        }
    });
    const bestTime = Object.entries(timeCount).reduce((a, b) => a[1] > b[1] ? a : b);
    if (bestTime[1] >= 2) { // Need at least 2 sessions to claim a "best window"
        bestFocusWindow = bestTime[0];
    }

    const generatedInsights = generateInsights(allSessions, metrics);
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
        soft_recommendation: softRecommendation,
        focus_streak: focusStreak,
        weekly_sessions_count: weeklySessionsCount,
        best_focus_window: bestFocusWindow
    };

    return NextResponse.json(data);
}
