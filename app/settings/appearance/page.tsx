"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { tryCreateClient } from "@/lib/supabase/client";
import { GlassSwitch } from "@/components/ui/glass-switch";
import { useI18n } from "@/lib/i18n/client";

export default function AppearanceTab() {
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
        <div suppressHydrationWarning className="flex flex-col gap-8 w-full">
            <div>
                <h1 className="text-3xl font-semibold mb-3">{t.settingsAppearance.title}</h1>
                <p className="text-foreground/60 text-base">{t.settingsAppearance.description}</p>
            </div>

            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-10">
                <div className="flex flex-col gap-6">
                    <div className="flex justify-between items-center bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-base font-medium text-foreground/90">{t.settingsAppearance.performanceMode}</h3>
                            <p className="text-sm text-foreground/50 max-w-[85%]">
                                {t.settingsAppearance.performanceModeDescription}
                            </p>
                        </div>

                        <GlassSwitch
                            checked={settings.performance_mode}
                            onCheckedChange={(val) => updateSetting('performance_mode', val)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
