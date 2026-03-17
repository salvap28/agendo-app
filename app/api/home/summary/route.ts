import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHomeSummaryData } from "@/lib/server/personalIntelligence";

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await getHomeSummaryData(supabase, user.id);
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unable to load home summary" },
            { status: 500 },
        );
    }
}
