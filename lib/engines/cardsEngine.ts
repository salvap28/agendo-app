import { FocusContext, FocusCard, FocusLayer } from '@/lib/types/focus';
import { AppLanguage } from "@/lib/i18n/messages";

export interface EngineResult {
    visibleCards: FocusCard[];
    toastCards: FocusCard[];
    suggestedLayers: FocusLayer[];
    sessionState: SessionState;
}

export enum SessionState {
    ENTRY = "ENTRY",
    SLOW_START = "SLOW_START",
    NORMAL_FLOW = "NORMAL_FLOW",
    FRICTION = "FRICTION",
    DISTRACTED = "DISTRACTED",
    FLOW = "FLOW",
    MID_PROGRESS = "MID_PROGRESS",
}

export type CardRule = {
    id: string;
    priority: number;
    when: (ctx: FocusContext, state: SessionState) => boolean;
    build: (ctx: FocusContext, language: AppLanguage) => FocusCard;
};

type CardMemoryPolicy = {
    maxShows?: number;
};

const HOURS_12_MS = 12 * 60 * 60 * 1000;
const MINUTES_5_MS = 5 * 60 * 1000;
const MINUTES_10_MS = 10 * 60 * 1000;
const MINUTES_15_MS = 15 * 60 * 1000;
const MINUTES_2_MS = 2 * 60 * 1000;

const cardConflicts: Record<string, string[]> = {
    card_micro_commit: ["card_lock_in_focus"],
    card_lock_in_focus: ["card_micro_commit", "card_next_step", "card_playlist"],
    card_next_step: ["card_lock_in_focus", "card_progress_check"],
    card_progress_check: ["card_next_step"],
    card_reduce_scope: ["card_reset_clarity"],
    card_reset_clarity: ["card_reduce_scope"],
    card_closure_bridge: ["card_progress_check", "card_next_step", "card_lock_in_focus"],
};

const cardMemoryPolicies: Record<string, CardMemoryPolicy> = {
    card_micro_commit: { maxShows: 1 },
    card_progress_check: { maxShows: 1 },
    card_closure_bridge: { maxShows: 1 },
    toast_active_recall: { maxShows: 1 },
};

