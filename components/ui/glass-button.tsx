import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * GlassButton (lowercase alias) — used by BlockDrawer and focus components.
 * Now powered by the gradient-button CSS system for visual consistency.
 */

const glassButtonVariants = cva(
    [
        "gradient-button",
        "relative group inline-flex items-center justify-center gap-2",
        "rounded-full",
        "outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50",
        "disabled:opacity-50 disabled:pointer-events-none",
        "cursor-pointer select-none tracking-tight overflow-hidden",
        "text-white",
    ].join(" "),
    {
        variants: {
            size: {
                default: "h-10 px-6 text-sm font-medium",
                sm: "h-8 px-4 text-xs font-medium",
                lg: "h-12 px-8 text-base font-medium",
                icon: "h-10 w-10 p-0 text-sm",
            },
            variant: {
                // Primary: animated violet→indigo gradient
                default: "gradient-button-agendo text-white",
                primary: "gradient-button-agendo text-white",
                // Gym: keep distinct emerald coloring
                gym: [
                    "gradient-button-subtle",
                    "!bg-none bg-emerald-500/10 border border-emerald-500/20 text-emerald-100",
                    "hover:bg-emerald-500/20 hover:border-emerald-500/40",
                    "hover:shadow-[0_0_18px_-4px_rgba(16,185,129,0.4)]",
                ].join(" "),
                // Destructive: keep distinct red coloring
                destructive: [
                    "gradient-button-subtle",
                    "!bg-none bg-red-500/10 border border-red-500/20 text-red-100",
                    "hover:bg-red-500/20 hover:border-red-500/40",
                ].join(" "),
                // Ghost / outline: subtle version
                ghost: "gradient-button-subtle text-white/70 hover:text-white",
            },
        },
        defaultVariants: {
            size: "default",
            variant: "default",
        },
    }
);

export interface GlassButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
    contentClassName?: string;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
    ({ className, children, size, variant, contentClassName, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(glassButtonVariants({ size, variant }), className)}
                {...props}
            >
                {/* Bottom sweep highlight */}
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                />
                <span className={cn("relative z-10 flex items-center gap-2", contentClassName)}>
                    {children}
                </span>
            </button>
        );
    }
);
GlassButton.displayName = "GlassButton";

export { GlassButton, glassButtonVariants };
