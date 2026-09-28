import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-[13px] leading-5 font-medium whitespace-nowrap transition-colors focus-visible:[outline:2px_solid_var(--accent-primary)] focus-visible:[outline-offset:2px]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent-dim)] text-[color:var(--status-info-text,var(--accent-primary))]",
        secondary:
          "border-transparent bg-[var(--status-neutral-bg)] text-[color:var(--text-secondary)]",
        destructive:
          "border-transparent bg-[var(--status-danger-bg)] text-[color:var(--status-danger-text,var(--status-danger))]",
        outline: "border-[color:var(--border-subtle)] bg-transparent text-[color:var(--text-secondary)]",
        subtle: "border-transparent bg-[var(--status-neutral-bg)] text-[color:var(--text-tertiary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
