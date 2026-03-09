"use client";

import React from 'react';
import { useFocusStore } from '@/lib/stores/focusStore';
import { useFocusTimer } from '@/hooks/useFocusTimer';
import { useStudyCountdown } from '@/hooks/useStudyCountdown';
import { FocusWaveBackground } from './FocusWaveBackground';
import { Pause, Play, X, CheckSquare } from 'lucide-react';
import { ReflectionSheet } from './ReflectionSheet';
import { GymTrackerPanel } from './GymTrackerPanel';
import { RestSelector } from './RestSelector';
import { evaluateFocusContext } from '@/lib/engines/cardsEngine';
import { FocusContext } from '@/lib/types/focus';
import { useBlocksStore } from '@/lib/stores/blocksStore';
import { FocusCardsCarousel } from './FocusCardsCarousel';
import { TechniquePickerCard } from './TechniquePickerCard';
import { IntentInputOverlay } from './IntentInputOverlay';
import { GlassButton } from '@/components/ui/glass-button';
import { requestNotificationPermission } from '@/lib/utils/notifications';

const BLOCK_TYPE_LABELS: Record<string, string> = {
    deep_work: "Deep Work",
    study: "Study",
    gym: "Training",
    meeting: "Meeting",
    admin: "Admin",
    break: "Break",
    other: "Focus",
    free: "Free Focus",
};

// Small icon badge for the mode, reusing the reference card's icon-in-circle
function ModeBadge({ type }: { type?: string }) {
    const label = BLOCK_TYPE_LABELS[type ?? "other"] ?? "Focus";
    return (
        <div
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm"
            style={{ background: "rgba(255,255,255,0.06)" }}
        >
            <span className="text-xs font-medium text-white/60 tracking-widest uppercase">
                {label}
            </span>
        </div>
    );
}

