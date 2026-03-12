import { FocusSession } from "@/lib/types/focus";
import { isSameDay, subDays } from "date-fns";

// Calculates a structural metric showing how often the user shows up (0-100)
export function calculateConsistencyScore(recentSessions: FocusSession[]): number {
    if (recentSessions.length === 0) return 0;
    
    const now = new Date();
    let activeDays = 0;
    
    // Check last 7 days window (strict consistency)
    for(let i=0; i<7; i++) {
        const d = subDays(now, i);
        const hasSession = recentSessions.some(s => s.startedAt && isSameDay(new Date(s.startedAt), d));
        if (hasSession) activeDays++;
    }

    // Showing up is 70% of consistency
    const dayScore = (activeDays / 7) * 70;
    
    // Bonus for volume in the same time frame (up to 30 points)
    const completedSessions = recentSessions.filter(s => s.endedAt && !s.isActive).length;
    const sessionScore = Math.min(30, completedSessions * 5);

    return Math.min(100, Math.max(0, Math.round(dayScore + sessionScore)));
}
