"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Trash2 } from "lucide-react";

const supabase = createClient();
import { useRouter } from "next/navigation";

export default function AccountTab() {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const router = useRouter();

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await supabase.auth.signOut();
            router.push('/login');
        } catch (error) {
            console.error("Error logging out", error);
        } finally {
            setIsLoggingOut(false);
        }
    };

    const handleDeleteAccount = () => {
        alert("La eliminación de cuenta debe ser confirmada. Por favor, contacta con soporte para este proceso por ahora.");
    };

    return (
        <div suppressHydrationWarning className="flex flex-col gap-8 w-full max-w-2xl">
            <div>
                <h1 className="text-3xl font-semibold mb-3">Cuenta</h1>
                <p className="text-foreground/60 text-base">Gestiona la seguridad y el acceso a tu cuenta.</p>
            </div>

            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-8">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-8 gap-6">
                    <div className="flex flex-col gap-2">
                        <h3 className="text-base font-medium text-foreground/90">Cerrar Sesión</h3>
                        <p className="text-sm text-foreground/50">Cerrará tu sesión activa en este dispositivo.</p>
                    </div>

                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 text-foreground px-6 py-3 rounded-xl text-sm font-medium transition-colors sm:w-auto w-full"
                    >
                        <LogOut size={18} />
                        {isLoggingOut ? "Cerrando..." : "Cerrar Sesión"}
                    </button>
                </div>

                <div className="flex flex-col gap-6 pt-2">
                    <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wider">Zona Peligrosa</h3>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-red-500/5 p-6 rounded-2xl border border-red-500/20 gap-6">
                        <div className="flex flex-col gap-2">
                            <h4 className="text-base font-medium text-red-400">Eliminar Cuenta</h4>
                            <p className="text-sm text-red-400/70 max-w-full sm:max-w-[300px]">
                                Al eliminar tu cuenta, perderás todos tus datos de forma permanente. Esta acción no se puede deshacer.
                            </p>
                        </div>

                        <button
                            onClick={handleDeleteAccount}
                            className="flex items-center justify-center shrink-0 gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
                        >
                            <Trash2 size={18} />
                            <span>Eliminar Cuenta</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
