"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Block, BlockType, BlockStatus, RecurrencePattern } from "@/lib/types/blocks";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useFocusStore } from "@/lib/stores/focusStore";
import {
    Copy,
    Trash2,
    Play,
    CheckCircle2,
    XCircle,
    MoreHorizontal,
    Activity,
    Coffee,
    Dumbbell,
    Briefcase,
    BookOpen,
    Zap,
    Tag,
    Clock,
    X,
    Type,
    ArrowLeft,
    Repeat,
    Layers
} from "lucide-react";
import { cn } from "@/lib/cn";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { GlassButton } from "@/components/ui/glass-button";
import { CircularTimePicker } from "@/components/focus/CircularTimePicker";
import { Input } from "@/components/ui/input";
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

// ─── CONFIGURATION ──────────────────────────────────────────────────────────

const BLOCK_TYPES_UI: { value: BlockType; label: string; icon: any; color: string; bg: string }[] = [
    { value: "deep_work", label: "Deep Work", icon: Layers, color: "text-indigo-400", bg: "bg-indigo-400/20" },
    { value: "meeting", label: "Meeting", icon: Briefcase, color: "text-blue-400", bg: "bg-blue-400/20" },
    { value: "gym", label: "Gym", icon: Dumbbell, color: "text-emerald-400", bg: "bg-emerald-400/20" },
    { value: "study", label: "Study", icon: BookOpen, color: "text-amber-400", bg: "bg-amber-400/20" },
    { value: "admin", label: "Admin", icon: Activity, color: "text-slate-400", bg: "bg-slate-400/20" },
    { value: "break", label: "Break", icon: Coffee, color: "text-rose-400", bg: "bg-rose-400/20" },
    { value: "other", label: "Other", icon: MoreHorizontal, color: "text-neutral-400", bg: "bg-neutral-400/20" },
];

const STATUS_OPTS: { value: BlockStatus; label: string; icon: any; color: string; bg: string }[] = [
    { value: "planned", label: "Planificado", icon: MoreHorizontal, color: "text-white/50", bg: "bg-white/10" },
    { value: "active", label: "En progreso", icon: Play, color: "text-green-400", bg: "bg-green-400/20" },
    { value: "completed", label: "Completado", icon: CheckCircle2, color: "text-indigo-400", bg: "bg-indigo-400/20" },
    { value: "canceled", label: "Cancelado", icon: XCircle, color: "text-red-400", bg: "bg-red-400/20" },
];

// Nodos primarios que orbitan el bloque
type PrimaryNode = "type" | "status" | "time" | "delete" | "focus" | "center";

// ─── ORBITAL MATH UTILS ─────────────────────────────────────────────────────

