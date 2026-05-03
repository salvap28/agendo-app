import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import type { PlannerProposal } from "@/lib/types/planner";
import { applyPlannerProposal } from "@/lib/server/planner";

type ApplyPayload = {
    proposal?: PlannerProposal;
};

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const language = await getServerLanguage();
    const copy = language === "es"
        ? {
            unauthorized: "No autorizado",
            invalidPayload: "Falta la propuesta para aplicar",
            applyError: "No se pudo aplicar la propuesta de planning",
        }
        : {
            unauthorized: "Unauthorized",
            invalidPayload: "Missing proposal to apply",
            applyError: "Unable to apply the planning proposal",
        };

    if (!user) {
        return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
    }

    const payload = await request.json() as ApplyPayload;
    if (!payload?.proposal) {
        return NextResponse.json({ error: copy.invalidPayload }, { status: 400 });
    }

    try {
        const result = await applyPlannerProposal(supabase, user.id, payload.proposal);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : copy.applyError },
            { status: 400 },
        );
    }
}
