"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { createClient } from "@/lib/supabase/client";
import { GlassSwitch } from "@/components/ui/glass-switch";

const supabase = createClient();

export default function AppearanceTab() {
    const { settings, updateSetting, fetchSettings, isInitialized } = useSettingsStore();

    useEffect(() => {
        async function init() {
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
                <h1 className="text-3xl font-semibold mb-3">Apariencia y Rendimiento</h1>
                <p className="text-foreground/60 text-base">Personaliza el diseño y los recursos de Agendo.</p>
            </div>

            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-10">
                {/* Performance Mode Section */}
                <div className="flex flex-col gap-6">
                    <div className="flex justify-between items-center bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-base font-medium text-foreground/90">Modo Rendimiento</h3>
                            <p className="text-sm text-foreground/50 max-w-[85%]">
                                Desactiva animaciones dinámicas, difuminados y efectos de brillo intensos. Recomendado si la aplicación funciona lenta o consume mucha batería en tu dispositivo.
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
