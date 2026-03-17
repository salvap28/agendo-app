import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchRecentActivityExperiences } from "@/lib/server/activityExperience";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const date = request.nextUrl.searchParams.get("date");
        if (!date) {
            return NextResponse.json({ error: "date is required" }, { status: 400 });
        }

        const experiences = await fetchRecentActivityExperiences(supabase, user.id, {
            startDate: date,
            endDate: date,
            limit: 120,
        });

        return NextResponse.json({ experiences });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch activity experiences.";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
