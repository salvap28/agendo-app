import { FocusSessionAnalytics } from "@/lib/types/behavior";
import { Block, BlockType } from "@/lib/types/blocks";
import { FocusSession } from "@/lib/types/focus";
import {
    ActivityExperience,
    ActivityExperienceCheckoutInput,
    ActivityLocationMode,
    ActivityOutcome,
    ActivityOutcomeReason,
    ActivityPresenceMode,
    CognitiveLoad,
    EnergyImpact,
    EngagementMode,
    ExperienceSource,
    PerceivedValue,
    SocialDemand,
} from "@/lib/types/activity";

const MINUTE_MS = 60 * 1000;

function clampUnit(value: number) {
    return Math.max(0, Math.min(1, value));
}

function resolveWindowFromDate(value: Date | string) {
    const hour = new Date(value).getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
}

export function resolveBlockEngagementMode(block: Pick<Block, "type" | "engagementMode">): EngagementMode {
    if (block.engagementMode) return block.engagementMode;

    switch (block.type) {
        case "deep_work":
        case "study":
            return "deep_focus";
        case "meeting":
            return "collaborative";
        case "gym":
            return "movement";
        case "admin":
            return "admin_light";
        case "break":
            return "recovery";
        default:
            return "light_execution";
    }
}

export function resolveBlockRequiresFocusMode(block: Pick<Block, "type" | "requiresFocusMode" | "engagementMode">) {
    if (typeof block.requiresFocusMode === "boolean") return block.requiresFocusMode;
    return resolveBlockEngagementMode(block) === "deep_focus";
}

export function resolveBlockGeneratesExperienceRecord(block: Pick<Block, "generatesExperienceRecord">) {
    return block.generatesExperienceRecord ?? true;
}

export function resolveBlockSocialDemand(block: Pick<Block, "type" | "socialDemandHint">): SocialDemand {
    if (block.socialDemandHint) return block.socialDemandHint;

    switch (block.type) {
        case "meeting":
            return "high";
        case "gym":
            return "medium";
        case "admin":
            return "low";
        case "break":
        case "deep_work":
        case "study":
            return "solo";
        default:
            return "unknown";
    }
}

export function resolveBlockLocationMode(block: Pick<Block, "type" | "locationMode">): ActivityLocationMode {
    if (block.locationMode) return block.locationMode;

    switch (block.type) {
        case "meeting":
            return "hybrid";
        case "gym":
            return "in_person";
        default:
            return "unknown";
    }
}

export function resolveBlockPresenceMode(block: Pick<Block, "type" | "presenceMode">): ActivityPresenceMode {
    if (block.presenceMode) return block.presenceMode;

    switch (block.type) {
        case "meeting":
            return "required";
        case "break":
            return "self_directed";
        default:
            return "unknown";
    }
}

export function resolveBlockCognitiveLoad(block: Pick<Block, "difficulty" | "intensity" | "cognitivelyHeavy" | "type">): CognitiveLoad {
    if (block.cognitivelyHeavy) return "high";
    if ((block.difficulty ?? 0) >= 4) return "high";
    if (block.intensity === "high") return "high";
    if ((block.difficulty ?? 0) >= 2 || block.intensity === "medium") return "medium";
    if (block.type === "meeting" || block.type === "admin") return "medium";
    return "low";
}

export function getActivityExperienceKey(args: {
    source: "focus" | "block" | "manual";
    sourceFocusSessionId?: string | null;
    sourceBlockId?: string | null;
}) {
    if (args.source === "focus" && args.sourceFocusSessionId) {
        return `focus:${args.sourceFocusSessionId}`;
    }

    if (args.sourceBlockId) {
        return `block:${args.sourceBlockId}`;
    }

    return `manual:${crypto.randomUUID()}`;
}

export function mapFocusAnalyticsToOutcome(closureType: FocusSessionAnalytics["closureType"]): ActivityOutcome {
    return closureType === "completed" ? "completed" : "interrupted";
}

