import type { BehaviorProfile, FocusSessionAnalytics, FocusWindow } from "@/lib/types/behavior";
import type { ActivityExperience } from "@/lib/types/activity";
import type { Block, BlockType } from "@/lib/types/blocks";
import type {
    HabitAdaptiveRecommendation,
    HabitBehaviorSnapshot,
    HabitDayState,
    HabitDesiredHelp,
    HabitHardestStartMoment,
    HabitPrimaryUseCase,
    HabitSuggestedBlockDraft,
    NextRelevantBlock,
    RescuePlan,
    RescuePlanAction,
    RescuePlanBlock,
    WeeklyConsistencyState,
} from "@/lib/types/habit";
import { getBlockEffectiveStatus } from "@/lib/utils/blockState";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const PRIMARY_USE_CASE_CONCRETE_VALUES: HabitPrimaryUseCase[] = ["study", "work", "gym"];
const HARDEST_START_MOMENT_CONCRETE_VALUES: HabitHardestStartMoment[] = [
    "morning",
    "afternoon",
    "night",
    "after_class",
    "before_training",
];
const DESIRED_HELP_CONCRETE_VALUES: HabitDesiredHelp[] = [
    "decide",
    "start_focus",
    "organize_day",
    "resume_when_lost",
];

function average(values: number[]) {
    if (values.length === 0) return 0;
    return values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function dedupeSelections<T extends string>(values: T[]) {
    return [...new Set(values)];
}

function resolveSelectionValue<T extends string>(values: T[], aggregateValue: T) {
    const normalized = dedupeSelections(values);
    if (normalized.length === 0) return null;
    if (normalized.includes(aggregateValue) || normalized.length > 1) return aggregateValue;
    return normalized[0];
}

export function toggleAggregateSelection<T extends string>(args: {
    current: T[];
    value: T;
    aggregateValue: T;
    concreteValues: T[];
}) {
    const { aggregateValue, concreteValues, value } = args;
    const current = dedupeSelections(args.current);

    if (value === aggregateValue) {
        return current.length === 1 && current[0] === aggregateValue
            ? []
            : [aggregateValue];
    }

    const nextWithoutAggregate = current.filter((item) => item !== aggregateValue);
    const next = nextWithoutAggregate.includes(value)
        ? nextWithoutAggregate.filter((item) => item !== value)
        : [...nextWithoutAggregate, value];

    if (next.length === 0) return [];
    if (concreteValues.every((item) => next.includes(item))) return [aggregateValue];

    return dedupeSelections(next);
}

export function resolvePrimaryUseCaseSelection(values: HabitPrimaryUseCase[]) {
    return resolveSelectionValue(values, "mixed") as HabitPrimaryUseCase | null;
}

export function resolveHardestStartMomentSelection(values: HabitHardestStartMoment[]) {
    return resolveSelectionValue(values, "mixed") as HabitHardestStartMoment | null;
}

export function resolveDesiredHelpSelection(values: HabitDesiredHelp[]) {
    return resolveSelectionValue(values, "mixed") as HabitDesiredHelp | null;
}

export function getPrimaryUseCaseConcreteValues() {
    return [...PRIMARY_USE_CASE_CONCRETE_VALUES];
}

export function getHardestStartMomentConcreteValues() {
    return [...HARDEST_START_MOMENT_CONCRETE_VALUES];
}

export function getDesiredHelpConcreteValues() {
    return [...DESIRED_HELP_CONCRETE_VALUES];
}

function blockDurationMin(block: Pick<Block, "startAt" | "endAt">) {
    return Math.max(5, Math.round((block.endAt.getTime() - block.startAt.getTime()) / MINUTE_MS));
}

function resolveFocusWindow(date: Date): FocusWindow {
    const hour = date.getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    if (hour < 22) return "evening";
    return "night";
}

function isKeyBlock(block: Block) {
    if (block.status === "canceled") return false;
    if (block.type === "break") return false;
    if (block.optional) return false;
    return (block.priority ?? 3) >= 3 || block.type === "deep_work" || block.type === "study" || block.type === "gym";
}

function rankBlockForStart(args: {
    block: Block;
    now: Date;
    recommendedWindow: FocusWindow | null;
}) {
    const { block, now, recommendedWindow } = args;
    const startDiffMin = Math.round((block.startAt.getTime() - now.getTime()) / MINUTE_MS);
    const endDiffMin = Math.round((block.endAt.getTime() - now.getTime()) / MINUTE_MS);
    const durationMin = blockDurationMin(block);
    const effectiveStatus = getBlockEffectiveStatus(block, now);
    const priority = block.priority ?? 3;
    const window = resolveFocusWindow(block.startAt);

    let score = 0;

    if (effectiveStatus === "active") score += 220;
    if (effectiveStatus === "planned") score += 80;
    if (startDiffMin >= 0 && startDiffMin <= 20) score += 90;
    if (startDiffMin > 20 && startDiffMin <= 90) score += 50;
    if (startDiffMin < 0 && endDiffMin > 0) score += 75;
    if (startDiffMin < 0 && endDiffMin <= 0) score -= 140;
    if (priority >= 4) score += 35;
    if (priority <= 2) score -= 12;
    if (block.type === "deep_work" || block.type === "study" || block.type === "gym") score += 24;
    if (block.requiresFocusMode) score += 16;
    if (block.optional) score -= 40;
    if (durationMin > 120) score -= 14;
    if (durationMin <= 60) score += 10;
    if (recommendedWindow && window === recommendedWindow) score += 18;

    return score;
}

function inferAdaptiveRecommendation(args: {
    block: Block;
    profile: BehaviorProfile | null;
    recentAnalytics: FocusSessionAnalytics[];
    rescueFrequency: number;
    language: "en" | "es";
}): HabitAdaptiveRecommendation | null {
    const { block, profile, recentAnalytics, rescueFrequency, language } = args;
    const blockTypeAnalytics = recentAnalytics.filter((item) => item.blockType === block.type);
    const averageStartDelayMin = blockTypeAnalytics.length > 0
        ? Math.round(average(blockTypeAnalytics.map((item) => item.startDelayMs / MINUTE_MS)))
        : null;
    const abandonmentRate = blockTypeAnalytics.length > 2
        ? blockTypeAnalytics.filter((item) => item.closureType === "abandoned").length / blockTypeAnalytics.length
        : 0;
    const durationMin = blockDurationMin(block);
    const blockWindow = resolveFocusWindow(block.startAt);
    const bestWindow = profile?.bestFocusWindow?.data.window ?? null;

    if (abandonmentRate >= 0.35 && durationMin >= 45) {
        const suggestedDurationMin = clamp(Math.round(durationMin * 0.7), 20, 60);
        return {
            type: "shorter_block",
            title: language === "es" ? "Version mas corta" : "Shorter version",
            body: language === "es"
                ? `Este tipo de bloque se sostiene mejor si arranca en ${suggestedDurationMin} min.`
                : `This kind of block tends to hold better when it starts as a ${suggestedDurationMin}-minute block.`,
            evidence: language === "es"
                ? "Se abandono seguido cuando quedo demasiado largo."
                : "It has been abandoned more often when it stretches too long.",
            suggestedDurationMin,
            suggestedWindow: null,
        };
    }

    if (bestWindow && bestWindow !== blockWindow && (block.type === "deep_work" || block.type === "study")) {
        return {
            type: bestWindow === "morning" || bestWindow === "afternoon" ? "move_earlier" : "move_later",
            title: language === "es" ? "Mejor ventana detectada" : "Better window detected",
            body: language === "es"
                ? `Tus bloques pesados se sostienen mejor en ${bestWindow === "morning" ? "la mañana" : bestWindow === "afternoon" ? "la tarde" : bestWindow === "evening" ? "la noche temprana" : "la noche"}.`
                : `Your heavier blocks tend to sustain better in the ${bestWindow}.`,
            evidence: language === "es"
                ? "La recomendacion se apoya en tus cierres de foco reales."
                : "This is based on your real focus outcomes.",
            suggestedDurationMin: null,
            suggestedWindow: bestWindow,
        };
    }

    if ((averageStartDelayMin ?? 0) >= 18 || rescueFrequency >= 2) {
        return {
            type: "bridge_block",
            title: language === "es" ? "Puente de arranque" : "Bridge block",
            body: language === "es"
                ? "Cuando cuesta arrancar, conviene empezar por una pieza mas chica y concreta."
                : "When getting started is harder, a smaller concrete bridge block usually lands better.",
            evidence: language === "es"
                ? "Vimos demora de arranque o necesidad de rescate reciente."
                : "We saw recent start delay or rescue usage.",
            suggestedDurationMin: 20,
            suggestedWindow: null,
        };
    }

    return null;
}

function formatWindowLabel(window: FocusWindow, language: "en" | "es") {
    if (language === "es") {
        if (window === "morning") return "la mañana";
        if (window === "afternoon") return "la tarde";
        if (window === "evening") return "la noche temprana";
        return "la noche";
    }

    return window === "evening" ? "early evening" : window;
}

export function buildOnboardingSuggestedBlock(args: {
    primaryUseCase: HabitPrimaryUseCase;
    hardestStartMoment: HabitHardestStartMoment;
    desiredHelp: HabitDesiredHelp;
    now?: Date;
    language?: "en" | "es";
}): HabitSuggestedBlockDraft {
    const now = args.now ?? new Date();
    const language = args.language ?? "es";
    const startAt = new Date(now);
    const titleByUseCase: Record<HabitPrimaryUseCase, string> = language === "es"
        ? {
            study: "Primer bloque de estudio",
            work: "Bloque de trabajo claro",
            gym: "Entrada al entrenamiento",
            mixed: "Bloque de arranque flexible",
        }
        : {
            study: "First study block",
            work: "Clear work block",
            gym: "Training start block",
            mixed: "Flexible start block",
        };
    const typeByUseCase: Record<HabitPrimaryUseCase, BlockType> = {
        study: "study",
        work: "deep_work",
        gym: "gym",
        mixed: "deep_work",
    };
    const durationByHelp: Record<HabitDesiredHelp, number> = {
        decide: 35,
        start_focus: 45,
        organize_day: 30,
        resume_when_lost: 25,
        mixed: 30,
    };

    if (args.hardestStartMoment === "morning") {
        startAt.setHours(Math.max(startAt.getHours(), 8), startAt.getMinutes() >= 30 ? 45 : 30, 0, 0);
    } else if (args.hardestStartMoment === "afternoon" || args.hardestStartMoment === "after_class") {
        startAt.setHours(Math.max(startAt.getHours(), 14), 0, 0, 0);
    } else if (args.hardestStartMoment === "before_training") {
        startAt.setHours(Math.max(startAt.getHours(), 17), 30, 0, 0);
    } else if (args.hardestStartMoment === "mixed") {
        startAt.setTime(now.getTime() + (20 * MINUTE_MS));
    } else {
        startAt.setHours(Math.max(startAt.getHours(), 20), 0, 0, 0);
    }

    if (startAt.getTime() <= now.getTime()) {
        startAt.setTime(now.getTime() + (15 * MINUTE_MS));
    }

    const reason = language === "es"
        ? args.desiredHelp === "start_focus"
            ? "Te lo dejamos corto y claro para arrancar sin pensar de mas."
            : args.desiredHelp === "resume_when_lost"
                ? "Sirve como punto de regreso rapido si el dia se desordena."
                : args.desiredHelp === "organize_day"
                    ? "Ordena el dia con una primera pieza concreta y liviana."
                    : args.desiredHelp === "mixed"
                        ? "Te deja una primera pieza clara para decidir menos y retomar mas facil."
                        : "Te evita decidir demasiado antes de empezar."
        : args.desiredHelp === "start_focus"
            ? "It is short and clear so you can start without overthinking."
            : args.desiredHelp === "resume_when_lost"
                ? "It gives you a fast way back when the day slips."
                : args.desiredHelp === "organize_day"
                    ? "It gives the day structure with one concrete first move."
                    : args.desiredHelp === "mixed"
                        ? "It gives you one clear first move so the day feels easier to pick back up."
                        : "It removes the need to over-decide before starting.";

    return {
        title: titleByUseCase[args.primaryUseCase],
        type: typeByUseCase[args.primaryUseCase],
        durationMin: durationByHelp[args.desiredHelp],
        startAt: startAt.toISOString(),
        reason,
    };
}

export function getNextRelevantBlock(args: {
    blocks: Block[];
    now?: Date;
    profile?: BehaviorProfile | null;
    recentAnalytics?: FocusSessionAnalytics[];
    rescueFrequency?: number;
    language?: "en" | "es";
}): NextRelevantBlock {
    const now = args.now ?? new Date();
    const language = args.language ?? "es";
    const profile = args.profile ?? null;
    const recentAnalytics = args.recentAnalytics ?? [];
    const rescueFrequency = args.rescueFrequency ?? 0;
    const recommendedWindow = profile?.bestFocusWindow?.data.window ?? null;

    const candidates = args.blocks
        .filter((block) => getBlockEffectiveStatus(block, now) !== "completed" && block.status !== "canceled")
        .sort((left, right) => rankBlockForStart({
            block: right,
            now,
            recommendedWindow,
        }) - rankBlockForStart({
            block: left,
            now,
            recommendedWindow,
        }));

    const winner = candidates[0] ?? null;
    if (!winner) {
        return {
            block: null,
            state: "fallback",
            headline: language === "es" ? "Tu proximo paso ya esta listo" : "Your next step is ready",
            context: language === "es"
                ? "No hay un bloque claro en agenda. Protege uno chico y arrancable."
                : "There is no clear next block yet. Protect a small startable one.",
            reason: language === "es" ? "Sin bloque claro" : "No clear block",
            suggestedDurationMin: profile?.optimalSessionLength?.data.medianMinutes ?? 30,
            suggestedStartAt: null,
            adaptiveRecommendation: null,
        };
    }

    const startDiffMin = Math.round((winner.startAt.getTime() - now.getTime()) / MINUTE_MS);
    const effectiveStatus = getBlockEffectiveStatus(winner, now);
    const adaptiveRecommendation = inferAdaptiveRecommendation({
        block: winner,
        profile,
        recentAnalytics,
        rescueFrequency,
        language,
    });
    const suggestedDurationMin = adaptiveRecommendation?.suggestedDurationMin
        ?? profile?.optimalSessionLength?.data.medianMinutes
        ?? blockDurationMin(winner);
    const state = effectiveStatus === "active" || startDiffMin <= 20
        ? "start_now"
        : startDiffMin <= 90
            ? "prepare"
            : "reorder";
    const context = language === "es"
        ? effectiveStatus === "active"
            ? "Seguimos desde aca."
            : startDiffMin <= 10
                ? "Empeza por esto."
                : startDiffMin <= 90
                    ? `Queda ${startDiffMin} min para este bloque.`
                    : "Conviene dejarlo protegido antes de que llegue la hora."
        : effectiveStatus === "active"
            ? "We continue from here."
            : startDiffMin <= 10
                ? "Start with this."
                : startDiffMin <= 90
                    ? `${startDiffMin} min until this block.`
                    : "Protect it before the hour arrives.";

    const reason = language === "es"
        ? recommendedWindow && resolveFocusWindow(winner.startAt) === recommendedWindow
            ? `Encaja con tu mejor ventana: ${formatWindowLabel(recommendedWindow, language)}.`
            : "Es el bloque mas relevante y accionable ahora."
        : recommendedWindow && resolveFocusWindow(winner.startAt) === recommendedWindow
            ? `It fits your strongest window: ${formatWindowLabel(recommendedWindow, language)}.`
            : "It is the most relevant and actionable block right now.";

    return {
        block: winner,
        state,
        headline: language === "es" ? "Tu proximo paso ya esta listo" : "Your next step is ready",
        context,
        reason,
        suggestedDurationMin,
        suggestedStartAt: winner.startAt.toISOString(),
        adaptiveRecommendation,
    };
}

export function buildHabitDayState(blocks: Block[], now = new Date(), language: "en" | "es" = "es"): HabitDayState {
    const todayBlocks = blocks.filter((block) => {
        const sameDate = block.startAt.getFullYear() === now.getFullYear()
            && block.startAt.getMonth() === now.getMonth()
            && block.startAt.getDate() === now.getDate();
        return sameDate && isKeyBlock(block);
    });
    const completedKeyBlocks = todayBlocks.filter((block) => getBlockEffectiveStatus(block, now) === "completed").length;
    const remaining = todayBlocks.filter((block) => getBlockEffectiveStatus(block, now) !== "completed" && block.status !== "canceled");
    const nextWindow = remaining[0] ? resolveFocusWindow(remaining[0].startAt) : null;

    return {
        totalKeyBlocks: todayBlocks.length,
        completedKeyBlocks,
        remainingLabel: remaining.length === 0
            ? (language === "es" ? "No queda ningun tramo importante." : "No important stretch remains.")
            : language === "es"
                ? `${remaining.length} bloque${remaining.length === 1 ? "" : "s"} clave${nextWindow ? ` hacia ${formatWindowLabel(nextWindow, language)}` : ""}.`
                : `${remaining.length} key block${remaining.length === 1 ? "" : "s"} left${nextWindow ? ` toward the ${formatWindowLabel(nextWindow, language)}` : ""}.`,
    };
}

function buildRescueBlock(block: Block): RescuePlanBlock {
    return {
        id: block.id,
        title: block.title,
        type: block.type,
        startAt: block.startAt.toISOString(),
        endAt: block.endAt.toISOString(),
        priority: block.priority ?? 3,
    };
}

function buildRescueAction(args: {
    block: Block;
    action: RescuePlanAction["type"];
    language: "en" | "es";
    now: Date;
    suggestedDurationMin: number | null;
}): RescuePlanAction {
    const { block, action, language, now, suggestedDurationMin } = args;
    const startAt = new Date(Math.max(block.startAt.getTime(), now.getTime() + (15 * MINUTE_MS)));
    if (action === "move") {
        return {
            type: "move",
            blockId: block.id,
            title: language === "es" ? "Mover mas tarde" : "Move later",
            summary: language === "es" ? "Lo protegemos sin tirarlo." : "Keep it protected without dropping it.",
            suggestedStart: startAt.toISOString(),
            suggestedDurationMin,
        };
    }

    if (action === "shorten") {
        return {
            type: "shorten",
            blockId: block.id,
            title: language === "es" ? "Version mas liviana" : "Lighter version",
            summary: language === "es" ? "Recortamos para que siga siendo viable." : "Trim it down so it stays viable.",
            suggestedStart: startAt.toISOString(),
            suggestedDurationMin,
        };
    }

    if (action === "lighten") {
        return {
            type: "lighten",
            blockId: block.id,
            title: language === "es" ? "Salvar solo la prioridad" : "Save just the priority",
            summary: language === "es" ? "Queda una pieza minima, clara y concreta." : "Keep a minimal clear version of it.",
            suggestedStart: startAt.toISOString(),
            suggestedDurationMin,
        };
    }

    return {
        type: "cancel",
        blockId: block.id,
        title: language === "es" ? "Cancelar hoy" : "Cancel for today",
        summary: language === "es" ? "Liberamos espacio para lo importante." : "Free up room for what matters most.",
        suggestedStart: null,
        suggestedDurationMin: null,
    };
}

export function buildRescuePlan(args: {
    blocks: Block[];
    now?: Date;
    profile?: BehaviorProfile | null;
    language?: "en" | "es";
}): RescuePlan | null {
    const now = args.now ?? new Date();
    const language = args.language ?? "es";
    const overdueBlocks = args.blocks
        .filter((block) => isKeyBlock(block))
        .filter((block) => getBlockEffectiveStatus(block, now) === "completed" && block.status !== "completed")
        .sort((left, right) => (right.priority ?? 3) - (left.priority ?? 3));
    const stuckActiveBlocks = args.blocks
        .filter((block) => isKeyBlock(block))
        .filter((block) => getBlockEffectiveStatus(block, now) === "active" && now.getTime() - block.startAt.getTime() > (20 * MINUTE_MS));
    const rescuePool = [...new Map([...stuckActiveBlocks, ...overdueBlocks].map((block) => [block.id, block])).values()];

    if (rescuePool.length === 0) return null;

    const priorityCandidates = rescuePool
        .sort((left, right) => (right.priority ?? 3) - (left.priority ?? 3))
        .slice(0, 2);
    const suggestedDurationMin = clamp(
        args.profile?.optimalSessionLength?.data.medianMinutes ?? 35,
        20,
        50,
    );
    const suggestedActions = priorityCandidates.flatMap((block) => {
        const durationMin = blockDurationMin(block);
        const actions: RescuePlanAction[] = [];
        if (durationMin > suggestedDurationMin) {
            actions.push(buildRescueAction({
                block,
                action: "shorten",
                language,
                now,
                suggestedDurationMin,
            }));
        }
        actions.push(buildRescueAction({
            block,
            action: "move",
            language,
            now,
            suggestedDurationMin: Math.min(durationMin, suggestedDurationMin),
        }));
        if ((block.priority ?? 3) <= 2 || block.optional) {
            actions.push(buildRescueAction({
                block,
                action: "cancel",
                language,
                now,
                suggestedDurationMin: null,
            }));
        } else {
            actions.push(buildRescueAction({
                block,
                action: "lighten",
                language,
                now,
                suggestedDurationMin: Math.min(25, suggestedDurationMin),
            }));
        }
        return actions.slice(0, 2);
    });

    return {
        overdueBlocks: overdueBlocks.map(buildRescueBlock),
        priorityCandidates: priorityCandidates.map(buildRescueBlock),
        suggestedActions,
        suggestedStart: new Date(now.getTime() + (15 * MINUTE_MS)).toISOString(),
        suggestedDurationMin,
        headline: language === "es" ? "Reordenemos sin empezar de cero" : "Let’s re-order without starting over",
        tone: language === "es"
            ? "Todavia hay una forma simple de salvar lo importante."
            : "There is still a simple way to protect what matters.",
    };
}

export function buildHabitBehaviorSnapshot(args: {
    profile: BehaviorProfile | null;
    recentAnalytics: FocusSessionAnalytics[];
    rescueEventsLast14d: number;
}): HabitBehaviorSnapshot {
    const { profile, recentAnalytics, rescueEventsLast14d } = args;
    const weakestTimeWindow = profile?.topFrictionSources
        .filter((item) => item.data.sourceType === "time_window")
        .map((item) => item.data.value as FocusWindow)
        .slice(0, 2) ?? [];
    const blockTypeCounts = recentAnalytics.reduce<Record<BlockType, number>>((acc, item) => {
        if (!item.blockType) return acc;
        acc[item.blockType] = (acc[item.blockType] ?? 0) + 1;
        return acc;
    }, {} as Record<BlockType, number>);
    const preferredBlockTypes = (Object.entries(blockTypeCounts) as Array<[BlockType, number]>)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([type]) => type);

    return {
        bestStartWindows: profile?.bestFocusWindow?.data.window ? [profile.bestFocusWindow.data.window] : [],
        weakestStartWindows: weakestTimeWindow,
        recommendedFocusDurationMin: profile?.optimalSessionLength?.data.medianMinutes ?? null,
        averageStartDelayMin: recentAnalytics.length > 0
            ? Math.round(average(recentAnalytics.map((item) => item.startDelayMs / MINUTE_MS)))
            : null,
        rescueFrequency: rescueEventsLast14d,
        frictionPatterns: profile?.topFrictionSources.slice(0, 3).map((item) => item.data.label) ?? [],
        preferredBlockTypes,
    };
}

