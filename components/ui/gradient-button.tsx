"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"

const gradientButtonVariants = cva(
    [
        "gradient-button",
        "inline-flex items-center justify-center gap-2",
        "rounded-2xl px-6 py-3",
        "text-sm leading-[19px] font-medium text-white",
        "font-sans",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50",
        "disabled:pointer-events-none disabled:opacity-50",
        "active:scale-[0.97] transition-transform duration-100",
    ],
    {
        variants: {
            variant: {
                // Main CTA: animated violet → indigo gradient
                default: "gradient-button-agendo",
                // Subtle secondary: dark glass look with softer gradient  
                ghost: "gradient-button-subtle",
                // Outline-style  
                outline: "gradient-button-subtle",
                // Same as default for glow/primary aliases
                glow: "gradient-button-agendo",
                primary: "gradient-button-agendo",
            },
            size: {
                default: "h-14 px-6 py-3",
                sm: "h-10 rounded-xl px-4 text-xs",
                lg: "h-16 rounded-3xl px-8 text-base",
                icon: "h-14 w-14",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface GradientButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof gradientButtonVariants> {
    asChild?: boolean
}

const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(gradientButtonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
GradientButton.displayName = "GradientButton"

export { GradientButton, gradientButtonVariants }
