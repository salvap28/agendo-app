"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const glassButtonVariants = cva(
    "gradient-button inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
    {
        variants: {
            variant: {
                // Primary CTA: animated violet→indigo gradient
                default: "gradient-button-agendo text-white",
                // Subtle secondary: soft dark gradient with violet tint
                ghost: "gradient-button-subtle text-white/80 hover:text-white",
                outline: "gradient-button-subtle text-white",
                // Aliases for primary/glow used in the codebase
                glow: "gradient-button-agendo text-white",
                primary: "gradient-button-agendo text-white",
            },
            size: {
                default: "h-12 px-6 py-3",
                sm: "h-9 rounded-xl px-4 text-xs",
                lg: "h-14 rounded-3xl px-8 text-base",
                icon: "h-12 w-12",
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