export function countMeaningfulDays(args: {
    recentAnalytics: FocusSessionAnalytics[];
    recentActivityExperiences: ActivityExperience[];
    eventDates: string[];
    now?: Date;
}) {
    const meaningfulDates = new Set<string>();

    args.recentAnalytics.forEach((item) => {
        meaningfulDates.add(item.startedAt.slice(0, 10));
    });

    args.recentActivityExperiences
        .filter((item) => item.wasUserConfirmed)
        .forEach((item) => {
            meaningfulDates.add((item.actualStart ?? item.updatedAt).slice(0, 10));
        });

    args.eventDates.forEach((date) => meaningfulDates.add(date));

    return meaningfulDates;
}

export function buildWeeklyConsistencyState(args: {
    meaningfulDates: Set<string>;
    language?: "en" | "es";
}): WeeklyConsistencyState {
    const language = args.language ?? "es";
    const meaningfulDays = args.meaningfulDates.size;
    const targetDays = 3;
    const reachedTarget = meaningfulDays >= targetDays;
    const remaining = Math.max(0, targetDays - meaningfulDays);

    return {
        meaningfulDays,
        targetDays,
        reachedTarget,
        headline: language === "es"
            ? `${meaningfulDays} de 7 dias con direccion real`
            : `${meaningfulDays} of 7 days with real direction`,
        body: reachedTarget
            ? (language === "es" ? "Semana solida. La continuidad sigue viva." : "Solid week. The rhythm is holding.")
            : language === "es"
                ? `Te falta ${remaining} dia${remaining === 1 ? "" : "s"} para sostener el ritmo.`
                : `${remaining} more day${remaining === 1 ? "" : "s"} to keep the rhythm going.`,
    };
}
