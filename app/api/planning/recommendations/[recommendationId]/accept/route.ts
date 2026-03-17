import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateRecommendationStatus } from "@/lib/server/planning";

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

    const { recommendationId: rawRecommendationId } = await context.params;
    const recommendationId = decodeURIComponent(rawRecommendationId);
    try {
        const recommendation = await updateRecommendationStatus(supabase, user.id, recommendationId, "accepted");
        return NextResponse.json({ recommendation });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unable to accept recommendation" },
            { status: 400 },
        );
    }
}
