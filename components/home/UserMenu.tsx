"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, getClientUser } from "@/lib/supabase/client";
import { LogOut, Settings, ChevronDown, Orbit } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { usePerformancePreference } from "@/hooks/usePerformancePreference";

export function UserMenu() {
    const { language } = useI18n();
    const copy = language === "es"
        ? {
            defaultUser: "Usuario",
            insights: "Insights",
            settings: "Configuración",
            logout: "Cerrar sesión",
        }
        : {
            defaultUser: "User",
            insights: "Insights",
            settings: "Settings",
            logout: "Log out",
        };

    const [userName, setUserName] = useState<string>("");
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { isLowEnd } = usePerformancePreference();

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const user = await getClientUser(supabase);
            if (user) {
                const username = user.user_metadata?.username;
                const fullName = user.user_metadata?.full_name || user.user_metadata?.name;

                if (username) {
                    setUserName(username);
                } else if (fullName) {
                    setUserName(fullName.split(" ")[0]);
                } else if (user.email) {
                    setUserName(user.email.split("@")[0]);
                }
            }
        };
        fetchUser();

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const displayName = userName || copy.defaultUser;

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    };

    const handleSettings = () => {
        setIsOpen(false);
        router.push("/settings");
    };

    const handleInsights = () => {
        setIsOpen(false);
        router.push("/insights");
    };

    return (
        <div
            ref={menuRef}
            className="absolute top-[max(env(safe-area-inset-top),1.5rem)] inset-x-0 z-[100] flex w-full justify-center transition-all duration-300"
        >
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="group flex items-center gap-2 px-2 py-1 transition-all"
                >
                    <span className="text-base font-medium tracking-wide text-white drop-shadow-sm">
                        {displayName}
                    </span>
                    <ChevronDown
                        className={cn(
                            "h-5 w-5 text-white transition-transform duration-300 drop-shadow-sm group-hover:translate-y-[2px]",
                            isOpen ? "rotate-180" : "rotate-0",
                        )}
                    />
                </button>

                <div
                    className={cn(
                        "absolute top-full left-1/2 mt-3 w-48 -translate-x-1/2 origin-top overflow-hidden rounded-[20px] border border-white/10 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] transition-all duration-300",
                        isLowEnd ? "bg-[#0a0b12]" : "bg-[#0a0b12]/95 backdrop-blur-2xl",
                        isOpen ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2 scale-95 opacity-0",
                    )}
                >
                    <div className="flex flex-col p-1.5">
                        <button
                            onClick={handleInsights}
                            className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            <Orbit className="h-4 w-4 opacity-70" />
                            <span className="text-sm font-medium">{copy.insights}</span>
                        </button>

                        <button
                            onClick={handleSettings}
                            className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            <Settings className="h-4 w-4 opacity-70" />
                            <span className="text-sm font-medium">{copy.settings}</span>
                        </button>

                        <div className="my-1 h-[1px] w-full bg-white/5" />

                        <button
                            onClick={handleLogout}
                            className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                        >
                            <LogOut className="h-4 w-4 opacity-70" />
                            <span className="text-sm font-medium">{copy.logout}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
