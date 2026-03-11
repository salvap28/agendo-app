"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";

const supabase = createClient();

export default function ProfileTab() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        async function loadProfile() {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setName(session.user.user_metadata?.full_name || "");
                setEmail(session.user.email || "");
            }
            setIsLoading(false);
        }
        loadProfile();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage("");

        try {
            const { error } = await supabase.auth.updateUser({
                data: { full_name: name }
            });
            if (error) throw error;
            setMessage("Perfil actualizado correctamente.");
        } catch (error: any) {
            setMessage(error.message || "Error al actualizar el perfil.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!mounted || isLoading) return null;

    return (
        <div className="flex flex-col gap-8 w-full">
            <div>
                <h1 className="text-3xl font-semibold mb-3">Perfil</h1>
                <p className="text-foreground/60 text-base">Gestiona tu información personal.</p>
            </div>

            <form onSubmit={handleSave} className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-6 w-full max-w-2xl">
                <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-foreground/80">Nombre Completo</label>
                    <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-black/20 border-white/10 h-12 rounded-xl text-base px-4"
                        placeholder="Tu nombre"
                    />
                </div>

                <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-foreground/80">Correo Electrónico</label>
                    <Input
                        type="email"
                        value={email}
                        disabled
                        className="bg-white/5 border-white/5 h-12 rounded-xl text-base px-4 text-foreground/50 opacity-70 cursor-not-allowed"
                    />
                    <p className="text-xs text-foreground/40 mt-1 pl-1">El correo electrónico no se puede cambiar por el momento.</p>
                </div>

                <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/5 mt-2">
                    <span className="text-sm text-emerald-400/90 font-medium">{message}</span>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 sm:ml-auto"
                    >
                        {isSaving ? "Guardando..." : "Guardar Cambios"}
                    </button>
                </div>
            </form>
        </div>
    );
}
