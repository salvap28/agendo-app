import { FocusSession } from "@/lib/types/focus";
import { isSameDay, subDays } from "date-fns";

// Calculates a structural metric showing how often the user shows up (0-100)
// targetDate ensures backward-compatibility when recomputing past metrics
export function calculateConsistencyScore(recentSessions: FocusSession[], targetDate: Date = new Date()): number {
    if (recentSessions.length === 0) return 0;
    
    let activeDays = 0;
    
    // Check last 7 days window counting backward from targetDate
    for(let i = 0; i < 7; i++) {
        const d = subDays(targetDate, i);
        const hasSession = recentSessions.some(s => s.startedAt && isSameDay(new Date(s.startedAt), d));
        if (hasSession) activeDays++;
    }

    // Showing up is 70% of consistency
    const dayScore = (activeDays / 7) * 70;
    
    // Bonus for volume in the same time frame (up to 30 points)
    // Only count sessions that actually completed before or on the target date
    const completedSessions = recentSessions.filter(s => s.endedAt && !s.isActive && new Date(s.endedAt) <= targetDate).length;
    const sessionScore = Math.min(30, completedSessions * 5);

    return Math.min(100, Math.max(0, Math.round(dayScore + sessionScore)));
}

// Extracts the current streak of consecutive days focusing
export function calculateFocusStreak(recentSessions: FocusSession[], targetDate: Date = new Date()): number {
    if (recentSessions.length === 0) return 0;
    
    let currentStreak = 0;
    
    // Check backwards day by day up to 30 days
    for (let i = 0; i < 30; i++) {
        const d = subDays(targetDate, i);
        const hasSession = recentSessions.some(s => s.startedAt && isSameDay(new Date(s.startedAt), d));
        
        if (hasSession) {
            currentStreak++;
        } else if (i === 0) {
            // It's okay if today doesn't have a session yet, the streak might still be alive from yesterday
            continue;
        } else {
            // Once we hit a day without sessions (and it's not today), the streak is broken
            break;
        }
    }
    
    return currentStreak;
}
