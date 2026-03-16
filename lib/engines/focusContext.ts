import { Block } from "@/lib/types/blocks";
import { FocusContext, FocusSession, FocusSessionSummary } from "@/lib/types/focus";

export const FOCUS_RECENT_EVENT_WINDOW_MS = 10 * 60 * 1000;

export function clamp(v: number, min: number, max: number) {
    return Math.min(max, Math.max(min, v));
}

function countRecentEvents(events: number[] | undefined, now: number, windowMs: number) {
    return (events ?? []).filter((timestamp) => now - timestamp <= windowMs).length;
}

function getLastEventAt(events: number[] | undefined) {
    if (!events || events.length === 0) return null;
    return events[events.length - 1] ?? null;
}

type BuildFocusContextArgs = {
    session: FocusSession | null;
    blocks: Block[];
    defaultFocusMinutes?: number;
    lastSession?: FocusSessionSummary | null;
    now?: number;
};

export function getFocusEffectiveNow(session: FocusSession, now = Date.now()) {
    if (session.endedAt) return new Date(session.endedAt).getTime();
    if (session.isPaused && session.pausedAt) return new Date(session.pausedAt).getTime();
    return now;
}

export function getFocusElapsedMs(session: FocusSession, now = Date.now()) {
    const startTime = new Date(session.startedAt).getTime();
    const effectiveNow = getFocusEffectiveNow(session, now);
    return Math.max(0, effectiveNow - startTime - session.totalPausedMs);
}

export function getFocusPlannedDurationMs(
    session: FocusSession,
    blocks: Block[],
    defaultFocusMinutes = 25
) {
    const block = session.blockId ? blocks.find((item) => item.id === session.blockId) : null;

    return block
        ? Math.max(1, block.endAt.getTime() - block.startAt.getTime())
        : Math.max(1, defaultFocusMinutes * 60 * 1000);
}

export function buildFocusContext({
    session,
    blocks,
    defaultFocusMinutes = 25,
    lastSession,
    now = Date.now(),
}: BuildFocusContextArgs): FocusContext | null {
    if (!session) return null;

    const startTime = new Date(session.startedAt).getTime();
    const plannedDurationMs = getFocusPlannedDurationMs(session, blocks, defaultFocusMinutes);
    const elapsedMs = getFocusElapsedMs(session, now);
    const sessionProgress = clamp(elapsedMs / plannedDurationMs, 0, 1);
    const recentPauseCount = countRecentEvents(session.pauseEvents, now, FOCUS_RECENT_EVENT_WINDOW_MS);
    const recentExitCount = countRecentEvents(session.exitEvents, now, FOCUS_RECENT_EVENT_WINDOW_MS);
    const lastPauseEventAt = getLastEventAt(session.pauseEvents);
    const lastExitEventAt = getLastEventAt(session.exitEvents);
    const lastFrictionEventAt = Math.max(lastPauseEventAt ?? 0, lastExitEventAt ?? 0) || null;
    const firstInteractionAt = session.firstInteractionAt ? new Date(session.firstInteractionAt).getTime() : null;
    const lastInteractionAt = session.lastInteractionAt ? new Date(session.lastInteractionAt).getTime() : null;
    const recentInteractionWindowMs = lastInteractionAt ? Math.max(0, now - lastInteractionAt) : elapsedMs;
    const recentStabilityMs = lastFrictionEventAt ? Math.max(0, now - lastFrictionEventAt) : elapsedMs;
    const startDelayMs = typeof session.startDelayMs === "number"
        ? session.startDelayMs
        : firstInteractionAt
            ? Math.max(0, firstInteractionAt - startTime)
            : elapsedMs;

    const enrichedLastSession = lastSession
        ? {
            ...lastSession,
            age: Math.max(0, now - new Date(lastSession.endedAt).getTime()),
        }
        : null;

    return {
        mode: session.mode,
        blockType: session.blockType,
        startTime,
        now,
        plannedDurationMs,
        elapsedMs,
        totalPausedMs: session.totalPausedMs,
        sessionProgress,
        pauses: session.pauseCount ?? 0,
        overlayExits: session.exitCount ?? 0,
        restPauses: session.restCount ?? 0,
        lastPauseReason: session.lastPauseReason ?? null,
        recentPauseCount,
        recentExitCount,
        recentInteractionWindowMs,
        recentStabilityMs,
        startDelayMs,
        intention: session.intention ?? null,
        nextStep: session.nextStep ?? null,
        minimumViable: session.minimumViable ?? null,
        history: session.history || [],
        cardMemory: session.cardMemory || {},
        closureBridgeShown: session.closureBridgeShown === true,
        lastSession: enrichedLastSession,
        activeLayerId: session.activeLayer?.id ?? null,
        activeLayerKind: session.activeLayer?.kind ?? null,
    };
}
