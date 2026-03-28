import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import { fetchRecentActivityExperiences } from "@/lib/server/activityExperience";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const language = await getServerLanguage();
        const copy = language === "es"
            ? {
                unauthorized: "No autorizado",
                dateRequired: "La fecha es obligatoria",
                loadError: "No se pudieron cargar las experiencias de actividad",
            }
            : {
                unauthorized: "Unauthorized",
                dateRequired: "date is required",
                loadError: "Failed to fetch activity experiences.",
            };

        if (!user) {
            return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
        }

        const date = request.nextUrl.searchParams.get("date");
        if (!date) {
            return NextResponse.json({ error: copy.dateRequired }, { status: 400 });
        }

        const experiences = await fetchRecentActivityExperiences(supabase, user.id, {
            startDate: date,
            endDate: date,
            limit: 120,
        });

        return NextResponse.json({ experiences });
    } catch (error) {
        const language = await getServerLanguage();
        const fallback = language === "es"
            ? "No se pudieron cargar las experiencias de actividad"
            : "Failed to fetch activity experiences.";
        const message = error instanceof Error ? error.message : fallback;
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
