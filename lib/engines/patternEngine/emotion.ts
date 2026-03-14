import { FocusSession } from "@/lib/types/focus";

// Calculates a 0-100 score indicating well-being and positive outlook surrounding work
export function calculateEmotionScore(session: FocusSession): number {
    const moodBefore = session.moodBefore || 3;
    const moodAfter = session.moodAfter || 3;

    // The baseline is the resulting mood (up to 60 points)
    let score = (moodAfter / 5) * 60; 
    
    // The "Delta": How the session changed your emotional state (up to 40 points)
    const moodDelta = moodAfter - moodBefore; // Range: -4 to +4
    
    if (moodDelta > 0) {
        // Feeling better after working is highly rewarding
        score += (moodDelta * 10); // +10 to +40
    } else if (moodDelta === 0 && moodAfter >= 4) {
        // Sustaining a great mood
        score += 20;
    } else if (moodDelta < 0) {
        // Feeling worse after working drains the score
        score -= (Math.abs(moodDelta) * 10);
    }

    return Math.min(100, Math.max(0, Math.round(score)));
}
