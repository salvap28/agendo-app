"use client";

import React, { useState } from "react";
import { FocusCard as FocusCardType } from "@/lib/types/focus";
import { FocusCard } from "./FocusCard";

interface FocusCardsCarouselProps {
    cards: FocusCardType[];
    onAction: (card: FocusCardType, action: NonNullable<FocusCardType["action"]>) => void;
    onActiveCardChange?: (card: FocusCardType | null) => void;
}

export function FocusCardsCarousel({ cards, onAction, onActiveCardChange }: FocusCardsCarouselProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [dragStartX, setDragStartX] = useState<number | null>(null);
    const boundedActiveIndex = cards.length === 0 ? 0 : Math.min(activeIndex, cards.length - 1);

    React.useEffect(() => {
        if (cards.length === 0) {
            setActiveIndex(0);
            return;
        }

        setActiveIndex((current) => {
            const currentCardId = cards[Math.min(current, cards.length - 1)]?.id;
            if (currentCardId && cards.some((card) => card.id === currentCardId)) {
                return Math.min(current, cards.length - 1);
            }

            return 0;
        });
    }, [cards]);

    React.useEffect(() => {
        onActiveCardChange?.(cards[boundedActiveIndex] ?? null);
    }, [boundedActiveIndex, cards, onActiveCardChange]);

    if (cards.length === 0) return null;

    const handleDragStart = (event: React.TouchEvent | React.MouseEvent) => {
        const x = 'touches' in event ? event.touches[0].clientX : event.clientX;
        setDragStartX(x);
    };

    const handleDragEnd = (event: React.TouchEvent | React.MouseEvent) => {
        if (dragStartX === null) return;
        const x = 'changedTouches' in event ? event.changedTouches[0].clientX : event.clientX;
        const diff = dragStartX - x;

        if (diff > 40 && boundedActiveIndex < cards.length - 1) {
            setActiveIndex((current) => current + 1);
        } else if (diff < -40 && boundedActiveIndex > 0) {
            setActiveIndex((current) => current - 1);
        }

        setDragStartX(null);
    };

    return (
        <div className="flex w-full justify-center select-none pb-0 pt-4">
            <div
                className="relative h-[280px] w-[280px] origin-bottom touch-none select-none scale-[0.85] sm:scale-95"
                style={{ WebkitUserSelect: "none" }}
                onTouchStart={handleDragStart}
                onTouchEnd={handleDragEnd}
                onMouseDown={handleDragStart}
                onMouseUp={handleDragEnd}
                onMouseLeave={(event) => dragStartX !== null && handleDragEnd(event)}
            >
                {cards.map((card, index) => {
                    const offset = index - boundedActiveIndex;
                    if (Math.abs(offset) > 3) return null;

                    let translateX = 0;
                    let scale = 1;
                    const zIndex = 10 - Math.abs(offset);
                    let opacity = 1;
                    let rotate = 0;

                    if (offset < 0) {
                        translateX = -120;
                        scale = 0.9;
                        opacity = 0;
                        rotate = -15;
                    } else if (offset > 0) {
                        translateX = offset * 25;
                        scale = 1 - offset * 0.05;
                        opacity = 1 - offset * 0.15;
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
                            <FocusCard
                                card={card}
                                isForeground={offset === 0}
                                onAction={onAction}
                            />
                        </div>
                    );
                })}
            </div>

            {cards.length > 1 && (
                <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
                    {cards.map((_, index) => (
                        <div
                            key={index}
                            className={`h-1.5 rounded-full transition-all duration-300 ${index === boundedActiveIndex ? "w-4 bg-white" : "w-1.5 bg-white/30"}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
