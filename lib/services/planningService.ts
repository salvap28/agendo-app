import { PlanningGuideResult, PlanningPreferencesInput, PlanningRecommendation } from "@/lib/types/planning";

function parseGuide(payload: PlanningGuideResult): PlanningGuideResult {
    return payload;
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

export async function dismissPlanningRecommendation(recommendationId: string) {
    const response = await fetch(`/api/planning/recommendations/${recommendationId}/dismiss`, {
        method: "POST",
    });

    return readJson<{ recommendation: PlanningRecommendation | null }>(response);
}

export async function acceptPlanningRecommendation(recommendationId: string) {
    const response = await fetch(`/api/planning/recommendations/${recommendationId}/accept`, {
        method: "POST",
    });

    return readJson<{ recommendation: PlanningRecommendation | null }>(response);
}

export async function applyPlanningRecommendation(recommendationId: string) {
    const response = await fetch(`/api/planning/recommendations/${recommendationId}/apply`, {
        method: "POST",
    });

    return readJson<{
        recommendation: PlanningRecommendation | null;
        changedBlockIds: string[];
        createdBlockIds: string[];
    }>(response);
}

export function canApplyRecommendation(recommendation: PlanningRecommendation) {
    return recommendation.applyability.mode === "auto";
}
