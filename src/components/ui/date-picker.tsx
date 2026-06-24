import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
}

export function DatePicker({ value, onChange, placeholder = "Select date", style }: DatePickerProps) {
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
  const selected = parsed && isValid(parsed) ? parsed : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={{
            width: "100%",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            color: selected ? "var(--text-primary)" : "var(--text-tertiary)",
            padding: "10px 12px",
            borderRadius: 2,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            outline: "none",
            boxSizing: "border-box" as const,
            cursor: "pointer",
            textAlign: "left" as const,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            ...style,
          }}
        >
          <span>{selected ? format(selected, "dd MMM yyyy") : placeholder}</span>
          <CalendarIcon size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 4,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          color: "var(--text-primary)",
        }}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
