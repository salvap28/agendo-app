import { Block } from "@/lib/types/blocks";
import {
    FocusEntryRitualState,
    FocusEntryStartMode,
    FocusLayer,
    FocusSession,
    FocusSessionSummary,
} from "@/lib/types/focus";
import { createAttentionAidLayer, createGymLayer, createStudyLayer } from "@/lib/engines/layersEngine";
import { getFocusPlannedDurationMs } from "@/lib/engines/focusContext";

const RECENT_SESSION_WINDOW_MS = 12 * 60 * 60 * 1000;

type EntryRitualSeedArgs = {
    session: FocusSession;
    blocks: Block[];
    lastSession?: FocusSessionSummary | null;
    now?: number;
};

function getBlockForSession(session: FocusSession, blocks: Block[]) {
    return session.blockId ? blocks.find((block) => block.id === session.blockId) ?? null : null;
}

function isRecentCompatibleSession(session: FocusSession, lastSession?: FocusSessionSummary | null) {
    if (!lastSession) return false;
    const sameModeType = lastSession.blockType === session.blockType;
    const withinWindow = (lastSession.age ?? Number.MAX_SAFE_INTEGER) < RECENT_SESSION_WINDOW_MS;
    return sameModeType && withinWindow;
}

function getMeaningfulBlockTitle(block: Block | null) {
    if (!block) return null;
    const title = block.title.trim();
    if (!title) return null;
    if (/^(new block|focus block|bloque)$/i.test(title)) return null;
    return title;
}

function getBlockNextStepSeed(block: Block | null) {
    if (!block?.notes) return null;
    const note = block.notes.trim();
    if (!note) return null;
    const [firstLine] = note.split(/\r?\n/);
    return firstLine.trim() || null;
}

export function getSuggestedEntryStartMode({
    session,
    lastSession,
}: EntryRitualSeedArgs): FocusEntryStartMode {
    if (session.blockType === "gym" || session.activeLayer?.kind === "gymMode") {
        return "gym";
    }

    if (session.blockType === "study" && session.activeLayer?.kind !== "studyTechnique") {
        return "study_technique";
    }

    if (
        isRecentCompatibleSession(session, lastSession) &&
        !lastSession?.nextStep &&
        !session.nextStep
    ) {
        return "micro_commit";
    }

    return "normal";
}

export function createEntryRitualState({
    session,
    blocks,
    lastSession,
    now = Date.now(),
}: EntryRitualSeedArgs): FocusEntryRitualState {
    const block = getBlockForSession(session, blocks);
    const recentSession = isRecentCompatibleSession(session, lastSession) ? lastSession : null;
    const suggestedStartMode = getSuggestedEntryStartMode({ session, blocks, lastSession, now });

    return {
        isActive: true,
        completed: false,
        skipped: false,
        objective: session.intention ?? recentSession?.intention ?? getMeaningfulBlockTitle(block),
        nextStep: session.nextStep ?? recentSession?.nextStep ?? getBlockNextStepSeed(block),
        minimumViable: session.minimumViable ?? recentSession?.minimumViable ?? null,
        suggestedStartMode,
        selectedStartMode: suggestedStartMode,
        startedAt: now,
        completedAt: null,
    };
}

export function createLegacyEntryRitualState(
    session: Pick<FocusSession, "intention" | "nextStep" | "minimumViable">
): FocusEntryRitualState {
    return {
        isActive: false,
        completed: true,
        skipped: false,
        objective: session.intention ?? null,
        nextStep: session.nextStep ?? null,
        minimumViable: session.minimumViable ?? null,
        suggestedStartMode: null,
        selectedStartMode: null,
        startedAt: null,
        completedAt: null,
    };
}

export function isEntryRitualBlockingRuntime(
    session: Pick<FocusSession, "endedAt" | "entryRitual"> | null
) {
    return Boolean(session?.entryRitual?.isActive && !session.endedAt);
}

export function resolveStudyStartLayer(session: FocusSession, blocks: Block[]) {
    const plannedDurationMs = getFocusPlannedDurationMs(session, blocks, 25);
    const studyLayerId = plannedDurationMs >= 45 * 60 * 1000 ? "study_50_10" : "pomodoro_25_5";
    return createStudyLayer(studyLayerId);
}

export function resolveEntryStartLayer(
    session: FocusSession,
    blocks: Block[],
    selectedStartMode: FocusEntryStartMode | null
): FocusLayer | null {
    switch (selectedStartMode) {
        case "study_technique":
            return session.activeLayer?.kind === "studyTechnique"
                ? session.activeLayer
                : resolveStudyStartLayer(session, blocks);
        case "gym":
            return session.activeLayer?.kind === "gymMode"
                ? session.activeLayer
                : createGymLayer();
        case "micro_commit":
            return createAttentionAidLayer("micro_commit_layer");
        case "normal":
        default:
            return null;
    }
}
