import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlanningGuideData } from "@/lib/server/planning";

type RouteContext = {
    params: Promise<{
        blockId: string;
    }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { blockId } = await context.params;
    const date = request.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const guide = await getPlanningGuideData(supabase, user.id, {
        targetDate: date,
        targetBlockId: blockId,
    });

    return NextResponse.json(guide);
}
