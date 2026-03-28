import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import { getPlanningGuideData } from "@/lib/server/planning";

type RouteContext = {
    params: Promise<{
        blockId: string;
    }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const language = await getServerLanguage();
    const copy = language === "es"
        ? { unauthorized: "No autorizado", loadError: "No se pudo cargar la planificacion del bloque" }
        : { unauthorized: "Unauthorized", loadError: "Unable to load block planning" };

    if (!user) {
        return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
    }

    const { blockId } = await context.params;
    const date = request.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    try {
        const guide = await getPlanningGuideData(supabase, user.id, {
            targetDate: date,
            targetBlockId: blockId,
            language,
        });

        return NextResponse.json(guide);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : copy.loadError },
            { status: 400 },
        );
    }
}
