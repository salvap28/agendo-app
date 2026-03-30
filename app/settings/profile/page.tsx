"use client";

import { useState, useEffect } from "react";
import { tryCreateClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";

type ProfileUpdateData = {
    email?: string;
    password?: string;
    data: {
        username: string;
    };
};

export default function ProfileTab() {
    const { t } = useI18n();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [currentEmail, setCurrentEmail] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTestingPush, setIsTestingPush] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        async function loadProfile() {
            const supabase = tryCreateClient();
            if (!supabase) {
                setMessage(t.settingsProfile.missingEnv);
                setIsLoading(false);
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUsername(session.user.user_metadata?.username || session.user.user_metadata?.full_name || "");
                setEmail(session.user.email || "");
                setCurrentEmail(session.user.email || "");
            }
            setIsLoading(false);
        }
        loadProfile();
    }, [t.settingsProfile.missingEnv]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage("");

        try {
            const supabase = tryCreateClient();
            if (!supabase) {
                setMessage(t.settingsProfile.missingEnv);
                return;
            }

            if (password !== confirmPassword) {
                setMessage(t.settingsProfile.passwordsMismatch);
                setIsSaving(false);
                return;
            }

            const updateData: ProfileUpdateData = { data: { username } };

            if (email !== currentEmail && email.trim() !== "") {
                updateData.email = email;
            }

            if (password.trim() !== "") {
                updateData.password = password;
            }

            const { error } = await supabase.auth.updateUser(updateData);
            if (error) throw error;

            let successMsg = t.settingsProfile.profileUpdated;
            if (email !== currentEmail) {
                successMsg += t.settingsProfile.profileUpdatedEmailSuffix;
            }
            setMessage(successMsg);
            setPassword("");
            setConfirmPassword("");
        } catch (error: unknown) {
            setMessage(error instanceof Error ? error.message : t.settingsProfile.updateError);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestPush = async () => {
        setIsTestingPush(true);
        setMessage("Enviando ping en 8 seg... Cierra la app ahora.");
        try {
            // Re-request permissions just in case
            if ("Notification" in window && Notification.permission !== "granted") {
                await Notification.requestPermission();
            }
            await fetch("/api/notifications/test-ping", { method: "POST" });
            setMessage("Ping enviado exitosamente por el servidor.");
        } catch (e) {
            setMessage("Error al probar las notificaciones.");
        } finally {
            setIsTestingPush(false);
        }
    };

    if (isLoading) return null;

    return (
        <div suppressHydrationWarning className="flex flex-col gap-8 w-full">
            <div>
                <h1 className="text-3xl font-semibold mb-3">{t.settingsProfile.title}</h1>
                <p className="text-foreground/60 text-base">{t.settingsProfile.description}</p>
            </div>

            <form onSubmit={handleSave} className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-6 w-full max-w-2xl">
                <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-foreground/80">{t.settingsProfile.username}</label>
                    <Input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="bg-black/20 border-white/10 h-12 rounded-xl text-base px-4"
                        placeholder={t.settingsProfile.usernamePlaceholder}
                    />
                </div>

                <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-foreground/80">{t.settingsProfile.email}</label>
                    <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-black/20 border-white/10 h-12 rounded-xl text-base px-4"
                        placeholder="you@email.com"
                    />
                    <p className="text-xs text-foreground/40 mt-1 pl-1">{t.settingsProfile.emailHint}</p>
                </div>

                <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-foreground/80">{t.settingsProfile.newPassword}</label>
                    <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-black/20 border-white/10 h-12 rounded-xl text-base px-4"
                        placeholder={t.settingsProfile.newPasswordPlaceholder}
                    />
                </div>

                {password.trim() !== "" && (
                    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="text-sm font-medium text-foreground/80">{t.settingsProfile.confirmPassword}</label>
                        <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="bg-black/20 border-white/10 h-12 rounded-xl text-base px-4"
                            placeholder={t.settingsProfile.confirmPasswordPlaceholder}
                        />
                    </div>
                )}

                <div className="flex flex-col gap-3 rounded-2xl bg-[#a855f7]/10 border border-[#a855f7]/20 p-5 mt-2">
                    <div>
                        <h4 className="text-sm font-semibold text-[#c084fc]">Notificaciones (Test)</h4>
                        <p className="text-xs text-foreground/60 mt-1">
                            Pon a prueba si llegan las alertas remotas cuando estás fuera de la app. 
                            Oprime el botón, ve al inicio de tu celular, y espera 8 segundos.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleTestPush}
                        disabled={isTestingPush}
                        className="bg-[#c084fc]/20 hover:bg-[#c084fc]/30 border border-[#c084fc]/30 text-[#f3e8ff] px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 mt-1 w-max"
                    >
                        {isTestingPush ? "Ping en progreso..." : "🛎️ Enviar Ping de 8 Segs"}
                    </button>
                </div>

                <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/5 mt-2">
                    <span className="text-sm text-emerald-400/90 font-medium">{message}</span>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 sm:ml-auto"
                    >
                        {isSaving ? t.settingsProfile.saving : t.settingsProfile.saveChanges}
                    </button>
                </div>
            </form>
        </div>
    );
}
