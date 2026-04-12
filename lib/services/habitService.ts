import type {
    HabitEventPayload,
    HabitHomeData,
    HabitPreferences,
} from "@/lib/types/habit";

type HabitHomeResponse = {
    summary: {
        momentum_current: number;
        momentum_delta_week: number;
        main_insight: string;
        progress_signal: "positive" | "quiet" | "neutral";
        soft_recommendation: string;
        profile_calibration_progress: number;
        focus_streak: number;
        weekly_sessions_count: number;
        best_focus_window: "morning" | "afternoon" | "evening" | "night" | null;
    };
    habit: HabitHomeData;
};

async function readJson<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error((payload as { error?: string }).error ?? "Request failed");
    }

    return response.json() as Promise<T>;
}

export async function fetchHabitHome() {
    const response = await fetch("/api/habit/home", { cache: "no-store" });
    return readJson<HabitHomeResponse>(response);
}

export async function saveHabitOnboarding(payload: Partial<HabitPreferences> & {
    eventName?: string;
    metadata?: Record<string, unknown>;
}) {
    const response = await fetch("/api/habit/onboarding", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    return readJson<{ ok: boolean }>(response);
}

export async function trackHabitEvent(payload: HabitEventPayload) {
    const body = JSON.stringify(payload);

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        const queued = navigator.sendBeacon("/api/habit/events", blob);
        if (queued) return { ok: true };
    }

    const response = await fetch("/api/habit/events", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body,
        keepalive: true,
    });

    return readJson<{ ok: boolean }>(response);
}
