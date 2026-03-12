import { createClient } from "@/lib/supabase/client";
import { FocusSession } from "@/lib/types/focus";
import { DailyMetric } from "@/lib/types/metrics";
import { 
    calculateProgressScore, 
    calculateFrictionScore, 
    calculateConsistencyScore, 
    calculateEmotionScore, 
    calculateMomentumDay, 
    calculateMomentumTotal 
} from "./index";
import { endOfDay, startOfDay, subDays } from "date-fns";

export async function syncDailyMetrics(userId: string) {
    try {
        const supabase = createClient();
        const now = new Date();
        
        const todayStart = startOfDay(now).toISOString();
        const todayEnd = endOfDay(now).toISOString();
    
    // 1. Fetch today's completed sessions
    const { data: todaySessionsData, error: sessionsErr } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', todayStart)
        .lte('started_at', todayEnd)
        .eq('is_active', false);
        
    if (sessionsErr) {
        console.error("Error fetching today sessions for metrics:", sessionsErr);
        return;
    }
    
    // Map snake_case to camelCase conceptually for our functions
    const todaySessions: FocusSession[] = (todaySessionsData || []).map(s => ({
        id: s.id,
        mode: s.mode as any,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        isActive: s.is_active,
        isPaused: s.is_paused,
        totalPausedMs: s.total_paused_ms,
        pauseCount: s.pause_count,
        exitCount: s.exit_count,
        intention: s.intention,
        difficulty: s.difficulty,
        clarity: s.clarity,
        energyBefore: s.energy_before,
        moodBefore: s.mood_before,
        moodAfter: s.mood_after,
        progressFeelingAfter: s.progress_feeling_after,
        startDelayMs: s.start_delay_ms,
    }));

    // 2. Fetch past 30 days of sessions to calculate consistency
    const thirtyDaysAgo = subDays(now, 30).toISOString();
    const { data: recentSessionsData } = await supabase
        .from('focus_sessions')
        .select('id, started_at, ended_at, is_active')
        .eq('user_id', userId)
        .gte('started_at', thirtyDaysAgo)
        .eq('is_active', false);
        
    const recentSessions: FocusSession[] = (recentSessionsData || []).map(s => ({
        id: s.id,
        mode: "block", // mock just for consistency date checks
        startedAt: s.started_at,
        endedAt: s.ended_at,
        isActive: s.is_active,
        isPaused: false,
        totalPausedMs: 0, pauseCount: 0, exitCount: 0
    }));

    // 3. Calculate scores for TODAY based on average of all sessions
    let progressScore = 0, frictionScore = 0, emotionScore = 0;
    
    if (todaySessions.length > 0) {
        const sumProgress = todaySessions.reduce((acc, s) => acc + calculateProgressScore(s), 0);
        const sumFriction = todaySessions.reduce((acc, s) => acc + calculateFrictionScore(s), 0);
        const sumEmotion = todaySessions.reduce((acc, s) => acc + calculateEmotionScore(s), 0);
        
        progressScore = Math.round(sumProgress / todaySessions.length);
        frictionScore = Math.round(sumFriction / todaySessions.length);
        emotionScore = Math.round(sumEmotion / todaySessions.length);
    }

    const consistencyScore = calculateConsistencyScore(recentSessions);
    
    const momentumDay = calculateMomentumDay(
        progressScore,
        consistencyScore,
        frictionScore,
        emotionScore
    );

    // 4. Fetch past daily metrics to calculate Total Momentum
    const { data: pastMetricsData } = await supabase
        .from('daily_metrics')
        .select('date, momentum_day')
        .eq('user_id', userId)
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: false });
        
    // Insert our new "today" as if it was already in history to get accurate total
    const todayDateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const pastMetricsList = (pastMetricsData || [])
        .filter(m => m.date !== todayDateStr) // Remove previous calculation for today if present
        .map(m => ({ date: m.date, momentum_day: m.momentum_day || 0 }));
        
    pastMetricsList.unshift({ date: todayDateStr, momentum_day: momentumDay });

    const momentumTotal = calculateMomentumTotal(pastMetricsList);
    
    // 5. UPSERT the daily_metrics row
    const upsertData = {
        user_id: userId,
        date: todayDateStr,
        progress_score: progressScore,
        friction_score: frictionScore,
        consistency_score: consistencyScore,
        emotion_score: emotionScore,
        momentum_day: momentumDay,
        momentum_total: momentumTotal,
        updated_at: new Date().toISOString()
        };
        
        const { error: upsertErr } = await supabase
            .from('daily_metrics')
            .upsert(upsertData, { onConflict: 'user_id,date' });
            
        if (upsertErr) {
            console.error("Failed to upsert daily_metrics:", upsertErr);
        }
    } catch (error) {
        console.error("Critical error in syncDailyMetrics:", error);
    }
}
