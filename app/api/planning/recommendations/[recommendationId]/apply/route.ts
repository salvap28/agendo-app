import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import { applyPlanningRecommendation } from "@/lib/server/planning";

type RouteContext = {
    params: Promise<{
        recommendationId: string;
    }>;
};

export async function POST(_: Request, context: RouteContext) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const language = await getServerLanguage();
    const copy = language === "es"
        ? { unauthorized: "No autorizado", applyError: "No se pudo aplicar la recomendacion" }
        : { unauthorized: "Unauthorized", applyError: "Unable to apply recommendation" };

    if (!user) {
        return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
    }

    const { recommendationId: rawRecommendationId } = await context.params;
    const recommendationId = decodeURIComponent(rawRecommendationId);

    try {
        const result = await applyPlanningRecommendation(supabase, user.id, recommendationId, language);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : copy.applyError },
            { status: 400 },
        );
    }
}
