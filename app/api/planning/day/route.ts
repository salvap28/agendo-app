import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlanningGuideData } from "@/lib/server/planning";

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const date = request.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    try {
        const guide = await getPlanningGuideData(supabase, user.id, {
            targetDate: date,
        });

        return NextResponse.json(guide);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unable to load day planning" },
            { status: 400 },
        );
    }
}
