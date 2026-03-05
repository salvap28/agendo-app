"use client";

import { Block, BlockType, BlockStatus } from "@/lib/types/blocks";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useFocusStore } from "@/lib/stores/focusStore";
import { useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { Textarea } from "@/components/ui/textarea";
import {
    Clock,
    Trash2,
    Copy,
    Play,
    CheckCircle2,
    XCircle,
    MoreHorizontal,
    Activity,
    Coffee,
    Dumbbell,
    Briefcase,
    BookOpen,
    Layers,
    Repeat,
    X,
    Zap,
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { GlassButton } from "@/components/ui/glass-button";

interface BlockDrawerProps {
    blockId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

// ── BLOCK TYPE CONFIG ────────────────────────────────────────────────────────

const BLOCK_TYPES_UI: { value: BlockType; label: string; icon: any; color: string; glow: string }[] = [
    { value: "deep_work", label: "Deep Work", icon: Layers, color: "text-indigo-400", glow: "bg-indigo-400" },
    { value: "meeting", label: "Meeting", icon: Briefcase, color: "text-blue-400", glow: "bg-blue-400" },
    { value: "gym", label: "Gym", icon: Dumbbell, color: "text-emerald-400", glow: "bg-emerald-400" },
    { value: "study", label: "Study", icon: BookOpen, color: "text-amber-400", glow: "bg-amber-400" },
    { value: "admin", label: "Admin", icon: Activity, color: "text-slate-400", glow: "bg-slate-400" },
    { value: "break", label: "Break", icon: Coffee, color: "text-rose-400", glow: "bg-rose-400" },
    { value: "other", label: "Other", icon: MoreHorizontal, color: "text-neutral-400", glow: "bg-neutral-400" },
];

// Maps a block type to the CSS classes for the Focus button
const FOCUS_BUTTON_STYLE: Record<string, { bg: string; border: string; shadow: string; text: string }> = {
    gym: { bg: "bg-emerald-500/15 hover:bg-emerald-500/25", border: "border border-emerald-500/30", shadow: "shadow-[0_0_24px_rgba(16,185,129,0.3)]", text: "text-emerald-100" },
    study: { bg: "bg-amber-500/15 hover:bg-amber-500/25", border: "border border-amber-500/30", shadow: "shadow-[0_0_24px_rgba(245,158,11,0.3)]", text: "text-amber-100" },
    meeting: { bg: "bg-rose-500/15 hover:bg-rose-500/25", border: "border border-rose-500/30", shadow: "shadow-[0_0_24px_rgba(225,29,72,0.3)]", text: "text-rose-100" },
    break: { bg: "bg-orange-500/15 hover:bg-orange-500/25", border: "border border-orange-500/30", shadow: "shadow-[0_0_24px_rgba(249,115,22,0.3)]", text: "text-orange-100" },
    admin: { bg: "bg-slate-500/15 hover:bg-slate-500/25", border: "border border-slate-500/30", shadow: "shadow-[0_0_24px_rgba(100,116,139,0.3)]", text: "text-slate-200" },
    deep_work: { bg: "bg-indigo-500/15 hover:bg-indigo-500/25", border: "border border-indigo-500/30", shadow: "shadow-[0_0_24px_rgba(99,102,241,0.3)]", text: "text-indigo-100" },
    other: { bg: "bg-white/10 hover:bg-white/15", border: "border border-white/20", shadow: "shadow-[0_0_14px_rgba(0,0,0,0.3)]", text: "text-white/80" },
};

const STATUS_OPTS: { value: BlockStatus; label: string; icon: any; color: string; dot: string }[] = [
    { value: "planned", label: "Planificado", icon: MoreHorizontal, color: "text-white/50", dot: "bg-white/30" },
    { value: "active", label: "En progreso", icon: Play, color: "text-green-400", dot: "bg-green-400" },
    { value: "completed", label: "Completado", icon: CheckCircle2, color: "text-indigo-400", dot: "bg-indigo-400" },
    { value: "canceled", label: "Cancelado", icon: XCircle, color: "text-red-400", dot: "bg-red-400" },
];

// ── SECTION LABEL ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 px-1 mb-2 mt-1">
            {children}
        </p>
    );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export function BlockDrawer({ blockId, isOpen, onClose }: BlockDrawerProps) {
    const { blocks, updateBlock, deleteBlock, deleteBlockSeries, duplicateBlock, setStatus, applyRecurrence } = useBlocksStore();
    const { openFromBlock } = useFocusStore();
    const block = blocks.find((b) => b.id === blockId);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    if (!block) return null;

    // ── HANDLERS ──────────────────────────────────────────────────────────────

    const handleTitleChange = (val: string) => updateBlock(block.id, { title: val });
    const handleNotesChange = (val: string) => updateBlock(block.id, { notes: val });
    const handleTypeChange = (val: BlockType) => updateBlock(block.id, { type: val });
    const handleStatusChange = (val: BlockStatus) => setStatus(block.id, val);

    const handleTimeUpdate = (type: 'start' | 'end', newDate: Date) => {
        if (type === 'start') {
            const start = newDate;
            let end = block.endAt;
            if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 15 * 60000);
            updateBlock(block.id, { startAt: start, endAt: end });
        } else {
            const end = newDate;
            let start = block.startAt;
            if (end.getTime() <= start.getTime()) start = new Date(end.getTime() - 15 * 60000);
            updateBlock(block.id, { startAt: start, endAt: end });
        }
    };

    const confirmDelete = (type: 'one' | 'series') => {
        if (type === 'one') deleteBlock(block.id);
        else if (block.recurrenceId) deleteBlockSeries(block.recurrenceId);
        setDeleteConfirmOpen(false);
        onClose();
    };

    // ── VISUALS ───────────────────────────────────────────────────────────────

    const activeType = BLOCK_TYPES_UI.find(t => t.value === block.type) ?? BLOCK_TYPES_UI[6];
    const activeStatus = STATUS_OPTS.find(s => s.value === block.status) ?? STATUS_OPTS[0];
    const TypeIcon = activeType.icon;

    const startStr = block.startAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const endStr = block.endAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-md p-0 border-l border-white/[0.06] bg-[#080809]/98 backdrop-blur-3xl shadow-[0_0_60px_rgba(0,0,0,0.8)] z-[100] flex flex-col"
            >
                {/* Glow on the drawer itself */}
                <GlowingEffect spread={60} proximity={120} inactiveZone={0.01} borderWidth={1} variant="subtle" />

                <SheetHeader className="sr-only">
                    <SheetTitle>Edit Block</SheetTitle>
                    <SheetDescription>Edit block details</SheetDescription>
                </SheetHeader>

                {/* ─── HEADER ─────────────────────────────────────────────── */}
                <div className="shrink-0 pt-7 px-6 pb-5 border-b border-white/[0.05]">
                    {/* Top row: type icon + close */}
                    <div className="flex items-center justify-between mb-4">
                        <div className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium",
                            "border-white/[0.08] bg-white/[0.04]",
                            activeType.color
                        )}>
                            <TypeIcon size={12} />
                            {activeType.label}
                        </div>
                        <button
                            onClick={onClose}
                            className="w-7 h-7 rounded-full flex items-center justify-center border border-white/[0.08] bg-white/[0.03] text-white/30 hover:text-white/80 hover:bg-white/[0.08] transition-all"
                        >
                            <X size={13} />
                        </button>
                    </div>

                    {/* Block Title */}
                    <Input
                        value={block.title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        className="text-2xl font-semibold text-white bg-transparent border-none p-0 h-auto placeholder:text-white/20 focus-visible:ring-0 tracking-tight mb-1"
                        placeholder="Untitled Block"
                    />

                    {/* Time + status chip row */}
                    <div className="flex items-center gap-2 mt-3">
                        <span className="text-sm text-white/40 font-medium tabular-nums">
                            {startStr} – {endStr}
                        </span>
                        <span className="text-white/15">·</span>
                        <div className={cn("flex items-center gap-1.5 text-xs font-medium", activeStatus.color)}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", activeStatus.dot)} />
                            {activeStatus.label}
                        </div>
                    </div>

                    {/* ── FOCUS BUTTON — primary CTA, always visible ── */}
                    {(() => {
                        const focusStyle = FOCUS_BUTTON_STYLE[block.type] ?? FOCUS_BUTTON_STYLE.other;
                        return (
                            <button
                                onClick={() => { openFromBlock(block.id, block.type); onClose(); }}
                                className={cn(
                                    "w-full mt-5 h-11 rounded-2xl flex items-center justify-center gap-2 text-sm font-medium transition-all duration-200",
                                    focusStyle.bg,
                                    focusStyle.border,
                                    focusStyle.shadow,
                                    focusStyle.text
                                )}
                            >
                                <Zap size={15} />
                                <span>Iniciar Focus</span>
                            </button>
                        );
                    })()}
                </div>

                {/* ─── SCROLLABLE BODY ─────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                    {/* STATUS */}
                    <div>
                        <SectionLabel>Estado</SectionLabel>
                        <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {STATUS_OPTS.map((s) => {
                                const isActive = block.status === s.value;
                                const Icon = s.icon;
                                return (
                                    <button
                                        key={s.value}
                                        onClick={() => handleStatusChange(s.value)}
                                        className={cn(
                                            "flex flex-col items-center justify-center gap-2 min-w-[100px] p-4 rounded-3xl transition-all duration-300 snap-center group relative overflow-hidden",
                                            isActive
                                                ? "bg-white/[0.08] ring-1 ring-white/20 shadow-lg"
                                                : "bg-white/[0.02] hover:bg-white/[0.04] active:bg-white/[0.06]"
                                        )}
                                    >
                                        {/* Background Glow for active state */}
                                        {isActive && (
                                            <div className={cn("absolute inset-0 opacity-20 blur-xl transition-all", s.dot)} />
                                        )}

                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all z-10",
                                            isActive ? `bg-white/10 ${s.color} shadow-[0_0_15px_currentColor]` : "bg-white/[0.04] text-white/30 group-hover:text-white/50"
                                        )}>
                                            <Icon size={24} />
                                        </div>
                                        <span className={cn(
                                            "text-sm font-semibold z-10 transition-colors",
                                            isActive ? "text-white" : "text-white/50"
                                        )}>
                                            {s.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SCHEDULE */}
                    <div>
                        <SectionLabel>Horario</SectionLabel>
                        <div className="flex flex-col gap-0.5">
                            {[
                                { label: "Inicio", type: "start" as const, date: block.startAt },
                                { label: "Fin", type: "end" as const, date: block.endAt },
                            ].map(({ label, type, date }) => (
                                <div key={type} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 group-hover:text-white/60">
                                            <Clock size={14} />
                                        </div>
                                        <span className="text-sm font-medium text-white/50 group-hover:text-white/80 transition-colors">{label}</span>
                                    </div>
                                    <TimePicker date={date} onChange={(d) => handleTimeUpdate(type, d)} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CATEGORY */}
                    <div>
                        <SectionLabel>Categoría</SectionLabel>
                        <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {BLOCK_TYPES_UI.map((t) => {
                                const isActive = block.type === t.value;
                                const Icon = t.icon;
                                return (
                                    <button
                                        key={t.value}
                                        onClick={() => handleTypeChange(t.value)}
                                        className={cn(
                                            "flex flex-col items-center justify-center gap-2 min-w-[100px] p-4 rounded-3xl transition-all duration-300 snap-center group relative overflow-hidden",
                                            isActive
                                                ? "bg-white/[0.08] ring-1 ring-white/20 shadow-lg"
                                                : "bg-white/[0.02] hover:bg-white/[0.04] active:bg-white/[0.06]"
                                        )}
                                    >
                                        {/* Background Glow for active state */}
                                        {isActive && (
                                            <div className={cn("absolute inset-0 opacity-20 blur-xl transition-all", t.glow)} />
                                        )}

                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all z-10",
                                            isActive ? `bg-white/10 ${t.color} shadow-[0_0_15px_currentColor]` : "bg-white/[0.04] text-white/30 group-hover:text-white/50"
                                        )}>
                                            <Icon size={24} />
                                        </div>
                                        <span className={cn(
                                            "text-sm font-semibold z-10 transition-colors",
                                            isActive ? "text-white" : "text-white/50"
                                        )}>
                                            {t.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* RECURRENCE */}
                    <div>
                        <SectionLabel>Repetición</SectionLabel>
                        <div className="flex flex-col gap-0.5">
                            {[
                                { label: "No se repite", value: undefined },
                                { label: "Todos los días", value: "daily" },
                                { label: "Cada semana", value: "weekly" },
                                { label: "Personalizado", value: "custom" },
                            ].map((opt) => {
                                const isSelected = (!block.recurrencePattern && !opt.value) || (block.recurrencePattern?.type === opt.value);
                                return (
                                    <button
                                        key={opt.label}
                                        onClick={() => {
                                            if (!opt.value) {
                                                updateBlock(block.id, { recurrencePattern: undefined, recurrenceId: undefined });
                                            } else {
                                                applyRecurrence(block.id, {
                                                    type: opt.value as any,
                                                    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                                                    days: opt.value === "custom" ? [1, 3, 5] : undefined,
                                                });
                                            }
                                        }}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium group",
                                            isSelected
                                                ? "bg-white/[0.07] text-white"
                                                : "text-white/40 hover:bg-white/[0.04] hover:text-white/80"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
                                            isSelected ? "bg-indigo-500/20 text-indigo-400" : "bg-white/[0.04] text-white/30 group-hover:text-white/60"
                                        )}>
                                            <Repeat size={13} />
                                        </div>
                                        <span>{opt.label}</span>
                                        {isSelected && (
                                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.8)]" />
                                        )}
                                    </button>
                                );
                            })}

                            {/* Custom day picker */}
                            {block.recurrencePattern?.type === "custom" && (
                                <div className="flex justify-between px-3 pt-3 pb-1 animate-in slide-in-from-top-2 fade-in duration-200">
                                    {["D", "L", "M", "X", "J", "V", "S"].map((day, idx) => {
                                        const isOn = block.recurrencePattern?.days?.includes(idx);
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    const cur = block.recurrencePattern?.days || [];
                                                    const next = isOn ? cur.filter(d => d !== idx) : [...cur, idx].sort();
                                                    applyRecurrence(block.id, { ...block.recurrencePattern!, days: next });
                                                }}
                                                className={cn(
                                                    "w-8 h-8 rounded-xl text-xs font-bold transition-all",
                                                    isOn
                                                        ? "bg-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                                                        : "bg-white/[0.04] text-white/30 hover:bg-white/10 hover:text-white/70"
                                                )}
                                            >
                                                {day}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* NOTES */}
                    <div>
                        <SectionLabel>Notas</SectionLabel>
                        <Textarea
                            value={block.notes || ""}
                            onChange={(e) => handleNotesChange(e.target.value)}
                            placeholder="Agrega detalles..."
                            className="bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/20 min-h-[90px] resize-none rounded-xl focus:bg-white/[0.06] focus:border-white/10 transition-colors text-sm"
                        />
                    </div>

                </div>

                {/* ─── FOOTER ACTIONS ──────────────────────────────────────── */}
                <div className="shrink-0 px-5 py-4 border-t border-white/[0.05] flex items-center justify-between">
                    {/* Danger: Delete */}
                    <button
                        onClick={() => setDeleteConfirmOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                        <Trash2 size={13} />
                        Eliminar
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Duplicate */}
                        <button
                            onClick={() => { duplicateBlock(block.id); onClose(); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/25 hover:text-white/70 hover:bg-white/[0.05] transition-all"
                        >
                            <Copy size={13} />
                            Duplicar
                        </button>
                        {/* Done / close */}
                        <GlassButton
                            onClick={onClose}
                            variant="default"
                            size="sm"
                            className="rounded-xl h-8 px-4 border-white/10"
                        >
                            Listo
                        </GlassButton>
                    </div>
                </div>

            </SheetContent>

            {/* ─── DELETE CONFIRMATION DIALOG ─────────────────────────────── */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent className="bg-[#0c0c0f] border border-white/[0.08] text-white rounded-3xl shadow-2xl">
                    <GlowingEffect spread={30} proximity={60} inactiveZone={0.01} borderWidth={1} variant="subtle" />
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">
                            {block.recurrenceId ? "Eliminar bloque recurrente" : "¿Eliminar este bloque?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white/50">
                            {block.recurrenceId
                                ? "Este bloque es parte de una serie. ¿Querés eliminarlo solo o toda la serie?"
                                : "Esta acción no se puede deshacer."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel className="bg-white/[0.05] border-white/[0.06] hover:bg-white/10 text-white hover:text-white rounded-xl">
                            Cancelar
                        </AlertDialogCancel>

                        {block.recurrenceId ? (
                            <>
                                <Button
                                    onClick={() => confirmDelete('one')}
                                    className="bg-red-500/15 text-red-400 hover:bg-red-500/25 border-0 rounded-xl"
                                >
                                    Solo este
                                </Button>
                                <Button
                                    onClick={() => confirmDelete('series')}
                                    className="bg-red-600 text-white hover:bg-red-700 border-0 rounded-xl"
                                >
                                    Toda la serie
                                </Button>
                            </>
                        ) : (
                            <Button
                                onClick={() => confirmDelete('one')}
                                className="bg-red-600 text-white hover:bg-red-700 border-0 rounded-xl"
                            >
                                Eliminar
                            </Button>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Sheet>
    );
}