export function mapFocusSessionToActivityExperience(args: {
    userId: string;
    session: FocusSession;
    analytics?: FocusSessionAnalytics | null;
    existing?: ActivityExperience | null;
    now?: Date;
}): ActivityExperience {
    const nowIso = (args.now ?? new Date()).toISOString();
    const analytics = args.analytics ?? null;
    const startedAt = args.session.startedAt;
    const endedAt = args.session.endedAt ?? nowIso;
    const actualDurationMin = Math.max(
        0,
        Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / MINUTE_MS),
    );
    const energyDelta = (args.session.moodAfter ?? 0) - (args.session.moodBefore ?? 0);
    const energyImpact: EnergyImpact = args.session.moodAfter == null || args.session.moodBefore == null
        ? "unknown"
        : energyDelta >= 2
            ? "energizing"
            : energyDelta <= -2
                ? "draining"
                : energyDelta < 0
                    ? "demanding"
                    : "neutral";
    const perceivedValue: PerceivedValue = (args.session.progressFeelingAfter ?? 0) >= 4
        ? "high"
        : (args.session.progressFeelingAfter ?? 0) >= 2
            ? "medium"
            : args.session.progressFeelingAfter == null
                ? "unknown"
                : "low";
    const cognitiveLoad: CognitiveLoad = (args.session.difficulty ?? 0) >= 4
        ? "high"
        : (args.session.difficulty ?? 0) >= 2
            ? "medium"
            : args.session.difficulty == null
                ? "unknown"
                : "low";
    const outcome = analytics ? mapFocusAnalyticsToOutcome(analytics.closureType) : "unknown";
    const outcomeReason: ActivityOutcomeReason = analytics?.closureType === "completed"
        ? "completed_as_planned"
        : analytics?.closureType === "abandoned"
            ? "high_friction"
            : "unknown";

    return {
        id: args.existing?.id ?? crypto.randomUUID(),
        experienceKey: getActivityExperienceKey({
            source: "focus",
            sourceFocusSessionId: args.session.id,
            sourceBlockId: args.session.blockId ?? null,
        }),
        userId: args.userId,
        sourceBlockId: args.session.blockId ?? null,
        sourceFocusSessionId: args.session.id,
        titleSnapshot: args.session.intention ?? "Focus session",
        blockTypeSnapshot: args.session.blockType ?? null,
        tagSnapshot: null,
        engagementMode: "deep_focus",
        outcome,
        source: "focus",
        scheduledStart: args.session.startedAt,
        scheduledEnd: args.session.endedAt ?? null,
        actualStart: args.session.startedAt,
        actualEnd: endedAt,
        actualDurationMin,
        energyImpact,
        cognitiveLoad,
        perceivedValue,
        socialDemand: "solo",
        outcomeReason,
        locationMode: "unknown",
        presenceMode: "self_directed",
        wasPlanned: true,
        wasCompletedAsPlanned: outcome === "completed",
        wasUserConfirmed: Boolean(
            args.session.progressFeelingAfter != null
            || args.session.moodAfter != null
            || args.session.difficulty != null
            || args.session.closureNote?.text
        ),
        wasSystemInferred: false,
        confidence: analytics ? 0.94 : 0.82,
        notes: args.session.closureNote?.text ?? null,
        metadataJson: {
            sourceMode: args.session.mode,
            minimumViable: args.session.minimumViable ?? null,
            nextStep: args.session.nextStep ?? null,
            timeWindow: analytics?.timeWindow ?? resolveWindowFromDate(startedAt),
            behaviorScore: analytics?.behaviorScore ?? null,
            frictionScore: analytics?.frictionScore ?? null,
        },
        createdAt: args.existing?.createdAt ?? nowIso,
        updatedAt: nowIso,
    };
}

function inferCompletedOutcome(block: Block): ActivityOutcome {
    const engagementMode = resolveBlockEngagementMode(block);
    if (engagementMode === "passive_attendance" || engagementMode === "collaborative") {
        return "attended";
    }
    return "completed";
}

function inferCompletedReason(block: Block): ActivityOutcomeReason {
    const engagementMode = resolveBlockEngagementMode(block);
    if (engagementMode === "passive_attendance" || engagementMode === "collaborative") {
        return "attended_as_expected";
    }
    return "completed_as_planned";
}

export function getDefaultActivityCheckoutOutcome(block: Pick<Block, "type" | "engagementMode">): ActivityOutcome {
    const engagementMode = resolveBlockEngagementMode(block);
    return engagementMode === "passive_attendance" || engagementMode === "collaborative"
        ? "attended"
        : "completed";
}

export function shouldPromptActivityCheckout(args: {
    block: Block;
    experience?: ActivityExperience | null;
    now?: Date;
}) {
    if (resolveBlockRequiresFocusMode(args.block) || !resolveBlockGeneratesExperienceRecord(args.block)) {
        return false;
    }

    if (args.block.status === "canceled") return false;

    const now = args.now ?? new Date();
    if (args.block.endAt.getTime() > now.getTime()) return false;

    if (args.experience?.wasUserConfirmed) return false;

    return true;
}