const calculateNodePosition = (index: number, total: number, radius: number, angleOffset: number = 0) => {
    // Distribute evenly around the circle, shifted by offset. We go counter-clockwise starting from top (270deg or -90deg in CSS Cartesian)
    const angleRange = 360;
    const baseAngle = -90; // Start at 12 o'clock
    const currentAngle = baseAngle + ((index * angleRange) / total) + angleOffset;

    const radian = (currentAngle * Math.PI) / 180;
    const x = radius * Math.cos(radian);
    const y = radius * Math.sin(radian);

    return { x, y, angle: currentAngle };
};

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export function RadialBlockMenu({ blockId, isNewBlock = false, onClose }: { blockId: string; isNewBlock?: boolean; onClose: () => void }) {
    const { blocks, updateBlock, deleteBlock, deleteBlockSeries, duplicateBlock, setStatus, applyRecurrence } = useBlocksStore();
    const { openFromBlock } = useFocusStore();

    const block = blocks.find(b => b.id === blockId);

    // Estado Orbital
    const [activePrimaryNode, setActivePrimaryNode] = useState<PrimaryNode | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const planetRefs = useRef<(HTMLDivElement | null)[]>([]);
    const galaxyRef = useRef<HTMLDivElement>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    // Guided initialization pass
    const [guidedStep, setGuidedStep] = useState<"center" | "time" | "type" | null>(isNewBlock ? "center" : null);

    useEffect(() => {
        if (isNewBlock) {
            setActivePrimaryNode("center");
        }
    }, [isNewBlock]);

    // Draft state para no aplicar repeticiones instantáneamente
    const [draftRecurrence, setDraftRecurrence] = useState<RecurrencePattern | undefined>(block?.recurrencePattern);

    // Fast local state for 60fps radial dragging without entire WeekView re-rendering
    const [localTime, setLocalTime] = useState({ start: block?.startAt, end: block?.endAt });

    useEffect(() => {
        if (activePrimaryNode === "center") {
            setDraftRecurrence(block?.recurrencePattern);
        }
        if (block?.startAt && block?.endAt) {
            setLocalTime({ start: block.startAt, end: block.endAt });
        }
    }, [activePrimaryNode, block?.recurrencePattern, block?.startAt, block?.endAt]);

    // Animación física de alto rendimiento a 60fps usando requestAnimationFrame
    useEffect(() => {
        let animationFrameId: number;
        // Estado local de la física para no disparar re-renders de React
        const physics = { angle: 0, speed: 20 };

        const animate = () => {
            if (!activePrimaryNode) {
                physics.angle = (physics.angle + physics.speed) % 360;
                if (physics.speed > 0.05) {
                    physics.speed = Math.max(0.05, physics.speed * 0.92); // Desacelera hasta el giro constante de fondo
                }
            }

            // Aplicar posiciones directo al DOM saltando el Virtual DOM (60 FPS puros)
            planetRefs.current.forEach((el, i) => {
                if (el) {
                    const pos = calculateNodePosition(i, 5, 160, physics.angle); // 5 planets, 160 radius
                    el.style.translate = `${pos.x}px ${pos.y}px`;
                }
            });

            // Zoom de cámara: si hay un nodo activo, desplazamos la galaxia para centrarlo
            if (galaxyRef.current) {
                if (activePrimaryNode) {
                    if (activePrimaryNode === "center") {
                        galaxyRef.current.style.translate = `0px 0px`;
                        galaxyRef.current.style.scale = "1.3";
                    } else {
                        // Buscar índice del nodo activo para calcular su posición exacta actual
                        const activeIndex = ["type", "focus", "time", "status", "danger"].indexOf(activePrimaryNode);
                        if (activeIndex !== -1) {
                            const pos = calculateNodePosition(activeIndex, 5, 160, physics.angle);
                            // Centrar el nodo y hacer zoom
                            galaxyRef.current.style.translate = `${-pos.x}px ${-pos.y}px`;
                            galaxyRef.current.style.scale = "1.3";
                        }
                    }
                } else {
                    // Volver a la vista normal
                    galaxyRef.current.style.translate = `0px 0px`;
                    galaxyRef.current.style.scale = "1";
                }
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [activePrimaryNode]);

    if (!block) return null;

    const isCurrentBlock = useMemo(() => {
        if (!block) return false;
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const startMins = block.startAt.getHours() * 60 + block.startAt.getMinutes();
        const endMins = block.endAt.getHours() * 60 + block.endAt.getMinutes();

        const crossesMidnight = startMins > endMins;

        // Is time within window?
        let timeMatch = false;
        if (!crossesMidnight) {
            timeMatch = nowMins >= startMins && nowMins < endMins;
        } else {
            timeMatch = nowMins >= startMins || nowMins < endMins;
        }

        if (!timeMatch) return false;

        // Is day a match?
        // Which day should we check against the pattern? 
        // If it crosses midnight and now is past midnight (nowMins < endMins), the block's "logical" day is yesterday.
        const logicalDate = new Date(now);
        if (crossesMidnight && nowMins < endMins) {
            logicalDate.setDate(logicalDate.getDate() - 1);
        }

        if (block.recurrencePattern) {
            if (block.recurrencePattern.type === 'daily') return true;
            if (block.recurrencePattern.type === 'weekly') {
                return block.recurrencePattern.days?.includes(logicalDate.getDay()) || false;
            }
        }

        // Exact date match for single block
        const blockLogicalDate = new Date(block.startAt);
        return logicalDate.getFullYear() === blockLogicalDate.getFullYear() &&
            logicalDate.getMonth() === blockLogicalDate.getMonth() &&
            logicalDate.getDate() === blockLogicalDate.getDate();

    }, [block]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 500);
    };

    // Handlers directos
    const handleBackgroundClick = (e: React.MouseEvent) => {
        if (e.target === containerRef.current) {
            if (activePrimaryNode) {
                setActivePrimaryNode(null);
            } else {
                handleClose();
            }
        }
    };

    const handlePrimaryClick = (node: PrimaryNode, e: React.MouseEvent) => {
        e.stopPropagation();

        if (node === "delete") {
            if (block.recurrenceId) {
                setDeleteConfirmOpen(true);
            } else {
                deleteBlock(block.id);
                handleClose();
            }
            return;
        }

        if (node === "focus") {
            if (activePrimaryNode === "focus") {
                openFromBlock(block.id, block.type);
                handleClose();
            } else {
                setActivePrimaryNode("focus");
            }
            return;
        }
        // Si tocamos el mismo nodo activo, lo contraemos. Si no, lo expandimos y pausamos la rotación.
        setActivePrimaryNode(prev => prev === node ? null : node);
    };

    const handleTypeSelect = (type: BlockType, e: React.MouseEvent) => {
        e.stopPropagation();
        updateBlock(block.id, { type });
        if (guidedStep === "type") {
            setGuidedStep(null);
            handleClose(); // Termina la creación guiada
        } else {
            setActivePrimaryNode(null); // Return to center
        }
    };

    const handleStatusSelect = (status: BlockStatus, e: React.MouseEvent) => {
        e.stopPropagation();
        setStatus(block.id, status);
        setActivePrimaryNode(null);
    };

    const confirmDelete = (type: 'one' | 'series') => {
        if (type === 'one') deleteBlock(block.id);
        else if (block.recurrenceId) deleteBlockSeries(block.recurrenceId);
        setDeleteConfirmOpen(false);
        handleClose();
    };

    // Datos visuales del bloque actual
    const activeType = BLOCK_TYPES_UI.find(t => t.value === block.type) || BLOCK_TYPES_UI[6];
    const activeStatus = STATUS_OPTS.find(s => s.value === block.status) || STATUS_OPTS[0];

    // Array de primary nodes
    const primaryNodes = [
        { id: "type" as const, label: "Categoría", icon: activeType.icon, color: activeType.color, bg: activeType.bg },
        { id: "focus" as const, label: "Focus", icon: Zap, color: "text-purple-500", bg: "bg-purple-500/20" },
        { id: "time" as const, label: "Horario", icon: Clock, color: "text-white/70", bg: "bg-white/10" },
        { id: "status" as const, label: "Estado", icon: activeStatus.icon, color: activeStatus.color, bg: activeStatus.bg },
        { id: "delete" as const, label: "Eliminar", icon: Trash2, color: "text-red-400", bg: "bg-red-500/10" },
    ];

    const PRIMARY_RADIUS = 160;
    const SECONDARY_RADIUS = 100;

    return (
        <div
            ref={containerRef}
            className={cn(
                "fixed inset-0 z-[200] flex items-center justify-center duration-500 overflow-hidden fill-mode-forwards",
                isClosing ? "animate-out fade-out pointer-events-none" : "animate-in fade-in"
            )}
            onClick={handleBackgroundClick}
        >
            {/* Dark glass backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl pointer-events-none" />

            {/* BOTÓN VOLVER (Fuera del zoom/paneo para que siempre esté fijo) */}
            {activePrimaryNode && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setActivePrimaryNode(null);
                    }}
                    className="absolute top-12 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-6 h-12 rounded-full bg-white/5 border border-white/10 backdrop-blur-2xl transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-white/10 hover:border-white/20 text-white/50 hover:text-white animate-in slide-in-from-top-4 fade-in"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Volver</span>
                </button>
            )}

            {/* Galaxia Base (Cámara/Paneo) */}
            <div
                ref={galaxyRef}
                className={cn(
                    "relative flex items-center justify-center w-full h-full pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    isClosing && "animate-out fade-out zoom-out fill-mode-forwards duration-500"
                )}
            >
                {/* ── ALAMBRE DE ÓRBITA PRINCIPAL ── */}
                <div
                    className={cn(
                        "absolute rounded-full border border-white/[0.04] transition-all duration-1000",
                        activePrimaryNode ? "opacity-20 scale-95" : "opacity-100 scale-100"
                    )}
                    style={{
                        width: PRIMARY_RADIUS * 2,
                        height: PRIMARY_RADIUS * 2,
                        animation: `spring-out 600ms cubic-bezier(0.175, 0.885, 0.32, 1.275) BOTH`
                    }}
                />

                {/* ── SOL CENTRAL (Bloque) ── */}
                <div
                    className={cn(
                        "group absolute pointer-events-auto flex flex-col items-center justify-center rounded-[2rem] bg-black/80 border border-white/20 backdrop-blur-2xl transition-all duration-500 shadow-[0_0_80px_rgba(255,255,255,0.1)]",
                        activePrimaryNode && activePrimaryNode !== "center" ? "z-10 opacity-30 scale-95 blur-sm cursor-pointer" : "z-[100] opacity-100",
                        activePrimaryNode === "center" ? "p-6 w-[280px] cursor-default" : "p-6 w-auto cursor-pointer hover:scale-[1.02] active:scale-[0.98] border-white/30 hover:border-indigo-400/30 hover:shadow-[0_0_40px_rgba(129,140,248,0.2)]"
                    )}
                    onClick={() => {
                        if (activePrimaryNode === "center") return;
                        if (activePrimaryNode) setActivePrimaryNode(null);
                        else setActivePrimaryNode("center");
                    }}
                    style={{
                        animation: `spring-out 600ms cubic-bezier(0.175, 0.885, 0.32, 1.275) BOTH`
                    }}
                >
                    <GlowingEffect spread={40} proximity={80} inactiveZone={0.01} borderWidth={1} variant="subtle" />

                    {activePrimaryNode === "center" ? (
                        <div className="flex flex-col w-full gap-5 relative z-10 animate-in fade-in zoom-in-95 duration-300">
                            {/* Editable Title */}
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 ml-1">Título</span>
                                <Input
                                    value={block.title}
                                    onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            // Trigger the same logic as "Guardar/Siguiente"
                                            if (JSON.stringify(draftRecurrence) !== JSON.stringify(block.recurrencePattern)) {
                                                if (!draftRecurrence) updateBlock(block.id, { recurrencePattern: undefined, recurrenceId: undefined });
                                                else applyRecurrence(block.id, draftRecurrence);
                                            }
                                            if (guidedStep === "center") {
                                                setGuidedStep("time");
                                                setActivePrimaryNode("time");
                                            } else {
                                                setActivePrimaryNode(null);
                                            }
                                        }
                                    }}
                                    className="text-lg font-bold tracking-tight text-white bg-black/40 border border-white/10 rounded-xl px-3 h-10 focus-visible:ring-1 focus-visible:ring-indigo-500/50 placeholder:text-white/20 shadow-inner"
                                    placeholder="Nombre del bloque"
                                    autoFocus
                                />
                            </div>

                            {/* Recurrence Selector */}
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 ml-1">Repetición</span>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {[
                                        { label: "No", value: undefined },
                                        { label: "Diario", value: "daily" },
                                        { label: "Semanal", value: "weekly" },
                                    ].map((opt) => {
                                        const isSelected = (!draftRecurrence && !opt.value) || (draftRecurrence?.type === opt.value);
                                        return (
                                            <button
                                                key={opt.label}
                                                onClick={() => {
                                                    if (!opt.value) {
                                                        setDraftRecurrence(undefined);
                                                    } else {
                                                        setDraftRecurrence({
                                                            type: opt.value as any,
                                                            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                                                        });
                                                    }
                                                }}
                                                className={cn(
                                                    "flex items-center justify-center gap-1.5 h-9 rounded-xl transition-all duration-300 text-xs font-semibold border backdrop-blur-md",
                                                    isSelected
                                                        ? "bg-indigo-500/20 text-indigo-100 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]"
                                                        : "bg-black/40 text-white/50 border-white/5 hover:bg-white/10 hover:border-white/10 hover:text-white/90"
                                                )}
                                            >
                                                {opt.value && <Repeat size={12} className={isSelected ? "text-indigo-400" : ""} />}
                                                <span>{opt.label}</span>
                                            </button>
                                        );
                                    })}
                                    {/* Custom option */}
                                    <button
                                        onClick={() => {
                                            setDraftRecurrence({
                                                type: "custom",
                                                endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                                                days: draftRecurrence?.days || [1, 3, 5],
                                            });
                                        }}
                                        className={cn(
                                            "flex items-center justify-center gap-1.5 h-9 rounded-xl transition-all duration-300 text-xs font-semibold border backdrop-blur-md",
                                            draftRecurrence?.type === "custom"
                                                ? "bg-indigo-500/20 text-indigo-100 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]"
                                                : "bg-black/40 text-white/50 border-white/5 hover:bg-white/10 hover:border-white/10 hover:text-white/90"
                                        )}
                                    >
                                        <Repeat size={12} className={draftRecurrence?.type === "custom" ? "text-indigo-400" : ""} />
                                        <span>A medida</span>
                                    </button>
                                </div>

                                {/* Custom day picker inline */}
                                {draftRecurrence?.type === "custom" && (
                                    <div className="flex justify-between mt-2 animate-in slide-in-from-top-1 fade-in duration-200">
                                        {["D", "L", "M", "X", "J", "V", "S"].map((day, idx) => {
                                            const isActive = draftRecurrence?.days?.includes(idx);
                                            return (
                                                <button
                                                    key={day}
                                                    onClick={() => {
                                                        let newDays = draftRecurrence?.days || [];
                                                        if (isActive) newDays = newDays.filter((d) => d !== idx);
                                                        else newDays = [...newDays, idx].sort();
                                                        if (newDays.length === 0) newDays = [idx];

                                                        setDraftRecurrence({
                                                            type: "custom",
                                                            endDate: draftRecurrence!.endDate,
                                                            days: newDays,
                                                        });
                                                    }}
                                                    className={cn(
                                                        "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 border",
                                                        isActive
                                                            ? "bg-indigo-500 text-white border-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.6)]"
                                                            : "bg-black/40 text-white/40 border-white/5 hover:bg-white/10 hover:border-white/10 hover:text-white/90"
                                                    )}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Acciones de Edición */}
                            <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-white/[0.05]">
                                <button
                                    onClick={() => {
                                        if (guidedStep === "center") {
                                            deleteBlock(block.id);
                                            handleClose();
                                        } else {
                                            setActivePrimaryNode(null);
                                        }
                                    }}
                                    className="px-5 py-2 rounded-xl text-xs font-semibold text-white/50 hover:text-white border border-transparent hover:bg-white/5 hover:border-white/10 transition-all duration-300"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        // Aplicar estado 'draft' de repetición
                                        if (JSON.stringify(draftRecurrence) !== JSON.stringify(block.recurrencePattern)) {
                                            if (!draftRecurrence) {
                                                updateBlock(block.id, { recurrencePattern: undefined, recurrenceId: undefined });
                                            } else {
                                                applyRecurrence(block.id, draftRecurrence);
                                            }
                                        }
                                        if (guidedStep === "center") {
                                            setGuidedStep("time");
                                            setActivePrimaryNode("time");
                                        } else {
                                            setActivePrimaryNode(null);
                                        }
                                    }}
                                    className="px-5 py-2 rounded-xl text-xs font-bold text-indigo-50 bg-indigo-500/80 border border-indigo-400/50 shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:bg-indigo-500 hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] hover:scale-[1.02] active:scale-95 transition-all duration-300 backdrop-blur-md"
                                >
                                    {guidedStep === "center" ? "Siguiente" : "Guardar"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col items-center justify-center group-hover:scale-[1.05] transition-transform duration-300">
                                <span className="text-xl font-bold tracking-tight text-white mb-1 max-w-[150px] truncate text-center relative z-10 transition-colors group-hover:text-indigo-100">
                                    {block.title || "Agendo Block"}
                                </span>
                                <span className="text-xs text-white/40 tabular-nums relative z-10 flex items-center gap-1.5 transition-colors group-hover:text-white/60">
                                    {localTime.start?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    <span>-</span>
                                    {localTime.end?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {block.recurrencePattern && <Repeat size={10} className="text-indigo-400 opacity-60 ml-0.5" />}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* ── PLANETAS Y LUNAS ── */}
                <div
                    className="absolute inset-0 flex items-center justify-center"
                >
                    {primaryNodes.map((pn, i) => {
                        const isFocused = activePrimaryNode === pn.id;
                        const isDimmed = activePrimaryNode && activePrimaryNode !== pn.id;

                        // Se calculan solo para el primer frame. Luego rAF asume el control
                        const pos = calculateNodePosition(i, primaryNodes.length, PRIMARY_RADIUS, 0);
                        const PIcon = pn.icon;

                        return (
                            <div
                                key={pn.id}
                                ref={(el) => { planetRefs.current[i] = el; }}
                                className={cn(
                                    "absolute flex flex-col items-center transition-all duration-700 pointer-events-auto",
                                    isDimmed ? "opacity-10 scale-75 blur-sm" : "opacity-100 scale-100",
                                    isFocused ? "z-[100]" : "z-10"
                                )}
                                style={{
                                    translate: `${pos.x}px ${pos.y}px`,
                                    animation: `spring-out-planet 600ms cubic-bezier(0.175, 0.885, 0.32, 1.275) BOTH`
                                }}
                            >
                                {/* Píldora del Planeta */}
                                <button
                                    onClick={(e) => handlePrimaryClick(pn.id, e)}
                                    className={cn(
                                        "h-16 flex items-center justify-center border transition-all duration-300 backdrop-blur-md relative overflow-hidden",
                                        pn.id === "focus" && isFocused ? "w-40 rounded-[2rem] px-5" : "w-16 rounded-full hover:scale-[1.15]",
                                        "active:scale-95",
                                        isFocused
                                            ? `scale-[1.15] shadow-[0_0_30px_currentColor] border-white/40 ${pn.bg}`
                                            : `bg-[#0c0c0f] border-white/10 hover:${pn.bg} hover:border-${pn.color.replace('text-', '')}/30`,
                                        pn.id === "focus" && !isFocused && "hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:border-purple-500/50" // Distinctive focus hover
                                    )}
                                    style={{
                                        color: isFocused ? 'white' : undefined,
                                    }}
                                >
                                    <GlowingEffect spread={35} proximity={80} inactiveZone={0.01} borderWidth={1} variant="subtle" />
                                    {isFocused && pn.id !== "focus" && (
                                        <div className="absolute inset-0 rounded-full animate-ping opacity-20 border border-current" />
                                    )}
                                    <div className={cn("flex items-center relative z-10 transition-all duration-300", pn.id === "focus" && isFocused ? "gap-2" : "gap-0")}>
                                        <PIcon className={cn("w-6 h-6", isFocused ? "text-white" : pn.color)} />
                                        {pn.id === "focus" && (
                                            <span
                                                className={cn(
                                                    "font-bold whitespace-nowrap text-white text-sm transition-all duration-300",
                                                    isFocused ? "opacity-100 max-w-[100px]" : "opacity-0 max-w-0 overflow-hidden"
                                                )}
                                            >
                                                Iniciar Focus
                                            </span>
                                        )}
                                    </div>
                                </button>
                                {/* Etiqueta (solo visible al idle) */}
                                <div
                                    className={cn(
                                        "absolute top-[calc(100%+8px)] text-[10px] uppercase tracking-widest font-medium transition-all duration-300 whitespace-nowrap",
                                        isFocused ? "opacity-0 translate-y-2" : "opacity-100 text-white/50"
                                    )}
                                >
                                    {pn.label}
                                </div>

                                {/* ── LUNAS (Nivel 2) ── */}
                                {isFocused && (
                                    <div className="absolute top-8 left-1/2 w-0 h-0 flex items-center justify-center pointer-events-none">

                                        {/* TYPE SATELLITES */}
                                        {pn.id === "type" && BLOCK_TYPES_UI.map((tn, j) => {
                                            const lPos = calculateNodePosition(j, BLOCK_TYPES_UI.length, SECONDARY_RADIUS, -90);
                                            const LIcon = tn.icon;
                                            const isSelected = tn.value === activeType.value;
                                            return (
                                                <div
                                                    key={tn.value}
                                                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                                    style={{
                                                        translate: `${lPos.x}px ${lPos.y}px`,
                                                        animation: `spring-out 500ms cubic-bezier(0.175, 0.885, 0.32, 1.275) ${j * 30}ms BOTH`
                                                    }}
                                                >
                                                    <button
                                                        onClick={(e) => handleTypeSelect(tn.value, e)}
                                                        className={cn(
                                                            "group pointer-events-auto w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-[1.3] active:scale-95 relative overflow-hidden",
                                                            isSelected ? `${tn.bg} border ${tn.color.replace('text-', 'border-')}` : "bg-black/80 border border-white/10 backdrop-blur-sm"
                                                        )}
                                                    >
                                                        <GlowingEffect spread={25} proximity={60} inactiveZone={0.01} borderWidth={1} variant="subtle" />
                                                        <LIcon className={cn("w-4 h-4 transition-transform duration-300 group-hover:scale-110 relative z-10", tn.color)} />

                                                        {/* Tooltip Label */}
                                                        <div className="absolute top-[calc(100%+8px)] opacity-0 group-hover:opacity-100 group-hover:translate-y-1 transition-all duration-300 text-[10px] uppercase tracking-widest font-bold text-white/70 whitespace-nowrap pointer-events-none">
                                                            {tn.label}
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        {/* STATUS SATELLITES */}
                                        {pn.id === "status" && STATUS_OPTS.map((sn, j) => {
                                            // Equidistant perfect 360 degree distribution starting from top
                                            const lPos = calculateNodePosition(j, STATUS_OPTS.length, 140, -90);
                                            const LIcon = sn.icon;
                                            const isSelected = sn.value === activeStatus.value;
                                            return (
                                                <div
                                                    key={sn.value}
                                                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                                    style={{
                                                        translate: `${lPos.x}px ${lPos.y}px`,
                                                        animation: `spring-out 500ms cubic-bezier(0.175, 0.885, 0.32, 1.275) ${j * 50}ms BOTH`
                                                    }}
                                                >
                                                    <button
                                                        onClick={(e) => handleStatusSelect(sn.value, e)}
                                                        className={cn(
                                                            "pointer-events-auto flex items-center gap-2 px-4 h-11 rounded-full whitespace-nowrap transition-all duration-300 hover:scale-110 active:scale-95 relative overflow-hidden",
                                                            isSelected ? `${sn.bg} border ${sn.color.replace('text-', 'border-')}` : `bg-black/80 border border-white/10 backdrop-blur-sm hover:${sn.bg} hover:border-${sn.color.replace('text-', '')}/30`
                                                        )}
                                                    >
                                                        <GlowingEffect spread={30} proximity={70} inactiveZone={0.01} borderWidth={1} variant="subtle" />
                                                        <div className="flex items-center gap-2 relative z-10">
                                                            <LIcon className={cn("w-4 h-4", sn.color)} />
                                                            <span className={cn("text-xs font-bold", sn.color)}>{sn.label}</span>
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        {/* TIME SATELLITE (Circular Time Picker) */}
                                        {pn.id === "time" && (
                                            <div
                                                className="absolute pointer-events-auto flex items-center justify-center"
                                                style={{ animation: `spring-out 500ms cubic-bezier(0.175, 0.885, 0.32, 1.275) BOTH` }}
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <CircularTimePicker
                                                    hideCenterText
                                                    startMins={localTime.start!.getHours() * 60 + localTime.start!.getMinutes()}
                                                    endMins={localTime.end!.getHours() * 60 + localTime.end!.getMinutes()}
                                                    onChange={(start: number, end: number) => {
                                                        const newStart = new Date(localTime.start!);
                                                        newStart.setHours(Math.floor(start / 60), start % 60, 0, 0);

                                                        const newEnd = new Date(localTime.end!);
                                                        newEnd.setHours(Math.floor(end / 60), end % 60, 0, 0);

                                                        if (newEnd < newStart) {
                                                            newEnd.setDate(newEnd.getDate() + 1);
                                                        } else if (newEnd.getTime() - newStart.getTime() > 86400000) {
                                                            newEnd.setDate(newEnd.getDate() - 1);
                                                        }

                                                        setLocalTime({ start: newStart, end: newEnd });
                                                    }}
                                                    onChangeEnd={(start: number, end: number) => {
                                                        const newStart = new Date(localTime.start!);
                                                        newStart.setHours(Math.floor(start / 60), start % 60, 0, 0);

                                                        const newEnd = new Date(localTime.end!);
                                                        newEnd.setHours(Math.floor(end / 60), end % 60, 0, 0);

                                                        if (newEnd < newStart) {
                                                            newEnd.setDate(newEnd.getDate() + 1);
                                                        } else if (newEnd.getTime() - newStart.getTime() > 86400000) {
                                                            newEnd.setDate(newEnd.getDate() - 1);
                                                        }

                                                        updateBlock(block.id, { startAt: newStart, endAt: newEnd });
                                                    }}
                                                />
                                                {(guidedStep === "time" || isNewBlock) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (guidedStep === "time") {
                                                                setGuidedStep("type");
                                                                setActivePrimaryNode("type");
                                                            } else {
                                                                setActivePrimaryNode(null);
                                                            }
                                                        }}
                                                        className="absolute top-[calc(100%+30px)] left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-xl bg-indigo-500/80 border border-indigo-400/50 text-indigo-50 font-bold text-sm shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:bg-indigo-500 hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] hover:scale-[1.05] active:scale-95 transition-all duration-300 backdrop-blur-md whitespace-nowrap"
                                                    >
                                                        {guidedStep === "time" ? "Confirmar y Continuar" : "Confirmar"}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Global Styles for the spring animation */}
            <style>{`
                @keyframes spring-out {
                    0% { scale: 0.5; opacity: 0; }
                    100% { scale: 1; opacity: 1; }
                }
                @keyframes spring-out-planet {
                    0% { translate: 0px 0px; scale: 0; opacity: 0; }
                    100% { scale: 1; opacity: 1; } 
                }
            `}</style>

            {/* ─── ALERT DIALOG DELETION ─── */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar bloque repetitivo?</AlertDialogTitle>
                        <AlertDialogDescription className="text-white/50">
                            Este bloque forma parte de una repetición. ¿Deseas eliminar solo este horario o todos los horarios vinculados?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                        <AlertDialogCancel className="bg-white/5 border-transparent text-white hover:bg-white/10 hover:text-white mt-0 h-10">
                            Cancelar
                        </AlertDialogCancel>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <AlertDialogAction
                                onClick={() => confirmDelete('one')}
                                className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20 w-full sm:w-auto h-10 flex-1"
                            >
                                Solo este
                            </AlertDialogAction>
                            <AlertDialogAction
                                onClick={() => confirmDelete('series')}
                                className="bg-red-500 text-white hover:bg-red-600 w-full sm:w-auto h-10 flex-1"
                            >
                                Todos
                            </AlertDialogAction>
                        </div>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
