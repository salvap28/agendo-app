"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

export function UserMenu() {
    const [userName, setUserName] = useState<string>("Usuario");
    const [isOpen, setIsOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const username = user.user_metadata?.username;
                const fullName = user.user_metadata?.full_name || user.user_metadata?.name;

                if (username) {
                    setUserName(username);
                } else if (fullName) {
                    setUserName(fullName.split(' ')[0]);
                } else if (user.email) {
                    setUserName(user.email.split('@')[0]);
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
        
        // Track scrolling to optionally blur background if the menu stays fixed
        const scrollContainer = document.getElementById("main-scroll-container");
        const handleScroll = () => {
            if (scrollContainer) {
                setIsScrolled(scrollContainer.scrollTop > 50);
            }
        };
        if (scrollContainer) {
            scrollContainer.addEventListener("scroll", handleScroll);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            if (scrollContainer) {
                scrollContainer.removeEventListener("scroll", handleScroll);
            }
        };
    }, []);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/auth/login");
        router.refresh(); // Refresh to clear states
    };

    const handleSettings = () => {
        setIsOpen(false);
        // We'll navigate to settings or open a modal. 
        // For now: 
        console.log("Settings clicked - implement navigation/modal");
        // router.push("/settings");
    };

    return (
        <div 
            ref={menuRef}
            className={cn(
                "fixed top-[max(env(safe-area-inset-top),1.5rem)] inset-x-0 w-full flex justify-center z-[100] transition-all duration-300",
                isScrolled ? "opacity-30 hover:opacity-100" : "opacity-100"
            )}
        >
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 group px-4 py-2 rounded-full bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md border border-white/5 transition-all shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3)]"
                >
                    <span className="text-white/90 text-sm font-medium tracking-wide">
                        {userName}
                    </span>
                    <span 
                        className={cn(
                            "text-white/50 text-[10px] sm:text-xs font-mono transition-transform duration-300",
                            isOpen ? "rotate-0 text-white/90" : "rotate-180"
                        )}
                        style={{ marginTop: isOpen ? '4px' : '-2px' }}
                    >
                        ^
                    </span>
                </button>

                {/* Dropdown elements */}
                <div
                    className={cn(
                        "absolute top-full mt-3 left-1/2 -translate-x-1/2 w-48 rounded-[20px] bg-[#0a0b12]/95 backdrop-blur-2xl border border-white/10 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 origin-top",
                        isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                    )}
                >
                    <div className="flex flex-col p-1.5">
                        <button
                            onClick={handleSettings}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[14px] hover:bg-white/10 transition-colors text-left text-white/80 hover:text-white"
                        >
                            <Settings className="w-4 h-4 opacity-70" />
                            <span className="text-sm font-medium">Configuración</span>
                        </button>
                        
                        <div className="h-[1px] w-full bg-white/5 my-1" />
                        
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[14px] hover:bg-rose-500/10 transition-colors text-left text-rose-400 hover:text-rose-300"
                        >
                            <LogOut className="w-4 h-4 opacity-70" />
                            <span className="text-sm font-medium">Cerrar sesión</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
