import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import { patchHabitPreferences, recordHabitEvent } from "@/lib/server/habit";
import type { HabitPreferences } from "@/lib/types/habit";

const ALLOWED_FIELDS: Array<keyof HabitPreferences> = [
    "primaryUseCase",
    "hardestStartMoment",
    "desiredHelp",
    "primaryUseCaseSelections",
    "hardestStartMomentSelections",
    "desiredHelpSelections",
    "onboardingCompletedAt",
    "firstMeaningfulActionAt",
    "lastMeaningfulActionAt",
];

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

        const body = await request.json();
        const patch: Partial<HabitPreferences> = {};
        for (const key of ALLOWED_FIELDS) {
            if (key in body) {
                (patch as Record<string, unknown>)[key] = body[key];
            }
        }

        await patchHabitPreferences(supabase, user.id, patch);

        if (typeof body.eventName === "string") {
            await recordHabitEvent(supabase, user.id, {
                name: body.eventName,
                metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : undefined,
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : (language === "es" ? "No se pudo guardar el onboarding" : "Unable to save onboarding"),
            },
            { status: 500 },
        );
    }
}
