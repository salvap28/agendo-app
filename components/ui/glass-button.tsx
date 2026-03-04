import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * GlassButton — single <button> element, no wrapper div.
 *
 * The outer pill shape is by default (rounded-full), but it inherits
 * whatever `rounded-*` you provide via `className`, so you can use
 * `rounded-xl`, `rounded-2xl`, etc. for grid / list contexts.
 *
 * Glow is a subtle blur shadow behind the element handled via Tailwind
 * `shadow-*`. The sweep-line hover effect is a `::after` pseudo rendered
 * via a child `<span aria-hidden>` so the button keeps its layout clean.
 */

const glassButtonVariants = cva(
    [
        // Base shape & background
        "relative group inline-flex items-center justify-center gap-2",
        "rounded-full",
        "bg-white/[0.03] hover:bg-white/[0.08]",
        "backdrop-blur-md",
        "border border-white/[0.08]",
        // Transitions
        "transition-all duration-300",
        "active:scale-[0.97]",
        // Focus / disability
        "outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        "disabled:opacity-50 disabled:pointer-events-none",
        // Cursor
        "cursor-pointer",
        // Keep text readable
        "select-none tracking-tight",
        // Overflow for the sweep line
        "overflow-hidden",
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
                default: "text-white/90 hover:text-white",
                primary: [
                    "bg-indigo-500/10 border-indigo-500/20 text-indigo-100",
                    "hover:bg-indigo-500/20 hover:border-indigo-500/40",
                    "hover:shadow-[0_0_18px_-4px_rgba(99,102,241,0.5)]",
                ].join(" "),
                gym: [
                    "bg-emerald-500/10 border-emerald-500/20 text-emerald-100",
                    "hover:bg-emerald-500/20 hover:border-emerald-500/40",
                    "hover:shadow-[0_0_18px_-4px_rgba(16,185,129,0.4)]",
                ].join(" "),
                destructive: [
                    "bg-red-500/10 border-red-500/20 text-red-100",
                    "hover:bg-red-500/20 hover:border-red-500/40",
                    "hover:shadow-[0_0_18px_-4px_rgba(239,68,68,0.5)]",
                ].join(" "),
                ghost: [
                    "bg-transparent border-transparent text-white/70",
                    "hover:bg-white/[0.05] hover:text-white",
                ].join(" "),
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
    /** Extra class applied only to the inner content span (not the button itself) */
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
                {/* Subtle bottom sweep highlight on hover */}
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
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
