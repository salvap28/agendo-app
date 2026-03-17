import { FocusSessionAnalytics } from "@/lib/types/behavior";
import { Block } from "@/lib/types/blocks";
import {
    ActivityBehaviorSignals,
    ActivityDailyLoadSnapshot,
    ActivityEngagementEnergySignal,
    ActivityExperience,
    ActivityExperienceAnalytics,
    ActivityPatternSummary,
    ActivityWindowSignal,
    EnergyImpact,
    EngagementMode,
} from "@/lib/types/activity";
import {
    computeCognitiveLoadWeight,
    computeEnergyImpactScore,
    computeExperienceConfidenceDecay,
    getExperienceWindow,
    isAttendanceLikeEngagement,
    isCompletionLikeOutcome,
} from "./domain";

const MINUTE_MS = 60 * 1000;

function average(values: number[]) {
    if (values.length === 0) return 0;
    return values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function round(value: number) {
    return Math.round(value * 100) / 100;
}

function distribution<T extends string>(items: T[]) {
    if (items.length === 0) return {} as Partial<Record<T, number>>;
    return items.reduce<Partial<Record<T, number>>>((accumulator, item) => {
        accumulator[item] = round((accumulator[item] ?? 0) + (1 / items.length));
        return accumulator;
    }, {});
}

function getActivityDate(experience: ActivityExperience) {
    return (experience.actualStart ?? experience.scheduledStart ?? experience.createdAt).slice(0, 10);
}

function getDurationMinutes(experience: ActivityExperience) {
    if (typeof experience.actualDurationMin === "number") return experience.actualDurationMin;
    if (experience.actualStart && experience.actualEnd) {
        return Math.max(0, Math.round((new Date(experience.actualEnd).getTime() - new Date(experience.actualStart).getTime()) / MINUTE_MS));
    }
    if (experience.scheduledStart && experience.scheduledEnd) {
        return Math.max(0, Math.round((new Date(experience.scheduledEnd).getTime() - new Date(experience.scheduledStart).getTime()) / MINUTE_MS));
    }
    return 0;
}

export function computeActivityExperienceAnalytics(experiences: ActivityExperience[]): ActivityExperienceAnalytics {
    const nonFocus = experiences.filter((experience) => experience.engagementMode !== "deep_focus");
    const attendance = nonFocus.filter((experience) => isAttendanceLikeEngagement(experience.engagementMode));
    const plannedDurations = nonFocus
        .filter((experience) => experience.scheduledStart && experience.scheduledEnd)
        .map((experience) => (
            Math.max(0, Math.round((new Date(experience.scheduledEnd!).getTime() - new Date(experience.scheduledStart!).getTime()) / MINUTE_MS))
        ));
    const actualDurations = nonFocus.map(getDurationMinutes);
    const executionVarianceMinutes = nonFocus.length === 0
        ? 0
        : round(average(nonFocus.map((experience, index) => Math.abs((actualDurations[index] ?? 0) - (plannedDurations[index] ?? actualDurations[index] ?? 0)))));

    return {
        totalCount: experiences.length,
        attendanceRate: attendance.length === 0
            ? 0
            : round(attendance.filter((experience) => isCompletionLikeOutcome(experience.outcome)).length / attendance.length),
        skipRate: nonFocus.length === 0
            ? 0
            : round(nonFocus.filter((experience) => experience.outcome === "skipped").length / nonFocus.length),
        postponeRate: nonFocus.length === 0
            ? 0
            : round(nonFocus.filter((experience) => experience.outcome === "postponed" || experience.outcome === "rescheduled").length / nonFocus.length),
        nonFocusCompletionRate: nonFocus.length === 0
            ? 0
            : round(nonFocus.filter((experience) => experience.outcome === "completed" || experience.outcome === "attended").length / nonFocus.length),
        executionVarianceMinutes,
        outcomeDistribution: distribution(nonFocus.map((experience) => experience.outcome)),
        energyImpactDistribution: distribution(experiences.map((experience) => experience.energyImpact)),
        cognitiveLoadDistribution: distribution(experiences.map((experience) => experience.cognitiveLoad)),
        perceivedValueDistribution: distribution(experiences.map((experience) => experience.perceivedValue)),
        reasonDistribution: distribution(nonFocus.map((experience) => experience.outcomeReason)),
    };
}

function countTransitions(items: ActivityExperience[]) {
    const sorted = [...items]
        .filter((item) => item.scheduledStart)
        .sort((left, right) => new Date(left.scheduledStart!).getTime() - new Date(right.scheduledStart!).getTime());
    let transitions = 0;

    for (let index = 0; index < sorted.length - 1; index += 1) {
        const current = sorted[index];
        const next = sorted[index + 1];
        const currentEnd = new Date(current.actualEnd ?? current.scheduledEnd ?? current.scheduledStart!).getTime();
        const nextStart = new Date(next.actualStart ?? next.scheduledStart!).getTime();
        const gapMinutes = (nextStart - currentEnd) / MINUTE_MS;

        if (gapMinutes < 25) {
            transitions += 1;
        }
    }

    return transitions;
}

export function computeDailyActivityLoad(
    experiences: ActivityExperience[],
    blocks: Block[],
    date: string,
): ActivityDailyLoadSnapshot {
    const dayExperiences = experiences.filter((experience) => getActivityDate(experience) === date);
    const dayBlocks = blocks.filter((block) => block.startAt.toISOString().slice(0, 10) === date);
    const passiveAttendanceLoad = round(dayExperiences
        .filter((experience) => experience.engagementMode === "passive_attendance")
        .reduce((total, experience) => total + (getDurationMinutes(experience) * (computeCognitiveLoadWeight(experience.cognitiveLoad) + 0.3)), 0));
    const collaborativeLoad = round(dayExperiences
        .filter((experience) => experience.engagementMode === "collaborative")
        .reduce((total, experience) => total + (getDurationMinutes(experience) * (computeCognitiveLoadWeight(experience.cognitiveLoad) + 0.45)), 0));
    const logisticsLoad = round(dayExperiences
        .filter((experience) => experience.engagementMode === "logistics" || experience.engagementMode === "movement")
        .reduce((total, experience) => total + (getDurationMinutes(experience) * 0.8), 0));
    const recoveryEffect = round(dayExperiences
        .filter((experience) => experience.engagementMode === "recovery")
        .reduce((total, experience) => total + (getDurationMinutes(experience) * Math.max(0, computeEnergyImpactScore(experience.energyImpact) + 0.4)), 0));
    const transitionCost = round(countTransitions(dayExperiences) * 8);
    const plannedMinutes = dayBlocks.reduce((total, block) => total + Math.round((block.endAt.getTime() - block.startAt.getTime()) / MINUTE_MS), 0);
    const actualMinutes = dayExperiences.reduce((total, experience) => total + getDurationMinutes(experience), 0);
    const planRealityVariance = round(actualMinutes - plannedMinutes);
    const rawLoad = passiveAttendanceLoad + collaborativeLoad + logisticsLoad + transitionCost - recoveryEffect;
    const realDayLoad = round(Math.max(0, rawLoad));
    const energyImpacts = dayExperiences.map((experience) => computeEnergyImpactScore(experience.energyImpact));
    const residualEnergyEstimate = clamp(
        round(55 + (average(energyImpacts) * 28) - ((realDayLoad / Math.max(1, plannedMinutes || 180)) * 16)),
        5,
        95,
    );

    return {
        passiveAttendanceLoad,
        logisticsLoad,
        collaborativeLoad,
        recoveryEffect,
        transitionCost,
        realDayLoad,
        residualEnergyEstimate,
        planRealityVariance,
    };
}

function detectWindowPreference(experiences: ActivityExperience[], nowIso: string): ActivityPatternSummary[] {
    const candidates = experiences
        .filter((experience) => experience.engagementMode === "light_execution" || experience.engagementMode === "admin_light")
        .reduce<Record<string, ActivityExperience[]>>((accumulator, experience) => {
            const window = getExperienceWindow(experience);
            accumulator[window] = [...(accumulator[window] ?? []), experience];
            return accumulator;
        }, {});

    const scored = Object.entries(candidates)
        .map(([window, items]) => ({
            window,
            items,
            score: average(items.map((item) => (
                ((item.perceivedValue === "high" ? 1 : item.perceivedValue === "medium" ? 0.6 : 0.2) * 0.55)
                + ((item.energyImpact === "energizing" || item.energyImpact === "restorative" ? 1 : item.energyImpact === "neutral" ? 0.6 : 0.2) * 0.45)
            ))),
        }))
        .sort((left, right) => right.score - left.score);

    const top = scored[0];
    if (!top || top.items.length < 3 || top.score < 0.7) return [];

    return [{
        patternKey: `preferred_light_execution_window:${top.window}`,
        patternType: "preferred_light_execution_window",
        confidence: round(Math.min(0.9, 0.6 + (top.items.length * 0.05))),
        sampleSize: top.items.length,
        title: "Light work lands better in a specific window",
        description: `${top.window} keeps showing cleaner outcomes for lighter execution and admin work.`,
        appliesTo: top.items.map((item) => item.id),
        data: {
            window: top.window,
            score: round(top.score),
        },
        updatedAt: nowIso,
    }];
}

function findNextFocusAfter(
    experience: ActivityExperience,
    focusAnalytics: FocusSessionAnalytics[],
    withinHours: number,
) {
    const pivot = new Date(experience.actualEnd ?? experience.scheduledEnd ?? experience.updatedAt).getTime();
    const maxDistance = withinHours * 60 * MINUTE_MS;

    return focusAnalytics.filter((item) => {
        const startedAt = new Date(item.startedAt).getTime();
        return startedAt >= pivot && startedAt - pivot <= maxDistance;
    });
}

export function detectActivityPatterns(
    experiences: ActivityExperience[],
    focusAnalytics: FocusSessionAnalytics[],
    now = new Date(),
): ActivityPatternSummary[] {
    const nowIso = now.toISOString();
    const patterns: ActivityPatternSummary[] = [];
    const collaborative = experiences.filter((experience) => experience.engagementMode === "collaborative");
    const attendance = experiences.filter((experience) => experience.engagementMode === "passive_attendance");
    const logistics = experiences.filter((experience) => experience.engagementMode === "logistics");
    const recovery = experiences.filter((experience) => experience.engagementMode === "recovery");

    if (collaborative.length >= 3) {
        const drainingRate = collaborative.filter((experience) => (
            experience.energyImpact === "draining" || experience.energyImpact === "demanding"
        )).length / collaborative.length;

        if (drainingRate >= 0.55) {
            patterns.push({
                patternKey: "post_meeting_fatigue:collaborative",
                patternType: "post_meeting_fatigue",
                confidence: round(Math.min(0.92, 0.58 + (drainingRate * 0.28) + (collaborative.length * 0.03))),
                sampleSize: collaborative.length,
                title: "Long collaboration is leaving a residual cost",
                description: "Collaborative blocks are frequently ending as demanding or draining.",
                appliesTo: collaborative.map((experience) => experience.id),
                data: {
                    drainingRate: round(drainingRate),
                },
                updatedAt: nowIso,
            });
        }

        const nextFocus = collaborative.flatMap((experience) => findNextFocusAfter(experience, focusAnalytics, 2));
        if (nextFocus.length >= 3) {
            const averageFriction = average(nextFocus.map((item) => item.frictionScore));
            const averageBehavior = average(nextFocus.map((item) => item.behaviorScore));
            if (averageFriction >= 58 || averageBehavior <= 58) {
                patterns.push({
                    patternKey: "collaboration_buffer_need:post_collaboration",
                    patternType: "collaboration_buffer_need",
                    confidence: round(Math.min(0.9, 0.62 + (nextFocus.length * 0.04))),
                    sampleSize: nextFocus.length,
                    title: "Deep work needs more air after collaboration",
                    description: "Focus sessions placed right after collaborative blocks are showing weaker recovery and more friction.",
                    appliesTo: nextFocus.map((item) => item.sessionId),
                    data: {
                        averageFriction: round(averageFriction),
                        averageBehavior: round(averageBehavior),
                    },
                    updatedAt: nowIso,
                });
            }
        }
    }

    if (attendance.length >= 3) {
        const residualLoad = average(attendance.map((experience) => (
            (computeCognitiveLoadWeight(experience.cognitiveLoad) * 0.65)
            + (Math.max(0, -computeEnergyImpactScore(experience.energyImpact)) * 0.35)
        )));

        if (residualLoad >= 0.62) {
            patterns.push({
                patternKey: "post_class_residual_load:attendance",
                patternType: "post_class_residual_load",
                confidence: round(Math.min(0.88, 0.56 + residualLoad * 0.34)),
                sampleSize: attendance.length,
                title: "Attendance-heavy blocks leave residual load",
                description: "Classes or passive attendance blocks are often carrying more cognitive weight than they look.",
                appliesTo: attendance.map((experience) => experience.id),
                data: {
                    residualLoad: round(residualLoad),
                },
                updatedAt: nowIso,
            });
        }
    }

    if (logistics.length >= 4) {
        const dayCounts = logistics.reduce<Record<string, number>>((accumulator, experience) => {
            const date = getActivityDate(experience);
            accumulator[date] = (accumulator[date] ?? 0) + 1;
            return accumulator;
        }, {});
        const averagePerDay = average(Object.values(dayCounts));
        if (averagePerDay >= 1.5) {
            patterns.push({
                patternKey: "logistics_fragmentation:days",
                patternType: "logistics_fragmentation",
                confidence: round(Math.min(0.86, 0.54 + (averagePerDay * 0.12))),
                sampleSize: logistics.length,
                title: "Logistics are fragmenting the day",
                description: "Too many movement or logistics blocks are splitting the day into harder-to-hold fragments.",
                appliesTo: logistics.map((experience) => experience.id),
                data: {
                    averagePerDay: round(averagePerDay),
                },
                updatedAt: nowIso,
            });
        }
    }

    if (recovery.length >= 2) {
        const nextFocus = recovery.flatMap((experience) => findNextFocusAfter(experience, focusAnalytics, 4));
        if (nextFocus.length >= 2) {
            const averageBehavior = average(nextFocus.map((item) => item.behaviorScore));
            const averageFriction = average(nextFocus.map((item) => item.frictionScore));
            if (averageBehavior >= 70 && averageFriction <= 40) {
                patterns.push({
                    patternKey: "recovery_boost:post_recovery",
                    patternType: "recovery_boost",
                    confidence: round(Math.min(0.84, 0.56 + (nextFocus.length * 0.06))),
                    sampleSize: nextFocus.length,
                    title: "Recovery blocks are buying back capacity",
                    description: "Focus after restorative blocks tends to hold with better behavior and lower friction.",
                    appliesTo: nextFocus.map((item) => item.sessionId),
                    data: {
                        averageBehavior: round(averageBehavior),
                        averageFriction: round(averageFriction),
                    },
                    updatedAt: nowIso,
                });
            }
        }
    }

    patterns.push(...detectWindowPreference(experiences, nowIso));
    return patterns;
}

export function buildActivityBehaviorSignals(
    experiences: ActivityExperience[],
    focusAnalytics: FocusSessionAnalytics[],
    now = new Date(),
): ActivityBehaviorSignals {
    const patterns = detectActivityPatterns(experiences, focusAnalytics, now);
    const attendanceRelevant = experiences.filter((experience) => isAttendanceLikeEngagement(experience.engagementMode));
    const attendanceReliability = attendanceRelevant.length === 0
        ? null
        : round(attendanceRelevant.filter((experience) => isCompletionLikeOutcome(experience.outcome)).length / attendanceRelevant.length);

    const collaborative = experiences.filter((experience) => experience.engagementMode === "collaborative");
    const postMeetingFatigue = collaborative.length === 0
        ? null
        : round(average(collaborative.map((experience) => Math.max(0, -computeEnergyImpactScore(experience.energyImpact)))));

    const attendance = experiences.filter((experience) => experience.engagementMode === "passive_attendance");
    const postClassResidualLoad = attendance.length === 0
        ? null
        : round(average(attendance.map((experience) => computeCognitiveLoadWeight(experience.cognitiveLoad))));

    const preferredLightExecutionWindowsMap = experiences
        .filter((experience) => experience.engagementMode === "light_execution" || experience.engagementMode === "admin_light")
        .reduce<Record<string, ActivityExperience[]>>((accumulator, experience) => {
            const window = getExperienceWindow(experience);
            accumulator[window] = [...(accumulator[window] ?? []), experience];
            return accumulator;
        }, {});

    const preferredLightExecutionWindows: ActivityWindowSignal[] = Object.entries(preferredLightExecutionWindowsMap)
        .map(([window, items]) => ({
            window: window as ActivityWindowSignal["window"],
            score: round(average(items.map((item) => (
                (item.perceivedValue === "high" ? 1 : item.perceivedValue === "medium" ? 0.65 : 0.25)
                + (item.energyImpact === "energizing" || item.energyImpact === "restorative" ? 0.5 : item.energyImpact === "neutral" ? 0.25 : 0)
            )))),
            confidence: round(Math.min(0.88, average(items.map(computeExperienceConfidenceDecay)) + (items.length * 0.04))),
            sampleSize: items.length,
        }))
        .filter((item) => item.sampleSize >= 2)
        .sort((left, right) => right.score - left.score)
        .slice(0, 2);

    const postponeTendencies = Object.entries(experiences.reduce<Record<string, ActivityExperience[]>>((accumulator, experience) => {
        accumulator[experience.engagementMode] = [...(accumulator[experience.engagementMode] ?? []), experience];
        return accumulator;
    }, {}))
        .map(([engagementMode, items]) => ({
            engagementMode: engagementMode as EngagementMode,
            rate: round(items.filter((item) => item.outcome === "postponed" || item.outcome === "rescheduled").length / items.length),
            confidence: round(Math.min(0.84, average(items.map(computeExperienceConfidenceDecay)) + (items.length * 0.04))),
            sampleSize: items.length,
        }))
        .filter((item) => item.sampleSize >= 2 && item.rate > 0)
        .sort((left, right) => right.rate - left.rate)
        .slice(0, 3);

    const energyImpactByEngagementMode: ActivityEngagementEnergySignal[] = Object.entries(experiences.reduce<Record<string, ActivityExperience[]>>((accumulator, experience) => {
        accumulator[experience.engagementMode] = [...(accumulator[experience.engagementMode] ?? []), experience];
        return accumulator;
    }, {}))
        .map(([engagementMode, items]) => {
            const counts = items.reduce<Record<string, number>>((accumulator, item) => {
                accumulator[item.energyImpact] = (accumulator[item.energyImpact] ?? 0) + 1;
                return accumulator;
            }, {});
            const dominantImpact = Object.entries(counts)
                .sort((left, right) => right[1] - left[1])[0]?.[0] as EnergyImpact | undefined;
            return {
                engagementMode: engagementMode as EngagementMode,
                dominantImpact: dominantImpact ?? "unknown",
                drainingRate: round(items.filter((item) => item.energyImpact === "draining").length / items.length),
                restorativeRate: round(items.filter((item) => item.energyImpact === "restorative" || item.energyImpact === "energizing").length / items.length),
                confidence: round(Math.min(0.88, average(items.map(computeExperienceConfidenceDecay)) + (items.length * 0.04))),
                sampleSize: items.length,
            };
        })
        .filter((item) => item.sampleSize >= 2);

    const dominantReasons = Object.entries(experiences.reduce<Record<string, number>>((accumulator, experience) => {
        accumulator[experience.outcomeReason] = (accumulator[experience.outcomeReason] ?? 0) + 1;
        return accumulator;
    }, {}))
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([reason, count]) => ({
            reason: reason as ActivityBehaviorSignals["dominantReasons"][number]["reason"],
            count,
        }));

    return {
        attendanceReliability,
        postMeetingFatigue,
        postClassResidualLoad,
        preferredLightExecutionWindows,
        postponeTendencies,
        energyImpactByEngagementMode,
        dominantReasons,
        patterns,
        lastActivityAt: experiences[0]?.updatedAt ?? null,
    };
}

