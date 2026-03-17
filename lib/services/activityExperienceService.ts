import { ActivityExperience, ActivityExperienceCheckoutInput } from "@/lib/types/activity";
import { Block } from "@/lib/types/blocks";

async function readJson<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error((payload as { error?: string }).error ?? "Request failed");
    }

    return response.json() as Promise<T>;
}

function buildActivityApiUrl(path: string) {
    if (typeof window !== "undefined" && window.location?.origin) {
        return new URL(path, window.location.origin).toString();
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        ?? process.env.NEXT_PUBLIC_SITE_URL
        ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

    return baseUrl ? new URL(path, baseUrl).toString() : path;
}

export async function fetchDayActivityExperiences(date: string) {
    const response = await fetch(buildActivityApiUrl(`/api/activity/day?date=${date}`));
    return readJson<{ experiences: ActivityExperience[] }>(response);
}

export async function fetchBlockActivityExperience(blockId: string) {
    const response = await fetch(buildActivityApiUrl(`/api/activity/block/${encodeURIComponent(blockId)}`));
    return readJson<{ experience: ActivityExperience | null; block: Block | null }>(response);
}

export async function inferBlockActivityExperience(blockId: string) {
    const response = await fetch(buildActivityApiUrl(`/api/activity/block/${encodeURIComponent(blockId)}`), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "infer" }),
    });

    return readJson<{ experience: ActivityExperience | null }>(response);
}

export async function recordBlockActivityCheckout(blockId: string, checkout: ActivityExperienceCheckoutInput) {
    const response = await fetch(buildActivityApiUrl(`/api/activity/block/${encodeURIComponent(blockId)}`), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            action: "checkout",
            checkout,
        }),
    });

    return readJson<{ experience: ActivityExperience | null }>(response);
}

export async function recordBlockRescheduleActivity(previousBlock: Block, nextBlock: Block) {
    const response = await fetch(buildActivityApiUrl(`/api/activity/block/${encodeURIComponent(previousBlock.id)}`), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            action: "rescheduled",
            previousBlock: {
                ...previousBlock,
                startAt: previousBlock.startAt.toISOString(),
                endAt: previousBlock.endAt.toISOString(),
                deadline: previousBlock.deadline?.toISOString() ?? null,
            },
            nextBlock: {
                ...nextBlock,
                startAt: nextBlock.startAt.toISOString(),
                endAt: nextBlock.endAt.toISOString(),
                deadline: nextBlock.deadline?.toISOString() ?? null,
            },
        }),
    });

    return readJson<{ experience: ActivityExperience | null }>(response);
}
