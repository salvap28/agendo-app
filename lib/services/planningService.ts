import { PlanningGuideResult, PlanningPreferencesInput, PlanningRecommendation } from "@/lib/types/planning";
import {
    PlannerApplyResult,
    PlannerProposal,
    PlannerProposalRevisionRequest,
    PlannerRequest,
    PlannerRevisionResult,
} from "@/lib/types/planner";

function parseGuide(payload: PlanningGuideResult): PlanningGuideResult {
    return payload;
}

function encodeRecommendationId(recommendationId: string) {
    return encodeURIComponent(recommendationId);
}

function hasString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

async function readJson<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error((payload as { error?: string }).error ?? "Request failed");
    }

    return response.json() as Promise<T>;
}

export async function fetchDayPlanning(date: string) {
    const response = await fetch(`/api/planning/day?date=${date}`);
    return parseGuide(await readJson<PlanningGuideResult>(response));
}

export async function fetchBlockPlanning(blockId: string, date: string) {
    const response = await fetch(`/api/planning/block/${blockId}?date=${date}`);
    return parseGuide(await readJson<PlanningGuideResult>(response));
}

export async function fetchGuidedPlanning(date: string, preferences?: PlanningPreferencesInput, targetBlockId?: string) {
    const response = await fetch("/api/planning/guide", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            date,
            targetBlockId,
            preferences,
        }),
    });

    return parseGuide(await readJson<PlanningGuideResult>(response));
}

export async function requestPlannerProposal(payload: PlannerRequest) {
    const response = await fetch("/api/planning/planner/propose", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    return readJson<PlannerProposal>(response);
}

export async function applyPlannerProposalRequest(proposal: PlannerProposal) {
    const response = await fetch("/api/planning/planner/apply", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ proposal }),
    });

    return readJson<PlannerApplyResult>(response);
}

export async function revisePlannerProposalRequest(payload: PlannerProposalRevisionRequest) {
    const response = await fetch("/api/planning/planner/decision", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    return readJson<PlannerRevisionResult>(response);
}

export async function dismissPlanningRecommendation(recommendationId: string) {
    const response = await fetch(`/api/planning/recommendations/${encodeRecommendationId(recommendationId)}/dismiss`, {
        method: "POST",
    });

    return readJson<{ recommendation: PlanningRecommendation | null }>(response);
}

export async function acceptPlanningRecommendation(recommendationId: string) {
    const response = await fetch(`/api/planning/recommendations/${encodeRecommendationId(recommendationId)}/accept`, {
        method: "POST",
    });

    return readJson<{ recommendation: PlanningRecommendation | null }>(response);
}

export async function applyPlanningRecommendation(recommendationId: string) {
    const response = await fetch(`/api/planning/recommendations/${encodeRecommendationId(recommendationId)}/apply`, {
        method: "POST",
    });

    return readJson<{
        recommendation: PlanningRecommendation | null;
        changedBlockIds: string[];
        createdBlockIds: string[];
    }>(response);
}

export function canApplyRecommendation(recommendation: PlanningRecommendation) {
    if (recommendation.applyability.mode !== "auto") return false;

    if (recommendation.suggestedAction.kind === "move") {
        return Boolean(
            recommendation.targetBlockId
            && hasString(recommendation.suggestedAction.payload.suggestedStart)
            && hasString(recommendation.suggestedAction.payload.suggestedEnd)
        );
    }

    if (
        recommendation.suggestedAction.kind === "shorten"
        || recommendation.suggestedAction.kind === "split"
        || recommendation.suggestedAction.kind === "mark_optional"
    ) {
        return Boolean(recommendation.targetBlockId);
    }

    if (recommendation.suggestedAction.kind === "insert_break") {
        return hasString(recommendation.suggestedAction.payload.suggestedStart);
    }

    return false;
}