export function FocusOverlay() {
    const { session, pause, resume, exit, finish, setLayer } = useFocusStore();
    const { blocks } = useBlocksStore();
    const { formatted: countUpFormatted } = useFocusTimer(session);
    const { countdownFormatted, currentPhase } = useStudyCountdown();
    const [showPicker, setShowPicker] = React.useState(false);
    const [showIntentInput, setShowIntentInput] = React.useState(false);
    const [isIntentCompletion, setIsIntentCompletion] = React.useState(false);
    const [prevFormatted, setPrevFormatted] = React.useState<string[]>([]);

    // Compute Context for Toasts (same as carousel but only for toasts here)
    const [toastMessage, setToastMessage] = React.useState<{ title?: string; desc?: string } | null>(null);

    React.useEffect(() => {
        requestNotificationPermission();
    }, []);

    React.useEffect(() => {
        if (!session) return;
        let nearEndAt = false;
        if (session.mode === "block" && session.blockId) {
            const block = blocks.find(b => b.id === session.blockId);
            if (block && !session.isPaused) {
                const limit = new Date(block.endAt).getTime();
                const now = new Date().getTime();
                if (limit - now <= 2 * 60 * 1000) nearEndAt = true;
            }
        }
        const context: FocusContext = {
            mode: session.mode,
            blockType: session.blockType,
            timeElapsedSec: session.totalPausedMs ? Math.floor(session.totalPausedMs / 1000) : 0,
            pauseCount: session.pauseCount,
            exitCount: session.exitCount,
            totalPausedSec: Math.floor(session.totalPausedMs / 1000),
            nearEndAt,
            timeOfDay: "morning",
            history: session.history || []
        };
        const result = evaluateFocusContext(context);
        if (result.toastCards.length > 0) {
            setToastMessage({ title: result.toastCards[0].title, desc: result.toastCards[0].description });
        } else {
            setToastMessage(null);
        }
    }, [session?.isPaused, session?.pauseCount, session?.totalPausedMs, session?.exitCount, blocks]);

    const formatted = countdownFormatted || countUpFormatted;

    // Derived per-char array for animated rendering (must come after formatted is declared)
    const formattedChars = React.useMemo(() => formatted.split(''), [formatted]);
    // We only unmount if there's no session, OR if it's inactive AND hasn't ended.
    // (If it has ended, we keep the overlay mounted so the ReflectionSheet can show).
    if (!session || (!session.isActive && !session.endedAt)) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col text-white overflow-hidden animate-in fade-in zoom-in-[0.98] duration-1000 ease-out" style={{ background: "#000" }}>
            {/* ── AURORA BACKGROUND ── */}
            <FocusWaveBackground mode={session.activeLayer?.kind === 'gymMode' ? 'gym' : 'default'} />

            {/* ── TOP BAR ── */}
            <div className="relative z-10 shrink-0 flex items-start justify-between px-4 sm:px-8 pt-6 sm:pt-8 pb-0 animate-in slide-in-from-top-8 fade-in duration-1000 delay-150 fill-mode-both">
                <div className="flex flex-col gap-2">
                    <ModeBadge type={session.blockType} />

                    {/* Active Layer Glass Chip */}
                    {session.activeLayer && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-sm">
                            <span className="text-[11px] font-medium text-white/50 tracking-wide">
                                {session.activeLayer.kind === "studyTechnique"
                                    ? (session.activeLayer.id === "study_50_10" ? "50/10 — Focus" : "Pomodoro 25/5")
                                    : "Gym Mode"}
                            </span>
                            <button
                                onClick={() => setLayer(null)}
                                className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center text-white/30 hover:text-white/90 hover:bg-white/10 transition-colors"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Exit = closes overlay, session remains paused */}
                <button
                    onClick={exit}
                    className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
                >
                    <X className="w-4 h-4 text-white/60" />
                </button>
            </div>

            {/* ── SCROLLABLE MAIN CONTENT ── */}
            <div className="relative z-10 flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col scrollbar-none">
                {/* ── CENTER STAGE: Intention + Timer ── */}
                <div className="flex flex-col items-center justify-center flex-1 shrink-0 min-h-[300px] px-4 sm:px-8 gap-4 py-8">
                    {session.intention && (
                        <div className="group flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-sm transition-all hover:bg-white/[0.06]">
                            <button
                                onClick={() => {
                                    useFocusStore.getState().setSessionIntention("");
                                    setIsIntentCompletion(true);
                                    setShowIntentInput(true);
                                }}
                                className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-transparent hover:border-green-400 hover:text-green-400 hover:bg-green-400/10 transition-all"
                                title="Completar y fijar otro"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                            <span className="text-sm font-medium text-white/80 tracking-wide">
                                {session.intention}
                            </span>
                            <button
                                onClick={() => useFocusStore.getState().setSessionIntention("")}
                                className="w-5 h-5 flex items-center justify-center rounded-full text-white/30 hover:text-white/80 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                                title="Eliminar"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {/* Giant timer — the hero element */}
                    <div className="flex flex-col items-center gap-3">
                        <div
                            className={`flex items-center tabular-nums font-bold select-none transition-colors duration-700 ${currentPhase === "break" ? "text-sky-100" : "text-white"}`}
                            style={{
                                fontSize: "clamp(4.5rem, 18vw, 13rem)",
                                lineHeight: 1.05,
                                letterSpacing: "-0.03em",
                                textShadow: "0 0 50px rgba(255,255,255,0.15)",
                            }}
                        >
                            {formattedChars.map((char, i) => {
                                const prevChar = prevFormatted[i];
                                const changed = prevChar !== undefined && prevChar !== char;
                                // Colons become two stacked circular dots
                                if (char === ':') {
                                    return (
                                        <div
                                            key={`sep-${i}`}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.22em',
                                                margin: '0 0.06em',
                                                opacity: 0.35,
                                                alignSelf: 'center',
                                                height: '0.65em', // roughly cap-height
                                            }}
                                        >
                                            <div style={{ width: '0.11em', height: '0.11em', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                                            <div style={{ width: '0.11em', height: '0.11em', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                                        </div>
                                    );
                                }
                                // Skip spaces
                                if (char === ' ') return null;
                                return (
                                    <span
                                        key={changed ? `${i}-${char}-${Date.now()}` : `${i}-${char}`}
                                        className="timer-digit"
                                    >
                                        {char}
                                    </span>
                                );
                            })}
                        </div>

                        {/* Study technique phase label (minimal text only) */}
                        {currentPhase && session.activeLayer?.kind === "studyTechnique" && (
                            <span className="text-sm tracking-widest uppercase text-white/60 font-medium">
                                {session.activeLayer.id === "study_50_10" ? "50/10" : "Pomodoro"} — {currentPhase === "focus" ? "Focus" : "Break"}
                            </span>
                        )}
                    </div>
                </div>

                {/* ── REACTIVE TOASTS (Top Center) ── */}
                {toastMessage && (
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
                        <div className="px-5 py-3 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col items-center gap-1">
                            <span className="text-white font-medium text-sm">{toastMessage.title}</span>
                            {toastMessage.desc && <span className="text-white/50 text-xs">{toastMessage.desc}</span>}
                        </div>
                    </div>
                )}

                {/* ── GYM LAYER ── */}
                <div className="w-full shrink-0 px-4 sm:px-6 flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-1000 delay-300 fill-mode-both">
                    <GymTrackerPanel />
                </div>

                {/* ── CARDS CAROUSEL ── */}
                {session.activeLayer?.kind !== 'gymMode' && (
                    <div className="w-full shrink-0 pb-2 animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-500 fill-mode-both">
                        <FocusCardsCarousel
                            onOpenPicker={() => setShowPicker(true)}
                            onOpenIntentInput={() => {
                                setIsIntentCompletion(false);
                                setShowIntentInput(true);
                            }}
                        />
                    </div>
                )}
            </div>

            {/* ── BOTTOM CONTROLS ── */}
            <div className="relative z-10 shrink-0 w-full px-4 sm:px-6 pb-6 sm:pb-8 flex flex-col items-center gap-4 animate-in slide-in-from-bottom-10 fade-in duration-1000 delay-700 fill-mode-both">

                {/* Rest Selector — secondary row above the main pill */}
                <RestSelector />

                {/* Main control pill — Pause/Resume · Finish */}
                <div
                    className="flex items-center gap-2 p-1.5 rounded-full border border-white/10"
                    style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}
                >
                    {/* Pause / Resume */}
                    <GlassButton
                        onClick={session.isPaused ? resume : pause}
                        variant="ghost"
                        size="icon"
                        className="w-12 h-12 border-white/10 hover:bg-white/10"
                    >
                        {session.isPaused
                            ? <Play fill="white" className="w-4 h-4 ml-0.5" />
                            : <Pause fill="white" className="w-4 h-4" />
                        }
                    </GlassButton>

                    {/* Spacer */}
                    <div className="w-px h-6 bg-white/10 mx-1" />

                    {/* Finish — white pill, the primary CTA */}
                    <button
                        onClick={finish}
                        className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors shadow-[0_0_24px_rgba(255,255,255,0.25)] select-none"
                    >
                        <CheckSquare className="w-4 h-4" />
                        Finalizar
                    </button>
                </div>
            </div>

            {/* ── TECHNIQUE PICKER MODAL ── */}
            {showPicker && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md px-6">
                    <TechniquePickerCard onClose={() => setShowPicker(false)} />
                </div>
            )}

            {/* ── INTENT INPUT MODAL ── */}
            {showIntentInput && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md px-6">
                    <IntentInputOverlay
                        onClose={() => setShowIntentInput(false)}
                        defaultIsCompletion={isIntentCompletion}
                    />
                </div>
            )}

            {/* ── REFLECTION SHEET ── */}
            <ReflectionSheet />
        </div>
    );
}
