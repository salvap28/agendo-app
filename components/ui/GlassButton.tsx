"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const glassButtonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
    {
        variants: {
            variant: {
                default:
                    "bg-white/10 hover:bg-white/15 text-white border border-white/10 shadow-[0_4px_16px_0_rgba(0,0,0,0.2)] hover:shadow-[0_4px_24px_0_rgba(100,100,255,0.15)] backdrop-blur-md",
                ghost: "hover:bg-white/5 text-white/80 hover:text-white",
                outline:
                    "border border-white/20 bg-transparent hover:bg-white/5 text-white",
                glow: "bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-100 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] backdrop-blur-md",
            },
            size: {
                default: "h-14 px-6 py-3",
                sm: "h-10 rounded-xl px-4",
                lg: "h-16 rounded-3xl px-8 text-base",
                icon: "h-14 w-14",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

export interface GlassButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
    asChild?: boolean;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(glassButtonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
GlassButton.displayName = "GlassButton";

export { GlassButton, glassButtonVariants };
