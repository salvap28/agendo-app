import { getSessionLengthBucketRange } from "@/lib/engines/personalIntelligence";
import { Block } from "@/lib/types/blocks";
import {
    GuidedPlanningOutput,
    PlanningEngineInput,
    PlanningEvidence,
    PlanningGuideResult,
    PlanningPriority,
    PlanningRecommendation,
    PlanningRecommendationType,
    ReasonCode,
    RecommendationApplyability,
} from "@/lib/types/planning";
import { BehaviorProfile } from "@/lib/types/behavior";
import { ActivityExperience } from "@/lib/types/activity";
import { buildPlanningBlockSnapshot } from "./blockMetadata";
import { computeDailyLoad } from "./dailyLoad";
import { estimatePostActivityApplicability } from "@/lib/engines/activityExperience";
import { AppLanguage } from "@/lib/i18n/messages";

function average(values: number[]) {
    if (values.length === 0) return 0;
    return values.reduce((total, value) => total + value, 0) / values.length;
}

function clampConfidence(value: number) {
    return Math.max(0.1, Math.min(0.98, Math.round(value * 100) / 100));
}

function getPriorityWeight(priority: PlanningPriority) {
    return priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

function demotePriority(priority: PlanningPriority): PlanningPriority {
    if (priority === "high") return "medium";
    if (priority === "medium") return "low";
    return "low";
}

function promotePriority(priority: PlanningPriority): PlanningPriority {
    if (priority === "low") return "medium";
    if (priority === "medium") return "high";
    return "high";
}

function getPlanningWindowLabel(
    window: "morning" | "afternoon" | "evening" | "night",
    language: AppLanguage = "en",
) {
    switch (window) {
        case "morning":
            return language === "es" ? "la manana" : "morning";
        case "afternoon":
            return language === "es" ? "la tarde" : "afternoon";
        case "evening":
            return language === "es" ? "el atardecer" : "evening";
        case "night":
            return language === "es" ? "la noche" : "night";
        default:
            return language === "es" ? "tu mejor ventana" : "best window";
    }
}

function getDayBlocks(blocks: Block[], date: string) {
    return blocks
        .filter((block) => block.startAt.toISOString().slice(0, 10) === date)
        .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
}

function getDayExperiences(experiences: ActivityExperience[], date: string) {
    return experiences.filter((experience) => (
        (experience.actualStart ?? experience.scheduledStart ?? experience.createdAt).slice(0, 10) === date
    ));
}

function getWindowHours(window: NonNullable<BehaviorProfile["bestFocusWindow"]>["data"]["window"]) {
    switch (window) {
        case "morning":
            return { startHour: 8, endHour: 11 };
        case "afternoon":
            return { startHour: 12, endHour: 16 };
        case "evening":
            return { startHour: 17, endHour: 20 };
        case "night":
            return { startHour: 20, endHour: 22 };
        default:
            return { startHour: 9, endHour: 11 };
    }
}

function blockFitsBestWindow(block: Block, window: NonNullable<BehaviorProfile["bestFocusWindow"]>["data"]["window"]) {
    const hour = block.startAt.getHours();
    const { startHour, endHour } = getWindowHours(window);
    return hour >= startHour && hour < endHour;
}

function findOpenSlot(blocks: Block[], date: string, startHour: number, endHour: number, durationMinutes: number, excludeBlockId?: string) {
    const dayStart = new Date(`${date}T00:00:00`);
    const slotStart = new Date(dayStart);
    slotStart.setHours(startHour, 0, 0, 0);
    const slotEnd = new Date(dayStart);
    slotEnd.setHours(endHour, 0, 0, 0);
    const candidates = blocks
        .filter((block) => block.id !== excludeBlockId)
        .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
    const durationMs = durationMinutes * 60000;

    let cursor = slotStart.getTime();
    while (cursor + durationMs <= slotEnd.getTime()) {
        const candidateEnd = cursor + durationMs;
        const overlaps = candidates.some((block) => (
            cursor < block.endAt.getTime()
            && candidateEnd > block.startAt.getTime()
        ));
        if (!overlaps) {
            return {
                suggestedStart: new Date(cursor).toISOString(),
                suggestedEnd: new Date(candidateEnd).toISOString(),
            };
        }
        cursor += 15 * 60000;
    }

    return null;
}

function buildEvidence(args: {
    confidence: number;
    sampleSize: number;
    hypothesisStrength: PlanningEvidence["hypothesisStrength"];
    lastUpdated: string | null;
    appliesTo: string[];
    signals: string[];
    trendDirection?: PlanningEvidence["trendDirection"];
}) {
    return {
        sampleSize: args.sampleSize,
        confidence: clampConfidence(args.confidence),
        hypothesisStrength: args.hypothesisStrength,
        lastUpdated: args.lastUpdated,
        trendDirection: args.trendDirection ?? null,
        appliesTo: args.appliesTo,
        recentlyValidated: args.lastUpdated
            ? ((Date.now() - new Date(args.lastUpdated).getTime()) / (24 * 60 * 60 * 1000)) <= 14
            : false,
        signals: args.signals,
    } satisfies PlanningEvidence;
}

function renderCopy(language: AppLanguage, reasonCode: ReasonCode, payload: Record<string, unknown>) {
    const isSpanish = language === "es";
    switch (reasonCode) {
        case "BEST_WINDOW_MISMATCH":
            return {
                title: isSpanish ? "Este bloque funcionaria mejor en otra franja" : "This block would land better elsewhere",
                message: isSpanish
                    ? `Este bloque intenso cae fuera de tu mejor ventana. ${String(payload.bestWindowLabel)} probablemente lo sostenga mejor.`
                    : `This intense block sits outside your strongest window. ${String(payload.bestWindowLabel)} would likely support it better.`,
                reason: isSpanish
                    ? `Las sesiones demandantes vienen sosteniendose mejor en ${String(payload.bestWindowLabel)} que en ${String(payload.currentWindowLabel)}.`
                    : `Demanding sessions have been holding better in the ${String(payload.bestWindowLabel)} than in the ${String(payload.currentWindowLabel)}.`,
            };
        case "SESSION_TOO_LONG":
            if (payload.unsplittable) {
                return {
                    title: isSpanish ? "Este bloque largo necesita recuperacion inmediata" : "This long block needs immediate recovery",
                    message: isSpanish
                        ? `Como esta tarea de ${String(payload.currentMinutes)} min no puede dividirse, tu cerebro necesitara un reset restaurativo de ${String(payload.breakMinutes)} min justo despues.`
                        : `Since this ${String(payload.currentMinutes)}m task can't be split, your brain will need a ${String(payload.breakMinutes)}m restorative reset right after to clear working memory.`,
                    reason: isSpanish
                        ? "Los ritmos ultradianos suelen pedir un reset de 20-30 min despues de una exigencia intensa que no se puede partir."
                        : "Ultradian rhythms dictate a 20-30m nervous system reset after intense unsplittable exertion to prevent deep cognitive fatigue.",
                };
            }
            return {
                title: isSpanish ? "Esta duracion se ve demasiado ambiciosa" : "This duration looks too ambitious",
                message: isSpanish
                    ? `${String(payload.recommendedRange)} se ve mas sostenible para ti hoy que ${String(payload.currentMinutes)} minutos seguidos.`
                    : `${String(payload.recommendedRange)} looks more sustainable for you right now than ${String(payload.currentMinutes)} straight minutes.`,
                reason: isSpanish
                    ? "Cuando los bloques se estiran muy por encima de tu rango reciente mas sano, suben la friccion y las caidas."
                    : "When blocks stretch too far past your recent sweet spot, friction and drop-off tend to rise.",
            };
        case "DAY_OVERLOAD":
            return {
                title: isSpanish ? "El dia se ve sobrecargado" : "The day looks overloaded",
                message: isSpanish
                    ? `Este dia esta leyendo como carga ${String(payload.loadLevel)}. Aligerar una pieza lo volveria mas realista.`
                    : `This day is reading as ${String(payload.loadLevel)} load. Lightening one piece would make it more realistic.`,
                reason: isSpanish
                    ? "Hay demasiada densidad, intensidad o trabajo largo apilado para tu capacidad reciente."
                    : "There is too much density, intensity or long-form work stacked together for your recent capacity.",
            };
        case "HIGH_FRICTION_CATEGORY":
            return {
                title: isSpanish ? "Aqui conviene empezar mas pequeno" : "Start smaller here",
                message: isSpanish
                    ? "Este bloque cae en un contexto que historicamente trajo mas friccion. Un punto de entrada mas chico deberia ayudar."
                    : "This block sits in a context that has historically carried more friction. A smaller entry point should help.",
                reason: isSpanish
                    ? `Las sesiones de ${String(payload.contextLabel)} estuvieron siendo mas dificiles de sostener que tu base reciente.`
                    : `${String(payload.contextLabel)} sessions have been harder to sustain than your recent baseline.`,
            };
        case "INTENSE_SEQUENCE":
            return {
                title: isSpanish ? "Esta secuencia necesita recuperacion" : "This sequence needs recovery",
                message: isSpanish
                    ? "Hay demasiados bloques exigentes pegados. Un descanso real haria el dia mas sostenible."
                    : "Too many demanding blocks are packed together. A real break would make the day easier to hold.",
                reason: isSpanish
                    ? "Cuando el trabajo intenso se apila sin recuperacion, la estabilidad suele caer."
                    : "When intense work stacks without recovery, session stability usually falls.",
            };
        case "PREMIUM_WINDOW_PROTECTION":
            return {
                title: isSpanish ? "Protege tu ventana premium" : "Protect your premium window",
                message: isSpanish
                    ? "Una tarea ligera esta ocupando una franja donde tu foco suele ser mas fuerte. Guardala para trabajo de mas valor."
                    : "A lighter task is occupying a window where your focus tends to be strongest. Save it for higher-value work.",
                reason: isSpanish
                    ? "Tu mejor ventana esta siendo usada por un bloque liviano mientras el trabajo pesado sigue fuera de ella."
                    : "Your best window is being used by a low-demand block while heavier work is still outside it.",
            };
        case "OVEROPTIMISTIC_PLAN":
            return {
                title: isSpanish ? "El plan viene demasiado optimista" : "The plan is running too optimistic",
                message: isSpanish
                    ? "Estas planeando bastante mas de lo que vienes sosteniendo en dias parecidos. Bajarlo ayudaria."
                    : "You are planning meaningfully more than you have been sustaining on similar days. Dialing it down would help.",
                reason: isSpanish
                    ? "La carga planificada esta claramente por encima de tu capacidad ejecutada reciente en contextos comparables."
                    : "Planned load is clearly above your recent executed capacity in comparable contexts.",
            };
        default:
            return {
                title: isSpanish ? "Hay margen para un plan mas limpio" : "There is room for a cleaner plan",
                message: isSpanish
                    ? "Un ajuste pequeno podria hacer esta agenda mas llevadera."
                    : "A small adjustment could make this schedule easier to carry.",
                reason: isSpanish
                    ? "Esta sugerencia se apoya en tu perfil reciente y en el layout actual del calendario."
                    : "This suggestion is grounded in your recent profile and the current calendar layout.",
            };
    }
}

function buildRecommendation(language: AppLanguage, args: {
    id: string;
    type: PlanningRecommendationType;
    scope: PlanningRecommendation["scope"];
    targetBlockId?: string | null;
    targetDate?: string | null;
    priority: PlanningPriority;
    confidence: number;
    reasonCode: ReasonCode;
    reasonPayload: Record<string, unknown>;
    evidence: PlanningEvidence;
    applyability: RecommendationApplyability;
    suggestedAction: PlanningRecommendation["suggestedAction"];
}) {
    const copy = renderCopy(language, args.reasonCode, args.reasonPayload);

    return {
        id: args.id,
        type: args.type,
        scope: args.scope,
        targetBlockId: args.targetBlockId ?? null,
        targetDate: args.targetDate ?? null,
        priority: args.priority,
        confidence: clampConfidence(args.confidence),
        title: copy.title,
        message: copy.message,
        reason: copy.reason,
        reasonCode: args.reasonCode,
        reasonPayload: args.reasonPayload,
        evidence: args.evidence,
        applyability: args.applyability,
        suggestedAction: args.suggestedAction,
        dismissible: true,
        reversible: false,
        createdAt: new Date().toISOString(),
    } satisfies PlanningRecommendation;
}

function getStableRecommendationId(
    userId: string,
    type: string,
    scope: string,
    targetKey: string,
    variant = "default",
) {
    return `${userId}:${scope}:${type}:${targetKey}:${variant}`;
}

function applyFeedbackSummary(
    recommendation: PlanningRecommendation,
    feedbackSummary: PlanningEngineInput["feedbackSummary"],
) {
    const stats = feedbackSummary?.[recommendation.type];
    if (!stats) return recommendation;

    const negativeCount = stats.dismissedCount + stats.ignoredCount;
    const positiveCount = stats.appliedCount + stats.acceptedCount;
    const isWeakOrRecent = recommendation.evidence.hypothesisStrength !== "stable";

    if (
        negativeCount >= 3
        && positiveCount === 0
        && isWeakOrRecent
        && recommendation.confidence < 0.82
        && recommendation.priority !== "high"
    ) {
        return null;
    }

    let confidence = recommendation.confidence;
    let priority = recommendation.priority;

    if (stats.dismissedCount >= 2 && stats.appliedCount === 0) {
        confidence -= 0.05;
        priority = demotePriority(priority);
    }

    if (stats.ignoredCount >= 2 && stats.appliedCount === 0) {
        confidence -= 0.04;
        if (recommendation.scope === "day") {
            priority = demotePriority(priority);
        }
    }

    if (stats.acceptedCount >= 2 && stats.dismissedCount === 0) {
        confidence += 0.02;
    }

    if (stats.appliedCount >= 2) {
        confidence += 0.05;
        priority = promotePriority(priority);
    }

    return {
        ...recommendation,
        confidence: clampConfidence(confidence),
        priority,
    };
}

function generateBlockRecommendations(input: PlanningEngineInput, dayBlocks: Block[], language: AppLanguage = "en") {
    const recommendations: PlanningRecommendation[] = [];
    const profile = input.profile;
    const dayExperiences = getDayExperiences(input.activityExperiences, input.targetDate);
    const targetBlock = input.targetBlockId
        ? dayBlocks.find((block) => block.id === input.targetBlockId)
        : null;
    const blocksToEvaluate = targetBlock ? [targetBlock] : dayBlocks;

    for (const block of blocksToEvaluate) {
        const snapshot = buildPlanningBlockSnapshot(block);
        const activityApplicability = estimatePostActivityApplicability({
            targetDate: input.targetDate,
            blockStart: block.startAt,
            cognitivelyHeavy: snapshot.cognitivelyHeavy,
            experiences: dayExperiences,
        });
        const bestWindow = profile.bestFocusWindow;
        const frictionSource = profile.topFrictionSources.find((pattern) => (
            pattern.data.sourceType === "block_type" && pattern.data.value === block.type
        ));

        if (
            bestWindow
            && bestWindow.confidence >= 0.74
            && snapshot.cognitivelyHeavy
            && snapshot.flexibility !== "fixed"
            && !blockFitsBestWindow(block, bestWindow.data.window)
        ) {
            const { startHour, endHour } = getWindowHours(bestWindow.data.window);
            const openSlot = findOpenSlot(dayBlocks, input.targetDate, startHour, endHour, snapshot.durationMinutes, block.id);

            if (openSlot) {
                const confidence = Math.min(0.92, bestWindow.confidence) * activityApplicability.modifier;
                if (confidence < 0.62) {
                    continue;
                }
                recommendations.push(buildRecommendation(language, {
                    id: getStableRecommendationId(input.userId, "move_block", "block", block.id, bestWindow.data.window),
                    type: "move_block",
                    scope: "block",
                    targetBlockId: block.id,
                    targetDate: input.targetDate,
                    priority: "high",
                    confidence,
                    reasonCode: "BEST_WINDOW_MISMATCH",
                    reasonPayload: {
                        currentWindowLabel: getPlanningWindowLabel(
                            block.startAt.getHours() < 12 ? "morning" : block.startAt.getHours() < 17 ? "afternoon" : block.startAt.getHours() < 21 ? "evening" : "night"
                        , language),
                        bestWindowLabel: getPlanningWindowLabel(bestWindow.data.window, language),
                    },
                    evidence: buildEvidence({
                        confidence: bestWindow.confidence,
                        sampleSize: bestWindow.sampleSize,
                        hypothesisStrength: "stable",
                        lastUpdated: bestWindow.updatedAt,
                        appliesTo: [block.id],
                        signals: ["best_focus_window", "flexible_block", "cognitively_heavy", ...activityApplicability.signals],
                    }),
                    applyability: {
                        mode: "auto",
                        helperText: language === "es"
                            ? "Agendo puede moverlo por ti sin romper el resto del plan."
                            : "Agendo can move it for you safely.",
                    },
                    suggestedAction: {
                        kind: "move",
                        label: language === "es" ? "Mover a mejor ventana" : "Move to best window",
                        payload: openSlot,
                    },
                }));
            }
        }

        if (profile.optimalSessionLength) {
            const optimalRange = getSessionLengthBucketRange(profile.optimalSessionLength.data.bucket);
            const recommendedMax = Math.max(optimalRange.maxMinutes, profile.optimalSessionLength.data.medianMinutes);

            if (snapshot.durationMinutes > recommendedMax + 20) {
                const splitTargetMinutes = Math.max(25, Math.min(recommendedMax, Math.round(snapshot.durationMinutes / 2)));
                const confidence = Math.min(0.9, profile.optimalSessionLength.confidence) * activityApplicability.modifier;
                if (confidence < 0.58) {
                    continue;
                }
                if (snapshot.splittable) {
                    recommendations.push(buildRecommendation(language, {
                        id: getStableRecommendationId(input.userId, "shorten_block", "block", block.id),
                        type: "split_block",
                        scope: "block",
                        targetBlockId: block.id,
                        targetDate: input.targetDate,
                        priority: "high",
                        confidence,
                        reasonCode: "SESSION_TOO_LONG",
                        reasonPayload: {
                            recommendedRange: `${optimalRange.minMinutes}-${optimalRange.maxMinutes} min`,
                            currentMinutes: snapshot.durationMinutes,
                        },
                        evidence: buildEvidence({
                            confidence: profile.optimalSessionLength.confidence,
                            sampleSize: profile.optimalSessionLength.sampleSize,
                            hypothesisStrength: "stable",
                            lastUpdated: profile.optimalSessionLength.updatedAt,
                            appliesTo: [block.id],
                            signals: ["optimal_session_length", "planned_duration", ...activityApplicability.signals],
                        }),
                        applyability: {
                            mode: "auto",
                            helperText: language === "es"
                                ? "Agendo puede dividirlo sin romper el resto del plan."
                                : "Agendo can split it without breaking the rest of the plan.",
                        },
                        suggestedAction: {
                            kind: "split",
                            label: language === "es" ? "Dividir en dos bloques" : "Split into two blocks",
                            payload: {
                                firstDurationMinutes: splitTargetMinutes,
                                secondDurationMinutes: snapshot.durationMinutes - splitTargetMinutes,
                            },
                        },
                    }));
                } else {
                    const breakMinutes = snapshot.durationMinutes >= 180 ? 30 : 20;
                    recommendations.push(buildRecommendation(language, {
                        id: getStableRecommendationId(input.userId, "insert_break", "block", block.id),
                        type: "insert_break",
                        scope: "block",
                        targetBlockId: block.id,
                        targetDate: input.targetDate,
                        priority: "medium",
                        confidence,
                        reasonCode: "SESSION_TOO_LONG",
                        reasonPayload: {
                            recommendedRange: `${optimalRange.minMinutes}-${optimalRange.maxMinutes} min`,
                            currentMinutes: snapshot.durationMinutes,
                            unsplittable: true,
                            breakMinutes,
                        },
                        evidence: buildEvidence({
                            confidence: profile.optimalSessionLength.confidence,
                            sampleSize: profile.optimalSessionLength.sampleSize,
                            hypothesisStrength: "stable",
                            lastUpdated: profile.optimalSessionLength.updatedAt,
                            appliesTo: [block.id],
                            signals: ["optimal_session_length", "planned_duration", "unsplittable_block", ...activityApplicability.signals],
                        }),
                        applyability: {
                            mode: "auto",
                            helperText: language === "es"
                                ? `Agendo puede agendar un descanso restaurativo de ${breakMinutes} min justo despues de este bloque.`
                                : `Agendo can schedule a ${breakMinutes}m restorative break right after this block.`,
                        },
                        suggestedAction: {
                            kind: "insert_break",
                            label: language === "es"
                                ? `Programar descanso (${breakMinutes}m)`
                                : `Schedule break (${breakMinutes}m)`,
                            payload: {
                                suggestedStart: block.endAt.toISOString(),
                                durationMinutes: breakMinutes,
                            },
                        },
                    }));
                }
            }
        }

        if (frictionSource && frictionSource.confidence >= 0.72) {
            const targetMinutes = Math.min(35, Math.max(20, Math.round(snapshot.durationMinutes * 0.45)));
            const confidence = Math.min(0.88, frictionSource.confidence) * Math.max(0.8, activityApplicability.modifier);
            recommendations.push(buildRecommendation(language, {
                id: getStableRecommendationId(input.userId, "start_small", "block", block.id),
                type: "start_small",
                scope: "block",
                targetBlockId: block.id,
                targetDate: input.targetDate,
                priority: "medium",
                confidence,
                reasonCode: "HIGH_FRICTION_CATEGORY",
                reasonPayload: {
                    contextLabel: frictionSource.data.label,
                },
                evidence: buildEvidence({
                    confidence: frictionSource.confidence,
                    sampleSize: frictionSource.sampleSize,
                    hypothesisStrength: "stable",
                    lastUpdated: frictionSource.updatedAt,
                    appliesTo: [block.id],
                    signals: ["friction_source", "category_match", ...activityApplicability.signals],
                }),
                applyability: {
                    mode: "auto",
                    helperText: snapshot.splittable
                        ? (language === "es" ? "Agendo puede darte una primera pasada mas ligera." : "Agendo can give you a lighter first pass.")
                        : (language === "es" ? "Agendo puede reducir la primera pasada automaticamente." : "Agendo can reduce the first pass automatically."),
                },
                suggestedAction: snapshot.splittable
                    ? {
                        kind: "split",
                        label: language === "es" ? "Empezar con una version mas chica" : "Start with a smaller version",
                        payload: {
                            firstDurationMinutes: targetMinutes,
                            secondDurationMinutes: Math.max(15, snapshot.durationMinutes - targetMinutes),
                        },
                    }
                    : {
                        kind: "shorten",
                        label: language === "es" ? "Reducir primera pasada" : "Reduce first pass",
                        payload: {
                            recommendedDurationMinutes: targetMinutes,
                        },
                    },
            }));
        }
    }

    return recommendations;
}

function generateDayRecommendations(input: PlanningEngineInput, dayBlocks: Block[], language: AppLanguage = "en") {
    const recommendations: PlanningRecommendation[] = [];
    const dayExperiences = getDayExperiences(input.activityExperiences, input.targetDate);
    const dailyLoad = computeDailyLoad(input.blocks, input.targetDate, input.recentAnalytics, input.activityExperiences);
    const daySnapshots = dayBlocks.map(buildPlanningBlockSnapshot);
    const intenseSnapshots = daySnapshots.filter((snapshot) => snapshot.cognitivelyHeavy || snapshot.intensity === "high");

    if (dailyLoad.level === "high" || dailyLoad.level === "overload") {
        const candidate = [...daySnapshots]
            .filter((snapshot) => snapshot.flexibility !== "fixed")
            .sort((left, right) => {
                const optionalBias = (right.optional ? 1 : 0) - (left.optional ? 1 : 0);
                if (optionalBias !== 0) return optionalBias;
                return right.durationMinutes - left.durationMinutes;
            })[0];

        if (candidate) {
            recommendations.push(buildRecommendation(language, {
                id: getStableRecommendationId(input.userId, "reduce_daily_load", "day", input.targetDate),
                type: "reduce_daily_load",
                scope: "day",
                targetBlockId: candidate.block.id,
                targetDate: input.targetDate,
                priority: "high",
                confidence: dailyLoad.level === "overload" ? 0.9 : 0.78,
                reasonCode: "DAY_OVERLOAD",
                reasonPayload: {
                    loadLevel: dailyLoad.level,
                },
                evidence: buildEvidence({
                    confidence: dailyLoad.level === "overload" ? 0.9 : 0.78,
                    sampleSize: Math.max(4, input.recentAnalytics.slice(0, 14).length),
                    hypothesisStrength: dailyLoad.level === "overload" ? "stable" : "recent",
                    lastUpdated: input.profile.lastUpdatedAt,
                    appliesTo: [input.targetDate, candidate.block.id],
                    signals: ["daily_load", "calendar_density", "recent_execution"],
                    trendDirection: input.profile.consistencyTrend?.data.direction ?? null,
                }),
                applyability: {
                    mode: "auto",
                    helperText: candidate.optional
                        ? (language === "es" ? "Agendo puede marcarlo como opcional sin tocar el resto del dia." : "Agendo can mark it optional without disturbing the rest of the day.")
                        : (language === "es" ? "Agendo puede aligerar el bloque mas flexible." : "Agendo can lighten the most flexible block."),
                },
                suggestedAction: candidate.optional
                    ? {
                        kind: "mark_optional",
                        label: language === "es" ? "Dejarlo opcional" : "Keep it optional",
                        payload: { optional: true },
                    }
                    : {
                        kind: "shorten",
                        label: language === "es" ? "Reducir carga del dia" : "Reduce day load",
                        payload: {
                            recommendedDurationMinutes: Math.max(30, candidate.durationMinutes - 25),
                        },
                    },
            }));
        }
    }

    if (dailyLoad.intenseSequences >= 1) {
        const anchor = intenseSnapshots[0];
        const breakStart = anchor ? new Date(anchor.block.endAt.getTime() + 15 * 60000).toISOString() : `${input.targetDate}T12:30:00.000Z`;
        recommendations.push(buildRecommendation(language, {
            id: getStableRecommendationId(input.userId, "insert_break", "day", input.targetDate),
            type: "insert_break",
            scope: "day",
            targetBlockId: anchor?.block.id ?? null,
            targetDate: input.targetDate,
            priority: "medium",
            confidence: 0.76,
            reasonCode: "INTENSE_SEQUENCE",
            reasonPayload: {},
            evidence: buildEvidence({
                confidence: 0.76,
                sampleSize: Math.max(4, input.recentAnalytics.slice(0, 10).length),
                hypothesisStrength: "recent",
                lastUpdated: input.profile.lastUpdatedAt,
                appliesTo: [input.targetDate],
                signals: ["intense_sequence", "break_gap"],
            }),
            applyability: {
                mode: "auto",
                helperText: language === "es" ? "Agendo puede reservar ese descanso en tu calendario." : "Agendo can reserve that break in your calendar.",
            },
            suggestedAction: {
                kind: "insert_break",
                label: language === "es" ? "Insertar descanso" : "Insert break",
                payload: {
                    suggestedStart: breakStart,
                    durationMinutes: 15,
                },
            },
        }));
    }

    if ((dailyLoad.residualEnergyEstimate <= 40 || dailyLoad.collaborativeLoad >= 90 || dailyLoad.passiveAttendanceLoad >= 80) && dayBlocks.length > 0) {
        const flexibleHeavy = daySnapshots.find((snapshot) => snapshot.cognitivelyHeavy && snapshot.flexibility !== "fixed");
        if (flexibleHeavy) {
            recommendations.push(buildRecommendation(language, {
                id: getStableRecommendationId(input.userId, "start_small", "day", input.targetDate, "post_activity_drain"),
                type: "start_small",
                scope: "day",
                targetBlockId: flexibleHeavy.block.id,
                targetDate: input.targetDate,
                priority: "high",
                confidence: 0.76,
                reasonCode: "HIGH_FRICTION_CATEGORY",
                reasonPayload: {
                    contextLabel: dailyLoad.collaborativeLoad >= dailyLoad.passiveAttendanceLoad
                        ? (language === "es" ? "carga reciente de colaboracion" : "recent collaboration load")
                        : (language === "es" ? "carga pasiva reciente" : "recent passive load"),
                },
                evidence: buildEvidence({
                    confidence: 0.76,
                    sampleSize: Math.max(3, dayExperiences.length),
                    hypothesisStrength: "recent",
                    lastUpdated: input.profile.activitySignals.lastActivityAt,
                    appliesTo: [input.targetDate, flexibleHeavy.block.id],
                    signals: ["real_day_load", "residual_energy_estimate", "post_activity_applicability"],
                }),
                applyability: {
                    mode: flexibleHeavy.splittable ? "auto" : "manual",
                    helperText: flexibleHeavy.splittable
                        ? (language === "es" ? "Agendo puede bajar el costo de entrada automaticamente." : "Agendo can lower the entry cost automatically.")
                        : (language === "es" ? "Conviene ajustarlo manualmente." : "This is better adjusted manually."),
                },
                suggestedAction: flexibleHeavy.splittable
                    ? {
                        kind: "split",
                        label: language === "es" ? "Reducir la primera pasada" : "Reduce the first pass",
                        payload: {
                            firstDurationMinutes: Math.min(30, Math.max(20, Math.round(flexibleHeavy.durationMinutes * 0.4))),
                            secondDurationMinutes: Math.max(15, flexibleHeavy.durationMinutes - Math.min(30, Math.max(20, Math.round(flexibleHeavy.durationMinutes * 0.4)))),
                        },
                    }
                    : {
                        kind: "review_plan",
                        label: language === "es" ? "Revisar hoy manualmente" : "Review today manually",
                        payload: {
                            reason: "post_activity_drain",
                        },
                    },
            }));
        }
    }

    const bestWindow = input.profile.bestFocusWindow;
    if (bestWindow && bestWindow.confidence >= 0.76) {
        const trivialInBestWindow = daySnapshots.find((snapshot) => (
            !snapshot.cognitivelyHeavy
            && snapshot.priority <= 2
            && blockFitsBestWindow(snapshot.block, bestWindow.data.window)
        ));
        const heavyOutsideWindow = daySnapshots.find((snapshot) => (
            snapshot.cognitivelyHeavy
            && !blockFitsBestWindow(snapshot.block, bestWindow.data.window)
            && snapshot.flexibility !== "fixed"
        ));

        if (trivialInBestWindow && heavyOutsideWindow) {
            recommendations.push(buildRecommendation(language, {
                id: getStableRecommendationId(input.userId, "protect_focus_window", "day", input.targetDate),
                type: "protect_focus_window",
                scope: "day",
                targetBlockId: trivialInBestWindow.block.id,
                targetDate: input.targetDate,
                priority: "medium",
                confidence: bestWindow.confidence,
                reasonCode: "PREMIUM_WINDOW_PROTECTION",
                reasonPayload: {
                    bestWindowLabel: getPlanningWindowLabel(bestWindow.data.window, language),
                },
                evidence: buildEvidence({
                    confidence: bestWindow.confidence,
                    sampleSize: bestWindow.sampleSize,
                    hypothesisStrength: "stable",
                    lastUpdated: bestWindow.updatedAt,
                    appliesTo: [trivialInBestWindow.block.id, heavyOutsideWindow.block.id],
                    signals: ["best_focus_window", "priority_gap"],
                }),
                applyability: {
                    mode: "manual",
                    helperText: language === "es"
                        ? "Revisalo manualmente para proteger esa ventana sin mover algo a ciegas."
                        : "Review it manually so you can protect that window without moving something blindly.",
                },
                suggestedAction: {
                    kind: "review_window",
                    label: language === "es" ? "Revisar esta ventana" : "Review this window",
                    payload: {
                        moveOutBlockId: trivialInBestWindow.block.id,
                        protectForBlockId: heavyOutsideWindow.block.id,
                    },
                },
            }));
        }
    }

    const recentPlannedVsActive = average(getDayBlocks(input.blocks, input.targetDate).map((block) => (
        (block.endAt.getTime() - block.startAt.getTime()) / 60000
    ))) / Math.max(1, average(input.recentAnalytics.slice(0, 8).map((item) => item.activeDurationMs / 60000)));
    if (recentPlannedVsActive >= 1.5 && dayBlocks.length >= 3) {
        recommendations.push(buildRecommendation(language, {
            id: getStableRecommendationId(input.userId, "downgrade_goal", "day", input.targetDate),
            type: "downgrade_goal",
            scope: "day",
            targetDate: input.targetDate,
            priority: "medium",
            confidence: 0.74,
            reasonCode: "OVEROPTIMISTIC_PLAN",
            reasonPayload: {},
            evidence: buildEvidence({
                confidence: 0.74,
                sampleSize: Math.max(4, input.recentAnalytics.slice(0, 8).length),
                hypothesisStrength: "recent",
                lastUpdated: input.profile.lastUpdatedAt,
                appliesTo: [input.targetDate],
                signals: ["planned_vs_executed_gap", "recent_capacity"],
                trendDirection: input.profile.consistencyTrend?.data.direction ?? null,
            }),
            applyability: {
                mode: "manual",
                helperText: language === "es"
                    ? "Ajustalo manualmente para que nada importante se recorte sin contexto."
                    : "Adjust this manually so nothing important gets trimmed opaquely.",
            },
            suggestedAction: {
                kind: "downgrade_goal",
                label: language === "es" ? "Bajar la meta del dia" : "Lower the day goal",
                payload: {
                    reduceByMinutes: 30,
                },
            },
        }));
    }

    return recommendations;
}

function buildGuidedPlan(
    input: PlanningEngineInput,
    dayBlocks: Block[],
    recommendations: PlanningRecommendation[],
    dailyLoad: PlanningGuideResult["dailyLoad"],
    language: AppLanguage = "en",
): GuidedPlanningOutput | null {
    if (!input.preferences) return null;

    const snapshots = dayBlocks.map(buildPlanningBlockSnapshot);
    if (snapshots.length === 0) {
        return {
            headline: language === "es" ? "Todavia no hay nada agendado" : "Nothing is scheduled yet",
            summary: language === "es"
                ? "Planificar con Agendo necesita al menos un bloque para ayudarte a ordenar el dia."
                : "Plan with Agendo needs at least one block before it can help structure the day.",
            strategy: language === "es"
                ? "Empieza agregando uno o dos bloques importantes y vuelve a pedir la guia."
                : "Start by adding one or two meaningful blocks, then ask again.",
            priorityBlockIds: [],
            steps: [],
            adjustmentRecommendationIds: [],
        };
    }

    const bestWindow = input.profile.bestFocusWindow?.data.window ?? null;
    const rankedSnapshots = [...snapshots].sort((left, right) => {
        const leftBestWindowBoost = bestWindow && blockFitsBestWindow(left.block, bestWindow) ? 18 : 0;
        const rightBestWindowBoost = bestWindow && blockFitsBestWindow(right.block, bestWindow) ? 18 : 0;
        const leftEnergyPenalty = input.preferences?.subjectiveEnergy === "low" && left.durationMinutes >= 90 ? 10 : 0;
        const rightEnergyPenalty = input.preferences?.subjectiveEnergy === "low" && right.durationMinutes >= 90 ? 10 : 0;
        const leftScore = (left.priority * 12) + (left.cognitivelyHeavy ? 16 : 0) + leftBestWindowBoost - leftEnergyPenalty;
        const rightScore = (right.priority * 12) + (right.cognitivelyHeavy ? 16 : 0) + rightBestWindowBoost - rightEnergyPenalty;
        return rightScore - leftScore;
    });

    const steps: GuidedPlanningOutput["steps"] = rankedSnapshots.slice(0, 4).map((snapshot, index) => {
        const blockRecommendation = recommendations.find((recommendation) => recommendation.targetBlockId === snapshot.block.id);
        const suggestedStart = typeof blockRecommendation?.suggestedAction.payload.suggestedStart === "string"
            ? blockRecommendation.suggestedAction.payload.suggestedStart
            : snapshot.block.startAt.toISOString();
        const suggestedEnd = typeof blockRecommendation?.suggestedAction.payload.suggestedEnd === "string"
            ? blockRecommendation.suggestedAction.payload.suggestedEnd
            : snapshot.block.endAt.toISOString();
        const defaultEmphasis: "protect" | "pace" = snapshot.cognitivelyHeavy ? "protect" : "pace";

        if (blockRecommendation?.type === "move_block") {
            return {
                order: index + 1,
                blockId: snapshot.block.id,
                title: snapshot.block.title,
                emphasis: "protect" as const,
                suggestedStart,
                suggestedEnd,
                recommendedDurationMinutes: snapshot.durationMinutes,
                reason: language === "es"
                    ? "Muevelo a tu ventana premium para que arranque con mas soporte."
                    : "Move it into your premium window so it starts with more support.",
            };
        }

        if (blockRecommendation?.type === "split_block" || blockRecommendation?.type === "shorten_block" || blockRecommendation?.type === "start_small") {
            return {
                order: index + 1,
                blockId: snapshot.block.id,
                title: snapshot.block.title,
                emphasis: "lighten" as const,
                suggestedStart: snapshot.block.startAt.toISOString(),
                suggestedEnd: snapshot.block.endAt.toISOString(),
                recommendedDurationMinutes: typeof blockRecommendation.suggestedAction.payload.recommendedDurationMinutes === "number"
                    ? blockRecommendation.suggestedAction.payload.recommendedDurationMinutes
                    : typeof blockRecommendation.suggestedAction.payload.firstDurationMinutes === "number"
                        ? blockRecommendation.suggestedAction.payload.firstDurationMinutes
                        : snapshot.durationMinutes,
                reason: language === "es"
                    ? "Una entrada mas chica tiene mas chances de sostenerse que un empuje sobredimensionado."
                    : "A smaller entry is more likely to hold than a single oversized push.",
            };
        }

        if (snapshot.block.type === "break") {
            return {
                order: index + 1,
                blockId: snapshot.block.id,
                title: snapshot.block.title,
                emphasis: "recover" as const,
                suggestedStart: snapshot.block.startAt.toISOString(),
                suggestedEnd: snapshot.block.endAt.toISOString(),
                recommendedDurationMinutes: snapshot.durationMinutes,
                reason: language === "es"
                    ? "Este bloque evita que el dia se vuelva una sola pila de exigencia."
                    : "This block keeps the day from turning into one long demand stack.",
            };
        }

            return {
                order: index + 1,
                blockId: snapshot.block.id,
                title: snapshot.block.title,
                emphasis: defaultEmphasis,
                suggestedStart: snapshot.block.startAt.toISOString(),
                suggestedEnd: snapshot.block.endAt.toISOString(),
                recommendedDurationMinutes: snapshot.durationMinutes,
            reason: snapshot.cognitivelyHeavy
                ? (language === "es"
                    ? "Esta es una pieza clave para proteger temprano y con algo de aire alrededor."
                    : "This is a key piece to protect early and with some air around it.")
                : (language === "es"
                    ? "Esto funciona mejor como soporte, sin agregar mas tension al dia."
                    : "This works better as support, without adding more strain to the day."),
        };
    });

    const loadSummary = dailyLoad.realDayLoad >= 140 || dailyLoad.level === "overload"
        ? (language === "es" ? "Simplifica antes de ejecutar." : "Simplify before you execute.")
        : dailyLoad.level === "high"
            ? (language === "es" ? "Prioriza fuerte y deja aire real." : "Prioritize hard and leave real air.")
            : (language === "es" ? "Este dia puede ordenarse sin forzarlo." : "This day can be shaped without forcing it.");
    const energyStrategy = input.preferences.subjectiveEnergy === "low"
        ? (language === "es"
            ? "Empieza con una pieza clara, recorta lo ambicioso y protege la recuperacion."
            : "Start with one clear piece, trim the ambitious parts and protect recovery.")
        : input.preferences.subjectiveEnergy === "high"
            ? (language === "es"
                ? "Protege tu bloque de mayor valor en la mejor ventana y deja que el resto lo apoye."
                : "Protect your highest-value block in the best window and let the rest support it.")
            : (language === "es"
                ? "Sostene una apuesta fuerte y evita apilar demasiada demanda seguida."
                : "Keep one strong bet and avoid stacking too much demand back to back.");

    return {
        headline: loadSummary,
        summary: bestWindow
            ? (language === "es"
                ? `Tu mejor ventana sigue siendo ${getPlanningWindowLabel(bestWindow, language)}. Ordena el dia alrededor del trabajo de mayor costo ahi.`
                : `Your strongest window is still the ${getPlanningWindowLabel(bestWindow, language)}. Shape the day around high-cost work there.`)
            : (language === "es"
                ? "Tu mejor ventana todavia se esta calibrando, asi que la prioridad es mantener el dia realista."
                : "Your strongest window is still calibrating, so the priority is keeping the day realistic."),
        strategy: language === "es"
            ? `${energyStrategy} La carga real del dia esta leyendo ${Math.round(dailyLoad.realDayLoad)} y la energia residual parece ${Math.round(dailyLoad.residualEnergyEstimate)}%.`
            : `${energyStrategy} Real day load is reading ${Math.round(dailyLoad.realDayLoad)} and residual energy looks ${Math.round(dailyLoad.residualEnergyEstimate)}%.`,
        priorityBlockIds: steps.map((step) => step.blockId).filter((blockId): blockId is string => Boolean(blockId)),
        steps,
        adjustmentRecommendationIds: recommendations.slice(0, 3).map((recommendation) => recommendation.id),
    };
}

export function buildPlanningGuide(input: PlanningEngineInput, language: AppLanguage = "en"): PlanningGuideResult {
    const dayBlocks = getDayBlocks(input.blocks, input.targetDate);
    const dailyLoad = computeDailyLoad(input.blocks, input.targetDate, input.recentAnalytics, input.activityExperiences);
    const blockRecommendations = generateBlockRecommendations(input, dayBlocks, language);
    const dayRecommendations = generateDayRecommendations(input, dayBlocks, language);

    const recommendations = [...blockRecommendations, ...dayRecommendations]
        .map((recommendation) => {
            let adjusted = recommendation;

            if (input.preferences) {
                let confidence = adjusted.confidence;
                let priority = adjusted.priority;

                if (
                    input.preferences.subjectiveEnergy === "low"
                    && (adjusted.type === "reduce_daily_load" || adjusted.type === "insert_break" || adjusted.type === "start_small")
                ) {
                    confidence = clampConfidence(confidence + 0.05);
                    priority = "high";
                }

                if (input.preferences.rigidity === "high" && adjusted.type === "move_block") {
                    confidence = clampConfidence(confidence - 0.04);
                }

                if (input.preferences.rigidity === "low" && adjusted.type === "move_block") {
                    confidence = clampConfidence(confidence + 0.03);
                }

                adjusted = {
                    ...adjusted,
                    confidence,
                    priority,
                };
            }

            return applyFeedbackSummary(adjusted, input.feedbackSummary);
        })
        .filter((recommendation): recommendation is PlanningRecommendation => Boolean(recommendation))
        .sort((left, right) => {
            const priorityDiff = getPriorityWeight(right.priority) - getPriorityWeight(left.priority);
            if (priorityDiff !== 0) return priorityDiff;
            return right.confidence - left.confidence;
        })
        .slice(0, input.targetBlockId ? 4 : 6);

    return {
        date: input.targetDate,
        dailyLoad,
        blocks: dayBlocks.map(buildPlanningBlockSnapshot),
        recommendations,
        bestFocusWindow: input.profile.bestFocusWindow?.data.window ?? null,
        guidedPlan: buildGuidedPlan(input, dayBlocks, recommendations, dailyLoad, language),
        activityLoad: {
            passiveAttendanceLoad: dailyLoad.passiveAttendanceLoad,
            logisticsLoad: dailyLoad.logisticsLoad,
            collaborativeLoad: dailyLoad.collaborativeLoad,
            recoveryEffect: dailyLoad.recoveryEffect,
            transitionCost: dailyLoad.transitionCost,
            realDayLoad: dailyLoad.realDayLoad,
            residualEnergyEstimate: dailyLoad.residualEnergyEstimate,
            planRealityVariance: dailyLoad.planRealityVariance,
        },
    };
}