export function inferActivityExperienceFromBlock(args: {
    userId: string;
    block: Block;
    existing?: ActivityExperience | null;
    now?: Date;
    source?: ExperienceSource;
    markUserConfirmed?: boolean;
    checkout?: Partial<ActivityExperienceCheckoutInput> | null;
}): ActivityExperience | null {
    if (resolveBlockRequiresFocusMode(args.block) || !resolveBlockGeneratesExperienceRecord(args.block)) {
        return null;
    }

    const now = args.now ?? new Date();
    const nowIso = now.toISOString();
    const engagementMode = resolveBlockEngagementMode(args.block);
    let outcome: ActivityOutcome = "unknown";
    let outcomeReason: ActivityOutcomeReason = "unknown";
    let confidence = 0.32;

    if (args.checkout?.outcome) {
        outcome = args.checkout.outcome;
        outcomeReason = args.checkout.outcomeReason ?? (
            outcome === "completed" || outcome === "attended"
                ? inferCompletedReason(args.block)
                : "unknown"
        );
        confidence = 0.94;
    } else if (args.block.status === "completed") {
        outcome = inferCompletedOutcome(args.block);
        outcomeReason = inferCompletedReason(args.block);
        confidence = 0.84;
    } else if (args.block.status === "canceled") {
        outcome = "cancelled";
        outcomeReason = "cancelled_by_other";
        confidence = 0.82;
    } else if (args.block.endAt.getTime() <= now.getTime()) {
        if (engagementMode === "passive_attendance" || engagementMode === "collaborative") {
            outcome = "attended";
            outcomeReason = "attended_as_expected";
            confidence = 0.58;
        } else if (engagementMode === "recovery") {
            outcome = "completed";
            outcomeReason = "completed_as_planned";
            confidence = 0.48;
        }
    }

    if (outcome === "unknown" && !args.checkout) {
        return null;
    }

    const actualStart = outcome === "cancelled" || outcome === "skipped" ? null : args.block.startAt.toISOString();
    const actualEnd = outcome === "cancelled" || outcome === "skipped" ? null : args.block.endAt.toISOString();

    return {
        id: args.existing?.id ?? crypto.randomUUID(),
        experienceKey: getActivityExperienceKey({
            source: "block",
            sourceBlockId: args.block.id,
        }),
        userId: args.userId,
        sourceBlockId: args.block.id,
        sourceFocusSessionId: null,
        titleSnapshot: args.block.title,
        blockTypeSnapshot: args.block.type,
        tagSnapshot: args.block.tag ?? null,
        engagementMode,
        outcome,
        source: args.source ?? (args.checkout ? "manual" : "system_inferred"),
        scheduledStart: args.block.startAt.toISOString(),
        scheduledEnd: args.block.endAt.toISOString(),
        actualStart,
        actualEnd,
        actualDurationMin: actualStart && actualEnd
            ? Math.max(0, Math.round((new Date(actualEnd).getTime() - new Date(actualStart).getTime()) / MINUTE_MS))
            : null,
        energyImpact: args.checkout?.energyImpact ?? "unknown",
        cognitiveLoad: args.checkout?.cognitiveLoad ?? resolveBlockCognitiveLoad(args.block),
        perceivedValue: args.checkout?.perceivedValue ?? "unknown",
        socialDemand: resolveBlockSocialDemand(args.block),
        outcomeReason,
        locationMode: resolveBlockLocationMode(args.block),
        presenceMode: resolveBlockPresenceMode(args.block),
        wasPlanned: true,
        wasCompletedAsPlanned: outcomeReason === "completed_as_planned" || outcomeReason === "attended_as_expected",
        wasUserConfirmed: Boolean(args.markUserConfirmed || args.checkout),
        wasSystemInferred: !args.markUserConfirmed && !args.checkout,
        confidence,
        notes: args.checkout?.notes ?? null,
        metadataJson: {
            inferred: !args.checkout && !args.markUserConfirmed,
            window: resolveWindowFromDate(args.block.startAt),
            status: args.block.status,
        },
        createdAt: args.existing?.createdAt ?? nowIso,
        updatedAt: nowIso,
    };
}

