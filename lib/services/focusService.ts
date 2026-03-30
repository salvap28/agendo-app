import { createClient, getClientUser } from "@/lib/supabase/client";
import { FocusInterventionRecord, FocusSession } from "@/lib/types/focus";

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

export async function triggerPersonalIntelligenceSync(
    sessionId: string,
    scope: "session" | "daily" | "weekly" = "session"
) {
    if (typeof fetch !== "function") return;

    try {
        await fetch("/api/analytics/consolidate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ scope, sessionId }),
        });
    } catch (error) {
        console.error("Failed to trigger personal intelligence sync", error);
    }
}

export async function syncActiveSession(session: FocusSession) {
    if (typeof window === "undefined") return;
    const supabase = createClient();
    const user = await getClientUser(supabase);
    if (!user) {
        console.log("[Sync] Aborted upsert: no user found");
        return;
    }

    const sessionPayload = {
        id: session.id,
        user_id: user.id,
        mode: session.mode || "free",
        block_id: session.blockId || null,
        block_type: session.blockType || "free",
        initiated_at: session.initiatedAt || session.startedAt,
        started_at: session.startedAt,
        is_active: true,
        is_paused: session.isPaused || false,
        paused_at: session.pausedAt || null,
        total_paused_ms: session.totalPausedMs || 0,
        active_layer: session.activeLayer || null,
        updated_at: new Date().toISOString(),
    };

    console.log("[Sync] Dispatching upsert for session:", session.id, "isPaused:", session.isPaused);

    // Fire and forget without awaited errors blocking UI
    supabase.from("focus_sessions").upsert(sessionPayload, { onConflict: "id" }).then(({ error }) => {
        if (error) {
            console.error("[Sync] Error pushing active session:", error);
        } else {
            console.log("[Sync] Upsert successful for:", session.id);
        }
    });
}

export async function persistCompletedSession(
    session: FocusSession,
    interventions: FocusInterventionRecord[] = []
) {
    const supabase = createClient();
    const user = await getClientUser(supabase);
    if (!user) return;

    const sessionPayload = {
        id: session.id,
        user_id: user.id,
        mode: session.mode,
        block_id: session.blockId,
        block_type: session.blockType,
        initiated_at: session.initiatedAt ?? session.startedAt,
        consolidated_at: session.consolidatedAt ?? session.startedAt,
        started_at: session.startedAt,
        ended_at: session.endedAt,
        planned_duration_ms: session.plannedDurationMs ?? null,
        is_active: false,
        is_paused: false,
        paused_at: null,
        total_paused_ms: session.totalPausedMs,
        pause_count: session.pauseCount,
        exit_count: session.exitCount,
        rest_count: session.restCount ?? 0,
        last_pause_reason: session.lastPauseReason ?? null,
        pause_events: session.pauseEvents ?? [],
        exit_events: session.exitEvents ?? [],
        first_interaction_at: session.firstInteractionAt ?? null,
        last_interaction_at: session.lastInteractionAt ?? null,
        intention: session.intention,
        next_step: session.nextStep ?? null,
        minimum_viable: session.minimumViable ?? null,
        energy_before: session.energyBefore ?? null,
        mood_before: session.moodBefore ?? null,
        mood_after: session.moodAfter ?? null,
        progress_feeling_after: session.progressFeelingAfter ?? null,
        difficulty: session.difficulty ?? null,
        clarity: session.clarity ?? null,
        start_delay_ms: session.startDelayMs ?? null,
        previous_context: session.previousContext ?? null,
        session_quality_score: session.sessionQualityScore ?? null,
        active_layer: session.activeLayer ?? null,
        history: session.history ?? [],
        card_memory: session.cardMemory ?? {},
        closure_bridge_shown: session.closureBridgeShown ?? false,
        closure_note: session.closureNote ?? null,
        entry_ritual: session.entryRitual ?? null,
        updated_at: new Date().toISOString(),
    };

    const { error: sessionError } = await supabase
        .from("focus_sessions")
        .upsert(sessionPayload, { onConflict: "id" });

    if (sessionError) {
        console.error("Error saving focus session:", JSON.stringify(sessionError, null, 2));
        throw sessionError;
    }

    const events = (session.events ?? []).map((event) => ({
        id: event.id,
        user_id: user.id,
        session_id: event.sessionId,
        event_type: event.type,
        runtime_state: event.runtimeState,
        occurred_at: event.timestamp,
        relative_ms: event.relativeMs,
        payload: event.payload ?? {},
    }));

    if (events.length > 0) {
        const { error: eventsError } = await supabase
            .from("focus_session_events")
            .upsert(events, { onConflict: "id" });

        if (eventsError) {
            console.error("Error saving focus session events:", JSON.stringify(eventsError, null, 2));
            throw eventsError;
        }
    }

    const sessionInterventions = interventions
        .filter((record) => record.sessionId === session.id)
        .map((record) => ({
            id: record.id,
            user_id: user.id,
            session_id: record.sessionId,
            occurred_at: new Date(record.timestamp).toISOString(),
            type: record.type,
            source_card: record.sourceCard ?? null,
            source_toast: record.sourceToast ?? null,
            trigger: record.trigger ?? null,
            action_taken: record.actionTaken ?? null,
            result: record.result ?? null,
            payload: record.payload ?? {},
        }));

    if (sessionInterventions.length > 0) {
        const { error: interventionsError } = await supabase
            .from("focus_session_interventions")
            .upsert(sessionInterventions, { onConflict: "id" });

        if (interventionsError) {
            console.error("Error saving focus interventions:", JSON.stringify(interventionsError, null, 2));
            throw interventionsError;
        }
    }

    await triggerPersonalIntelligenceSync(session.id);
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

    await triggerPersonalIntelligenceSync(sessionId);
}