function getCardsCopy(language: AppLanguage) {
    return language === "es"
        ? {
            takeYourTime: "Tomate tu tiempo",
            breatheAndReturn: "Respira profundo. Vuelve cuando estes listo para continuar.",
            blockEnding: "Fin del bloque",
            blockEndingBody: "Estas llegando al final del tiempo planificado.",
            extend5: "Extender 5 min",
            finish: "Finalizar",
            exitsTitle: "Salir seguido rompe el hilo",
            exitsBody: "Reducimos alcance para volver mas facil?",
            reduceScope: "Reducir alcance",
            activeRecallBody: "Haz una pausa corta y recupera lo aprendido en una oracion.",
            answer: "Responder",
            later: "Luego",
            defineGoal: "Define tu objetivo",
            defineGoalBody: "Que quieres lograr en este bloque?",
            define: "Definir",
            resumePrevious: "Retomar lo ultimo",
            suggestedFirstStep: (step: string) => `Primer paso sugerido: ${step}`,
            resumeWhereYouLeft: "Sigue desde donde habias quedado.",
            resume: "Retomar",
            shortCommitment: "Compromiso corto",
            shortCommitmentBody: "Prueba 5 minutos sin interrupciones.",
            activate: "Activar",
            makeItSmaller: "Hazlo mas chico",
            makeItSmallerBody: "Si el bloque se siente grande, elige una version minima.",
            refocusTitle: "Perdiste el hilo?",
            refocusBody: "Vuelve al objetivo del bloque.",
            refocus: "Reenfocar",
            returnToBlock: "Vuelve al bloque",
            minimumVersion: (value: string) => `Vuelve por esta version minima: ${value}`,
            firstStep: (value: string) => `Vuelve por este primer paso: ${value}`,
            return: "Volver",
            inRhythm: "Entraste en ritmo",
            inRhythmBody: "Evita interrupciones ahora.",
            protect: "Proteger",
            progressTitle: "Avanzaste?",
            progressBody: "Marca progreso rapido.",
            mark: "Marcar",
            closingTitle: "Cerrando el bloque",
            closingBody: "Tomate un segundo. Que fue lo mas importante que avanzaste?",
            done: "Listo",
            noteProgress: "Anotar avance",
            playlistTitle: "Playlist sugerida",
            playlistBody: "Musica ideal para este momento.",
            openPlaylist: "Abrir playlist",
            nextStepTitle: "Cual es el siguiente paso?",
            nextStepBody: "Define la accion concreta para seguir.",
            chooseTechnique: "Elige tecnica",
            chooseTechniqueBody: "Estructura tu sesion para maximizar el aprendizaje.",
            configure: "Configurar",
            trainingMode: "Modo entrenamiento",
            trainingModeBody: "Registra tus series y descansos.",
        }
        : {
            takeYourTime: "Take your time",
            breatheAndReturn: "Take a deep breath. Come back when you are ready to continue.",
            blockEnding: "Block ending",
            blockEndingBody: "You are reaching the end of the planned time.",
            extend5: "Extend 5 min",
            finish: "Finish",
            exitsTitle: "Repeated exits break the thread",
            exitsBody: "Should we reduce the scope to make it easier to return?",
            reduceScope: "Reduce scope",
            activeRecallBody: "Pause briefly and retrieve what you learned in one sentence.",
            answer: "Answer",
            later: "Later",
            defineGoal: "Define your goal",
            defineGoalBody: "What do you want to achieve in this block?",
            define: "Define",
            resumePrevious: "Resume the last thread",
            suggestedFirstStep: (step: string) => `Suggested first step: ${step}`,
            resumeWhereYouLeft: "Continue from where you left off.",
            resume: "Resume",
            shortCommitment: "Short commitment",
            shortCommitmentBody: "Try 5 uninterrupted minutes.",
            activate: "Activate",
            makeItSmaller: "Make it smaller",
            makeItSmallerBody: "If the block feels large, choose a minimum version.",
            refocusTitle: "Lost the thread?",
            refocusBody: "Return to the goal of the block.",
            refocus: "Refocus",
            returnToBlock: "Return to the block",
            minimumVersion: (value: string) => `Return through this minimum version: ${value}`,
            firstStep: (value: string) => `Return through this first step: ${value}`,
            return: "Return",
            inRhythm: "You found the rhythm",
            inRhythmBody: "Avoid interruptions now.",
            protect: "Protect",
            progressTitle: "Did you move forward?",
            progressBody: "Mark progress quickly.",
            mark: "Mark",
            closingTitle: "Closing the block",
            closingBody: "Take a second. What was the most important thing you moved forward?",
            done: "Done",
            noteProgress: "Note progress",
            playlistTitle: "Suggested playlist",
            playlistBody: "Music that fits this moment.",
            openPlaylist: "Open playlist",
            nextStepTitle: "What is the next step?",
            nextStepBody: "Define the concrete action to continue.",
            chooseTechnique: "Choose technique",
            chooseTechniqueBody: "Structure your session for stronger learning.",
            configure: "Configure",
            trainingMode: "Training mode",
            trainingModeBody: "Track your sets and rests.",
        };
}

function getMemoryKey(cardId: string) {
    if (cardId.startsWith("toast_active_recall_")) return "toast_active_recall";
    return cardId;
}

function isSuppressedByMemory(ctx: FocusContext, cardId: string) {
    const memoryKey = getMemoryKey(cardId);
    const memory = ctx.cardMemory[memoryKey];
    if (!memory) return false;

    if (memory.cooldownUntil && memory.cooldownUntil > ctx.now) {
        return true;
    }

    const policy = cardMemoryPolicies[memoryKey];
    if (!policy?.maxShows) return false;

    return memory.timesShown >= policy.maxShows;
}

function hasRecentMatchingSession(ctx: FocusContext) {
    return !!(
        ctx.lastSession &&
        ctx.lastSession.blockType === ctx.blockType &&
        (ctx.lastSession.age ?? Number.MAX_SAFE_INTEGER) < HOURS_12_MS &&
        (ctx.lastSession.intention || ctx.lastSession.nextStep)
    );
}

