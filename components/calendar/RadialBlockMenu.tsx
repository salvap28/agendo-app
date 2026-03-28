"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Block, BlockType, BlockStatus, RecurrencePattern } from "@/lib/types/blocks";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { useFocusStore } from "@/lib/stores/focusStore";
import {
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
    Clock,
    X,
    Bell,
    ArrowLeft,
    Repeat,
    Layers,
    type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/cn";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { CircularTimePicker } from "@/components/focus/CircularTimePicker";
import { Input } from "@/components/ui/input";
import { PlanningRecommendation } from "@/lib/types/planning";
import {
    acceptPlanningRecommendation,
    applyPlanningRecommendation,
    canApplyRecommendation,
    dismissPlanningRecommendation,
    fetchBlockPlanning,
} from "@/lib/services/planningService";
import { PlanningRecommendationCard } from "@/components/planning/PlanningRecommendationCard";
import { useActivityExperienceStore } from "@/lib/stores/activityExperienceStore";
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
import { OverlapResolutionModal, OverlapResolutionType } from "@/components/calendar/OverlapResolutionModal";
import { isOverlapping, findNextFreeSlot } from "@/lib/utils/scheduling";
import { resolveOverlapBySlicingUnderlying, resolveOverlapByShrinkingNew } from "@/lib/utils/overlapResolution";
import { useI18n } from "@/lib/i18n/client";
import { getBlockStatusLabel, getBlockTypeLabel, getRecurrenceLabel, getWeekdayInitialsSundayFirst } from "@/lib/i18n/app";
import { getRadialBlockMenuCopy } from "@/lib/i18n/ui";

// ─── CONFIGURATION ──────────────────────────────────────────────────────────

const BLOCK_TYPES_UI: { value: BlockType; icon: LucideIcon; color: string; bg: string; hoverBg: string }[] = [
    { value: "deep_work", icon: Layers, color: "text-indigo-400", bg: "bg-indigo-400/20", hoverBg: "hover:bg-indigo-500" },
    { value: "meeting", icon: Briefcase, color: "text-blue-400", bg: "bg-blue-400/20", hoverBg: "hover:bg-blue-500" },
    { value: "gym", icon: Dumbbell, color: "text-emerald-400", bg: "bg-emerald-400/20", hoverBg: "hover:bg-emerald-500" },
    { value: "study", icon: BookOpen, color: "text-amber-400", bg: "bg-amber-400/20", hoverBg: "hover:bg-amber-500" },
    { value: "admin", icon: Activity, color: "text-slate-400", bg: "bg-slate-400/20", hoverBg: "hover:bg-slate-500" },
    { value: "break", icon: Coffee, color: "text-rose-400", bg: "bg-rose-400/20", hoverBg: "hover:bg-rose-500" },
    { value: "other", icon: MoreHorizontal, color: "text-neutral-400", bg: "bg-neutral-400/20", hoverBg: "hover:bg-neutral-500" },
];

const STATUS_OPTS: { value: BlockStatus; icon: LucideIcon; color: string; bg: string }[] = [
    { value: "planned", icon: MoreHorizontal, color: "text-white/50", bg: "bg-white/10" },
    { value: "active", icon: Play, color: "text-green-400", bg: "bg-green-400/20" },
    { value: "completed", icon: CheckCircle2, color: "text-indigo-400", bg: "bg-indigo-400/20" },
    { value: "canceled", icon: XCircle, color: "text-red-400", bg: "bg-red-400/20" },
];

// Nodos primarios que orbitan el bloque
type PrimaryNode = "type" | "status" | "time" | "delete" | "focus" | "notifications" | "center";
const PRIMARY_NODE_ORDER: Array<Exclude<PrimaryNode, "center">> = ["type", "focus", "time", "status", "notifications", "delete"];

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
    const { language } = useI18n();
    const { blocks, updateBlock, createBlock, deleteBlock, deleteBlockSeries, setStatus, applyRecurrence, fetchBlocks } = useBlocksStore();
    const { openFromBlock } = useFocusStore();
    const {
        refreshBlockExperience,
        inferBlockExperience,
    } = useActivityExperienceStore();

    const block = blocks.find(b => b.id === blockId);
    const recurrenceDayLabels = getWeekdayInitialsSundayFirst(language);
    const copy = React.useMemo(() => getRadialBlockMenuCopy(language), [language]);

    // Estado Orbital
    const [activePrimaryNode, setActivePrimaryNode] = useState<PrimaryNode | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const planetRefs = useRef<(HTMLDivElement | null)[]>([]);
    const galaxyRef = useRef<HTMLDivElement>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
    const [isFocusConfirming, setIsFocusConfirming] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [pressedType, setPressedType] = useState<BlockType | null>(null);
    const [primaryRadius, setPrimaryRadius] = useState(PRIMARY_ORBIT_RADIUS_DESKTOP);
    const [isTimeDragging, setIsTimeDragging] = useState(false);
    const [isAddingNotification, setIsAddingNotification] = useState(false);
    const [customNotificationMins, setCustomNotificationMins] = useState("");
    const [planningRecommendations, setPlanningRecommendations] = useState<PlanningRecommendation[]>([]);
    const [planningApplyingId, setPlanningApplyingId] = useState<string | null>(null);
    const [planningLoading, setPlanningLoading] = useState(false);
    const [isAgendoOptionsOpen, setIsAgendoOptionsOpen] = useState(false);
    const [pendingConflict, setPendingConflict] = useState<{ newBlock: Partial<Block> & Pick<Block, "startAt" | "endAt" | "id">, overlaps: Block[] } | null>(null);
    const planningBlockId = block?.id ?? null;
    const planningDate = block?.startAt ? block.startAt.toISOString().slice(0, 10) : null;
    const planningSignature = React.useMemo(() => {
        if (!planningDate) return "";
        return blocks
            .filter((entry) => entry.startAt.toISOString().slice(0, 10) === planningDate)
            .map((entry) => [
                entry.id,
                entry.startAt.toISOString(),
                entry.endAt.toISOString(),
                entry.type,
                entry.priority ?? "",
                entry.difficulty ?? "",
                entry.flexibility ?? "",
                entry.intensity ?? "",
                entry.optional ?? "",
            ].join(":"))
            .join("|");
    }, [blocks, planningDate]);

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

    const refreshPlanning = useCallback(async () => {
        if (!planningBlockId || !planningDate) return;
        setPlanningLoading(true);
        try {
            const guide = await fetchBlockPlanning(planningBlockId, planningDate);
            setPlanningRecommendations(guide.recommendations.slice(0, 3));
        } catch (error) {
            console.error("Failed to fetch block planning", error);
        } finally {
            setPlanningLoading(false);
        }
    }, [planningBlockId, planningDate]);

    useEffect(() => {
        if (!planningBlockId || !planningDate) return;
        void refreshPlanning();
    }, [planningSignature, planningBlockId, planningDate, refreshPlanning]);

    useEffect(() => {
        if (!block?.id) return;
        void refreshBlockExperience(block.id).then((experience) => {
            if (!experience && block.endAt.getTime() <= Date.now() && !(block.requiresFocusMode ?? false)) {
                void inferBlockExperience(block.id);
            }
        });
    }, [block?.id, block?.status, block?.startAt, block?.endAt, block?.requiresFocusMode, refreshBlockExperience, inferBlockExperience]);



    const handleDismissPlanning = async (recommendation: PlanningRecommendation) => {
        await dismissPlanningRecommendation(recommendation.id);
        await refreshPlanning();
    };

    const handleAcceptPlanning = async (recommendation: PlanningRecommendation) => {
        await acceptPlanningRecommendation(recommendation.id);
        await refreshPlanning();
    };

    const handleApplyPlanning = async (recommendation: PlanningRecommendation) => {
        setPlanningApplyingId(recommendation.id);
        try {
            await applyPlanningRecommendation(recommendation.id);
            await fetchBlocks();
            await refreshPlanning();
        } catch (error) {
            console.error("Failed to apply planning recommendation", error);
            await refreshPlanning();
        } finally {
            setPlanningApplyingId(null);
        }
    };



    const handleResolveConflict = (resolution: OverlapResolutionType) => {
        if (!pendingConflict || !block) return;
        const { newBlock, overlaps } = pendingConflict;

        const _currentBlocks = blocks.filter(b => b.status !== "canceled" && b.id !== newBlock.id);

        if (resolution === 'slice_underlying') {
            resolveOverlapBySlicingUnderlying(newBlock, overlaps, updateBlock, createBlock);
        } 
        else if (resolution === 'shrink_new') {
            resolveOverlapByShrinkingNew(newBlock, overlaps, createBlock, updateBlock);
        }
        else if (resolution === 'move_forward') {
            const durationMins = (newBlock.endAt.getTime() - newBlock.startAt.getTime()) / 60000;
            const slot = findNextFreeSlot(_currentBlocks, newBlock.startAt, durationMins, newBlock.id);
            
            if (slot) {
                updateBlock(newBlock.id!, { startAt: slot.startAt, endAt: slot.endAt });
            }
        }
        else if (resolution === 'keep_overlap') {
            updateBlock(newBlock.id!, { startAt: newBlock.startAt, endAt: newBlock.endAt });
        }

        setPendingConflict(null);
    };


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
    useEffect(() => {
        if (activePrimaryNode === "center") {
            setDraftRecurrence(block?.recurrencePattern);
        }
        if (block?.startAt && block?.endAt) {
            setLocalTime({ start: block.startAt, end: block.endAt });
        }
    }, [activePrimaryNode, block, block?.recurrencePattern, block?.startAt, block?.endAt]);

    const setOrbitPosition = (el: HTMLElement, x: number, y: number) => {
        // Use transform3d for strict GPU hardware acceleration, critical for mobile 60fps
        el.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0)`;
        // Enforce will-change to prevent Vercel/mobile repaints
        el.style.willChange = 'transform';
    };

    const getInitialZoomForNode = useCallback((node: PrimaryNode) => {
        if (isMobile) {
            if (node === "time") return 1.18;
            if (node === "type") return 1;
            if (node === "status") return 1.05;
            if (node === "center") return 1.06;
            return 1.18;
        }
        if (node === "time") return 1.35;
        return 1.3;
    }, [isMobile]);

    const [zoomByNode, setZoomByNode] = useState<Partial<Record<PrimaryNode, number>>>({});
    const zoomByNodeRef = useRef<Partial<Record<PrimaryNode, number>>>(zoomByNode);
    const isTimeDraggingRef = useRef(false);

    useEffect(() => {
        isTimeDraggingRef.current = isTimeDragging;
    }, [isTimeDragging]);

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

        // Bypassear la medición dinámica para listas móviles full-width y el TimePicker, sino la cámara ajusta el encuadre infinitamente al arrastrar
        if ((isMobile && (node === "type" || node === "status")) || node === "time") {
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
        primaryRadius
    ]);

    const setGalaxyCamera = (x: number, y: number, zoom: number) => {
        if (!galaxyRef.current) return;
        galaxyRef.current.style.setProperty("translate", `${x}px ${y}px`);
        galaxyRef.current.style.setProperty("scale", String(zoom));
        galaxyRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
    };

    const radialGlowDisabled = activePrimaryNode === "time" || isTimeDragging;

    // Animación física de alto rendimiento a 60fps usando requestAnimationFrame
    useEffect(() => {
        let animationFrameId: number;
        // Estado local de la física para no disparar re-renders de React
        const physics = { angle: 0, speed: 20, offset: { x: 0, y: 0 } };

        const animate = () => {
            if (isTimeDraggingRef.current) {
                animationFrameId = requestAnimationFrame(animate);
                return;
            }

            if (!activePrimaryNode) {
                physics.angle = (physics.angle + physics.speed) % 360;
                if (physics.speed > 0.05) {
                    physics.speed = Math.max(0.05, physics.speed * 0.92); // Desacelera hasta el giro constante de fondo
                }
            }

            // Aplicar posiciones directo al DOM saltando el Virtual DOM (60 FPS puros)
            // Cuando hay un nodo activo, el ángulo global se CONGELA, lo que evita "brincos" 
            // no deseados en la posición de destino
            const currentObjPrimary = primaryRadius;
            let targetAnchor = { x: 0, y: 0 };

            if (activePrimaryNode && activePrimaryNode !== "center") {
                // Kill any residual drag speed instantly so we don't calculate a shifting anchor
                physics.speed = 0;
                const activeIndex = PRIMARY_NODE_ORDER.indexOf(activePrimaryNode);
                if (activeIndex !== -1) {
                    targetAnchor = calculateNodePosition(activeIndex, PRIMARY_NODE_ORDER.length, currentObjPrimary, physics.angle);
                }
            } else {
                // Return camera to center smoothly
                targetAnchor = { x: 0, y: 0 };
            }

            // Interpolación lineal (Lerp) para movimiento suave de cámara 
            physics.offset.x += (targetAnchor.x - physics.offset.x) * 0.12;
            physics.offset.y += (targetAnchor.y - physics.offset.y) * 0.12;

            planetRefs.current.forEach((el, i) => {
                if (el) {
                    const pos = calculateNodePosition(i, PRIMARY_NODE_ORDER.length, currentObjPrimary, physics.angle);
                    // The planet stays exactly in its expected orbital pos.
                    // The 'camera/offset' subtraction simulates panning the entire system.
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

    useEffect(() => {
        if (activePrimaryNode === "time") return;
        setIsTimeDragging(false);
    }, [activePrimaryNode]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 500);
    };

    // Handlers directos
    const handleBackgroundClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            if (activePrimaryNode && activePrimaryNode !== "center") {
                setActivePrimaryNode(null);
            } else if (guidedStep === "center") {
                handleClose();
            } else {
                setActivePrimaryNode(null);
                setGuidedStep("center");
            }
        }
    };

    const handlePrimaryClick = (node: PrimaryNode, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!block) return;

        if (node === "delete") {
            setIsFocusConfirming(false);
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
            if (isFocusConfirming) {
                openFromBlock(block.id, block.type);
                handleClose();
            } else {
                setIsFocusConfirming(true);
            }
            return;
        }

        setIsFocusConfirming(false);
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

    const primaryNodes = [
        { id: "type" as const, label: copy.category, icon: activeType.icon, color: activeType.color, bg: activeType.bg },
        { id: "focus" as const, label: copy.focus, icon: Zap, color: "text-purple-500", bg: "bg-purple-500/20" },
        { id: "time" as const, label: copy.schedule, icon: Clock, color: "text-white/70", bg: "bg-white/10" },
        { id: "status" as const, label: copy.status, icon: activeStatus.icon, color: activeStatus.color, bg: activeStatus.bg },
        { id: "notifications" as const, label: copy.alerts, icon: Bell, color: "text-amber-400", bg: "bg-amber-500/20" },
        { id: "delete" as const, label: copy.delete, icon: Trash2, color: "text-red-400", bg: "bg-red-500/10" },
    ];

    const PRIMARY_RADIUS = primaryRadius;
    const SECONDARY_RADIUS = isMobile ? 66 : 100;

    const pillWidthExpanded = isMobile ? "w-28 rounded-[2rem] px-3" : "w-40 rounded-[2rem] px-5";
    const pillHeightClass = isMobile ? "h-11" : "h-16";
    const scaleExpanded = isMobile ? "scale-[1.08]" : "scale-[1.15]";
    const pillWidthDefault = isMobile ? "w-11 rounded-full" : "w-16 rounded-full";

    if (!block || !mounted) return null;

    return createPortal(
        <div
            ref={containerRef}
            className={cn(
                "fixed inset-0 z-[200] flex items-center justify-center duration-500 overflow-hidden fill-mode-forwards",
                activePrimaryNode ? "touch-none" : "",
                isClosing ? "animate-out fade-out pointer-events-none" : "animate-in fade-in"
            )}
            onClick={handleBackgroundClick}
            onWheel={(e) => {
                if (activePrimaryNode) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            }}
            onTouchMove={(e) => {
                if (activePrimaryNode) {
                    e.stopPropagation();
                }
            }}
        >
            {/* Dark glass backdrop */}
            <div
                className={cn("absolute inset-0 bg-black/75 backdrop-blur-2xl", activePrimaryNode ? "pointer-events-auto" : "pointer-events-none")}
                onClick={handleBackgroundClick}
            />

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
                    <span className="text-xs font-bold uppercase tracking-widest">{copy.back}</span>
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
                    {language === "es" ? "INICIAR FOCO" : "START FOCUS"}
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

                {/* ── CENTRAL SUN COMPONENTS ── */}

                <div
                    className={cn(
                        "group absolute pointer-events-auto flex flex-col items-center justify-center transition-all duration-500",
                        activePrimaryNode && activePrimaryNode !== "center" && activePrimaryNode !== "notifications" ? "z-10 opacity-30 scale-95 blur-sm cursor-pointer" : "z-[100] opacity-100",
                        activePrimaryNode === "center" ? `p-6 ${isMobile ? "w-[240px]" : "w-[280px]"} cursor-default rounded-[2rem] bg-black/80 border border-white/20 backdrop-blur-2xl shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-[0_0_60px_rgba(255,255,255,0.15)]` :
                            activePrimaryNode === "notifications" ? "cursor-default border-none bg-transparent shadow-none w-0 h-0" :
                                "p-6 rounded-[2rem] bg-black/80 border border-white/20 backdrop-blur-2xl shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-[0_0_60px_rgba(255,255,255,0.15)] w-auto cursor-pointer hover:scale-[1.02] active:scale-[0.98] border-white/30"
                    )}
                    onClick={() => {
                        if (activePrimaryNode === "center" || activePrimaryNode === "notifications") return;
                        setActivePrimaryNode("center");
                        setGuidedStep("center");
                    }}
                    style={{
                        animation: `spring-out 600ms cubic-bezier(0.175, 0.885, 0.32, 1.275) BOTH`
                    }}
                >
                    <GlowingEffect spread={40} proximity={80} inactiveZone={0.01} borderWidth={1} variant="subtle" disabled={radialGlowDisabled} />

                    {activePrimaryNode === "center" ? (
                        <div className="flex flex-col w-full gap-5 relative z-10 animate-in fade-in zoom-in-95 duration-300">
                            {/* Editable Title */}
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 ml-1">{copy.title}</span>
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
                                    placeholder={copy.blockNamePlaceholder}
                                    autoFocus
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 ml-1">
                                    {copy.planningMetadata}
                                </span>
                                <div className="space-y-2 rounded-2xl border border-white/8 bg-black/20 p-3">
                                    <div className="flex flex-wrap gap-1.5">
                                        {[1, 2, 3, 4, 5].map((priority) => (
                                            <button
                                                key={`priority-${priority}`}
                                                onClick={() => updateBlock(block.id, { priority: priority as Block["priority"] })}
                                                className={cn(
                                                    "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all",
                                                    (block.priority ?? 3) === priority
                                                        ? "bg-indigo-500/25 text-indigo-100"
                                                        : "bg-white/[0.04] text-white/45 hover:text-white/80",
                                                )}
                                            >
                                                P{priority}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(["light", "medium", "high"] as const).map((intensity) => (
                                            <button
                                                key={intensity}
                                                onClick={() => updateBlock(block.id, {
                                                    intensity,
                                                    cognitivelyHeavy: intensity === "high" ? true : block.cognitivelyHeavy,
                                                })}
                                                className={cn(
                                                    "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all",
                                                    (block.intensity ?? "medium") === intensity
                                                        ? "bg-amber-500/20 text-amber-100"
                                                        : "bg-white/[0.04] text-white/45 hover:text-white/80",
                                                )}
                                            >
                                                {intensity === "light" ? copy.intensityLight : intensity === "medium" ? copy.intensityMedium : copy.intensityHigh}
                                            </button>
                                        ))}
                                        {(["fixed", "moderate", "flexible"] as const).map((flexibility) => (
                                            <button
                                                key={flexibility}
                                                onClick={() => updateBlock(block.id, { flexibility })}
                                                className={cn(
                                                    "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all",
                                                    (block.flexibility ?? "moderate") === flexibility
                                                        ? "bg-sky-500/20 text-sky-100"
                                                        : "bg-white/[0.04] text-white/45 hover:text-white/80",
                                                )}
                                            >
                                                {flexibility === "fixed" ? copy.flexibilityFixed : flexibility === "moderate" ? copy.flexibilityModerate : copy.flexibilityFlexible}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => updateBlock(block.id, { splittable: !(block.splittable ?? true) })}
                                            className={cn(
                                                "rounded-2xl border px-3 py-2 text-left text-xs transition-all",
                                                (block.splittable ?? true)
                                                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                                                    : "border-white/8 bg-white/[0.03] text-white/48",
                                            )}
                                        >
                                            {(block.splittable ?? true) ? copy.splittableYes : copy.splittableNo}
                                        </button>
                                        <button
                                            onClick={() => updateBlock(block.id, { optional: !(block.optional ?? false) })}
                                            className={cn(
                                                "rounded-2xl border px-3 py-2 text-left text-xs transition-all",
                                                (block.optional ?? false)
                                                    ? "border-white/20 bg-white/[0.08] text-white"
                                                    : "border-white/8 bg-white/[0.03] text-white/48",
                                            )}
                                        >
                                            {(block.optional ?? false) ? copy.optionalYes : copy.optionalNo}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Recurrence Selector */}
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 ml-1">{copy.recurrence}</span>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {[
                                        { label: copy.recurrenceNone, value: undefined },
                                        { label: getRecurrenceLabel(language, "daily"), value: "daily" },
                                        { label: getRecurrenceLabel(language, "weekly"), value: "weekly" },
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
                                                            type: opt.value as Exclude<RecurrencePattern["type"], "custom">,
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
                                        <span>{copy.custom}</span>
                                    </button>
                                </div>

                                {/* Custom day picker inline */}
                                {draftRecurrence?.type === "custom" && (
                                    <div className="flex justify-between mt-2 animate-in slide-in-from-top-1 fade-in duration-200">
                                        {recurrenceDayLabels.map((day, idx) => {
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
                                    {copy.cancel}
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
                                    {guidedStep === "center" ? copy.next : copy.save}
                                </button>
                            </div>
                        </div>
                    ) : activePrimaryNode === "notifications" ? (
                        <>
                            {/* SATELLITE "+" BUTTON ORBITING TOP */}
                            <div
                                className="absolute pointer-events-auto z-[105]"
                                style={{
                                    left: '50%',
                                    top: '50%',
                                    transform: `translate(-50%, -100px)` // Sits directly on the Y axis above the sun
                                }}
                            >
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsAddingNotification((prev) => !prev);
                                        setCustomNotificationMins("5");
                                    }}
                                    className={cn(
                                        "w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 ease-out shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-white/10 group active:scale-95",
                                        isAddingNotification
                                            ? "bg-amber-500/20 border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.3)] ring-amber-500/30 rotate-45"
                                            : "bg-black/60 border-white/20 backdrop-blur-md hover:bg-black/80 hover:border-amber-500/40 hover:shadow-[0_0_25px_rgba(245,158,11,0.25)] hover:ring-amber-500/20"
                                    )}
                                >
                                    <span className={cn(
                                        "text-2xl font-light mb-0.5 transition-colors duration-300",
                                        isAddingNotification ? "text-amber-400" : "text-white/60 group-hover:text-amber-300"
                                    )}>+</span>
                                    <GlowingEffect spread={isAddingNotification ? 35 : 20} proximity={60} inactiveZone={0.01} borderWidth={1} variant="subtle" disabled={radialGlowDisabled} />
                                </button>
                            </div>

                            {/* THE LIST HANGING BELOW */}
                            <div
                                className="flex flex-col items-center w-[220px] absolute z-10 animate-in fade-in zoom-in-95 duration-300 pointer-events-auto cursor-auto"
                                style={{
                                    left: '50%',
                                    top: '50%',
                                    transform: `translate(-50%, 70px)`
                                }}
                            >
                                <div className="flex flex-col w-full gap-2.5 max-h-[160px] overflow-y-auto pr-2">
                                    {(block.notifications || []).sort((a, b) => a - b).map(offset => (
                                        <div key={offset} className="flex items-center justify-between w-full h-11 px-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] ring-1 ring-white/5 group hover:border-amber-500/30 hover:bg-black/60 transition-all duration-300">
                                            <div className="flex items-center gap-2.5">
                                                <Bell className="w-4 h-4 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                                                <span className="text-[13px] font-medium text-white/90 tracking-wide">
                                                    {offset === 0 ? copy.atTime : copy.minutesBefore(offset)}
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateBlock(block.id, { notifications: block.notifications?.filter(n => n !== offset) || [] });
                                                }}
                                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}

                                    {isAddingNotification && (
                                        <div className="flex items-center justify-between w-full h-11 px-3 rounded-2xl bg-black/60 border border-amber-500/40 backdrop-blur-xl animate-in slide-in-from-bottom-2 fade-in shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-2 flex-1 relative">
                                                <Bell className="w-4 h-4 text-amber-400 ml-1" />
                                                <Input
                                                    autoFocus
                                                    type="number"
                                                    min="0"
                                                    value={customNotificationMins}
                                                    onChange={(e) => setCustomNotificationMins(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            const val = parseInt(customNotificationMins, 10);
                                                            if (!isNaN(val) && val >= 0) {
                                                                const current = block.notifications || [];
                                                                if (!current.includes(val)) {
                                                                    updateBlock(block.id, { notifications: [...current, val] });
                                                                }
                                                            }
                                                            setIsAddingNotification(false);
                                                        }
                                                        if (e.key === "Escape") setIsAddingNotification(false);
                                                    }}
                                                    className="w-14 h-8 text-center px-1 rounded-md bg-transparent border-b border-amber-500/30 text-white font-semibold text-[14px] focus-visible:ring-0 focus-visible:border-amber-400 focus-visible:bg-black/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/20"
                                                    placeholder="0"
                                                />
                                                <span className="text-[12px] font-medium text-white/50">min</span>
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const val = parseInt(customNotificationMins, 10);
                                                    if (!isNaN(val) && val >= 0) {
                                                        const current = block.notifications || [];
                                                        if (!current.includes(val)) {
                                                            updateBlock(block.id, { notifications: [...current, val] });
                                                        }
                                                    }
                                                    setIsAddingNotification(false);
                                                }}
                                                className="w-7 h-7 flex items-center justify-center rounded-full text-amber-950 bg-amber-500 hover:bg-amber-400 transition-all ml-1 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex flex-col items-center justify-center group-hover:scale-[1.05] transition-transform duration-300">
                                <span className="text-xl font-bold tracking-tight text-white mb-1 max-w-[150px] truncate text-center relative z-10 transition-colors group-hover:text-indigo-100">
                                    {block.title || copy.agendoBlock}
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

                        const PIcon = pn.icon;

                        return (
                            <div
                                key={pn.id}
                                ref={(el) => { planetRefs.current[i] = el; }}
                                className={cn(
                                    // Removed absolute left/top layout for pure transform translation
                                    "absolute left-1/2 top-1/2 flex flex-col items-center transition-[opacity,scale,filter] duration-700 pointer-events-auto",
                                    isDimmed ? "opacity-10 scale-75 blur-sm" : "opacity-100 scale-100",
                                    isFocused || (pn.id === "delete" && isDeleteConfirming && !block.recurrenceId) ? "z-[100]" : "z-10"
                                )}
                                style={{
                                    // Initial fallback positioning, instantly overridden by physics loop via translate3d
                                    animation: `spring-out-planet 600ms cubic-bezier(0.175, 0.885, 0.32, 1.275) BOTH`
                                }}
                            >
                                {/* Píldora del Planeta */}
                                <button
                                    onClick={(e) => handlePrimaryClick(pn.id, e)}
                                    className={cn(
                                        "flex items-center justify-center border transition-all duration-300 backdrop-blur-md relative overflow-hidden",
                                        pillHeightClass,
                                        pn.id === "focus" && isFocusConfirming ? pillWidthExpanded :
                                            pn.id === "delete" && isDeleteConfirming && !block.recurrenceId ? `${pillWidthExpanded} bg-red-500 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] ${scaleExpanded}` :
                                                isFocused && pn.id === "time" ? (isMobile ? "h-20 w-20 flex-shrink-0 rounded-full" : "h-24 w-24 flex-shrink-0 rounded-full") : `${pillWidthDefault} hover:${scaleExpanded}`,
                                        "active:scale-95",
                                        pn.color,
                                        isFocused && pn.id === "time"
                                            ? `${scaleExpanded} bg-black shadow-[0_0_30px_rgba(255,255,255,0.15)] border-white/15`
                                            : isFocused || (pn.id === "focus" && isFocusConfirming)
                                                ? `${scaleExpanded} shadow-[0_0_30px_currentColor] border-white/40 ${pn.bg}`
                                                : pn.id === "delete" && isDeleteConfirming && !block.recurrenceId ? "" : `bg-[#0c0c0f] border-white/10 hover:${pn.bg} hover:border-${pn.color.replace('text-', '')}/30 hover:shadow-[0_0_25px_currentColor]`,
                                        pn.id === "focus" && !isFocusConfirming && "hover:shadow-[0_0_25px_currentColor] hover:border-purple-500/50" // Distinctive focus hover
                                    )}
                                >
                                    <GlowingEffect spread={35} proximity={80} inactiveZone={0.01} borderWidth={1} variant="subtle" disabled={radialGlowDisabled} />
                                    {isFocused && pn.id !== "focus" && (
                                        <div className="absolute inset-0 rounded-full animate-ping opacity-20 border border-current" />
                                    )}
                                    <div className={cn("flex items-center relative z-10 transition-all duration-300", (pn.id === "focus" && isFocusConfirming) || (pn.id === "delete" && isDeleteConfirming && !block.recurrenceId) ? "gap-2" : "gap-0")}>
                                        {isFocused && pn.id === "time" ? (() => {
                                            const diffMs = (localTime.end?.getTime() ?? 0) - (localTime.start?.getTime() ?? 0);
                                            let diffMins = Math.round(diffMs / 60000);
                                            if (diffMins < 0) diffMins += 1440;
                                            const hrs = Math.floor(diffMins / 60);
                                            const mins = diffMins % 60;
                                            const durationStr = hrs === 0 ? `${mins}m` : mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
                                            return (
                                                <span className="max-w-[4.5rem] text-center text-lg font-bold leading-[1.05] tracking-tight text-white whitespace-normal">
                                                    {durationStr}
                                                </span>
                                            );
                                        })() : (
                                            <PIcon className={cn("w-6 h-6", isFocused || (pn.id === "delete" && isDeleteConfirming && !block.recurrenceId) || (pn.id === "focus" && isFocusConfirming) ? "text-white" : pn.color)} />
                                        )}
                                        {pn.id === "focus" && (
                                            <span
                                                className={cn(
                                                    "font-bold whitespace-nowrap text-white text-sm transition-all duration-300",
                                                    isFocusConfirming ? "opacity-100 max-w-[100px]" : "opacity-0 max-w-0 overflow-hidden"
                                                )}
                                            >
                                                {copy.focusMode}
                                            </span>
                                        )}
                                        {pn.id === "delete" && (
                                            <span
                                                className={cn(
                                                    "font-bold whitespace-nowrap text-white text-sm transition-all duration-300",
                                                    isDeleteConfirming && !block.recurrenceId ? "opacity-100 max-w-[100px]" : "opacity-0 max-w-0 overflow-hidden"
                                                )}
                                            >
                                                {copy.confirm}
                                            </span>
                                        )}
                                    </div>
                                </button>
                                {/* Etiqueta (solo visible al idle) */}
                                <div
                                    className={cn(
                                        "absolute top-[calc(100%+8px)] text-[10px] uppercase tracking-widest font-medium transition-all duration-300 whitespace-nowrap",
                                        isFocused || (pn.id === "focus" && isFocusConfirming) ? "opacity-0 translate-y-2" : "opacity-100 text-white/50"
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
                                                            tn.color,
                                                            isSelected ? `${tn.bg} border ${tn.color.replace('text-', 'border-')} shadow-[0_0_20px_currentColor]` : "bg-black/80 border border-white/10 backdrop-blur-sm hover:border-white/30 hover:shadow-[0_0_15px_currentColor]",
                                                            isPressing && "border-transparent"
                                                        )}
                                                    >
                                                        <GlowingEffect spread={25} proximity={60} inactiveZone={0.01} borderWidth={1} variant="subtle" disabled={radialGlowDisabled} />
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
                                                                {getBlockTypeLabel(language, tn.value)}
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
                                            const statusLabel = getBlockStatusLabel(language, sn.value);
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
                                                            sn.color,
                                                            isSelected ? `${sn.bg} border ${sn.color.replace('text-', 'border-')} shadow-[0_0_20px_currentColor]` : `bg-black/80 border border-white/10 backdrop-blur-sm hover:${sn.bg} hover:border-${sn.color.replace('text-', '')}/30 hover:shadow-[0_0_15px_currentColor]`
                                                        )}
                                                    >
                                                        <GlowingEffect spread={30} proximity={70} inactiveZone={0.01} borderWidth={1} variant="subtle" disabled={radialGlowDisabled} />
                                                        <div className="flex items-center gap-2 relative z-10 text-current">
                                                            <LIcon className="w-4 h-4" />
                                                            <span className="text-xs font-bold truncate">{statusLabel}</span>
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        {/* TIME SATELLITE (Circular Time Picker) */}
                                        {pn.id === "time" && (
                                            <div
                                                className="absolute pointer-events-auto flex items-center justify-center touch-none"
                                                style={{ animation: `spring-out 500ms cubic-bezier(0.175, 0.885, 0.32, 1.275) BOTH` }}
                                            >
                                                <CircularTimePicker
                                                    hideCenterText
                                                    startMins={localTime.start!.getHours() * 60 + localTime.start!.getMinutes()}
                                                    endMins={localTime.end!.getHours() * 60 + localTime.end!.getMinutes() +
                                                        (localTime.end!.getDate() !== localTime.start!.getDate() ? 1440 : 0)}
                                                    onDragStateChange={setIsTimeDragging}
                                                    busyBlocks={blocks.filter(b =>
                                                        b.id !== block.id &&
                                                        b.startAt.getFullYear() === localTime.start!.getFullYear() &&
                                                        b.startAt.getMonth() === localTime.start!.getMonth() &&
                                                        b.startAt.getDate() === localTime.start!.getDate()
                                                    ).map(b => {
                                                        const sMins = b.startAt.getHours() * 60 + b.startAt.getMinutes();
                                                        let eMins = b.endAt.getHours() * 60 + b.endAt.getMinutes();
                                                        if (b.endAt.getDate() !== b.startAt.getDate()) eMins += 1440;
                                                        return { start: sMins, end: eMins };
                                                    })}
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

                                                        setLocalTime({ start: newStart, end: newEnd });

                                                        const newBlockData = { ...block, startAt: newStart, endAt: newEnd };
                                                        const _currentBlocks = blocks.filter(b => b.status !== "canceled" && b.id !== block.id);
                                                        
                                                        const actualOverlaps = _currentBlocks.filter(b =>
                                                            isOverlapping(newStart, newEnd, b.startAt, b.endAt)
                                                        );
                                                        const hasOverlap = actualOverlaps.length > 0;

                                                        if (hasOverlap) {
                                                            setPendingConflict({ newBlock: newBlockData, overlaps: actualOverlaps });
                                                            setActivePrimaryNode(null);
                                                        } else {
                                                            updateBlock(block.id, { startAt: newStart, endAt: newEnd });
                                                        }
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
                                                        {guidedStep === "time" ? copy.confirmAndContinue : copy.confirm}
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
                                    <GlowingEffect spread={30} proximity={60} inactiveZone={0.01} borderWidth={1} variant="subtle" disabled={radialGlowDisabled} />
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
                                        {getBlockTypeLabel(language, tn.value)}
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
                                    <GlowingEffect spread={30} proximity={60} inactiveZone={0.01} borderWidth={1} variant="subtle" disabled={radialGlowDisabled} />
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
                                        {getBlockStatusLabel(language, sn.value)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Opciones de Agendo Button */}
            {!isNewBlock && block && (
                <div className="pointer-events-none absolute inset-x-0 bottom-8 z-[410] flex justify-center px-4">
                    <button
                        onClick={() => setIsAgendoOptionsOpen(true)}
                        className="pointer-events-auto px-6 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all font-semibold text-xs uppercase tracking-widest backdrop-blur-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]"
                    >
                        {copy.agendoOptions}
                    </button>
                </div>
            )}

            {/* Opciones de Agendo Overlay */}
            {isAgendoOptionsOpen && !isNewBlock && block && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-[2rem] p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-white/90">{copy.agendoSuggestions}</h3>
                                <p className="text-xs text-white/50 mt-1">{copy.aiRecommended}</p>
                            </div>
                            <button
                                onClick={() => setIsAgendoOptionsOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors flex-shrink-0 ml-4"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div className="flex justify-between mb-4">
                            <button
                                onClick={() => void refreshPlanning()}
                                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white w-full"
                            >
                                {planningLoading ? copy.analyzing : copy.refreshSuggestions}
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {!planningLoading && planningRecommendations.length === 0 && (
                                <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-white/52 text-center">
                                    {copy.noSuggestions}
                                </div>
                            )}

                            {planningRecommendations.map((recommendation) => (
                                <PlanningRecommendationCard
                                    key={recommendation.id}
                                    compact
                                    recommendation={recommendation}
                                    onAccept={handleAcceptPlanning}
                                    onDismiss={handleDismissPlanning}
                                    onApply={canApplyRecommendation(recommendation) ? handleApplyPlanning : undefined}
                                    applying={planningApplyingId === recommendation.id}
                                />
                            ))}
                        </div>
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
                        <AlertDialogTitle>{copy.deleteRecurringTitle}</AlertDialogTitle>
                        <AlertDialogDescription className="text-white/50">
                            {copy.deleteRecurringDescription}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                        <AlertDialogCancel className="bg-white/5 border-transparent text-white hover:bg-white/10 hover:text-white mt-0 h-10">
                            {copy.cancel}
                        </AlertDialogCancel>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <AlertDialogAction
                                onClick={() => confirmDelete('one')}
                                className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20 w-full sm:w-auto h-10 flex-1"
                            >
                                {copy.onlyThis}
                            </AlertDialogAction>
                            <AlertDialogAction
                                onClick={() => confirmDelete('series')}
                                className="bg-red-500 text-white hover:bg-red-600 w-full sm:w-auto h-10 flex-1"
                            >
                                {copy.all}
                            </AlertDialogAction>
                        </div>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── OVERLAP RESOLUTION MODAL ─── */}
            <OverlapResolutionModal
                isOpen={!!pendingConflict}
                onClose={() => setPendingConflict(null)}
                pendingBlock={pendingConflict?.newBlock || null}
                overlappingCount={pendingConflict?.overlaps.length || 0}
                onResolve={handleResolveConflict}
            />
        </div>,
        document.body
    );
}
