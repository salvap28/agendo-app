import { FocusSession } from "@/lib/types/focus";

// Calculates a 0-100 score indicating well-being and positive outlook surrounding work
export function calculateEmotionScore(session: FocusSession): number {
    const moodBefore = session.moodBefore || 3;
    const moodAfter = session.moodAfter || 3;
    const energyBefore = session.energyBefore || 3;

    // Mood resulting from the session dictates the bulk of our emotional imprint
    let score = (moodAfter / 5) * 50; 
    
    // Entering with energy provides the remaining baseline
    score += (energyBefore / 5) * 25;
    
    // The "Delta Boost": Feeling better after working than before is highly rewarding emotionally
    if (moodAfter > moodBefore) {
        score += 25;
    } else if (moodAfter === moodBefore && moodAfter > 3) {
        score += 15; // Sustaining a good mood is also highly valuable
    }

    return Math.min(100, Math.max(0, Math.round(score)));
}
