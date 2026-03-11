"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function AppearanceTab() {
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

    if (!mounted) return null;

    const colors = [
        { name: 'Blue', value: '#3B82F6' },
        { name: 'Purple', value: '#A855F7' },
        { name: 'Rose', value: '#F43F5E' },
        { name: 'Amber', value: '#F59E0B' },
        { name: 'Emerald', value: '#10B981' },
    ];

    return (
        <div className="flex flex-col gap-8 w-full">
            <div>
                <h1 className="text-3xl font-semibold mb-3">Apariencia y Rendimiento</h1>
                <p className="text-foreground/60 text-base">Personaliza el diseño y los recursos de Agendo.</p>
            </div>

            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-10">

                {/* Accent Color Section */}
                <div className="flex flex-col gap-4">
                    <h3 className="text-base font-medium text-foreground/90">Color de Acento</h3>
                    <p className="text-sm text-foreground/50">Elige el color principal para botones e iluminación de la interfaz.</p>

                    <div className="flex gap-4 mt-2">
                        {colors.map(color => (
                            <button
                                key={color.value}
                                onClick={() => updateSetting('theme_color', color.value)}
                                className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${settings.theme_color === color.value ? 'ring-2 ring-white scale-110 shadow-lg' : 'hover:scale-110 opacity-80'
                                    }`}
                                style={{ backgroundColor: color.value }}
                            />
                        ))}
                    </div>
                </div>

                <div className="w-full h-px bg-white/5"></div>

                {/* Performance Mode Section */}
                <div className="flex flex-col gap-6">
                    <div className="flex justify-between items-center bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-base font-medium text-foreground/90">Modo Rendimiento</h3>
                            <p className="text-sm text-foreground/50 max-w-[85%]">
                                Desactiva animaciones dinámicas, difuminados y efectos de brillo intensos. Recomendado si la aplicación funciona lenta o consume mucha batería en tu dispositivo.
                            </p>
                        </div>

                        <button
                            onClick={() => updateSetting('performance_mode', !settings.performance_mode)}
                            className={`relative shrink-0 inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#0a0b12] ${settings.performance_mode ? 'bg-primary' : 'bg-white/20'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.performance_mode ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
