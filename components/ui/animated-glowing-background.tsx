import { cn } from "@/lib/cn";

interface AnimatedGlowingBackgroundProps {
    /** 'pill' for circular buttons, 'block' for rectangular calendar cards */
    variant?: "pill" | "block";
    /** Border radius in px for the outer container when variant="block". Inner cutout is this - 1.5px. Default: 16 */
    radius?: number;
}

export function AnimatedGlowingBackground({ variant = "pill", radius = 16 }: AnimatedGlowingBackgroundProps) {
    const isPill = variant === "pill";

    const outerRadius = isPill ? "9999px" : `${radius}px`;
    const innerRadius = isPill ? "9999px" : `${Math.max(0, radius - 1.5)}px`;

    return (
        <div
            className={cn(
                "absolute inset-0 z-0 overflow-hidden pointer-events-none",
                isPill && "group-hover:scale-105 transition-transform duration-500"
            )}
            style={{ borderRadius: outerRadius }}
        >
            {/* Outer blurred glow layer – slower spin */}
            <div
                className={cn(
                    "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[-2] bg-no-repeat",
                    isPill
                        ? "w-[600px] h-[600px] blur-[8px] opacity-70"
                        : "w-[180%] h-[180%] blur-[5px] opacity-80",
                    "bg-[conic-gradient(transparent,#7C3AED_5%,transparent_35%,transparent_50%,#4F46E5_60%,transparent_85%)]",
                    "animate-[spin_3s_linear_infinite]",
                )}
            />

            {/* Sharper inner glow layer */}
            <div
                className={cn(
                    "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[-2] bg-no-repeat",
                    isPill
                        ? "w-[600px] h-[600px] blur-[3px] opacity-90"
                        : "w-[180%] h-[180%] blur-[2px] opacity-90",
                    "bg-[conic-gradient(transparent,#7C3AED_2%,transparent_20%,transparent_50%,#c084fc_52%,transparent_70%)]",
                    "animate-[spin_4s_linear_infinite]",
                )}
            />

            {/* Counter-spin accent (block only) */}
            {!isPill && (
                <div
                    className={cn(
                        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[-2] bg-no-repeat",
                        "w-[180%] h-[180%] blur-[4px] opacity-40",
                        "bg-[conic-gradient(transparent,#a855f7_3%,transparent_25%)]",
                        "animate-[spin_5s_linear_infinite_reverse]",
                    )}
                />
            )}

            {/* Dark inner cut-out — exposes only a thin glowing border strip */}
            <div
                className="absolute z-[-1] bg-[#020208]/90 backdrop-blur-sm"
                style={{
                    inset: isPill ? "1.5px" : "1px",
                    borderRadius: innerRadius,
                }}
            />
        </div>
    );
}

