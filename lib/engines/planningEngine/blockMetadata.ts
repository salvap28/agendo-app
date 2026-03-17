import { Block, BlockFlexibility, BlockIntensity, BlockPriority } from "@/lib/types/blocks";
import { PlanningBlockSnapshot } from "@/lib/types/planning";

function clampDifficulty(value: number | undefined) {
    if (!value) return 3;
    return Math.max(1, Math.min(5, Math.round(value)));
}

function resolvePriority(block: Block): BlockPriority {
    if (block.priority) return block.priority;
    if (block.type === "deep_work" || block.type === "study") return 4;
    if (block.type === "meeting" || block.type === "admin") return 3;
    if (block.type === "break") return 1;
    return 2;
}

function resolveIntensity(block: Block, durationMinutes: number): BlockIntensity {
    if (block.intensity) return block.intensity;
    if (block.type === "deep_work" || block.type === "study") return durationMinutes >= 90 ? "high" : "medium";
    if (block.type === "meeting" || block.type === "gym") return "medium";
    if (block.type === "break") return "light";
    return durationMinutes >= 75 ? "medium" : "light";
}

function resolveFlexibility(block: Block): BlockFlexibility {
    if (block.flexibility) return block.flexibility;
    if (block.type === "meeting" || block.type === "gym") return "fixed";
    if (block.type === "break") return "flexible";
    return "moderate";
}

export function buildPlanningBlockSnapshot(block: Block): PlanningBlockSnapshot {
    const durationMinutes = Math.max(
        15,
        block.estimatedDurationMinutes ?? Math.round((block.endAt.getTime() - block.startAt.getTime()) / 60000)
    );
    const intensity = resolveIntensity(block, durationMinutes);
    const difficulty = clampDifficulty(block.difficulty ?? (
        intensity === "high" ? 4 : intensity === "medium" ? 3 : 2
    ));

    return {
        block,
        durationMinutes,
        priority: resolvePriority(block),
        difficulty,
        flexibility: resolveFlexibility(block),
        intensity,
        cognitivelyHeavy: block.cognitivelyHeavy ?? (intensity === "high" || block.type === "deep_work" || block.type === "study"),
        splittable: block.splittable ?? !["meeting", "gym", "break"].includes(block.type),
        optional: block.optional ?? false,
        deadlineIso: block.deadline?.toISOString() ?? null,
    };
}