function sortByPriority(cards: FocusCard[]) {
    return [...cards].sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function isClosureBridgeEligible(ctx: FocusContext, state: SessionState, minimumProgress: number) {
    return (
        ctx.sessionProgress >= minimumProgress &&
        ctx.elapsedMs >= MINUTES_5_MS &&
        !ctx.closureBridgeShown &&
        state !== SessionState.DISTRACTED
    );
}

export function shouldOfferClosureBridgeOnFinish(ctx: FocusContext, state: SessionState) {
    return isClosureBridgeEligible(ctx, state, 0.75);
}

function buildContextualCards(context: FocusContext, sessionState: SessionState, language: AppLanguage = "en") {
    return rules
        .filter((rule) => rule.when(context, sessionState))
        .map((rule) => ({ ...rule.build(context, language), priority: rule.priority }))
        .filter((card) => !isSuppressedByMemory(context, card.id));
}

function buildToastCards(ctx: FocusContext, language: AppLanguage = "en"): FocusCard[] {
    const copy = getCardsCopy(language);
    const toastCards: FocusCard[] = [];
    const remainingMs = Math.max(0, ctx.plannedDurationMs - ctx.elapsedMs);

    if (ctx.lastPauseReason === "manual_pause") {
        toastCards.push({
            id: "toast_pause",
            type: "reactive",
            title: copy.takeYourTime,
            description: copy.breatheAndReturn,
            isToast: true,
            priority: 100,
        });
    }

    if (ctx.mode === "block" && remainingMs <= 2 * 60 * 1000) {
        toastCards.push({
            id: "toast_near_end",
            type: "reactive",
            title: copy.blockEnding,
            description: copy.blockEndingBody,
            action: {
                label: copy.extend5,
                type: "custom",
                payload: { action: "extend" },
            },
            secondaryAction: {
                label: copy.finish,
                type: "custom",
                payload: { action: "finish" },
            },
            isToast: true,
            priority: 110,
        });
    }

    if (ctx.recentExitCount >= 2 && ctx.sessionProgress < 0.6) {
        toastCards.push({
            id: "toast_exits",
            type: "reactive",
            title: copy.exitsTitle,
            description: copy.exitsBody,
            action: {
                label: copy.reduceScope,
                type: "custom",
                payload: { action: "reduceScopeFlow" },
            },
            isToast: true,
            priority: 95,
        });
    }

    const activeRecallWindow = ctx.sessionProgress >= 0.65
        ? "late"
        : ctx.sessionProgress >= 0.33
            ? "mid"
            : null;

    if (ctx.blockType === "study" && activeRecallWindow) {
        toastCards.push({
            id: `toast_active_recall_${activeRecallWindow}`,
            type: "study",
            title: "Active Recall",
            description: copy.activeRecallBody,
            action: {
                label: copy.answer,
                type: "layer",
                payload: { layerId: "active_recall" },
            },
            secondaryAction: {
                label: copy.later,
                type: "resolve",
                payload: { action: "dismiss" },
            },
            isToast: true,
            priority: 80,
        });
    }

    return sortByPriority(toastCards).filter((toast) => !isSuppressedByMemory(ctx, toast.id));
}

export function resolveCardConflicts(cards: FocusCard[]) {
    const filtered = new Map(cards.map((card) => [card.id, card]));

    for (const card of cards) {
        const conflicts = cardConflicts[card.id] || [];
        for (const conflictId of conflicts) {
            const current = filtered.get(card.id);
            const conflict = filtered.get(conflictId);

            if (!current || !conflict) continue;

            if ((current.priority || 0) >= (conflict.priority || 0)) {
                filtered.delete(conflictId);
            } else {
                filtered.delete(card.id);
            }
        }
    }

    return Array.from(filtered.values());
}

const rules: CardRule[] = [
    {
        id: "card_define_intention",
        priority: 100,
        when: (ctx, state) => !ctx.intention && (state === SessionState.ENTRY || state === SessionState.SLOW_START),
        build: (_, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_define_intention",
            type: "work",
            title: copy.defineGoal,
            description: copy.defineGoalBody,
            action: {
                label: copy.define,
                type: "setIntent",
            },
            priority: 100,
            });
        },
    },
    {
        id: "card_continue_previous",
        priority: 70,
        when: (ctx, state) => hasRecentMatchingSession(ctx) && (
            state === SessionState.ENTRY ||
            (state === SessionState.SLOW_START && !ctx.nextStep)
        ),
        build: (ctx, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_continue_previous",
            type: "universal",
            title: copy.resumePrevious,
            description: ctx.lastSession?.nextStep
                ? copy.suggestedFirstStep(ctx.lastSession.nextStep)
                : copy.resumeWhereYouLeft,
            action: {
                label: copy.resume,
                type: "custom",
                payload: {
                    action: "restorePreviousIntent",
                    intention: ctx.lastSession?.intention,
                    nextStep: ctx.lastSession?.nextStep,
                },
            },
            priority: 70,
            });
        },
    },
    {
        id: "card_micro_commit",
        priority: 85,
        when: (_, state) => state === SessionState.SLOW_START,
        build: (_, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_micro_commit",
            type: "work",
            title: copy.shortCommitment,
            description: copy.shortCommitmentBody,
            action: {
                label: copy.activate,
                type: "layer",
                payload: { layerId: "micro_commit_layer" },
            },
            priority: 85,
            });
        },
    },
    {
        id: "card_reduce_scope",
        priority: 80,
        when: (ctx, state) => state === SessionState.FRICTION && !ctx.minimumViable,
        build: (_, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_reduce_scope",
            type: "work",
            title: copy.makeItSmaller,
            description: copy.makeItSmallerBody,
            action: {
                label: copy.reduceScope,
                type: "custom",
                payload: { action: "reduceScopeFlow" },
            },
            priority: 80,
            });
        },
    },
    {
        id: "card_reset_clarity",
        priority: 90,
        when: (ctx, state) => state === SessionState.FRICTION && ctx.recentExitCount >= 1,
        build: (_, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_reset_clarity",
            type: "work",
            title: copy.refocusTitle,
            description: copy.refocusBody,
            action: {
                label: copy.refocus,
                type: "custom",
                payload: { action: "resetClarityFlow" },
            },
            priority: 90,
            });
        },
    },
    {
        id: "card_return_to_focus",
        priority: 95,
        when: (_, state) => state === SessionState.DISTRACTED,
        build: (ctx, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_return_to_focus",
            type: "reactive",
            title: copy.returnToBlock,
            description: ctx.minimumViable
                ? copy.minimumVersion(ctx.minimumViable)
                : ctx.nextStep
                    ? copy.firstStep(ctx.nextStep)
                    : ctx.intention
                        ? `${copy.exitsTitle}. ${ctx.intention}`
                        : copy.exitsTitle,
            action: {
                label: copy.return,
                type: "custom",
                payload: { action: "refocusPrompt" },
            },
            priority: 95,
            });
        },
    },
    {
        id: "card_lock_in_focus",
        priority: 60,
        when: (_, state) => state === SessionState.FLOW,
        build: (_, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_lock_in_focus",
            type: "universal",
            title: copy.inRhythm,
            description: copy.inRhythmBody,
            action: {
                label: copy.protect,
                type: "layer",
                payload: { layerId: "focus_protection_layer" },
            },
            priority: 60,
            });
        },
    },
    {
        id: "card_progress_check",
        priority: 75,
        when: (ctx, state) => state === SessionState.MID_PROGRESS && !ctx.minimumViable,
        build: (_, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_progress_check",
            type: "universal",
            title: copy.progressTitle,
            description: copy.progressBody,
            action: {
                label: copy.mark,
                type: "custom",
                payload: { action: "progressQuickCheck" },
            },
            priority: 75,
            });
        },
    },
    {
        id: "card_closure_bridge",
        priority: 92,
        when: (ctx, state) => isClosureBridgeEligible(ctx, state, 0.9),
        build: (_, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_closure_bridge",
            type: "universal",
            title: copy.closingTitle,
            description: copy.closingBody,
            action: {
                label: copy.done,
                type: "custom",
                payload: { action: "completeClosureBridge" },
            },
            secondaryAction: {
                label: copy.noteProgress,
                type: "custom",
                payload: { action: "openClosureBridge" },
            },
            priority: 92,
            });
        },
    },
    {
        id: "card_playlist",
        priority: 0,
        when: (_, state) => state === SessionState.NORMAL_FLOW,
        build: (_, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_playlist",
            type: "universal",
            title: copy.playlistTitle,
            description: copy.playlistBody,
            action: {
                label: copy.openPlaylist,
                type: "externalLink",
                payload: { url: "https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS" },
            },
            priority: 0,
            });
        },
    },
    {
        id: "card_next_step",
        priority: 20,
        when: (ctx, state) => (
            state === SessionState.NORMAL_FLOW &&
            Boolean(ctx.intention) &&
            !ctx.nextStep &&
            ctx.sessionProgress >= 0.18
        ),
        build: (_, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_next_step",
            type: "universal",
            title: copy.nextStepTitle,
            description: copy.nextStepBody,
            action: {
                label: copy.define,
                type: "custom",
                payload: { action: "openNextStepEditor" },
            },
            priority: 20,
            });
        },
    },
    {
        id: "card_study_technique",
        priority: 50,
        when: (ctx) => (ctx.blockType === "study" || ctx.mode === "free") && ctx.activeLayerKind !== "studyTechnique",
        build: (_, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_study_technique",
            type: "study",
            title: copy.chooseTechnique,
            description: copy.chooseTechniqueBody,
            action: {
                label: copy.configure,
                type: "layer",
                payload: { showPicker: true },
            },
            priority: 50,
            });
        },
    },
    {
        id: "card_gym_mode",
        priority: 60,
        when: (ctx) => (ctx.blockType === "gym" || ctx.mode === "free") && ctx.activeLayerKind !== "gymMode",
        build: (_, language) => {
            const copy = getCardsCopy(language);
            return ({
            id: "card_gym_mode",
            type: "gym",
            title: copy.trainingMode,
            description: copy.trainingModeBody,
            action: {
                label: copy.activate,
                type: "layer",
                payload: { layerId: "gym_set_tracker" },
            },
            priority: 60,
            });
        },
    },
];

