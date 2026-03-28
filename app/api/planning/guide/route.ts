import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import { getPlanningGuideData } from "@/lib/server/planning";
import { PlanningPreferencesInput } from "@/lib/types/planning";

type GuidePayload = {
    date?: string;
    targetBlockId?: string;
    preferences?: PlanningPreferencesInput;
};

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const language = await getServerLanguage();
    const copy = language === "es"
        ? { unauthorized: "No autorizado", loadError: "No se pudo cargar la planificacion guiada" }
        : { unauthorized: "Unauthorized", loadError: "Unable to load guided planning" };

    if (!user) {
        return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
    }

    const payload = await request.json() as GuidePayload;
    const date = payload.date ?? new Date().toISOString().slice(0, 10);
    try {
        const guide = await getPlanningGuideData(supabase, user.id, {
            targetDate: date,
            targetBlockId: payload.targetBlockId,
            preferences: payload.preferences,
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
