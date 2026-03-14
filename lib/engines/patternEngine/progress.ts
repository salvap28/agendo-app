import { FocusSession } from "@/lib/types/focus";

// Calculates a value between 0-100 representing raw execution progress.
export function calculateProgressScore(session: FocusSession): number {
    let score = 0;
    
    // Baseline for completing a session without bailing out prematurely is smaller now.
    // We don't reward pure activity, we reward progress.
    if (session.endedAt && !session.isActive) {
        score += 20; 
    }

    const difficulty = session.difficulty || 3;
    const progressFeeling = session.progressFeelingAfter || 3; // 1 to 5
    
    // The inner feeling of progress is our golden metric for subjective advance (up to 50 points)
    score += (progressFeeling / 5) * 50;
    
    // Pushing through harder tasks yields higher raw progress output (up to 30 points)
    // A difficult task where you made progress is worth more than an easy task
    score += (difficulty / 5) * 30;
    
    // Penalty if the feeling of progress is extremely low despite activity
    if (progressFeeling <= 2) {
        score = score * 0.7; // 30% penalty
    }

    return Math.min(100, Math.max(0, Math.round(score)));
}
