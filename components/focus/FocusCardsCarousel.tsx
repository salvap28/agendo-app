"use client";

import React, { useEffect, useState } from "react";
import { useFocusStore } from "@/lib/stores/focusStore";
import { useBlocksStore } from "@/lib/stores/blocksStore";
import { evaluateFocusContext } from "@/lib/engines/cardsEngine";
import { FocusCard as FocusCardType, FocusContext } from "@/lib/types/focus";
import { FocusCard } from "./FocusCard";

interface FocusCardsCarouselProps {
    onOpenPicker?: () => void;
    onOpenIntentInput?: () => void;
}

export function FocusCardsCarousel({ onOpenPicker, onOpenIntentInput }: FocusCardsCarouselProps) {
    const { session, setLayer, setSessionIntention, finish, extendBlock, activateGymTracker } = useFocusStore();
    const { blocks, updateBlock } = useBlocksStore();
    const [visibleCards, setVisibleCards] = useState<FocusCardType[]>([]);
    const [toastCards, setToastCards] = useState<FocusCardType[]>([]);

    // Stacked carousel state
    const [activeIndex, setActiveIndex] = useState(0);
    const [dragStartX, setDragStartX] = useState<number | null>(null);

    useEffect(() => {
        if (!session) return;

        let nearEndAt = false;
        if (session.mode === "block" && session.blockId) {
            const block = blocks.find(b => b.id === session.blockId);
            if (block && !session.isPaused) {
                const limit = new Date(block.endAt).getTime();
                const now = new Date().getTime();
                if (limit - now <= 2 * 60 * 1000) {
                    nearEndAt = true;
                }
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

        // We no longer filter by dismissals since cards cannot be manually closed
        setVisibleCards(result.visibleCards);
        setToastCards(result.toastCards);

    }, [
        session?.totalPausedMs,
        session?.pauseCount,
        session?.exitCount,
        session?.history,
    ]);

    const handleAction = (card: FocusCardType, action: NonNullable<FocusCardType["action"]>) => {
        switch (action.type) {
            case "externalLink":
                if (action.payload?.url) window.open(String(action.payload.url), "_blank");
                break;
            case "layer":
                if (action.payload?.showPicker && onOpenPicker) {
                    onOpenPicker();
                } else if (action.payload?.layerId === 'gym_set_tracker') {
                    activateGymTracker();
                } else if (action.payload?.layerId) {
                    setLayer({ id: String(action.payload.layerId), kind: "gymMode" });
                }
                break;
            case "setIntent":
                if (onOpenIntentInput) {
                    onOpenIntentInput();
                }
                break;
            case "custom":
                if (action.payload?.action === "extend") {
                    extendBlock(5);
                    if (session?.blockId) {
                        const block = blocks.find(b => b.id === session.blockId);
                        if (block) {
                            const newEnd = new Date(block.endAt.getTime() + 5 * 60000);
                            updateBlock(block.id, { endAt: newEnd });
                        }
                    }
                    if (activeIndex < allCards.length - 1) setActiveIndex(i => i + 1);
                } else if (action.payload?.action === "finish") {
                    finish();
                } else if (action.payload?.action === "unblockSteps") {
                    console.log("Unblock: walk, water, environment change.");
                }
                break;
            default:
                console.log("Action not implemented", action);
        }
    };

    // We only map visibleCards in the main stack. Toasts will be handled by a separate top-level component.
    const allCards = visibleCards;

    // Ensure active index is valid
    useEffect(() => {
        if (allCards.length > 0 && activeIndex >= allCards.length) {
            setActiveIndex(Math.max(0, allCards.length - 1));
        }
    }, [allCards.length, activeIndex]);

    if (allCards.length === 0) return null;

    // --- Swipe Handlers ---
    const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
        const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
        setDragStartX(x);
    };

    const handleDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
        if (dragStartX === null) return;
        const x = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
        const diff = dragStartX - x;

        // Swipe left -> next card
        if (diff > 40 && activeIndex < allCards.length - 1) {
            setActiveIndex(i => i + 1);
        }
        // Swipe right -> previous card
        else if (diff < -40 && activeIndex > 0) {
            setActiveIndex(i => i - 1);
        }
        setDragStartX(null);
    };

    const handleDrag = (e: React.MouseEvent | React.TouchEvent) => {
        if (dragStartX === null) return;
        // Removed preventDefault to ensure we don't accidentally swallow clicks
    };

    return (
        <div className="w-full flex justify-center pb-0 pt-4 select-none">
            {/* 
            Container size matches the card size: w-[280px], h-[280px] 
            */}
            <div
                className="relative w-[280px] h-[280px] select-none touch-none scale-[0.85] sm:scale-95 origin-bottom"
                style={{ WebkitUserSelect: "none" }}
                onTouchStart={handleDragStart}
                onTouchEnd={handleDragEnd}
                onMouseDown={handleDragStart}
                onMouseMove={handleDrag}
                onMouseUp={handleDragEnd}
                onMouseLeave={(e) => dragStartX !== null && handleDragEnd(e)}
            >
                {allCards.map((card, index) => {
                    const offset = index - activeIndex;

                    // Only render cards that are reasonably close to the active index to save DOM nodes
                    if (Math.abs(offset) > 3) return null;

                    /**
                     * STACK LOGIC:
                     * offset < 0: Past cards, swung out to the left and faded.
                     * offset === 0: Active card, centered, full size.
                     * offset > 0: Future cards, stacked behind, slightly smaller and shifted right.
                     */

                    let translateX = 0;
                    let scale = 1;
                    let zIndex = 10 - Math.abs(offset);
                    let opacity = 1;
                    let rotate = 0;

                    if (offset < 0) {
                        // Swiped away to the left
                        translateX = -120; // Move left
                        scale = 0.9;
                        opacity = 0;
                        rotate = -15; // slight tilt
                    } else if (offset === 0) {
                        // Active card
                        translateX = 0;
                        scale = 1;
                        opacity = 1;
                        rotate = 0;
                    } else {
                        // Stacked behind
                        // E.g., offset 1 -> shift right 15px, scale down 0.95
                        translateX = offset * 25;
                        scale = 1 - (offset * 0.05);
                        opacity = 1 - (offset * 0.15); // Better visibility behind
                    }

                    return (
                        <div
                            key={card.id}
                            className={`absolute inset-0 origin-bottom transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${offset > 0 ? 'pointer-events-none' : ''}`}
                            style={{
                                transform: `translateX(${translateX}px) scale(${scale}) rotate(${rotate}deg)`,
                                zIndex,
                                opacity,
                            }}
                        >
                            <FocusCard card={card} isForeground={offset === 0} onAction={handleAction} onDismiss={() => { }} />
                        </div>
                    );
                })}
            </div>

            {/* Optional Pagination dots (only show if multiple cards exist) */}
            {allCards.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                    {allCards.map((_, i) => (
                        <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? "bg-white w-4" : "bg-white/30"}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
