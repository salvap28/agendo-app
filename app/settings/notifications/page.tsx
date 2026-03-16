"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { createClient } from "@/lib/supabase/client";
import { GlassSwitch } from "@/components/ui/glass-switch";
import { BellRing, Check } from "lucide-react";
import { requestNotificationPermission } from "@/lib/utils/notifications";

const supabase = createClient();

export default function NotificationsTab() {
    const { settings, updateSetting, fetchSettings, isInitialized } = useSettingsStore();
    const [testStatus, setTestStatus] = useState<"idle" | "waiting" | "sent">("idle");
    const [pushStatus, setPushStatus] = useState<"checking" | "configured" | "missing">("checking");

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

    useEffect(() => {
        let cancelled = false;

        async function loadPushStatus() {
            try {
                const response = await fetch("/api/notifications/vapid-public-key", {
                    cache: "no-store"
                });

                if (!cancelled) {
                    if (!response.ok) {
                        setPushStatus("missing");
                        return;
                    }

                    const data = await response.json();
                    setPushStatus(data.configured ? "configured" : "missing");
                }
            } catch {
                if (!cancelled) {
                    setPushStatus("missing");
                }
            }
        }

        loadPushStatus();

        return () => {
            cancelled = true;
        };
    }, []);

    const handleTestNotification = async () => {
        if (!("Notification" in window)) {
            alert("Este navegador no soporta notificaciones de escritorio.");
            return;
        }

        let permission = Notification.permission;
        if (permission === "default") {
            permission = await Notification.requestPermission();
        }

        if (permission === "granted") {
            setTestStatus("waiting");
            setTimeout(() => {
                new Notification("¡Prueba Exitosa! 🚀", {
                    body: "Las notificaciones locales desde Agendo están funcionando perfecto.",
                    icon: "/icon.png" // Opcional si tenés un ícono en public
                });
                setTestStatus("sent");

                // Reset status after a few seconds
                setTimeout(() => setTestStatus("idle"), 4000);
            }, 10000);
        } else {
            alert("Permiso denegado. Por favor habilitá las notificaciones para este sitio en los ajustes de tu navegador/celular.");
        }
    };

    return (
        <div suppressHydrationWarning className="flex flex-col gap-8 w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-semibold mb-3">Notificaciones</h1>
                    <p className="text-foreground/60 text-base">Decidí cómo y cuándo querés que Agendo te avise.</p>
                </div>

                <button
                    onClick={handleTestNotification}
                    disabled={testStatus === "waiting"}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all shadow-lg ${testStatus === "sent"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                        : testStatus === "waiting"
                            ? "bg-indigo-500/50 text-white cursor-wait animate-pulse border border-indigo-400/50"
                            : "bg-primary border border-white/20 text-white hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(currentColor,0.4)]"
                        }`}
                >
                    {testStatus === "sent" ? (
                        <><Check size={18} /> Enviado</>
                    ) : testStatus === "waiting" ? (
                        <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span> Esperando 10s...</>
                    ) : (
                        <><BellRing size={18} /> Enviar Prueba (10s)</>
                    )}
                </button>
            </div>

            {pushStatus === "missing" && (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                    Las notificaciones locales siguen funcionando, pero los push en segundo plano necesitan una VAPID public key.
                    Si ya la agregaste en <code className="mx-1">.env.local</code>, reinicia <code className="mx-1">npm run dev</code>.
                </div>
            )}

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
                            onCheckedChange={async (val) => {
                                if (val) {
                                    const granted = await requestNotificationPermission();
                                    if (!granted) {
                                        alert("Necesitás habilitar permisos en tu navegador/celular para activar las notificaciones.");
                                        return;
                                    }
                                }
                                updateSetting('notify_block_reminders', val);
                            }}
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
