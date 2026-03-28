"use client";

import { ArrowDown } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

interface SectionIntroProps {
    onNext: () => void;
}

export function SectionIntro({ onNext }: SectionIntroProps) {
    const { language } = useI18n();

    return (
        <section className="relative w-full h-[100dvh] snap-start flex flex-col items-center justify-center p-6 select-none bg-transparent overflow-hidden">
            <h1
                className="font-bold text-white/90 drop-shadow-2xl"
                style={{
                    fontSize: `clamp(72px, 18vw, 120px)`,
                    letterSpacing: `-0.07em`,
                    transform: `translateY(-12vh)`
                }}
            >
                Agendo
            </h1>


            {/* Pulse Down Arrow (Call to scroll) */}
            <button
                onClick={onNext}
                aria-label={language === "es" ? "Ir a la siguiente sección" : "Scroll to next section"}
                className="absolute bottom-16 md:bottom-24 p-4 text-white/50 hover:text-white/90 transition-colors animate-bounce cursor-pointer group"
                style={{ animationDuration: '3s' }}
            >
                <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center backdrop-blur-sm group-hover:bg-white/[0.08] group-hover:border-white/20 transition-all">
                    <ArrowDown className="w-5 h-5" strokeWidth={1.5} />
                </div>
            </button>
        </section>
    );
}