export function detectSessionState(ctx: FocusContext): SessionState {
    const hasDirection = Boolean(ctx.intention || ctx.nextStep || ctx.minimumViable) || ctx.mode === "free";
    const isVeryEarly = ctx.sessionProgress < 0.08;
    const isEarly = ctx.sessionProgress <= 0.18;
    const hasRecentFriction = ctx.recentPauseCount > 0 || ctx.recentExitCount > 0;
    const repeatedRecentFriction = ctx.recentPauseCount >= 2 || ctx.recentExitCount >= 2 || (ctx.recentPauseCount >= 1 && ctx.recentExitCount >= 1);
    const isStableNow = ctx.recentPauseCount === 0 && ctx.recentExitCount === 0 && ctx.recentStabilityMs >= MINUTES_5_MS;
    const silentSlowStart = isEarly && ctx.startDelayMs >= MINUTES_2_MS && ctx.recentInteractionWindowMs >= MINUTES_2_MS;

    if (isVeryEarly && !hasRecentFriction && ctx.startDelayMs < MINUTES_2_MS) {
        return hasDirection ? SessionState.NORMAL_FLOW : SessionState.ENTRY;
    }

    if (ctx.recentExitCount >= 2 && ctx.sessionProgress >= 0.12 && ctx.recentStabilityMs < MINUTES_5_MS) {
        return SessionState.DISTRACTED;
    }

    if (repeatedRecentFriction && ctx.sessionProgress >= 0.12 && ctx.recentStabilityMs < MINUTES_5_MS) {
        return SessionState.FRICTION;
    }

    if (
        isEarly &&
        (
            silentSlowStart ||
            !hasDirection ||
            ctx.recentPauseCount >= 1
        )
    ) {
        return SessionState.SLOW_START;
    }

    if (hasDirection && ctx.sessionProgress >= 0.25 && isStableNow) {
        return SessionState.FLOW;
    }

    if (hasDirection && ctx.sessionProgress >= 0.45 && ctx.sessionProgress <= 0.6 && !isStableNow) {
        return SessionState.MID_PROGRESS;
    }

    return SessionState.NORMAL_FLOW;
}

