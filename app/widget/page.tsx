import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/lib/i18n/server";
import { getHabitHomeData } from "@/lib/server/habit";
import { WidgetViewTracker } from "@/components/habit/WidgetViewTracker";

export default async function WidgetPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const language = await getServerLanguage();
    const data = await getHabitHomeData(supabase, user.id, language);
    const widget = data.habit.widget;

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#04060d] px-4 text-white">
            <WidgetViewTracker />
            <div className="w-full max-w-sm rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,24,0.96),rgba(6,8,16,0.98))] p-6 shadow-[0_28px_80px_-42px_rgba(0,0,0,0.72)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    {language === "es" ? "Widget" : "Widget"}
                </p>
                <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white/92">
                    {widget.title}
                </h1>
                <p className="mt-3 text-sm leading-7 text-white/55">
                    {widget.body}
                </p>
                <Link
                    href={widget.deepLink}
                    className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-[18px] bg-gradient-to-r from-[#79c2ff] via-[#7dd3fc] to-[#6ee7b7] px-5 text-sm font-semibold text-slate-950"
                >
                    {widget.ctaLabel}
                </Link>
            </div>
        </main>
    );
}
