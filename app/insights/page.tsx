import { redirect } from "next/navigation";
import { InsightsDashboard } from "@/components/insights/InsightsDashboard";
import { getInsightsDashboardData } from "@/lib/server/personalIntelligence";
import { getServerLanguage } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function InsightsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const language = await getServerLanguage();
    const data = await getInsightsDashboardData(supabase, user.id, language);
    return <InsightsDashboard data={data} language={language} />;
}
