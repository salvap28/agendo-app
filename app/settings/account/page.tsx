"use client";

import { useState } from "react";
import { tryCreateClient } from "@/lib/supabase/client";
import { LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

export default function AccountTab() {
    const { t } = useI18n();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const router = useRouter();

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            const supabase = tryCreateClient();
            if (!supabase) {
                alert(t.settingsAccount.missingEnv);
                return;
            }

            await supabase.auth.signOut();
            router.push('/login');
        } catch (error) {
            console.error("Error logging out", error);
        } finally {
            setIsLoggingOut(false);
        }
    };

    const handleDeleteAccount = () => {
        alert(t.settingsAccount.deleteAccountAlert);
    };

    return (
        <div suppressHydrationWarning className="flex flex-col gap-8 w-full max-w-2xl">
            <div>
                <h1 className="text-3xl font-semibold mb-3">{t.settingsAccount.title}</h1>
                <p className="text-foreground/60 text-base">{t.settingsAccount.description}</p>
            </div>

            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-8 gap-6">
                    <div className="flex flex-col gap-2">
                        <h3 className="text-base font-medium text-foreground/90">{t.settingsAccount.logout}</h3>
                        <p className="text-sm text-foreground/50">{t.settingsAccount.logoutDescription}</p>
                    </div>

                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 text-foreground px-6 py-3 rounded-xl text-sm font-medium transition-colors sm:w-auto w-full"
                    >
                        <LogOut size={18} />
                        {isLoggingOut ? t.settingsAccount.loggingOut : t.settingsAccount.logout}
                    </button>
                </div>

                <div className="flex flex-col gap-6 pt-2">
                    <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wider">{t.settingsAccount.dangerZone}</h3>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-red-500/5 p-6 rounded-2xl border border-red-500/20 gap-6">
                        <div className="flex flex-col gap-2">
                            <h4 className="text-base font-medium text-red-400">{t.settingsAccount.deleteAccount}</h4>
                            <p className="text-sm text-red-400/70 max-w-full sm:max-w-[300px]">
                                {t.settingsAccount.deleteAccountDescription}
                            </p>
                        </div>

                        <button
                            onClick={handleDeleteAccount}
                            className="flex items-center justify-center shrink-0 gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
                        >
                            <Trash2 size={18} />
                            <span>{t.settingsAccount.deleteAccount}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
