import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import type { PlannerRequest } from "@/lib/types/planner";
import { getPlannerProposal } from "@/lib/server/planner";

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const language = await getServerLanguage();
    const copy = language === "es"
        ? {
            unauthorized: "No autorizado",
            invalidPayload: "Falta el texto para planear",
            loadError: "No se pudo armar la propuesta de planning",
        }
        : {
            unauthorized: "Unauthorized",
            invalidPayload: "Missing planner input",
            loadError: "Unable to build the planning proposal",
        };

    if (!user) {
        return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
    }

    const payload = await request.json() as PlannerRequest;
    if (!payload?.input || typeof payload.input !== "string") {
        return NextResponse.json({ error: copy.invalidPayload }, { status: 400 });
    }

    try {
        const proposal = await getPlannerProposal(supabase, user.id, payload, language);
        return NextResponse.json(proposal);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : copy.loadError },
            { status: 400 },
        );
    }
}
