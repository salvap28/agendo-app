"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { createClient } from "@/lib/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassSwitch } from "@/components/ui/glass-switch";

const supabase = createClient();

export default function PreferencesTab() {
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
                <h1 className="text-3xl font-semibold mb-3">Preferencias</h1>
                <p className="text-foreground/60 text-base">Configura cómo funciona Agendo por defecto.</p>
            </div>

            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-10">

                {/* Calendar Preferences */}
                <div className="flex flex-col gap-6">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Calendario y Sistema</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-3">
                            <label className="text-sm text-foreground/80 font-medium">Primer día de la semana</label>
                            <Select
                                value={settings.first_day_of_week.toString()}
                                onValueChange={(val) => updateSetting('first_day_of_week', parseInt(val) as 0 | 1)}
                            >
                                <SelectTrigger className="w-full bg-black/20 border-white/10 h-12 rounded-xl text-foreground">
                                    <SelectValue placeholder="Selecciona un día" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0a0b12] border border-white/10 text-foreground">
                                    <SelectItem value="1">Lunes</SelectItem>
                                    <SelectItem value="0">Domingo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="text-sm text-foreground/80 font-medium">Formato de Hora</label>
                            <Select
                                value={settings.time_format}
                                onValueChange={(val) => updateSetting('time_format', val as '12h' | '24h')}
                            >
                                <SelectTrigger className="w-full bg-black/20 border-white/10 h-12 rounded-xl text-foreground">
                                    <SelectValue placeholder="Selecciona formato" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0a0b12] border border-white/10 text-foreground">
                                    <SelectItem value="24h">24 Horas (14:00)</SelectItem>
                                    <SelectItem value="12h">12 Horas (2:00 PM)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="w-full h-px bg-white/5"></div>

                {/* Focus Preferences */}
                <div className="flex flex-col gap-6">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Sesiones de Enfoque</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-3">
                            <label className="text-sm text-foreground/80 font-medium">Minutos de Enfoque Predeterminados</label>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-black/20 border border-white/10 rounded-xl overflow-hidden h-12">
                                    <button
                                        onClick={() => updateSetting('focus_default_minutes', Math.max(1, settings.focus_default_minutes - 5))}
                                        className="h-full px-4 text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors border-r border-white/5"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="text"
                                        value={settings.focus_default_minutes}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) updateSetting('focus_default_minutes', val);
                                        }}
                                        className="w-16 bg-transparent text-center text-lg focus:outline-none"
                                    />
                                    <button
                                        onClick={() => updateSetting('focus_default_minutes', Math.min(120, settings.focus_default_minutes + 5))}
                                        className="h-full px-4 text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors border-l border-white/5"
                                    >
                                        +
                                    </button>
                                </div>
                                <span className="text-base text-foreground/50 font-medium">min</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="text-sm text-foreground/80 font-medium">Minutos de Descanso Predeterminados</label>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-black/20 border border-white/10 rounded-xl overflow-hidden h-12">
                                    <button
                                        onClick={() => updateSetting('rest_default_minutes', Math.max(1, settings.rest_default_minutes - 1))}
                                        className="h-full px-4 text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors border-r border-white/5"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="text"
                                        value={settings.rest_default_minutes}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) updateSetting('rest_default_minutes', val);
                                        }}
                                        className="w-16 bg-transparent text-center text-lg focus:outline-none"
                                    />
                                    <button
                                        onClick={() => updateSetting('rest_default_minutes', Math.min(60, settings.rest_default_minutes + 1))}
                                        className="h-full px-4 text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors border-l border-white/5"
                                    >
                                        +
                                    </button>
                                </div>
                                <span className="text-base text-foreground/50 font-medium">min</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-6 bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex flex-col gap-2">
                            <h4 className="text-base font-medium text-foreground/90">Iniciar descanso automáticamente</h4>
                            <p className="text-sm text-foreground/50 max-w-[80%]">Al terminar un bloque de concentración, el contador de descanso inicia solo para que no pierdas el ritmo.</p>
                        </div>
                        <GlassSwitch
                            checked={settings.auto_start_rest}
                            onCheckedChange={(val) => updateSetting('auto_start_rest', val)}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}
