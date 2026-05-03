import type { SupabaseClient } from "@supabase/supabase-js";
import type {
    PlannerContextBundle,
    PlannerDecisionRecord,
    PlannerDecisionType,
    PlannerInputRecord,
    PlannerProposal,
    PlannerProposalRecord,
    PlannerProposalStatus,
    PlannerProposalVariant,
    PlannerRequest,
    PlannerSessionRecord,
    PlannerSessionStatus,
    PlannerSurface,
} from "@/lib/types/planner";

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

function asObject(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function asPlannerContextBundle(value: unknown) {
    return asObject(value) as unknown as PlannerContextBundle;
}

function asPlannerInterpretation(value: unknown) {
    return asObject(value) as unknown as PlannerProposalRecord["interpretation"];
}

function asPlannerDrafts(value: unknown) {
    return Array.isArray(value)
        ? value as unknown as PlannerProposalRecord["drafts"]
        : [];
}

function mapSessionRow(row: DbRow): PlannerSessionRecord {
    return {
        id: asString(row.id),
        userId: asString(row.user_id),
        status: asString(row.status, "active") as PlannerSessionRecord["status"],
        surface: asString(row.surface, "unknown") as PlannerSurface,
        inputSource: asString(row.input_source, "text") as PlannerSessionRecord["inputSource"],
        targetDate: asString(row.target_date),
        latestContextBundle: asPlannerContextBundle(row.latest_context_bundle),
        latestInputId: asNullableString(row.latest_input_id),
        latestProposalId: asNullableString(row.latest_proposal_id),
        appliedProposalId: asNullableString(row.applied_proposal_id),
        appliedAt: asNullableString(row.applied_at),
        closedAt: asNullableString(row.closed_at),
        createdAt: asNullableString(row.created_at) ?? new Date().toISOString(),
        updatedAt: asNullableString(row.updated_at) ?? new Date().toISOString(),
    };
}

function mapInputRow(row: DbRow): PlannerInputRecord {
    return {
        id: asString(row.id),
        sessionId: asString(row.session_id),
        userId: asString(row.user_id),
        source: asString(row.source, "text") as PlannerInputRecord["source"],
        rawInput: asString(row.raw_input),
        normalizedInput: asNullableString(row.normalized_input),
        targetDate: asString(row.target_date),
        requestPayload: asObject(row.request_payload),
        createdAt: asNullableString(row.created_at) ?? new Date().toISOString(),
    };
}

function mapProposalRow(row: DbRow): PlannerProposalRecord {
    return {
        id: asString(row.id),
        sessionId: asString(row.session_id),
        inputId: asString(row.input_id),
        userId: asString(row.user_id),
        parentProposalId: asNullableString(row.parent_proposal_id),
        engine: asString(row.engine, "heuristic_v1") as PlannerProposalRecord["engine"],
        variant: asString(row.variant, "initial") as PlannerProposalVariant,
        status: asString(row.status, "active") as PlannerProposalStatus,
        headline: asString(row.headline),
        summary: asString(row.summary),
        targetDate: asString(row.target_date),
        contextBundle: asPlannerContextBundle(row.context_bundle),
        interpretation: asPlannerInterpretation(row.interpretation),
        drafts: asPlannerDrafts(row.drafts),
        totalDurationMin: asNumber(row.total_duration_min),
        explicitTimesCount: asNumber(row.explicit_times_count),
        guidedPlanningSuggested: asBoolean(row.guided_planning_suggested),
        createdAt: asNullableString(row.created_at) ?? new Date().toISOString(),
        updatedAt: asNullableString(row.updated_at) ?? new Date().toISOString(),
    };
}

function mapDecisionRow(row: DbRow): PlannerDecisionRecord {
    return {
        id: asString(row.id),
        sessionId: asString(row.session_id),
        userId: asString(row.user_id),
        proposalId: asNullableString(row.proposal_id),
        fromProposalId: asNullableString(row.from_proposal_id),
        toProposalId: asNullableString(row.to_proposal_id),
        decisionType: asString(row.decision_type) as PlannerDecisionType,
        payload: asObject(row.payload_json),
        createdAt: asNullableString(row.created_at) ?? new Date().toISOString(),
    };
}

export function hydratePlannerProposal(record: PlannerProposalRecord): PlannerProposal {
    return {
        sessionId: record.sessionId,
        inputId: record.inputId,
        proposalId: record.id,
        parentProposalId: record.parentProposalId,
        variant: record.variant,
        status: record.status,
        createdAt: record.createdAt,
        engine: record.engine,
        headline: record.headline,
        summary: record.summary,
        targetDate: record.targetDate,
        context: record.contextBundle,
        interpretation: record.interpretation,
        drafts: record.drafts,
        totalDurationMin: record.totalDurationMin,
        explicitTimesCount: record.explicitTimesCount,
        guidedPlanningSuggested: record.guidedPlanningSuggested,
    };
}

export async function createPlannerSession(args: {
    supabase: SupabaseClient;
    userId: string;
    request: PlannerRequest;
    context: PlannerContextBundle;
}): Promise<PlannerSessionRecord> {
    const { supabase, userId, request, context } = args;
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("planner_sessions")
        .insert({
            user_id: userId,
            status: "active",
            surface: request.surface ?? "unknown",
            input_source: request.source,
            target_date: context.targetDate,
            latest_context_bundle: context,
            created_at: now,
            updated_at: now,
        })
        .select("*")
        .single();

    if (error) throw error;
    return mapSessionRow(data as DbRow);
}

export async function createPlannerInput(args: {
    supabase: SupabaseClient;
    userId: string;
    sessionId: string;
    request: PlannerRequest;
    targetDate: string;
}): Promise<PlannerInputRecord> {
    const { supabase, userId, sessionId, request, targetDate } = args;
    const { data, error } = await supabase
        .from("planner_inputs")
        .insert({
            session_id: sessionId,
            user_id: userId,
            source: request.source,
            raw_input: request.input,
            normalized_input: request.input.trim(),
            target_date: targetDate,
            request_payload: {
                source: request.source,
                targetDate: request.targetDate ?? null,
                timezone: request.timezone ?? null,
                nowIso: request.nowIso ?? null,
                surface: request.surface ?? null,
            },
        })
        .select("*")
        .single();

    if (error) throw error;

    const input = mapInputRow(data as DbRow);
    const { error: sessionError } = await supabase
        .from("planner_sessions")
        .update({
            latest_input_id: input.id,
            updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("user_id", userId);

    if (sessionError) throw sessionError;
    return input;
}

export async function createPlannerProposalRecord(args: {
    supabase: SupabaseClient;
    userId: string;
    sessionId: string;
    inputId: string;
    proposal: PlannerProposal;
    parentProposalId?: string | null;
    variant?: PlannerProposalVariant;
    status?: PlannerProposalStatus;
}): Promise<PlannerProposalRecord> {
    const {
        supabase,
        userId,
        sessionId,
        inputId,
        proposal,
        parentProposalId = null,
        variant = "initial",
        status = "active",
    } = args;

    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("planner_proposals")
        .insert({
            session_id: sessionId,
            input_id: inputId,
            user_id: userId,
            parent_proposal_id: parentProposalId,
            engine: proposal.engine,
            variant,
            status,
            headline: proposal.headline,
            summary: proposal.summary,
            target_date: proposal.targetDate,
            context_bundle: proposal.context,
            interpretation: proposal.interpretation,
            drafts: proposal.drafts,
            total_duration_min: proposal.totalDurationMin,
            explicit_times_count: proposal.explicitTimesCount,
            guided_planning_suggested: proposal.guidedPlanningSuggested,
            created_at: now,
            updated_at: now,
        })
        .select("*")
        .single();

    if (error) throw error;

    const record = mapProposalRow(data as DbRow);
    const { error: sessionError } = await supabase
        .from("planner_sessions")
        .update({
            latest_proposal_id: record.id,
            latest_context_bundle: proposal.context,
            updated_at: now,
        })
        .eq("id", sessionId)
        .eq("user_id", userId);

    if (sessionError) throw sessionError;
    return record;
}

export async function fetchPlannerProposalRecord(
    supabase: SupabaseClient,
    userId: string,
    proposalId: string,
): Promise<PlannerProposalRecord | null> {
    const { data, error } = await supabase
        .from("planner_proposals")
        .select("*")
        .eq("id", proposalId)
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw error;
    return data ? mapProposalRow(data as DbRow) : null;
}

export async function recordPlannerDecision(args: {
    supabase: SupabaseClient;
    userId: string;
    sessionId: string;
    proposalId?: string | null;
    fromProposalId?: string | null;
    toProposalId?: string | null;
    decisionType: PlannerDecisionType;
    payload?: Record<string, unknown>;
}): Promise<PlannerDecisionRecord> {
    const {
        supabase,
        userId,
        sessionId,
        proposalId = null,
        fromProposalId = null,
        toProposalId = null,
        decisionType,
        payload = {},
    } = args;

    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("planner_decisions")
        .insert({
            session_id: sessionId,
            user_id: userId,
            proposal_id: proposalId,
            from_proposal_id: fromProposalId,
            to_proposal_id: toProposalId,
            decision_type: decisionType,
            payload_json: payload,
            created_at: now,
        })
        .select("*")
        .single();

    if (error) throw error;

    const decision = mapDecisionRow(data as DbRow);

    if (decisionType === "proposal_lightened" || decisionType === "proposal_regenerated" || decisionType === "proposal_edited") {
        if (fromProposalId) {
            const { error: fromError } = await supabase
                .from("planner_proposals")
                .update({ status: "superseded", updated_at: now })
                .eq("id", fromProposalId)
                .eq("user_id", userId);
            if (fromError) throw fromError;
        }
        if (toProposalId) {
            const { error: toError } = await supabase
                .from("planner_proposals")
                .update({ status: "active", updated_at: now })
                .eq("id", toProposalId)
                .eq("user_id", userId);
            if (toError) throw toError;
        }
        const { error: sessionError } = await supabase
            .from("planner_sessions")
            .update({
                latest_proposal_id: toProposalId,
                updated_at: now,
            })
            .eq("id", sessionId)
            .eq("user_id", userId);
        if (sessionError) throw sessionError;
    }

    if (decisionType === "proposal_accepted" && proposalId) {
        const { error: proposalError } = await supabase
            .from("planner_proposals")
            .update({ status: "accepted", updated_at: now })
            .eq("id", proposalId)
            .eq("user_id", userId);
        if (proposalError) throw proposalError;
    }

    if (decisionType === "proposal_rejected") {
        if (proposalId) {
            const { error: proposalError } = await supabase
                .from("planner_proposals")
                .update({ status: "rejected", updated_at: now })
                .eq("id", proposalId)
                .eq("user_id", userId);
            if (proposalError) throw proposalError;
        }
        const { error: sessionError } = await supabase
            .from("planner_sessions")
            .update({
                status: "rejected" satisfies PlannerSessionStatus,
                closed_at: now,
                updated_at: now,
            })
            .eq("id", sessionId)
            .eq("user_id", userId);
        if (sessionError) throw sessionError;
    }

    if (decisionType === "plan_applied" && proposalId) {
        const { error: proposalError } = await supabase
            .from("planner_proposals")
            .update({ status: "applied", updated_at: now })
            .eq("id", proposalId)
            .eq("user_id", userId);
        if (proposalError) throw proposalError;

        const { error: sessionError } = await supabase
            .from("planner_sessions")
            .update({
                status: "applied" satisfies PlannerSessionStatus,
                applied_proposal_id: proposalId,
                applied_at: now,
                closed_at: now,
                updated_at: now,
            })
            .eq("id", sessionId)
            .eq("user_id", userId);
        if (sessionError) throw sessionError;
    }

    return decision;
}

export async function linkPlannerAppliedBlocks(args: {
    supabase: SupabaseClient;
    userId: string;
    sessionId: string;
    proposalId: string;
    decisionId: string | null;
    blockIds: string[];
}) {
    if (args.blockIds.length === 0) return;
    const rows = args.blockIds.map((blockId) => ({
        session_id: args.sessionId,
        proposal_id: args.proposalId,
        decision_id: args.decisionId,
        user_id: args.userId,
        block_id: blockId,
    }));

    const { error } = await args.supabase.from("planner_applied_blocks").insert(rows);
    if (error) throw error;
}
