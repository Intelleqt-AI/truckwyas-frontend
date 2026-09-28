import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:[outline:2px_solid_var(--accent-primary)] focus-visible:[outline-offset:3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Theme tokens only (the shadcn HSL variables are not defined in this app).
        default: "bg-[var(--accent-primary)] text-[color:var(--btn-action-color)] hover:opacity-90",
        destructive:
          "bg-[var(--status-danger)] text-white hover:opacity-90",
        outline:
          "border border-[color:var(--border-subtle)] bg-transparent text-[color:var(--text-primary)] hover:bg-[var(--surface-tint-hover)]",
        secondary:
          "border border-[color:var(--border-subtle)] bg-transparent text-[color:var(--text-secondary)] hover:bg-[var(--surface-tint-hover)] hover:text-[color:var(--text-primary)]",
        ghost: "text-[color:var(--text-secondary)] hover:bg-[var(--surface-tint-hover)] hover:text-[color:var(--text-primary)]",
        link: "text-[color:var(--accent-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-md px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
