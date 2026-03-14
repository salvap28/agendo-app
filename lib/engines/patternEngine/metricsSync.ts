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

// Recalculates and upserts the daily_metrics row for a specific user and date.
// If no date is passed, defaults to today.
export async function recomputeDailyMetricsForUser(userId: string, targetDate: Date = new Date()) {
    try {
        const supabase = createClient();
        
        const targetStart = startOfDay(targetDate).toISOString();
        const targetEnd = endOfDay(targetDate).toISOString();
        const targetDateStr = targetDate.toISOString().split('T')[0];
    
    // 1. Fetch today's completed sessions
    const { data: targetSessionsData, error: sessionsErr } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', targetStart)
        .lte('started_at', targetEnd)
        .eq('is_active', false);
        
    if (sessionsErr) {
        console.error("Error fetching today sessions for metrics:", sessionsErr);
        return;
    }
    
    // Map snake_case to camelCase conceptually for our functions
    const targetSessions: FocusSession[] = (targetSessionsData || []).map(s => ({
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
    const thirtyDaysAgo = subDays(targetDate, 30).toISOString();
    const { data: recentSessionsData } = await supabase
        .from('focus_sessions')
        .select('id, started_at, ended_at, is_active')
        .eq('user_id', userId)
        .gte('started_at', thirtyDaysAgo)
        .lte('started_at', targetEnd) // Make sure we don't look into the future
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

    // 3. Calculate scores for TARGET DATE based on average of all sessions
    let progressScore = 0, frictionScore = 0, emotionScore = 0;
    
    if (targetSessions.length > 0) {
        const sumProgress = targetSessions.reduce((acc, s) => acc + calculateProgressScore(s), 0);
        const sumFriction = targetSessions.reduce((acc, s) => acc + calculateFrictionScore(s), 0);
        const sumEmotion = targetSessions.reduce((acc, s) => acc + calculateEmotionScore(s), 0);
        
        progressScore = Math.round(sumProgress / targetSessions.length);
        frictionScore = Math.round(sumFriction / targetSessions.length);
        emotionScore = Math.round(sumEmotion / targetSessions.length);
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
        .lte('date', targetDateStr) // Only up to target date
        .order('date', { ascending: false });
        
    // Insert our new computed target day as if it was already in history to get accurate total
    const pastMetricsList = (pastMetricsData || [])
        .filter(m => m.date !== targetDateStr) // Remove previous calculation for target if present
        .map(m => ({ date: m.date, momentum_day: m.momentum_day || 0 }));
        
    pastMetricsList.unshift({ date: targetDateStr, momentum_day: momentumDay });

    const momentumTotal = calculateMomentumTotal(pastMetricsList);
    
    // 5. UPSERT the daily_metrics row
    const upsertData = {
        user_id: userId,
        date: targetDateStr,
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
        console.error("Critical error in recomputeDailyMetricsForUser:", error);
    }
}

// Backward compatibility alias
export const syncDailyMetrics = (userId: string) => recomputeDailyMetricsForUser(userId);
