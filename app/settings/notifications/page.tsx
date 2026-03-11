"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { createClient } from "@/lib/supabase/client";
import { GlassSwitch } from "@/components/ui/glass-switch";

const supabase = createClient();

export default function NotificationsTab() {
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
                <h1 className="text-3xl font-semibold mb-3">Notificaciones</h1>
                <p className="text-foreground/60 text-base">Decidí cómo y cuándo querés que Agendo te avise.</p>
            </div>

            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-10">

                <div className="flex flex-col gap-6">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Avisos del Calendario</h3>

                    <div className="flex justify-between items-center bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-base font-medium text-foreground/90">Recordatorios de Bloques</h3>
                            <p className="text-sm text-foreground/50 max-w-[85%]">
                                Recibir notificaciones sutiles poco antes de que empiece un bloque en tu calendario.
                            </p>
                        </div>
                        <GlassSwitch
                            checked={settings.notify_block_reminders}
                            onCheckedChange={(val) => updateSetting('notify_block_reminders', val)}
                        />
                    </div>
                </div>

                <div className="w-full h-px bg-white/5"></div>

                <div className="flex flex-col gap-6">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Foco y Gimnasio</h3>

                    <div className="flex justify-between items-center bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-base font-medium text-foreground/90">Cronómetro de Foco</h3>
                            <p className="text-sm text-foreground/50 max-w-[85%]">
                                Alertas al terminar una sesión de concentración o descanso activo.
                            </p>
                        </div>
                        <GlassSwitch
                            checked={settings.notify_focus_timer}
                            onCheckedChange={(val) => updateSetting('notify_focus_timer', val)}
                        />
                    </div>

                    <div className="flex justify-between items-center bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-base font-medium text-foreground/90">Descanso de Series (Gym)</h3>
                            <p className="text-sm text-foreground/50 max-w-[85%]">
                                Avisos para informarte que finalizó tu tiempo de descanso y debes empezar la próxima serie.
                            </p>
                        </div>
                        <GlassSwitch
                            checked={settings.notify_gym_rest}
                            onCheckedChange={(val) => updateSetting('notify_gym_rest', val)}
                        />
                    </div>
                </div>

                <div className="w-full h-px bg-white/5"></div>

                <div className="flex flex-col gap-6">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Hábitos y Resúmenes</h3>

                    <div className="flex justify-between items-center bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-base font-medium text-foreground/90">Daily Briefing</h3>
                            <p className="text-sm text-foreground/50 max-w-[85%]">
                                Recibe un resumen por la mañana con tus bloques y tareas más importantes del día.
                            </p>
                        </div>
                        <GlassSwitch
                            checked={settings.notify_daily_briefing}
                            onCheckedChange={(val) => updateSetting('notify_daily_briefing', val)}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}