export function evaluateFocusContext(context: FocusContext, language: AppLanguage = "en"): EngineResult {
    const sessionState = detectSessionState(context);
    const contextualCards = sortByPriority(resolveCardConflicts(buildContextualCards(context, sessionState, language)));
    const visibleCards = contextualCards.slice(0, 4);

    const suggestedLayers: FocusLayer[] = [];
    if (context.blockType === "study") {
        suggestedLayers.push({ id: "pomodoro_25_5", kind: "studyTechnique" });
        suggestedLayers.push({ id: "study_50_10", kind: "studyTechnique" });
        suggestedLayers.push({ id: "active_recall", kind: "studyTechnique" });
    }
    if (context.blockType === "gym") {
        suggestedLayers.push({ id: "gym_set_tracker", kind: "gymMode" });
    }

    return {
        visibleCards,
        toastCards: buildToastCards(context, language),
        suggestedLayers,
        sessionState,
    };
}

export const focusCardCooldowns = {
    card_micro_commit: { accepted: HOURS_12_MS, rejected: MINUTES_15_MS, dismissed: MINUTES_15_MS },
    card_reduce_scope: { accepted: MINUTES_15_MS, rejected: MINUTES_10_MS, dismissed: MINUTES_10_MS },
    card_reset_clarity: { accepted: MINUTES_15_MS, rejected: MINUTES_10_MS, dismissed: MINUTES_10_MS },
    card_return_to_focus: { accepted: MINUTES_15_MS, rejected: MINUTES_10_MS, dismissed: MINUTES_10_MS },
    card_progress_check: { accepted: HOURS_12_MS, rejected: HOURS_12_MS, dismissed: HOURS_12_MS },
    toast_near_end: { accepted: MINUTES_5_MS, rejected: MINUTES_5_MS, dismissed: MINUTES_5_MS },
    toast_active_recall: { accepted: HOURS_12_MS, rejected: MINUTES_15_MS, dismissed: MINUTES_15_MS },
    toast_exits: { accepted: MINUTES_10_MS, rejected: MINUTES_10_MS, dismissed: MINUTES_10_MS },
} as const;
