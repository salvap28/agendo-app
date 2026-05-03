"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Mic, Square, WandSparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Textarea } from "@/components/ui/textarea";

type CaptureSource = "text" | "voice";

type SpeechRecognitionResultLike = {
    readonly isFinal: boolean;
    readonly 0: { readonly transcript: string };
};

type SpeechRecognitionEventLike = {
    readonly resultIndex: number;
    readonly results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface HabitCaptureCardProps {
    badgeLabel: string;
    title: string;
    helper: string;
    placeholder: string;
    submitLabel: string;
    submitLoadingLabel: string;
    voiceLabel: string;
    voiceListeningLabel: string;
    onSubmit: (value: string, source: CaptureSource) => Promise<void> | void;
    onTextStart?: () => void;
    onVoiceStart?: () => void;
    onVoiceStop?: () => void;
    disabled?: boolean;
    loading?: boolean;
    feedback?: string | null;
    openPlanningLabel?: string;
    onOpenPlanning?: (() => void) | null;
}

function getSpeechRecognitionCtor() {
    if (typeof window === "undefined") return null;
    const speechWindow = window as Window & {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function HabitCaptureCard({
    badgeLabel,
    title,
    helper,
    placeholder,
    submitLabel,
    submitLoadingLabel,
    voiceLabel,
    voiceListeningLabel,
    onSubmit,
    onTextStart,
    onVoiceStart,
    onVoiceStop,
    disabled = false,
    loading = false,
    feedback = null,
    openPlanningLabel,
    onOpenPlanning,
}: HabitCaptureCardProps) {
    const [value, setValue] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [usedVoice, setUsedVoice] = useState(false);
    const [hasStartedTyping, setHasStartedTyping] = useState(false);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const draftBaseRef = useRef("");
    const stopRequestedRef = useRef(false);
    const restartTimeoutRef = useRef<number | null>(null);
    const speechCtor = useMemo(() => getSpeechRecognitionCtor(), []);

    useEffect(() => {
        return () => {
            if (restartTimeoutRef.current !== null) {
                window.clearTimeout(restartTimeoutRef.current);
            }
            stopRequestedRef.current = true;
            recognitionRef.current?.stop();
        };
    }, []);

    const handleToggleVoice = () => {
        if (!speechCtor || loading || disabled) return;

        if (isListening) {
            stopRequestedRef.current = true;
            if (restartTimeoutRef.current !== null) {
                window.clearTimeout(restartTimeoutRef.current);
                restartTimeoutRef.current = null;
            }
            recognitionRef.current?.stop();
            return;
        }

        const recognition = new speechCtor();
        recognition.lang = document.documentElement.lang?.startsWith("es") ? "es-ES" : "en-US";
        recognition.continuous = true;
        recognition.interimResults = true;
        draftBaseRef.current = value.trim();
        stopRequestedRef.current = false;
        recognitionRef.current = recognition;

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .slice(event.resultIndex)
                .map((result) => result[0]?.transcript ?? "")
                .join(" ")
                .trim();

            if (!transcript) return;
            setUsedVoice(true);
            setValue(draftBaseRef.current ? `${draftBaseRef.current} ${transcript}`.trim() : transcript);
        };

        recognition.onend = () => {
            recognitionRef.current = null;
            if (stopRequestedRef.current || loading || disabled) {
                setIsListening(false);
                onVoiceStop?.();
                return;
            }

            restartTimeoutRef.current = window.setTimeout(() => {
                restartTimeoutRef.current = null;
                if (stopRequestedRef.current || !speechCtor) return;

                const restartedRecognition = new speechCtor();
                restartedRecognition.lang = document.documentElement.lang?.startsWith("es") ? "es-ES" : "en-US";
                restartedRecognition.continuous = true;
                restartedRecognition.interimResults = true;
                draftBaseRef.current = value.trim();
                recognitionRef.current = restartedRecognition;

                restartedRecognition.onresult = recognition.onresult;
                restartedRecognition.onend = recognition.onend;
                restartedRecognition.onerror = recognition.onerror;
                restartedRecognition.start();
            }, 250);
        };

        recognition.onerror = () => {
            setIsListening(false);
            recognitionRef.current = null;
            stopRequestedRef.current = true;
            if (restartTimeoutRef.current !== null) {
                window.clearTimeout(restartTimeoutRef.current);
                restartTimeoutRef.current = null;
            }
            onVoiceStop?.();
        };

        setIsListening(true);
        onVoiceStart?.();
        recognition.start();
    };

    const handleSubmit = async () => {
        const trimmed = value.trim();
        if (!trimmed || loading || disabled) return;

        await onSubmit(trimmed, usedVoice ? "voice" : "text");
        setValue("");
        setUsedVoice(false);
    };

    return (
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(10,14,24,0.94),rgba(14,12,24,0.82))] p-4 shadow-[0_30px_110px_-70px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-5">
            <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.14),transparent_72%)] blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.14),transparent_74%)] blur-3xl" />

            <div className="relative flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/34">{badgeLabel}</p>
                        <h2 className="text-xl font-semibold tracking-[-0.03em] text-white/95">{title}</h2>
                        <p className="text-sm text-white/56">{helper}</p>
                    </div>
                    {onOpenPlanning && openPlanningLabel ? (
                        <button
                            type="button"
                            onClick={onOpenPlanning}
                            disabled={loading || disabled}
                            className="inline-flex h-10 items-center rounded-full border border-white/10 bg-black/18 px-3.5 text-sm text-white/72 transition-all duration-200 hover:border-white/18 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {openPlanningLabel}
                        </button>
                    ) : null}
                </div>

                <Textarea
                    value={value}
                    onChange={(event) => {
                        if (!hasStartedTyping && event.target.value.trim()) {
                            setHasStartedTyping(true);
                            onTextStart?.();
                        }
                        setValue(event.target.value);
                    }}
                    placeholder={placeholder}
                    className="min-h-[104px] resize-none rounded-[22px] border-white/10 bg-black/18 px-4 py-3 text-[0.98rem] text-white placeholder:text-white/28 focus-visible:border-cyan-300/25 focus-visible:ring-cyan-300/20"
                    disabled={loading || disabled}
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {speechCtor ? (
                            <button
                                type="button"
                                onClick={handleToggleVoice}
                                disabled={loading || disabled}
                                aria-pressed={isListening}
                                className={cn(
                                    "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition-all duration-200",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16]",
                                    "disabled:cursor-not-allowed disabled:opacity-60",
                                    isListening
                                        ? "border-cyan-300/25 bg-cyan-400/10 text-white"
                                        : "border-white/10 bg-black/18 text-white/74 hover:border-white/18 hover:bg-white/[0.06] hover:text-white",
                                )}
                            >
                                {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                {isListening ? voiceListeningLabel : voiceLabel}
                            </button>
                        ) : null}

                        {feedback ? <span className="text-sm text-white/50">{feedback}</span> : null}
                    </div>

                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={loading || disabled || !value.trim()}
                        className="inline-flex h-11 items-center gap-2 rounded-[18px] border border-transparent bg-gradient-to-r from-[#79c2ff] via-[#7dd3fc] to-[#6ee7b7] px-4 text-sm font-semibold text-slate-950 shadow-[0_22px_50px_-30px_rgba(125,211,252,0.7)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_28px_58px_-28px_rgba(125,211,252,0.82)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                        {loading ? submitLoadingLabel : submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
