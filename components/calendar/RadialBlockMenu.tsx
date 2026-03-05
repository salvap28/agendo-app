"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
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

const BLOCK_TYPES_UI: { value: BlockType; label: string; icon: any; color: string; bg: string; hoverBg: string }[] = [
    { value: "deep_work", label: "Deep Work", icon: Layers, color: "text-indigo-400", bg: "bg-indigo-400/20", hoverBg: "hover:bg-indigo-500" },
    { value: "meeting", label: "Meeting", icon: Briefcase, color: "text-blue-400", bg: "bg-blue-400/20", hoverBg: "hover:bg-blue-500" },
    { value: "gym", label: "Gym", icon: Dumbbell, color: "text-emerald-400", bg: "bg-emerald-400/20", hoverBg: "hover:bg-emerald-500" },
    { value: "study", label: "Study", icon: BookOpen, color: "text-amber-400", bg: "bg-amber-400/20", hoverBg: "hover:bg-amber-500" },
    { value: "admin", label: "Admin", icon: Activity, color: "text-slate-400", bg: "bg-slate-400/20", hoverBg: "hover:bg-slate-500" },
    { value: "break", label: "Break", icon: Coffee, color: "text-rose-400", bg: "bg-rose-400/20", hoverBg: "hover:bg-rose-500" },
    { value: "other", label: "Other", icon: MoreHorizontal, color: "text-neutral-400", bg: "bg-neutral-400/20", hoverBg: "hover:bg-neutral-500" },
];

const STATUS_OPTS: { value: BlockStatus; label: string; icon: any; color: string; bg: string }[] = [
    { value: "planned", label: "Planificado", icon: MoreHorizontal, color: "text-white/50", bg: "bg-white/10" },
    { value: "active", label: "En progreso", icon: Play, color: "text-green-400", bg: "bg-green-400/20" },
    { value: "completed", label: "Completado", icon: CheckCircle2, color: "text-indigo-400", bg: "bg-indigo-400/20" },
    { value: "canceled", label: "Cancelado", icon: XCircle, color: "text-red-400", bg: "bg-red-400/20" },
];

// Nodos primarios que orbitan el bloque
type PrimaryNode = "type" | "status" | "time" | "delete" | "focus" | "center";
const PRIMARY_NODE_ORDER: Array<Exclude<PrimaryNode, "center">> = ["type", "focus", "time", "status", "delete"];

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

