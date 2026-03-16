import { createClient, getClientUser } from "@/lib/supabase/client";
import { recomputeDailyMetricsForUser } from "@/lib/engines/patternEngine/metricsSync";

/**
 * FocusService
 * Responsible for encapsulating side-effects (database persistence, API calls, sync loops)
 * away from the local Zustand state manager.
 */

export interface ReflectionPayload {
    energyBefore?: number;
    moodBefore?: number;
    clarity?: number;
    difficulty?: number;
    progressFeelingAfter?: number;
    moodAfter?: number;
    notes?: string;
}

export async function saveSessionReflection(sessionId: string, oldIntention: string | undefined, payload: ReflectionPayload): Promise<void> {
    const supabase = createClient();
    
    // Intention override if user wrote reflection notes
    const newIntention = payload.notes ? `${oldIntention ? oldIntention + ' | ' : ''}${payload.notes}` : oldIntention;

    const { error } = await supabase.from('focus_sessions').update({
        energy_before: payload.energyBefore,
        mood_before: payload.moodBefore,
        clarity: payload.clarity,
        difficulty: payload.difficulty,
        progress_feeling_after: payload.progressFeelingAfter,
        mood_after: payload.moodAfter,
        intention: newIntention,
    }).eq('id', sessionId);

    if (error) {
        console.error('Error saving reflection:', JSON.stringify(error, null, 2));
        throw error; // Let caller decide if they want to swallow or broadcast
    }

    // Immediately background sync daily metrics assuming the session belongs to them
    const user = await getClientUser(supabase);
    if (user) {
        // Fire and forget, decoupled from UI flow
        recomputeDailyMetricsForUser(user.id).catch(e => {
            console.error("Background daily metrics sync failed", e);
        });
    }
}
