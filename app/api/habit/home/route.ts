import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import { getHabitHomeData } from "@/lib/server/habit";

export async function GET() {
    const language = await getServerLanguage();
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: language === "es" ? "No autorizado" : "Unauthorized" },
                { status: 401 },
            );
        }

        const data = await getHabitHomeData(supabase, user.id, language);
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : (language === "es" ? "No se pudo cargar la direccion del dia" : "Unable to load habit home"),
            },
            { status: 500 },
        );
    }
}