const PRIMARY_ORBIT_RADIUS_MOBILE = 124;
const PRIMARY_ORBIT_RADIUS_DESKTOP = 168;

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
    const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [pressedType, setPressedType] = useState<BlockType | null>(null);
    const [primaryRadius, setPrimaryRadius] = useState(PRIMARY_ORBIT_RADIUS_DESKTOP);

    useEffect(() => {
        setMounted(true);
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);

            // Fixed orbit diameter relative to viewport size.
            const viewportBase = Math.min(window.innerWidth, window.innerHeight);
            const rawRadius = Math.round(viewportBase * (mobile ? 0.32 : 0.24));
            const minRadius = mobile ? PRIMARY_ORBIT_RADIUS_MOBILE - 26 : PRIMARY_ORBIT_RADIUS_DESKTOP - 48;
            const maxRadius = mobile ? PRIMARY_ORBIT_RADIUS_MOBILE + 26 : PRIMARY_ORBIT_RADIUS_DESKTOP + 52;
            const nextRadius = Math.max(minRadius, Math.min(maxRadius, rawRadius));
            setPrimaryRadius(nextRadius);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Guided initialization pass
    const [guidedStep, setGuidedStep] = useState<"center" | "time" | "type" | null>(isNewBlock ? "center" : null);

    useEffect(() => {
        if (isNewBlock) {
            // Delay auto-opening center to allow the orbital entrance animation to play first
            const timer = setTimeout(() => {
                setActivePrimaryNode("center");
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [isNewBlock]);

    // Draft state para no aplicar repeticiones instantáneamente
    const [draftRecurrence, setDraftRecurrence] = useState<RecurrencePattern | undefined>(block?.recurrencePattern);

    // Fast local state for 60fps radial dragging without entire WeekView re-rendering
    const [localTime, setLocalTime] = useState({ start: block?.startAt, end: block?.endAt });
    const localStartMs = localTime.start?.getTime() ?? 0;
    const localEndMs = localTime.end?.getTime() ?? 0;

    useEffect(() => {
        if (activePrimaryNode === "center") {
            setDraftRecurrence(block?.recurrencePattern);
        }
        if (block?.startAt && block?.endAt) {
            setLocalTime({ start: block.startAt, end: block.endAt });
        }
    }, [activePrimaryNode, block?.recurrencePattern, block?.startAt, block?.endAt]);

    const setOrbitPosition = (el: HTMLElement, x: number, y: number) => {
        // Keep a fixed radius with stable positioning on mobile/desktop.
        el.style.left = `calc(50% + ${x}px)`;
        el.style.top = `calc(50% + ${y}px)`;
        el.style.removeProperty("translate");
    };

    const getInitialZoomForNode = useCallback((node: PrimaryNode) => {
        if (isMobile) {
            if (node === "time") return 0.9;
            if (node === "type") return 1;
            if (node === "status") return 1.05;
            if (node === "center") return 1.06;
            return 1.18;
        }
        if (node === "time") return 1.15;
        return 1.3;
    }, [isMobile]);

    const [zoomByNode, setZoomByNode] = useState<Partial<Record<PrimaryNode, number>>>({});
    const zoomByNodeRef = useRef<Partial<Record<PrimaryNode, number>>>(zoomByNode);

    useEffect(() => {
        zoomByNodeRef.current = zoomByNode;
    }, [zoomByNode]);

    const getFocusZoom = useCallback((node: PrimaryNode | null) => {
        if (!node) return 1;
        return zoomByNode[node] ?? getInitialZoomForNode(node);
    }, [zoomByNode, getInitialZoomForNode]);

    const measureFocusContentAndUpdateZoom = useCallback((node: PrimaryNode) => {
        if (node === "center") return;

        const nodeIndex = PRIMARY_NODE_ORDER.indexOf(node as Exclude<PrimaryNode, "center">);
        if (nodeIndex === -1) return;

        // Bypassear la medición dinámica para listas móviles full-width, sino la cámara se aleja al infinito
        if (isMobile && (node === "type" || node === "status")) {
            setZoomByNode((prev) => {
                const targetZoom = getInitialZoomForNode(node);
                if (Math.abs((prev[node] ?? 1) - targetZoom) <= 0.02) return prev;
                const updated = { ...prev, [node]: targetZoom };
                zoomByNodeRef.current = updated;
                return updated;
            });
            return;
        }

        const root = planetRefs.current[nodeIndex];
        if (!root) return;

        const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (const element of elements) {
            const style = window.getComputedStyle(element);
            if (style.display === "none" || style.visibility === "hidden") continue;

            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;

            minX = Math.min(minX, rect.left);
            minY = Math.min(minY, rect.top);
            maxX = Math.max(maxX, rect.right);
            maxY = Math.max(maxY, rect.bottom);
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return;

        const currentZoom = zoomByNodeRef.current[node] ?? getInitialZoomForNode(node);
        const rawWidth = (maxX - minX) / Math.max(currentZoom, 0.01);
        const rawHeight = (maxY - minY) / Math.max(currentZoom, 0.01);

        const horizontalPadding = isMobile ? 14 : 24;
        const topPadding = isMobile ? 112 : 96;
        const bottomPadding = isMobile ? 18 : 24;

        const availableWidth = Math.max(120, window.innerWidth - horizontalPadding * 2);
        const availableHeight = Math.max(120, window.innerHeight - topPadding - bottomPadding);

        const fitZoom = Math.min(availableWidth / rawWidth, availableHeight / rawHeight);
        const maxZoom = isMobile ? 1.26 : 1.35;
        const minZoom = isMobile ? 0.72 : 0.82;
        const nextZoom = Math.max(minZoom, Math.min(maxZoom, fitZoom));

        if (!Number.isFinite(nextZoom) || Math.abs(nextZoom - currentZoom) <= 0.02) return;

        setZoomByNode((prev) => {
            if (Math.abs((prev[node] ?? currentZoom) - nextZoom) <= 0.02) return prev;
            const updated = { ...prev, [node]: nextZoom };
            zoomByNodeRef.current = updated;
            return updated;
        });
    }, [getInitialZoomForNode, isMobile]);

    useEffect(() => {
        if (!activePrimaryNode) return;

        let canceled = false;
        const runMeasure = () => {
            if (canceled) return;
            measureFocusContentAndUpdateZoom(activePrimaryNode);
        };

        const rafId = requestAnimationFrame(runMeasure);
        const settleTimer = window.setTimeout(runMeasure, 620);

        return () => {
            canceled = true;
            cancelAnimationFrame(rafId);
            window.clearTimeout(settleTimer);
        };
    }, [
        activePrimaryNode,
        measureFocusContentAndUpdateZoom,
        primaryRadius,
        localStartMs,
        localEndMs
    ]);

    const setGalaxyCamera = (x: number, y: number, zoom: number) => {
        if (!galaxyRef.current) return;
        galaxyRef.current.style.setProperty("translate", `${x}px ${y}px`);
        galaxyRef.current.style.setProperty("scale", String(zoom));
        galaxyRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
    };

    // Animación física de alto rendimiento a 60fps usando requestAnimationFrame
    useEffect(() => {
        let animationFrameId: number;
        // Estado local de la física para no disparar re-renders de React
        const physics = { angle: 0, speed: 20, offset: { x: 0, y: 0 } };

        const animate = () => {
            if (!activePrimaryNode) {
                physics.angle = (physics.angle + physics.speed) % 360;
                if (physics.speed > 0.05) {
                    physics.speed = Math.max(0.05, physics.speed * 0.92); // Desacelera hasta el giro constante de fondo
                }
            }

            // Aplicar posiciones directo al DOM saltando el Virtual DOM (60 FPS puros)
            const currentObjPrimary = primaryRadius;
            let targetAnchor = { x: 0, y: 0 };

            if (activePrimaryNode && activePrimaryNode !== "center") {
                const activeIndex = PRIMARY_NODE_ORDER.indexOf(activePrimaryNode);
                if (activeIndex !== -1) {
                    targetAnchor = calculateNodePosition(activeIndex, 5, currentObjPrimary, physics.angle);
                }
            }

            // Interpolación lineal (Lerp) para movimiento suave de cámara 
            physics.offset.x += (targetAnchor.x - physics.offset.x) * 0.12;
            physics.offset.y += (targetAnchor.y - physics.offset.y) * 0.12;

            planetRefs.current.forEach((el, i) => {
                if (el) {
                    const pos = calculateNodePosition(i, 5, currentObjPrimary, physics.angle); // 5 planets
                    const x = pos.x - physics.offset.x;
                    const y = pos.y - physics.offset.y;
                    setOrbitPosition(el, x, y);
                }
            });

            // Zoom de cámara: si hay un nodo activo, desplazamos la galaxia para centrarlo
            if (galaxyRef.current) {
                if (activePrimaryNode) {
                    const focusZoom = getFocusZoom(activePrimaryNode);
                    setGalaxyCamera(0, 0, focusZoom);
                } else {
                    // Volver a la vista normal
                    setGalaxyCamera(0, 0, 1);
                }
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [activePrimaryNode, isMobile, primaryRadius, getFocusZoom]);


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
            if (activePrimaryNode || isDeleteConfirming) {
                setActivePrimaryNode(null);
                setIsDeleteConfirming(false);
            } else {
                handleClose();
            }
        }
    };

    const handlePrimaryClick = (node: PrimaryNode, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!block) return;

        if (node === "delete") {
            if (block.recurrenceId) {
                setDeleteConfirmOpen(true);
            } else {
                if (isDeleteConfirming) {
                    deleteBlock(block.id);
                    handleClose();
                } else {
                    setIsDeleteConfirming(true);
                }
            }
            return;
        }

        setIsDeleteConfirming(false);

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
        setPressedType(null);
        setActivePrimaryNode(prev => prev === node ? null : node);
    };

    const handleTypeSelect = (type: BlockType, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!block) return;
        setPressedType(null);
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
        if (!block) return;
        setStatus(block.id, status);
        setActivePrimaryNode(null);
    };

    const confirmDelete = (type: 'one' | 'series') => {
        if (!block) return;
        if (type === 'one') deleteBlock(block.id);
        else if (block.recurrenceId) deleteBlockSeries(block.recurrenceId);
        setDeleteConfirmOpen(false);
        handleClose();
    };

    // Datos visuales del bloque actual
    const activeType = BLOCK_TYPES_UI.find(t => t.value === block?.type) || BLOCK_TYPES_UI[6];
    const activeStatus = STATUS_OPTS.find(s => s.value === block?.status) || STATUS_OPTS[0];

    // Array de primary nodes
    const primaryNodes = [
        { id: "type" as const, label: "Categoría", icon: activeType.icon, color: activeType.color, bg: activeType.bg },
        { id: "focus" as const, label: "Focus", icon: Zap, color: "text-purple-500", bg: "bg-purple-500/20" },
        { id: "time" as const, label: "Horario", icon: Clock, color: "text-white/70", bg: "bg-white/10" },
        { id: "status" as const, label: "Estado", icon: activeStatus.icon, color: activeStatus.color, bg: activeStatus.bg },
        { id: "delete" as const, label: "Eliminar", icon: Trash2, color: "text-red-400", bg: "bg-red-500/10" },
    ];

    const PRIMARY_RADIUS = primaryRadius;
    const SECONDARY_RADIUS = isMobile ? 66 : 100;

    const pillWidthExpanded = isMobile ? "w-32 rounded-[2rem] px-3" : "w-40 rounded-[2rem] px-5";
    const pillHeightClass = isMobile ? "h-12" : "h-16";
    const scaleExpanded = isMobile ? "scale-[1.10]" : "scale-[1.15]";
    const pillWidthDefault = isMobile ? "w-12 rounded-full" : "w-16 rounded-full";

    if (!block || !mounted) return null;

    return createPortal(
        <div
            ref={containerRef}
            className={cn(
                "fixed inset-0 z-[200] flex items-center justify-center duration-500 overflow-hidden fill-mode-forwards",
                isClosing ? "animate-out fade-out pointer-events-none" : "animate-in fade-in"
            )}
            onClick={handleBackgroundClick}
        >
            {/* Dark glass backdrop */}
            <div className="absolute inset-0 bg-black/75 backdrop-blur-2xl pointer-events-none" />

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

            {activePrimaryNode === "focus" && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        openFromBlock(block.id, block.type);
                        handleClose();
                    }}
                    className="absolute top-[calc(env(safe-area-inset-top,0px)+68px)] left-1/2 -translate-x-1/2 z-[320] h-11 px-5 rounded-full bg-purple-500/25 border border-purple-300/35 text-purple-50 text-xs font-bold tracking-wider shadow-[0_10px_28px_-12px_rgba(168,85,247,0.6)] backdrop-blur-xl hover:bg-purple-500/35 hover:border-purple-200/45 hover:scale-[1.03] active:scale-95 transition-all duration-300 whitespace-nowrap"
                >
                    INICIAR FOCUS
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
                        activePrimaryNode ? "opacity-20" : "opacity-100"
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
                        activePrimaryNode === "center" ? `p-6 ${isMobile ? "w-[240px]" : "w-[280px]"} cursor-default` : "p-6 w-auto cursor-pointer hover:scale-[1.02] active:scale-[0.98] border-white/30 hover:border-indigo-400/30 hover:shadow-[0_0_40px_rgba(129,140,248,0.2)]"
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
                                    className={cn("font-bold tracking-tight text-white bg-black/40 border border-white/10 rounded-xl px-3 h-10 focus-visible:ring-1 focus-visible:ring-indigo-500/50 placeholder:text-white/20 shadow-inner",
                                        isMobile ? "text-base" : "text-lg")}
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
                                    "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-700 pointer-events-auto",
                                    isDimmed ? "opacity-10 scale-75 blur-sm" : "opacity-100 scale-100",
                                    isFocused || (pn.id === "delete" && isDeleteConfirming && !block.recurrenceId) ? "z-[100]" : "z-10"
                                )}
                                style={{
                                    left: `calc(50% + ${pos.x}px)`,
                                    top: `calc(50% + ${pos.y}px)`,
                                    animation: `spring-out-planet 600ms cubic-bezier(0.175, 0.885, 0.32, 1.275) BOTH`
                                }}
                            >
                                {/* Píldora del Planeta */}
                                <button
                                    onClick={(e) => handlePrimaryClick(pn.id, e)}
                                    className={cn(
                                        "flex items-center justify-center border transition-all duration-300 backdrop-blur-md relative overflow-hidden",
                                        pillHeightClass,
                                        pn.id === "focus" && isFocused ? pillWidthExpanded :
                                            pn.id === "delete" && isDeleteConfirming && !block.recurrenceId ? `${pillWidthExpanded} bg-red-500 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] ${scaleExpanded}` : `${pillWidthDefault} hover:${scaleExpanded}`,
                                        "active:scale-95",
                                        isFocused
                                            ? `${scaleExpanded} shadow-[0_0_30px_currentColor] border-white/40 ${pn.bg}`
                                            : pn.id === "delete" && isDeleteConfirming && !block.recurrenceId ? "" : `bg-[#0c0c0f] border-white/10 hover:${pn.bg} hover:border-${pn.color.replace('text-', '')}/30`,
                                        pn.id === "focus" && !isFocused && "hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:border-purple-500/50" // Distinctive focus hover
                                    )}
                                    style={{
                                        color: isFocused || (pn.id === "delete" && isDeleteConfirming && !block.recurrenceId) ? 'white' : undefined,
                                    }}
                                >
                                    <GlowingEffect spread={35} proximity={80} inactiveZone={0.01} borderWidth={1} variant="subtle" />
                                    {isFocused && pn.id !== "focus" && (
                                        <div className="absolute inset-0 rounded-full animate-ping opacity-20 border border-current" />
                                    )}
                                    <div className={cn("flex items-center relative z-10 transition-all duration-300", (pn.id === "focus" && isFocused) || (pn.id === "delete" && isDeleteConfirming && !block.recurrenceId) ? "gap-2" : "gap-0")}>
                                        <PIcon className={cn("w-6 h-6", isFocused || (pn.id === "delete" && isDeleteConfirming && !block.recurrenceId) ? "text-white" : pn.color)} />
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
                                        {pn.id === "delete" && (
                                            <span
                                                className={cn(
                                                    "font-bold whitespace-nowrap text-white text-sm transition-all duration-300",
                                                    isDeleteConfirming && !block.recurrenceId ? "opacity-100 max-w-[100px]" : "opacity-0 max-w-0 overflow-hidden"
                                                )}
                                            >
                                                Confirmar
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
                                    <div
                                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 flex items-center justify-center pointer-events-none"
                                    >



                                        {/* TYPE SATELLITES (DESKTOP) */}
                                        {pn.id === "type" && !isMobile && BLOCK_TYPES_UI.map((tn, j) => {
                                            const lPos = calculateNodePosition(j, BLOCK_TYPES_UI.length, SECONDARY_RADIUS, -90);
                                            const LIcon = tn.icon;
                                            const isSelected = tn.value === activeType.value;
                                            const isPressing = isMobile && pressedType === tn.value;
                                            return (
                                                <div
                                                    key={tn.value}
                                                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                                    style={{
                                                        left: `${lPos.x}px`,
                                                        top: `${lPos.y}px`,
                                                        animation: `satellite-orbit 500ms cubic-bezier(0.175, 0.885, 0.32, 1.275) ${j * 30}ms BOTH`
                                                    }}
                                                >
                                                    <button
                                                        onClick={(e) => handleTypeSelect(tn.value, e)}
                                                        onPointerDown={(e) => {
                                                            e.stopPropagation();
                                                            if (isMobile) setPressedType(tn.value);
                                                        }}
                                                        onPointerUp={() => {
                                                            if (isMobile) setPressedType(null);
                                                        }}
                                                        onPointerLeave={() => {
                                                            if (isMobile) setPressedType(null);
                                                        }}
                                                        onPointerCancel={() => {
                                                            if (isMobile) setPressedType(null);
                                                        }}
                                                        className={cn(
                                                            "group pointer-events-auto rounded-full flex items-center relative overflow-hidden active:scale-95",
                                                            "transition-[max-width,padding,background-color,border-color,box-shadow,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                                                            isMobile ? "max-w-[36px] min-w-[36px] h-9" : "min-w-[40px] max-w-[40px] h-10",
                                                            isPressing
                                                                ? (isMobile ? "max-w-[132px] px-3.5 justify-start" : "max-w-[200px] px-5 justify-start")
                                                                : "px-0 justify-center hover:max-w-[200px] hover:px-5 hover:justify-start",
                                                            tn.hoverBg, "hover:border-transparent",
                                                            isSelected ? `${tn.bg} border ${tn.color.replace('text-', 'border-')} shadow-[0_0_15px_currentColor]` : "bg-black/80 border border-white/10 backdrop-blur-sm hover:border-white/30",
                                                            isPressing && "border-transparent"
                                                        )}
                                                    >
                                                        <GlowingEffect spread={25} proximity={60} inactiveZone={0.01} borderWidth={1} variant="subtle" />
                                                        <div className={cn(
                                                            "flex items-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] relative z-10 shrink-0",
                                                            isPressing ? "justify-start gap-2.5 w-auto" : "justify-center gap-0 w-full group-hover:justify-start group-hover:gap-2.5 group-hover:w-auto"
                                                        )}>
                                                            <LIcon className={cn(
                                                                "w-4 h-4 shrink-0 transition-all duration-500 ease-out",
                                                                isPressing ? "text-white" : `group-hover:text-white ${tn.color}`
                                                            )} />
                                                            <span className={cn(
                                                                "text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                                                                isPressing
                                                                    ? (isMobile ? "opacity-100 max-w-[84px] text-white" : "opacity-100 max-w-[150px] text-white")
                                                                    : "opacity-0 max-w-0 group-hover:opacity-100 group-hover:max-w-[150px] group-hover:text-white",
                                                                tn.color
                                                            )}>
                                                                {tn.label}
                                                            </span>
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })}



                                        {/* STATUS SATELLITES (DESKTOP) */}
                                        {pn.id === "status" && !isMobile && STATUS_OPTS.map((sn, j) => {
                                            // Equidistant perfect 360 degree distribution starting from top
                                            const statusOrbitRadius = 140;
                                            const lPos = calculateNodePosition(j, STATUS_OPTS.length, statusOrbitRadius, -90);
                                            const LIcon = sn.icon;
                                            const isSelected = sn.value === activeStatus.value;
                                            const statusLabel = sn.label;
                                            return (
                                                <div
                                                    key={sn.value}
                                                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                                    style={{
                                                        left: `${lPos.x}px`,
                                                        top: `${lPos.y}px`,
                                                        animation: `satellite-orbit 500ms cubic-bezier(0.175, 0.885, 0.32, 1.275) ${j * 50}ms BOTH`
                                                    }}
                                                >
                                                    <button
                                                        onClick={(e) => handleStatusSelect(sn.value, e)}
                                                        className={cn(
                                                            "pointer-events-auto flex items-center gap-2 rounded-full whitespace-nowrap transition-all duration-300 hover:scale-110 active:scale-95 relative overflow-hidden",
                                                            "h-11 px-4",
                                                            isSelected ? `${sn.bg} border ${sn.color.replace('text-', 'border-')}` : `bg-black/80 border border-white/10 backdrop-blur-sm hover:${sn.bg} hover:border-${sn.color.replace('text-', '')}/30`
                                                        )}
                                                    >
                                                        <GlowingEffect spread={30} proximity={70} inactiveZone={0.01} borderWidth={1} variant="subtle" />
                                                        <div className="flex items-center gap-2 relative z-10">
                                                            <LIcon className={cn("w-4 h-4", sn.color)} />
                                                            <span className={cn("text-xs font-bold truncate", sn.color)}>{statusLabel}</span>
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

            {/* MOBILE LISTS (Rendered at root to avoid transform clipping) */}
            {isMobile && activePrimaryNode === "type" && (
                <div
                    className="absolute left-0 right-0 top-1/2 z-[400] pointer-events-auto flex justify-center w-full"
                    style={{ animation: 'mobile-menu-enter 400ms cubic-bezier(0.16, 1, 0.3, 1) 300ms both' }}
                >
                    <div className="flex overflow-x-auto gap-3 pb-4 px-6 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full max-w-full">
                        {BLOCK_TYPES_UI.map((tn) => {
                            const LIcon = tn.icon;
                            const isSelected = tn.value === activeType.value;
                            return (
                                <button
                                    key={tn.value}
                                    onClick={(e) => handleTypeSelect(tn.value, e)}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-2 min-w-[96px] h-24 p-3 rounded-3xl transition-all duration-300 snap-center relative overflow-hidden active:scale-95",
                                        isSelected
                                            ? "bg-white/[0.12] ring-1 ring-white/20 shadow-xl"
                                            : "bg-black/80 border border-white/10 hover:bg-white/[0.05]"
                                    )}
                                >
                                    <GlowingEffect spread={30} proximity={60} inactiveZone={0.01} borderWidth={1} variant="subtle" />
                                    {isSelected && (
                                        <div className={cn("absolute inset-0 opacity-20 blur-xl transition-all", tn.bg)} />
                                    )}
                                    <div className={cn(
                                        "w-10 h-10 rounded-2xl flex items-center justify-center transition-all z-10",
                                        isSelected ? `${tn.bg} ${tn.color.replace('text-', 'text-')} shadow-[0_0_15px_currentColor]` : "bg-white/[0.04] text-white/40"
                                    )}>
                                        <LIcon size={20} />
                                    </div>
                                    <span className={cn(
                                        "text-xs font-bold uppercase tracking-wider z-10 transition-colors whitespace-nowrap",
                                        isSelected ? "text-white" : "text-white/50"
                                    )}>
                                        {tn.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {isMobile && activePrimaryNode === "status" && (
                <div
                    className="absolute left-0 right-0 top-1/2 z-[400] pointer-events-auto flex justify-center w-full"
                    style={{ animation: 'mobile-menu-enter 400ms cubic-bezier(0.16, 1, 0.3, 1) 300ms both' }}
                >
                    <div className="flex overflow-x-auto gap-3 pb-4 px-6 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full max-w-full">
                        {STATUS_OPTS.map((sn) => {
                            const LIcon = sn.icon;
                            const isSelected = sn.value === activeStatus.value;
                            return (
                                <button
                                    key={sn.value}
                                    onClick={(e) => handleStatusSelect(sn.value, e)}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-2 min-w-[96px] h-24 p-3 rounded-3xl transition-all duration-300 snap-center relative overflow-hidden active:scale-95",
                                        isSelected
                                            ? "bg-white/[0.12] ring-1 ring-white/20 shadow-xl"
                                            : "bg-black/80 border border-white/10 hover:bg-white/[0.05]"
                                    )}
                                >
                                    <GlowingEffect spread={30} proximity={60} inactiveZone={0.01} borderWidth={1} variant="subtle" />
                                    {isSelected && (
                                        <div className={cn("absolute inset-0 opacity-20 blur-xl transition-all", sn.bg)} />
                                    )}
                                    <div className={cn(
                                        "w-10 h-10 rounded-2xl flex items-center justify-center transition-all z-10",
                                        isSelected ? `${sn.bg} ${sn.color} shadow-[0_0_15px_currentColor]` : "bg-white/[0.04] text-white/40"
                                    )}>
                                        <LIcon size={20} />
                                    </div>
                                    <span className={cn(
                                        "text-xs font-bold uppercase tracking-wider z-10 transition-colors whitespace-nowrap",
                                        isSelected ? "text-white" : "text-white/50"
                                    )}>
                                        {sn.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Global Styles for the spring animation */}
            <style>{`
                @keyframes mobile-menu-enter {
                    0% { opacity: 0; transform: translateY(120px) scale(0.95); }
                    100% { opacity: 1; transform: translateY(80px) scale(1); }
                }
                @keyframes spring-out {
                    0% { scale: 0.5; opacity: 0; }
                    100% { scale: 1; opacity: 1; }
                }
                @keyframes spring-out-planet {
                    0% { left: 50%; top: 50%; scale: 0; opacity: 0; }
                    100% { scale: 1; opacity: 1; } 
                }
                @keyframes satellite-orbit {
                    0% { left: 0px; top: 0px; opacity: 0; }
                    100% { opacity: 1; }
                }
            `}</style>

            {/* ─── ALERT DIALOG DELETION ─── */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent
                    overlayClassName="z-[450] bg-black/60 backdrop-blur-md"
                    className="z-[460] bg-black/90 border-white/10 backdrop-blur-2xl text-white"
                >
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
        </div>,
        document.body
    );
}
