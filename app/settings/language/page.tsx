"use client";

import { useEffect } from "react";
import { Languages } from "lucide-react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { tryCreateClient } from "@/lib/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/client";
import type { AppLanguage } from "@/lib/i18n/messages";

export default function LanguageTab() {
    const { settings, updateSetting, fetchSettings, isInitialized } = useSettingsStore();
    const { t } = useI18n();

    useEffect(() => {
        async function init() {
            const supabase = tryCreateClient();
            if (!supabase) return;

            if (!isInitialized) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user?.id) {
                    await fetchSettings(session.user.id);
                }
            }
        }
        init();
    }, [isInitialized, fetchSettings]);

    return (
        <div suppressHydrationWarning className="flex flex-col gap-8 w-full max-w-2xl">
            <div>
                <h1 className="text-3xl font-semibold mb-3">{t.settingsLanguage.title}</h1>
                <p className="text-foreground/60 text-base">{t.settingsLanguage.description}</p>
            </div>

            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-8">
                <div className="flex items-start gap-4 rounded-2xl border border-white/5 bg-black/20 p-6">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5">
                        <Languages className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-3">
                        <div>
                            <h3 className="text-base font-medium text-foreground/90">{t.settingsLanguage.sectionTitle}</h3>
                            <p className="mt-1 text-sm text-foreground/50">{t.settingsLanguage.sectionDescription}</p>
                        </div>

                        <Select
                            value={settings.language}
                            onValueChange={(value) => updateSetting('language', value as AppLanguage)}
                        >
                            <SelectTrigger className="w-full bg-black/20 border-white/10 h-12 rounded-xl text-foreground">
                                <SelectValue placeholder={t.settingsLanguage.title} />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0a0b12] border border-white/10 text-foreground">
                                <SelectItem value="en">{t.settingsLanguage.english}</SelectItem>
                                <SelectItem value="es">{t.settingsLanguage.spanish}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-black/20 p-6">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-primary">{t.settingsLanguage.noteTitle}</h4>
                    <p className="mt-3 text-sm leading-7 text-foreground/60">{t.settingsLanguage.noteBody}</p>
                </div>
            </div>
        </div>
    );
}