export function estimatePostActivityApplicability(args: {
    targetDate: string;
    blockStart: Date;
    cognitivelyHeavy: boolean;
    experiences: ActivityExperience[];
}) {
    const relevant = args.experiences.filter((experience) => {
        const date = getActivityDate(experience);
        const end = experience.actualEnd ?? experience.scheduledEnd ?? experience.updatedAt;
        return date === args.targetDate && new Date(end).getTime() <= args.blockStart.getTime();
    });

    let modifier = 1;
    const signals: string[] = [];

    const drainingRecent = relevant.find((experience) => {
        const end = new Date(experience.actualEnd ?? experience.scheduledEnd ?? experience.updatedAt).getTime();
        const distanceMinutes = (args.blockStart.getTime() - end) / MINUTE_MS;
        return distanceMinutes <= 180 && (
            experience.energyImpact === "draining"
            || experience.energyImpact === "demanding"
        ) && (
            experience.engagementMode === "collaborative"
            || experience.engagementMode === "passive_attendance"
        );
    });

    if (drainingRecent && args.cognitivelyHeavy) {
        modifier -= 0.18;
        signals.push("recent_draining_attendance");
    }

    const logisticsMinutes = relevant
        .filter((experience) => experience.engagementMode === "logistics" || experience.engagementMode === "movement")
        .reduce((total, experience) => total + getDurationMinutes(experience), 0);
    if (logisticsMinutes >= 60 && args.cognitivelyHeavy) {
        modifier -= 0.08;
        signals.push("logistics_fragmentation");
    }

    const recentRecovery = relevant.find((experience) => {
        const end = new Date(experience.actualEnd ?? experience.scheduledEnd ?? experience.updatedAt).getTime();
        const distanceMinutes = (args.blockStart.getTime() - end) / MINUTE_MS;
        return distanceMinutes <= 150
            && experience.engagementMode === "recovery"
            && (experience.energyImpact === "restorative" || experience.energyImpact === "energizing");
    });

    if (recentRecovery) {
        modifier += 0.08;
        signals.push("recent_recovery_boost");
    }

    return {
        modifier: round(clamp(modifier, 0.55, 1.18)),
        signals,
    };
}
