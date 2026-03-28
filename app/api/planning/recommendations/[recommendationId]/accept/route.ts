import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import { updateRecommendationStatus } from "@/lib/server/planning";

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
        ? { unauthorized: "No autorizado", acceptError: "No se pudo aceptar la recomendacion" }
        : { unauthorized: "Unauthorized", acceptError: "Unable to accept recommendation" };

    if (!user) {
        return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
    }

    const { recommendationId: rawRecommendationId } = await context.params;
    const recommendationId = decodeURIComponent(rawRecommendationId);
    try {
        const recommendation = await updateRecommendationStatus(supabase, user.id, recommendationId, "accepted", language);
        return NextResponse.json({ recommendation });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : copy.acceptError },
            { status: 400 },
        );
    }
}
