"use client";

import { useRef, useState } from "react";
import { BackgroundEclipse } from "@/components/ui/BackgroundEclipse";
import { SectionIntro } from "@/components/home/SectionIntro";
import { SectionContext } from "@/components/home/SectionContext";
import { SectionCalendar } from "@/components/home/SectionCalendar";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useEffect } from "react";

// Force dynamic rendering (usually needed if this was server component, keeping for safety)
// export const dynamic = "force-dynamic";

export default function Home() {
  const contextRef = useRef<HTMLElement>(null);
  const calendarRef = useRef<HTMLElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const { fetchBlocks, isLoaded: blocksLoaded } = useBlocksStore();

  useEffect(() => {
    if (!blocksLoaded) {
      fetchBlocks();
    }
  }, [blocksLoaded, fetchBlocks]);

  const scrollToSection = (ref: React.RefObject<HTMLElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      {/* --- PRELOADER --- */}
      <div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#020205] transition-opacity duration-1000 ${isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50 animate-ping"></div>
        </div>
      </div>

      <div className={`relative w-full h-[100dvh] overflow-hidden bg-[#020205] text-neutral-100 selection:bg-indigo-500/30 font-sans ${isLoaded ? 'animate-fade-blur' : 'opacity-0'}`}>
        {/* --- BACKGROUND LAYERS (Fixed) --- */}
        <BackgroundEclipse onLoaded={() => setIsLoaded(true)} />

        <main id="main-scroll-container" className="relative w-full h-full overflow-y-auto snap-y snap-mandatory scroll-smooth">
          {/* --- 1. INTRO (AGENDO Wordmark) --- */}
          <div className="relative z-10 w-full snap-start">
            <SectionIntro onNext={() => scrollToSection(contextRef)} />
          </div>

          {/* --- 2. CONTEXT (Greeting & Next Block) --- */}
          <div ref={contextRef as any} className="relative z-10 w-full snap-start">
            <SectionContext onNext={() => scrollToSection(calendarRef)} />
          </div>

          {/* --- 3. CALENDAR (Full integration) --- */}
          <div ref={calendarRef as any} className="relative z-10 w-full snap-start">
            <SectionCalendar />
          </div>

        </main>
      </div>
    </>
  );
}
