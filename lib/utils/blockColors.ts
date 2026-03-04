/**
 * Per-type color palette for the animated active-block border effect.
 * primary / secondary  → conic gradient stop colors (two streaks, 180° apart)
 * streak               → sharper fast streak color
 * glow1 / glow2        → box-shadow rgba values for the hover outer glow
 * innerBorder          → CSS color for the card's inner border
 */
export interface BlockTypeColors {
    primary: string;
    secondary: string;
    streak: string;
    glow1: string;   // tighter shadow
    glow2: string;   // wider diffuse shadow
    innerBorder: string;
}

export const BLOCK_TYPE_COLORS: Record<string, BlockTypeColors> = {
    deep_work: {
        primary: "#7C3AED",
        secondary: "#4F46E5",
        streak: "#c084fc",
        glow1: "rgba(124,58,237,0.40)",
        glow2: "rgba(99,102,241,0.18)",
        innerBorder: "rgba(99,102,241,0.25)",
    },
    meeting: {
        primary: "#e11d48",
        secondary: "#be123c",
        streak: "#fb7185",
        glow1: "rgba(225,29,72,0.40)",
        glow2: "rgba(251,113,133,0.18)",
        innerBorder: "rgba(225,29,72,0.25)",
    },
    gym: {
        primary: "#10b981",
        secondary: "#059669",
        streak: "#34d399",
        glow1: "rgba(16,185,129,0.40)",
        glow2: "rgba(52,211,153,0.18)",
        innerBorder: "rgba(16,185,129,0.25)",
    },
    study: {
        primary: "#f59e0b",
        secondary: "#d97706",
        streak: "#fcd34d",
        glow1: "rgba(245,158,11,0.40)",
        glow2: "rgba(252,211,77,0.18)",
        innerBorder: "rgba(245,158,11,0.25)",
    },
    admin: {
        primary: "#94a3b8",
        secondary: "#64748b",
        streak: "#cbd5e1",
        glow1: "rgba(148,163,184,0.40)",
        glow2: "rgba(203,213,225,0.18)",
        innerBorder: "rgba(148,163,184,0.25)",
    },
    break: {
        primary: "#f97316",
        secondary: "#ea580c",
        streak: "#fb923c",
        glow1: "rgba(249,115,22,0.40)",
        glow2: "rgba(251,146,60,0.18)",
        innerBorder: "rgba(249,115,22,0.25)",
    },
    other: {
        primary: "#a3a3a3",
        secondary: "#737373",
        streak: "#d4d4d4",
        glow1: "rgba(163,163,163,0.40)",
        glow2: "rgba(212,212,212,0.18)",
        innerBorder: "rgba(163,163,163,0.25)",
    },
};

export function getBlockColors(type: string): BlockTypeColors {
    return BLOCK_TYPE_COLORS[type] ?? BLOCK_TYPE_COLORS.other;
}
