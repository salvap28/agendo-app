import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    fetchActivityExperienceForBlock,
    inferActivityExperienceForBlock,
    recordActivityCheckout,
    recordBlockRescheduleExperience,
} from "@/lib/server/activityExperience";
import { Block } from "@/lib/types/blocks";

type DbRow = Record<string, unknown>;

function asString(value: unknown, fallback = "") {
    return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
    return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
}

function asBoolean(value: unknown, fallback = false) {
    return typeof value === "boolean" ? value : fallback;
}

function mapBlockRow(row: DbRow): Block {
    return {
        id: asString(row.id),
        title: asString(row.title),
        type: asString(row.type) as Block["type"],
        status: asString(row.status) as Block["status"],
        startAt: new Date(asString(row.start_at)),
        endAt: new Date(asString(row.end_at)),
        notes: asNullableString(row.notes) ?? undefined,
        tag: asNullableString(row.tag) ?? undefined,
        color: asNullableString(row.color) ?? undefined,
        priority: row.priority == null ? undefined : asNumber(row.priority) as Block["priority"],
        estimatedDurationMinutes: row.estimated_duration_minutes == null ? undefined : asNumber(row.estimated_duration_minutes),
        difficulty: row.difficulty == null ? undefined : asNumber(row.difficulty),
        flexibility: (asNullableString(row.flexibility) ?? undefined) as Block["flexibility"],
        intensity: (asNullableString(row.intensity) ?? undefined) as Block["intensity"],
        deadline: asNullableString(row.deadline) ? new Date(asString(row.deadline)) : undefined,
        cognitivelyHeavy: row.cognitively_heavy == null ? undefined : asBoolean(row.cognitively_heavy),
        splittable: row.splittable == null ? undefined : asBoolean(row.splittable),
        optional: row.optional == null ? undefined : asBoolean(row.optional),
        engagementMode: (asNullableString(row.engagement_mode) ?? undefined) as Block["engagementMode"],
        requiresFocusMode: row.requires_focus_mode == null ? undefined : asBoolean(row.requires_focus_mode),
        generatesExperienceRecord: row.generates_experience_record == null ? undefined : asBoolean(row.generates_experience_record),
        socialDemandHint: (asNullableString(row.social_demand_hint) ?? undefined) as Block["socialDemandHint"],
        locationMode: (asNullableString(row.location_mode) ?? undefined) as Block["locationMode"],
        presenceMode: (asNullableString(row.presence_mode) ?? undefined) as Block["presenceMode"],
        notifications: Array.isArray(row.notifications) ? row.notifications as number[] : undefined,
        recurrenceId: asNullableString(row.recurrence_id) ?? undefined,
        recurrencePattern: (row.recurrence_pattern ?? undefined) as Block["recurrencePattern"],
    };
}

function hydrateBlockFromBody(row: Record<string, unknown>): Block {
    return {
        id: asString(row.id),
        title: asString(row.title),
        type: asString(row.type) as Block["type"],
        status: asString(row.status) as Block["status"],
        startAt: new Date(asString(row.startAt)),
        endAt: new Date(asString(row.endAt)),
        notes: asNullableString(row.notes) ?? undefined,
        tag: asNullableString(row.tag) ?? undefined,
        color: asNullableString(row.color) ?? undefined,
        priority: row.priority == null ? undefined : asNumber(row.priority) as Block["priority"],
        estimatedDurationMinutes: row.estimatedDurationMinutes == null ? undefined : asNumber(row.estimatedDurationMinutes),
        difficulty: row.difficulty == null ? undefined : asNumber(row.difficulty),
        flexibility: (asNullableString(row.flexibility) ?? undefined) as Block["flexibility"],
        intensity: (asNullableString(row.intensity) ?? undefined) as Block["intensity"],
        deadline: asNullableString(row.deadline) ? new Date(asString(row.deadline)) : undefined,
        cognitivelyHeavy: row.cognitivelyHeavy == null ? undefined : asBoolean(row.cognitivelyHeavy),
        splittable: row.splittable == null ? undefined : asBoolean(row.splittable),
        optional: row.optional == null ? undefined : asBoolean(row.optional),
        engagementMode: (asNullableString(row.engagementMode) ?? undefined) as Block["engagementMode"],
        requiresFocusMode: row.requiresFocusMode == null ? undefined : asBoolean(row.requiresFocusMode),
        generatesExperienceRecord: row.generatesExperienceRecord == null ? undefined : asBoolean(row.generatesExperienceRecord),
        socialDemandHint: (asNullableString(row.socialDemandHint) ?? undefined) as Block["socialDemandHint"],
        locationMode: (asNullableString(row.locationMode) ?? undefined) as Block["locationMode"],
        presenceMode: (asNullableString(row.presenceMode) ?? undefined) as Block["presenceMode"],
        notifications: Array.isArray(row.notifications) ? row.notifications as number[] : undefined,
        recurrenceId: asNullableString(row.recurrenceId) ?? undefined,
        recurrencePattern: (row.recurrencePattern ?? undefined) as Block["recurrencePattern"],
    };
}

async function fetchOwnedBlock(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, blockId: string) {
    const { data, error } = await supabase
        .from("blocks")
        .select("*")
        .eq("user_id", userId)
        .eq("id", blockId)
        .maybeSingle();

    if (error) throw error;
    return data ? mapBlockRow(data as DbRow) : null;
}

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ blockId: string }> },
) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { blockId } = await context.params;
        const experience = await fetchActivityExperienceForBlock(supabase, user.id, blockId);
        const block = await fetchOwnedBlock(supabase, user.id, blockId);
        return NextResponse.json({ experience, block });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load activity experience.";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ blockId: string }> },
) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const action = typeof body?.action === "string" ? body.action : "infer";
        const { blockId } = await context.params;

        if (action === "rescheduled") {
            if (!body?.previousBlock || !body?.nextBlock) {
                return NextResponse.json({ error: "previousBlock and nextBlock are required." }, { status: 400 });
            }

            const experience = await recordBlockRescheduleExperience(
                supabase,
                user.id,
                hydrateBlockFromBody(body.previousBlock),
                hydrateBlockFromBody(body.nextBlock),
            );

            return NextResponse.json({ experience });
        }

        const block = await fetchOwnedBlock(supabase, user.id, blockId);
        if (!block) {
            return NextResponse.json({ error: "Block not found." }, { status: 404 });
        }

        if (action === "checkout") {
            if (!body?.checkout || typeof body.checkout !== "object") {
                return NextResponse.json({ error: "checkout payload is required." }, { status: 400 });
            }

            const experience = await recordActivityCheckout(supabase, user.id, {
                block,
                checkout: body.checkout,
            });

            return NextResponse.json({ experience });
        }

        const experience = await inferActivityExperienceForBlock(supabase, user.id, block, {
            source: action === "manual" ? "manual" : "system_inferred",
            markUserConfirmed: action === "manual",
        });

        return NextResponse.json({ experience });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update activity experience.";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
