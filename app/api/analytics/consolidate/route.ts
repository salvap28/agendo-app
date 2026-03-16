import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    runDailyPersonalIntelligenceConsolidation,
    runWeeklyPersonalIntelligenceConsolidation,
    syncSessionPersonalIntelligence,
} from "@/lib/server/personalIntelligence";

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const scope = body?.scope ?? "session";

    if (scope === "session") {
        if (!body?.sessionId || typeof body.sessionId !== "string") {
            return NextResponse.json({ error: "sessionId is required for session scope." }, { status: 400 });
        }

        const result = await syncSessionPersonalIntelligence(supabase, user.id, body.sessionId);
        return NextResponse.json(result);
    }

    if (scope === "daily") {
        const result = await runDailyPersonalIntelligenceConsolidation(supabase, user.id);
        return NextResponse.json(result);
    }

    if (scope === "weekly") {
        const result = await runWeeklyPersonalIntelligenceConsolidation(supabase, user.id);
        return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown consolidation scope." }, { status: 400 });
}
