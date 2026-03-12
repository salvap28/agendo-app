import { FocusSession } from "@/lib/types/focus";

// Calculates a value between 0-100 representing raw execution progress.
export function calculateProgressScore(session: FocusSession): number {
    let score = 0;
    
    // Baseline for completing a session without bailing out prematurely
    if (session.endedAt && !session.isActive) {
        score += 40; 
    }

    const difficulty = session.difficulty || 3;
    const progressFeeling = session.progressFeelingAfter || 3;
    
    // The inner feeling of progress is our golden metric for subjective advance
    score += (progressFeeling / 5) * 40;
    
    // Pushing through harder tasks yields slightly higher raw progress output
    score += (difficulty / 5) * 20;
    
    return Math.min(100, Math.max(0, Math.round(score)));
}
