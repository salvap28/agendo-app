import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import { getHomeSummaryData } from "@/lib/server/personalIntelligence";

export async function GET() {
    let languageForError: "en" | "es" = "en";
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const language = await getServerLanguage();
        languageForError = language;
        const copy = language === "es"
            ? { unauthorized: "No autorizado", loadError: "No se pudo cargar el resumen del inicio" }
            : { unauthorized: "Unauthorized", loadError: "Unable to load home summary" };

        if (!user) {
            return NextResponse.json({ error: copy.unauthorized }, { status: 401 });
        }

        const data = await getHomeSummaryData(supabase, user.id, language);
        return NextResponse.json(data);
    } catch (error) {
        const fallback = languageForError === "es"
            ? "No se pudo cargar el resumen del inicio"
            : "Unable to load home summary";
        return NextResponse.json(
            { error: error instanceof Error ? error.message : fallback },
            { status: 500 },
        );
    }
}
