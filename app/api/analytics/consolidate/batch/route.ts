import { NextRequest, NextResponse } from "next/server";
import { runPersonalIntelligenceBatchConsolidation } from "@/lib/server/personalIntelligence";
import { createAdminClient } from "@/lib/supabase/admin";

function isValidScope(value: unknown): value is "daily" | "weekly" {
    return value === "daily" || value === "weekly";
}

export async function POST(request: NextRequest) {
    const expectedSecret = process.env.PERSONAL_INTELLIGENCE_CRON_SECRET;
    const providedSecret = request.headers.get("x-agendo-cron-secret");

    if (!expectedSecret) {
        return NextResponse.json({ error: "Missing cron secret configuration." }, { status: 500 });
    }

    if (providedSecret !== expectedSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const scope = body?.scope ?? "daily";

    if (!isValidScope(scope)) {
        return NextResponse.json({ error: "Unknown consolidation scope." }, { status: 400 });
    }

    const userIds = Array.isArray(body?.userIds)
        ? body.userIds.filter((value: unknown): value is string => typeof value === "string")
        : undefined;
    const limit = typeof body?.limit === "number" ? body.limit : undefined;

    const supabase = createAdminClient();
    const result = await runPersonalIntelligenceBatchConsolidation(supabase, scope, {
        userIds,
        limit,
    });

    return NextResponse.json(result);
}
