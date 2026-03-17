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
import { buildPlanningBlockSnapshot } from "./blockMetadata";
import { computeDailyLoad } from "./dailyLoad";

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

function getPlanningWindowLabel(window: "morning" | "afternoon" | "evening" | "night") {
    switch (window) {
        case "morning":
            return "morning";
        case "afternoon":
            return "afternoon";
        case "evening":
            return "evening";
        case "night":
            return "night";
        default:
            return "best window";
    }
}

function getDayBlocks(blocks: Block[], date: string) {
    return blocks
        .filter((block) => block.startAt.toISOString().slice(0, 10) === date)
        .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
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

function renderCopy(reasonCode: ReasonCode, payload: Record<string, unknown>) {
    switch (reasonCode) {
        case "BEST_WINDOW_MISMATCH":
            return {
                title: "This block would land better elsewhere",
                message: `This intense block sits outside your strongest window. ${String(payload.bestWindowLabel)} would likely support it better.`,
                reason: `Demanding sessions have been holding better in the ${String(payload.bestWindowLabel)} than in the ${String(payload.currentWindowLabel)}.`,
            };
        case "SESSION_TOO_LONG":
            return {
                title: "This duration looks too ambitious",
                message: `${String(payload.recommendedRange)} looks more sustainable for you right now than ${String(payload.currentMinutes)} straight minutes.`,
                reason: "When blocks stretch too far past your recent sweet spot, friction and drop-off tend to rise.",
            };
        case "DAY_OVERLOAD":
            return {
                title: "The day looks overloaded",
                message: `This day is reading as ${String(payload.loadLevel)} load. Lightening one piece would make it more realistic.`,
                reason: "There is too much density, intensity or long-form work stacked together for your recent capacity.",
            };
        case "HIGH_FRICTION_CATEGORY":
            return {
                title: "Start smaller here",
                message: "This block sits in a context that has historically carried more friction. A smaller entry point should help.",
                reason: `${String(payload.contextLabel)} sessions have been harder to sustain than your recent baseline.`,
            };
        case "INTENSE_SEQUENCE":
            return {
                title: "This sequence needs recovery",
                message: "Too many demanding blocks are packed together. A real break would make the day easier to hold.",
                reason: "When intense work stacks without recovery, session stability usually falls.",
            };
        case "PREMIUM_WINDOW_PROTECTION":
            return {
                title: "Protect your premium window",
                message: "A lighter task is occupying a window where your focus tends to be strongest. Save it for higher-value work.",
                reason: "Your best window is being used by a low-demand block while heavier work is still outside it.",
            };
        case "OVEROPTIMISTIC_PLAN":
            return {
                title: "The plan is running too optimistic",
                message: "You are planning meaningfully more than you have been sustaining on similar days. Dialing it down would help.",
                reason: "Planned load is clearly above your recent executed capacity in comparable contexts.",
            };
        default:
            return {
                title: "There is room for a cleaner plan",
                message: "A small adjustment could make this schedule easier to carry.",
                reason: "This suggestion is grounded in your recent profile and the current calendar layout.",
            };
    }
}

function buildRecommendation(args: {
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
    const copy = renderCopy(args.reasonCode, args.reasonPayload);

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

function generateBlockRecommendations(input: PlanningEngineInput, dayBlocks: Block[]) {
    const recommendations: PlanningRecommendation[] = [];
    const profile = input.profile;
    const targetBlock = input.targetBlockId
        ? dayBlocks.find((block) => block.id === input.targetBlockId)
        : null;
    const blocksToEvaluate = targetBlock ? [targetBlock] : dayBlocks;

    for (const block of blocksToEvaluate) {
        const snapshot = buildPlanningBlockSnapshot(block);
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
                recommendations.push(buildRecommendation({
                    id: getStableRecommendationId(input.userId, "move_block", "block", block.id, bestWindow.data.window),
                    type: "move_block",
                    scope: "block",
                    targetBlockId: block.id,
                    targetDate: input.targetDate,
                    priority: "high",
                    confidence: Math.min(0.92, bestWindow.confidence),
                    reasonCode: "BEST_WINDOW_MISMATCH",
                    reasonPayload: {
                        currentWindowLabel: getPlanningWindowLabel(
                            block.startAt.getHours() < 12 ? "morning" : block.startAt.getHours() < 17 ? "afternoon" : block.startAt.getHours() < 21 ? "evening" : "night"
                        ),
                        bestWindowLabel: getPlanningWindowLabel(bestWindow.data.window),
                    },
                    evidence: buildEvidence({
                        confidence: bestWindow.confidence,
                        sampleSize: bestWindow.sampleSize,
                        hypothesisStrength: "stable",
                        lastUpdated: bestWindow.updatedAt,
                        appliesTo: [block.id],
                        signals: ["best_focus_window", "flexible_block", "cognitively_heavy"],
                    }),
                    applyability: {
                        mode: "auto",
                    helperText: "Agendo can move it for you safely.",
                    },
                    suggestedAction: {
                        kind: "move",
                        label: "Move to best window",
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
                recommendations.push(buildRecommendation({
                    id: getStableRecommendationId(input.userId, "shorten_block", "block", block.id),
                    type: snapshot.splittable ? "split_block" : "shorten_block",
                    scope: "block",
                    targetBlockId: block.id,
                    targetDate: input.targetDate,
                    priority: snapshot.splittable ? "high" : "medium",
                    confidence: Math.min(0.9, profile.optimalSessionLength.confidence),
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
                        signals: ["optimal_session_length", "planned_duration"],
                    }),
                    applyability: {
                        mode: "auto",
                        helperText: snapshot.splittable
                            ? "Agendo can split it without breaking the rest of the plan."
                            : "Agendo can shorten the block safely.",
                    },
                    suggestedAction: snapshot.splittable
                        ? {
                            kind: "split",
                            label: "Split into two blocks",
                            payload: {
                                firstDurationMinutes: splitTargetMinutes,
                                secondDurationMinutes: snapshot.durationMinutes - splitTargetMinutes,
                            },
                        }
                        : {
                            kind: "shorten",
                            label: "Shorten block",
                            payload: {
                                recommendedDurationMinutes: recommendedMax,
                            },
                        },
                }));
            }
        }

        if (frictionSource && frictionSource.confidence >= 0.72) {
            const targetMinutes = Math.min(35, Math.max(20, Math.round(snapshot.durationMinutes * 0.45)));
            recommendations.push(buildRecommendation({
                id: getStableRecommendationId(input.userId, "start_small", "block", block.id),
                type: "start_small",
                scope: "block",
                targetBlockId: block.id,
                targetDate: input.targetDate,
                priority: "medium",
                confidence: Math.min(0.88, frictionSource.confidence),
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
                    signals: ["friction_source", "category_match"],
                }),
                applyability: {
                    mode: "auto",
                    helperText: snapshot.splittable
                        ? "Agendo can give you a lighter first pass."
                        : "Agendo can reduce the first pass automatically.",
                },
                suggestedAction: snapshot.splittable
                    ? {
                        kind: "split",
                        label: "Start with a smaller version",
                        payload: {
                            firstDurationMinutes: targetMinutes,
                            secondDurationMinutes: Math.max(15, snapshot.durationMinutes - targetMinutes),
                        },
                    }
                    : {
                        kind: "shorten",
                        label: "Reduce first pass",
                        payload: {
                            recommendedDurationMinutes: targetMinutes,
                        },
                    },
            }));
        }
    }

    return recommendations;
}

function generateDayRecommendations(input: PlanningEngineInput, dayBlocks: Block[]) {
    const recommendations: PlanningRecommendation[] = [];
    const dailyLoad = computeDailyLoad(input.blocks, input.targetDate, input.recentAnalytics);
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
            recommendations.push(buildRecommendation({
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
                        ? "Agendo can mark it optional without disturbing the rest of the day."
                        : "Agendo can lighten the most flexible block.",
                },
                suggestedAction: candidate.optional
                    ? {
                        kind: "mark_optional",
                        label: "Keep it optional",
                        payload: { optional: true },
                    }
                    : {
                        kind: "shorten",
                        label: "Reduce day load",
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
        recommendations.push(buildRecommendation({
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
                    helperText: "Agendo can reserve that break in your calendar.",
            },
            suggestedAction: {
                kind: "insert_break",
                label: "Insertar descanso",
                payload: {
                    suggestedStart: breakStart,
                    durationMinutes: 15,
                },
            },
        }));
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
            recommendations.push(buildRecommendation({
                id: getStableRecommendationId(input.userId, "protect_focus_window", "day", input.targetDate),
                type: "protect_focus_window",
                scope: "day",
                targetBlockId: trivialInBestWindow.block.id,
                targetDate: input.targetDate,
                priority: "medium",
                confidence: bestWindow.confidence,
                reasonCode: "PREMIUM_WINDOW_PROTECTION",
                reasonPayload: {
                    bestWindowLabel: getPlanningWindowLabel(bestWindow.data.window),
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
                    helperText: "Review it manually so you can protect that window without moving something blindly.",
                },
                suggestedAction: {
                    kind: "review_window",
                    label: "Review this window",
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
        recommendations.push(buildRecommendation({
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
                helperText: "Adjust this manually so nothing important gets trimmed opaquely.",
            },
            suggestedAction: {
                kind: "downgrade_goal",
                    label: "Lower the day goal",
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
): GuidedPlanningOutput | null {
    if (!input.preferences) return null;

    const snapshots = dayBlocks.map(buildPlanningBlockSnapshot);
    if (snapshots.length === 0) {
        return {
            headline: "Nothing is scheduled yet",
            summary: "Plan with Agendo needs at least one block before it can help structure the day.",
            strategy: "Start by adding one or two meaningful blocks, then ask again.",
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
                reason: "Move it into your premium window so it starts with more support.",
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
                reason: "A smaller entry is more likely to hold than a single oversized push.",
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
                reason: "This block keeps the day from turning into one long demand stack.",
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
                ? "This is a key piece to protect early and with some air around it."
                : "This works better as support, without adding more strain to the day.",
        };
    });

    const loadSummary = dailyLoad.level === "overload"
        ? "Simplify before you execute."
        : dailyLoad.level === "high"
            ? "Prioritize hard and leave real air."
            : "This day can be shaped without forcing it.";
    const energyStrategy = input.preferences.subjectiveEnergy === "low"
        ? "Start with one clear piece, trim the ambitious parts and protect recovery."
        : input.preferences.subjectiveEnergy === "high"
            ? "Protect your highest-value block in the best window and let the rest support it."
            : "Keep one strong bet and avoid stacking too much demand back to back.";

    return {
        headline: loadSummary,
        summary: bestWindow
            ? `Your strongest window is still the ${getPlanningWindowLabel(bestWindow)}. Shape the day around high-cost work there.`
            : "Your strongest window is still calibrating, so the priority is keeping the day realistic.",
        strategy: energyStrategy,
        priorityBlockIds: steps.map((step) => step.blockId).filter((blockId): blockId is string => Boolean(blockId)),
        steps,
        adjustmentRecommendationIds: recommendations.slice(0, 3).map((recommendation) => recommendation.id),
    };
}

export function buildPlanningGuide(input: PlanningEngineInput): PlanningGuideResult {
    const dayBlocks = getDayBlocks(input.blocks, input.targetDate);
    const dailyLoad = computeDailyLoad(input.blocks, input.targetDate, input.recentAnalytics);
    const blockRecommendations = generateBlockRecommendations(input, dayBlocks);
    const dayRecommendations = generateDayRecommendations(input, dayBlocks);

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
        guidedPlan: buildGuidedPlan(input, dayBlocks, recommendations, dailyLoad),
    };
}
