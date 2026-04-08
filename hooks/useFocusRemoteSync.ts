import { useEffect } from 'react';
import { createClient, getClientUser } from '@/lib/supabase/client';
import { useFocusStore } from '@/lib/stores/focusStore';
import { FocusSession } from '@/lib/types/focus';
import { RealtimeChannel } from '@supabase/supabase-js';

type FocusSessionRow = {
    id: string;
    mode: "free" | "block" | null;
    block_id: string | null;
    block_type: FocusSession["blockType"] | null;
    initiated_at: string;
    started_at: string;
    is_paused: boolean;
    paused_at: string | null;
    total_paused_ms: number;
    planned_duration_ms: number | null;
    active_layer: FocusSession["activeLayer"] | null;
    history: string[] | null;
    pause_count: number | null;
    exit_count: number | null;
    card_memory: FocusSession["cardMemory"] | null;
    closure_bridge_shown: boolean | null;
    is_active: boolean;
};

export function useFocusRemoteSync() {
    const { dangerouslyInjectRemoteSession } = useFocusStore();

    useEffect(() => {
        let channel: RealtimeChannel | null = null;
        let isSetup = true;

        async function setupRealtimeSync() {
            const supabase = createClient();
            const user = await getClientUser(supabase);
            if (!user || !isSetup) return;

            // 1. Initial hydration: grab any active session from DB
            const { data: activeSessions, error } = await supabase
                .from('focus_sessions')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('updated_at', { ascending: false })
                .limit(1);

            if (!error && activeSessions && activeSessions.length > 0) {
                const remoteData = activeSessions[0];
                const localSession = useFocusStore.getState().session;

                // Only hydrate if we don't have a local session, OR if the remote session is DIFFERENT.
                // If we started a new session locally, it will override the remote via syncActiveSession.
                if (!localSession || localSession.id !== remoteData.id) {
                    const mappedSession: FocusSession = {
                        id: remoteData.id,
                        mode: remoteData.mode as "free" | "block",
                        blockId: remoteData.block_id ?? undefined,
                        blockType: remoteData.block_type ?? undefined,
                        initiatedAt: remoteData.initiated_at,
                        startedAt: remoteData.started_at,
                        isActive: true,
                        isPaused: remoteData.is_paused,
                        pausedAt: remoteData.paused_at ?? undefined,
                        totalPausedMs: remoteData.total_paused_ms,
                        plannedDurationMs: remoteData.planned_duration_ms ?? undefined,
                        activeLayer: remoteData.active_layer ?? undefined,
                        history: remoteData.history ?? [],
                        pauseCount: remoteData.pause_count ?? 0,
                        exitCount: remoteData.exit_count ?? 0,
                        cardMemory: remoteData.card_memory ?? {},
                        closureBridgeShown: remoteData.closure_bridge_shown ?? false,
                        events: [],
                        persistenceStatus: "draft",
                        runtimeState: "stabilized"
                    };
                    dangerouslyInjectRemoteSession(mappedSession);
                }
            }

            // 2. Setup Postgres listener for live changes
            channel = supabase.channel(`focus-sync-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'focus_sessions',
                        filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                        console.log("[Focus Sync] Websocket received payload:", payload);
                        const newRow = payload.new as FocusSessionRow;
                        const local = useFocusStore.getState().session;

                        // If user ended the session elsewhere
                        if (newRow.is_active === false && local?.id === newRow.id) {
                            // The session was finished on another device
                            useFocusStore.setState({ session: null }); // Hard reset to avoid re-triggering finishes
                        } 
                        // If it's active and someone paused/resumed/changed layer
                        else if (newRow.is_active === true) {
                            // Same session update
                            if (local && local.id === newRow.id) {
                                // Prevent infinite loops by checking timestamps or simple deep equality of essentials
                                if (
                                    local.isPaused !== newRow.is_paused ||
                                    local.pausedAt !== newRow.paused_at ||
                                    local.totalPausedMs !== newRow.total_paused_ms ||
                                    JSON.stringify(local.activeLayer) !== JSON.stringify(newRow.active_layer)
                                ) {
                                    const updatedSession = {
                                        ...local,
                                        isPaused: newRow.is_paused,
                                        pausedAt: newRow.paused_at ?? undefined,
                                        totalPausedMs: newRow.total_paused_ms,
                                        activeLayer: newRow.active_layer ?? undefined,
                                    };
                                    dangerouslyInjectRemoteSession(updatedSession as FocusSession);
                                }
                            } else {
                                // A completely different session started on another device!
                                // Override local immediately to match multiplayer
                                const mappedSession: FocusSession = {
                                    id: newRow.id,
                                    mode: newRow.mode as "free" | "block",
                                    blockId: newRow.block_id ?? undefined,
                                    blockType: newRow.block_type ?? undefined,
                                    initiatedAt: newRow.initiated_at,
                                    startedAt: newRow.started_at,
                                    isActive: true,
                                    isPaused: newRow.is_paused,
                                    pausedAt: newRow.paused_at ?? undefined,
                                    totalPausedMs: newRow.total_paused_ms,
                                    plannedDurationMs: newRow.planned_duration_ms ?? undefined,
                                    activeLayer: newRow.active_layer ?? undefined,
                                    history: newRow.history ?? [],
                                    pauseCount: newRow.pause_count ?? 0,
                                    exitCount: newRow.exit_count ?? 0,
                                    cardMemory: newRow.card_memory ?? {},
                                    closureBridgeShown: newRow.closure_bridge_shown ?? false,
                                    events: [],
                                    persistenceStatus: "draft",
                                    runtimeState: "stabilized"
                                };
                                dangerouslyInjectRemoteSession(mappedSession);
                            }
                        }
                    }
                )
                .subscribe();
        }

        setupRealtimeSync();

        return () => {
            isSetup = false;
            if (channel) channel.unsubscribe();
        };
    }, [dangerouslyInjectRemoteSession]);

    return null;
}
