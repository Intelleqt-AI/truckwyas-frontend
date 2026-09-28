import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { style?: React.CSSProperties }
>(({ className, children, style, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn("tw-select-trigger", className)}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      background: "var(--input-bg, var(--bg-surface))",
      border: "1px solid var(--border-control)",
      color: "var(--text-primary)",
      padding: "8px 12px",
      minHeight: 40,
      borderRadius: "var(--radius-control)",
      fontSize: 14,
      lineHeight: "20px",
      fontFamily: "var(--font-sans)",
      cursor: "pointer",
      boxSizing: "border-box" as const,
      gap: 8,
      ...style,
    }}
    {...props}
  >
    {children}
    <ChevronDown size={13} className="tw-select-chevron" style={{ color: "var(--text-tertiary)", flexShrink: 0, transition: "transform 0.15s" }} />
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn("tw-select-content", className)}
      position={position}
      sideOffset={4}
      style={{
        background: "var(--bg-overlay)",
        border: "1px solid var(--border-overlay)",
        /* Overlay elevation: one step above the card (border + pop shadow). */
        boxShadow: "var(--shadow-pop)",
        borderRadius: "var(--radius-control)",
        zIndex: 9999,
        minWidth: "var(--radix-select-trigger-width)",
        maxHeight: 280,
        overflowY: "auto",
      }}
      {...props}
    >
      <SelectPrimitive.Viewport style={{ padding: 4 }}>
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn("tw-select-item", className)}
    style={{
      display: "flex",
      alignItems: "center",
      padding: "8px 10px 8px 28px",
      minHeight: 36,
      fontSize: 14,
      lineHeight: "20px",
      fontFamily: "var(--font-sans)",
      color: "var(--text-primary)",
      borderRadius: "var(--radius-chip)",
      cursor: "pointer",
      outline: "none",
      position: "relative",
      userSelect: "none",
    }}
    {...props}
  >
    <span style={{ position: "absolute", left: 8, display: "flex", alignItems: "center" }}>
      <SelectPrimitive.ItemIndicator>
        <Check size={12} style={{ color: "var(--accent-primary)" }} />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(className)}
    style={{
      padding: "6px 10px",
      fontSize: 13,
      lineHeight: "20px",
      fontWeight: 500,
      fontFamily: "var(--font-sans)",
      color: "var(--text-tertiary)",
      letterSpacing: "normal",
    }}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn(className)}
    style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
}