export function inferRescheduledActivityExperience(args: {
    userId: string;
    previousBlock: Block;
    nextBlock: Block;
    existing?: ActivityExperience | null;
    now?: Date;
}) {
    if (resolveBlockRequiresFocusMode(args.previousBlock) || !resolveBlockGeneratesExperienceRecord(args.previousBlock)) {
        return null;
    }

    const previousStart = args.previousBlock.startAt.getTime();
    const nextStart = args.nextBlock.startAt.getTime();
    const diffMinutes = Math.abs(Math.round((nextStart - previousStart) / MINUTE_MS));

    if (diffMinutes < 30) return null;

    const nowIso = (args.now ?? new Date()).toISOString();
    return {
        id: args.existing?.id ?? crypto.randomUUID(),
        experienceKey: getActivityExperienceKey({
            source: "block",
            sourceBlockId: args.previousBlock.id,
        }),
        userId: args.userId,
        sourceBlockId: args.previousBlock.id,
        sourceFocusSessionId: null,
        titleSnapshot: args.previousBlock.title,
        blockTypeSnapshot: args.previousBlock.type,
        tagSnapshot: args.previousBlock.tag ?? null,
        engagementMode: resolveBlockEngagementMode(args.previousBlock),
        outcome: nextStart > previousStart ? "rescheduled" : "postponed",
        source: "calendar",
        scheduledStart: args.previousBlock.startAt.toISOString(),
        scheduledEnd: args.previousBlock.endAt.toISOString(),
        actualStart: args.nextBlock.startAt.toISOString(),
        actualEnd: args.nextBlock.endAt.toISOString(),
        actualDurationMin: Math.round((args.nextBlock.endAt.getTime() - args.nextBlock.startAt.getTime()) / MINUTE_MS),
        energyImpact: "unknown",
        cognitiveLoad: resolveBlockCognitiveLoad(args.previousBlock),
        perceivedValue: "unknown",
        socialDemand: resolveBlockSocialDemand(args.previousBlock),
        outcomeReason: "calendar_conflict",
        locationMode: resolveBlockLocationMode(args.previousBlock),
        presenceMode: resolveBlockPresenceMode(args.previousBlock),
        wasPlanned: true,
        wasCompletedAsPlanned: false,
        wasUserConfirmed: false,
        wasSystemInferred: true,
        confidence: 0.76,
        notes: null,
        metadataJson: {
            previousStart: args.previousBlock.startAt.toISOString(),
            previousEnd: args.previousBlock.endAt.toISOString(),
            nextStart: args.nextBlock.startAt.toISOString(),
            nextEnd: args.nextBlock.endAt.toISOString(),
        },
        createdAt: args.existing?.createdAt ?? nowIso,
        updatedAt: nowIso,
    } satisfies ActivityExperience;
}

export function applyCheckoutToExperience(
    experience: ActivityExperience,
    checkout: ActivityExperienceCheckoutInput,
): ActivityExperience {
    const actualDurationMin = experience.actualDurationMin ?? (
        experience.actualStart && experience.actualEnd
            ? Math.max(0, Math.round((new Date(experience.actualEnd).getTime() - new Date(experience.actualStart).getTime()) / MINUTE_MS))
            : null
    );

    return {
        ...experience,
        outcome: checkout.outcome,
        energyImpact: checkout.energyImpact ?? experience.energyImpact,
        perceivedValue: checkout.perceivedValue ?? experience.perceivedValue,
        cognitiveLoad: checkout.cognitiveLoad ?? experience.cognitiveLoad,
        outcomeReason: checkout.outcomeReason ?? experience.outcomeReason,
        notes: checkout.notes ?? experience.notes,
        wasUserConfirmed: true,
        wasSystemInferred: false,
        source: experience.source === "focus" ? "hybrid" : "manual",
        confidence: 0.96,
        actualDurationMin,
        wasCompletedAsPlanned: checkout.outcome === "completed" || checkout.outcome === "attended",
        updatedAt: new Date().toISOString(),
    };
}

export function computeEnergyImpactScore(impact: EnergyImpact) {
    switch (impact) {
        case "restorative":
            return 1;
        case "energizing":
            return 0.65;
        case "neutral":
            return 0;
        case "demanding":
            return -0.45;
        case "draining":
            return -1;
        default:
            return 0;
    }
}

export function computeCognitiveLoadWeight(load: CognitiveLoad) {
    switch (load) {
        case "high":
            return 1;
        case "medium":
            return 0.65;
        case "low":
            return 0.35;
        default:
            return 0.45;
    }
}

export function getExperienceWindow(experience: Pick<ActivityExperience, "actualStart" | "scheduledStart">) {
    return resolveWindowFromDate(experience.actualStart ?? experience.scheduledStart ?? new Date());
}

export function isCompletionLikeOutcome(outcome: ActivityOutcome) {
    return ["completed", "partial", "attended", "joined_late", "left_early"].includes(outcome);
}

export function isAttendanceLikeEngagement(engagementMode: EngagementMode) {
    return engagementMode === "passive_attendance" || engagementMode === "collaborative";
}

export function matchesBlockType(engagementMode: EngagementMode, blockType: BlockType | undefined) {
    if (!blockType) return false;
    if (engagementMode === "deep_focus") return blockType === "deep_work" || blockType === "study";
    if (engagementMode === "collaborative") return blockType === "meeting";
    if (engagementMode === "movement") return blockType === "gym";
    if (engagementMode === "recovery") return blockType === "break";
    return true;
}

export function computeExperienceConfidenceDecay(experience: ActivityExperience) {
    const ageDays = (Date.now() - new Date(experience.updatedAt).getTime()) / (24 * 60 * 60 * 1000);
    return clampUnit((experience.confidence ?? 0.5) * Math.max(0.4, 1 - (ageDays / 90)));
}
