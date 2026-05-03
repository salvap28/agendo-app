import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import type { PlannerProposalRevisionRequest } from "@/lib/types/planner";
import { revisePlannerProposal } from "@/lib/server/planner";

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const language = await getServerLanguage();
    const copy = language === "es"
        ? {
            unauthorized: "No autorizado",
            invalidPayload: "Faltan datos para registrar la decision del planner",
            decisionError: "No se pudo registrar la decision del planner",
        }
        : {
            unauthorized: "Unauthorized",
            invalidPayload: "Missing planner decision payload",
            decisionError: "Unable to register the planner decision",
        };

    if (!user) {
        return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
    }

    const payload = await request.json() as PlannerProposalRevisionRequest;
    if (!payload?.sessionId || !payload?.proposalId || !payload?.action) {
        return NextResponse.json({ error: copy.invalidPayload }, { status: 400 });
    }

    try {
        const result = await revisePlannerProposal(supabase, user.id, payload, language);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : copy.decisionError },
            { status: 400 },
        );
    }
}
