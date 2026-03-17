import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyPlanningRecommendation } from "@/lib/server/planning";

type RouteContext = {
    params: Promise<{
        recommendationId: string;
    }>;
};

export async function POST(_: Request, context: RouteContext) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recommendationId } = await context.params;

    try {
        const result = await applyPlanningRecommendation(supabase, user.id, recommendationId);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unable to apply recommendation" },
            { status: 400 },
        );
    }
}
