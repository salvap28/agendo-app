"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Palette, Settings, ShieldAlert, ArrowLeft, Bell } from "lucide-react";

export function SettingsSidebar() {
    const pathname = usePathname();

    const navItems = [
        { name: "Perfil", href: "/settings/profile", icon: User },
        { name: "Apariencia", href: "/settings/appearance", icon: Palette },
        { name: "Preferencias", href: "/settings/preferences", icon: Settings },
        { name: "Notificaciones", href: "/settings/notifications", icon: Bell },
        { name: "Cuenta", href: "/settings/account", icon: ShieldAlert, danger: true },
    ];

    return (
        <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-6">
            <Link
                href="/"
                className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition-colors w-fit px-2"
            >
                <ArrowLeft size={16} />
                <span>Volver a Inicio</span>
            </Link>

            <nav className="flex flex-col gap-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (pathname === '/settings' && item.href === '/settings/profile');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive
                                ? "bg-foreground/10 text-foreground font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-foreground/5"
                                : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
                                } ${item.danger ? "hover:text-red-400 hover:bg-red-500/10" : ""}`}
                        >
                            <item.icon size={18} className={isActive ? "text-primary" : ""} />
                            <span>{item.name}</span>
                        </Link>
                    )
                })}
            </nav>
        </div>
    );
}
