import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // z-[10000]: some pages (e.g. the public customer share link) wrap
      // their whole content in a position:fixed, z-9999 shell to escape the
      // app root's overflow:hidden — a dialog at the default z-50 would
      // render behind that and just silently not be visible.
      "fixed inset-0 z-[10000] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, style, children, hideClose, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    {/* Split in two: the outer Content element only does fixed, viewport-
        centered positioning via a plain inline transform (guaranteed to
        apply — this dialog previously relied on Tailwind's translate-x/y
        utilities for centering and they silently didn't take effect in this
        build). The zoom/fade animation classes live on the INNER wrapper
        instead of here, driven off the outer's data-state via Tailwind's
        group-data variant — that keeps the animation's own transform
        (scale) from ever fighting the outer's centering transform, so the
        dialog scales from its own center instead of jumping to a corner. */}
    <DialogPrimitive.Content
      ref={ref}
      className={cn("group fixed z-[10000] outline-none", className)}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxHeight: "90vh",
        maxWidth: "95vw",
        overflow: "auto",
      }}
      {...props}
    >
      <div
        style={{ position: "relative", ...style }}
        className="origin-center group-data-[state=open]:animate-in group-data-[state=closed]:animate-out group-data-[state=closed]:fade-out-0 group-data-[state=open]:fade-in-0 group-data-[state=closed]:zoom-out-95 group-data-[state=open]:zoom-in-95"
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </div>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

export { Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent }
