import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 border-0 bg-transparent text-[color:var(--text-secondary)] hover:bg-[var(--surface-tint-hover)] hover:text-[color:var(--text-primary)]"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell: "rounded-md w-10 font-normal text-[13px] leading-5 text-[color:var(--text-secondary)]",
        row: "flex w-full mt-1",
        cell: "h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day: "rdp-day-btn h-10 w-10 p-0 text-sm font-normal rounded-md",
        day_selected: "rdp-day-selected",
        day_today: "rdp-day-today",
        day_outside: "rdp-day-outside",
        day_disabled: "text-[color:var(--text-disabled)] cursor-not-allowed",
        day_hidden: "invisible",
        ...classNames,
      }}
      styles={{
        cell: { border: "none" },
        day: { border: "none" },
        head_cell: { border: "none" },
        table: { borderCollapse: "collapse" },
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
