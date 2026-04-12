import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import { recordHabitEvent } from "@/lib/server/habit";

export async function POST(request: NextRequest) {
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

        const payload = await request.json();
        if (!payload?.name || typeof payload.name !== "string") {
            return NextResponse.json(
                { error: language === "es" ? "Falta el nombre del evento" : "Missing event name" },
                { status: 400 },
            );
        }

        await recordHabitEvent(supabase, user.id, payload);
        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : (language === "es" ? "No se pudo registrar el evento" : "Unable to record event"),
            },
            { status: 500 },
        );
    }
}
