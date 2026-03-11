"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { createClient } from "@/lib/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const supabase = createClient();

export default function PreferencesTab() {
    const { settings, updateSetting, fetchSettings, isInitialized } = useSettingsStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
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

    // Evita el flash de hidratación del SSR, pero carga instantáneamente del local storage
    if (!mounted) return null;

    return (
        <div className="flex flex-col gap-8 w-full">
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
                            <div className="flex items-center gap-4">
                                <Input
                                    type="number"
                                    min="1" max="120"
                                    value={settings.focus_default_minutes}
                                    onChange={(e) => updateSetting('focus_default_minutes', parseInt(e.target.value) || 25)}
                                    className="bg-black/20 border-white/10 h-12 rounded-xl w-32 text-center text-lg"
                                />
                                <span className="text-base text-foreground/50 font-medium">min</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="text-sm text-foreground/80 font-medium">Minutos de Descanso Predeterminados</label>
                            <div className="flex items-center gap-4">
                                <Input
                                    type="number"
                                    min="1" max="60"
                                    value={settings.rest_default_minutes}
                                    onChange={(e) => updateSetting('rest_default_minutes', parseInt(e.target.value) || 5)}
                                    className="bg-black/20 border-white/10 h-12 rounded-xl w-32 text-center text-lg"
                                />
                                <span className="text-base text-foreground/50 font-medium">min</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-6 bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex flex-col gap-2">
                            <h4 className="text-base font-medium text-foreground/90">Iniciar descanso automáticamente</h4>
                            <p className="text-sm text-foreground/50 max-w-[80%]">Al terminar un bloque de concentración, el contador de descanso inicia solo para que no pierdas el ritmo.</p>
                        </div>
                        <button
                            onClick={() => updateSetting('auto_start_rest', !settings.auto_start_rest)}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#0a0b12] ${settings.auto_start_rest ? 'bg-primary' : 'bg-white/20'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.auto_start_rest ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
