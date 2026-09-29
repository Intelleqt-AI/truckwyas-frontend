import * as React from "react"
import { useState, useEffect } from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import "./date-picker-dashboard.css"

interface DatePickerProps {
  dashboard?: boolean
  /** Applied to the text input so a sibling <label htmlFor> can bind to it. */
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
  maxDate?: Date
}

// Presentation-only opt-in: retain DayPicker's selection and keyboard behavior.
const DASHBOARD_CALENDAR_CLASSES = {
  caption: "dashboard-date-caption",
  caption_label: "dashboard-date-caption-label",
  nav_button: "dashboard-date-nav-button",
  nav_button_previous: "dashboard-date-previous",
  nav_button_next: "dashboard-date-next",
  table: "dashboard-date-table",
  head_row: "dashboard-date-head-row",
  head_cell: "dashboard-date-head-cell",
  row: "dashboard-date-row",
  cell: "dashboard-date-cell",
  day: "dashboard-date-day",
  day_selected: "dashboard-date-selected",
  day_today: "dashboard-date-today",
  day_outside: "dashboard-date-outside",
  day_disabled: "dashboard-date-disabled",
  day_hidden: "dashboard-date-hidden",
}

// Formats tried in order when parsing typed input
const PARSE_FORMATS = ['dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd', 'd/M/yyyy', 'dd/MM/yy']
// A typed value is complete when it has a four-digit year.
const COMPLETE_DATE = /^(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}-\d{1,2}-\d{1,2})$/

function tryParse(raw: string): Date | null {
  for (const fmt of PARSE_FORMATS) {
    const d = parse(raw, fmt, new Date())
    if (isValid(d) && d.getFullYear() > 1900 && d.getFullYear() < 2100) return d
  }
  return null
}

export function DatePicker({ dashboard = false, id, value, onChange, placeholder = "DD/MM/YYYY", style, maxDate }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [month, setMonth] = useState<Date>(new Date())

  // Keep the text input in sync when value changes externally (calendar pick or parent reset)
  useEffect(() => {
    if (value) {
      const d = parse(value, 'yyyy-MM-dd', new Date())
      if (isValid(d)) {
        setInputVal(format(d, 'dd/MM/yyyy'))
        setMonth(d)
        return
      }
    }
    setInputVal('')
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setInputVal(raw)
    if (!raw) {
      onChange('')
      return
    }
    // Commit a typed date only once it is complete (four-digit year). Parsing
    // each keystroke read "06/10/2" as 2002 and rewrote the field mid-typing.
    // A two-digit year ("06/10/26") is accepted when the field loses focus.
    if (!COMPLETE_DATE.test(raw.trim())) return
    const d = tryParse(raw.trim())
    if (d && (!maxDate || d <= maxDate)) {
      onChange(format(d, 'yyyy-MM-dd'))
      setMonth(d)
    }
  }

  const handleBlur = () => {
    const typed = inputVal.trim() ? tryParse(inputVal.trim()) : null
    if (typed && (!maxDate || typed <= maxDate)) {
      const iso = format(typed, 'yyyy-MM-dd')
      if (iso !== value) onChange(iso)
      setInputVal(format(typed, 'dd/MM/yyyy'))
      setMonth(typed)
      return
    }
    if (value) {
      const d = parse(value, 'yyyy-MM-dd', new Date())
      if (isValid(d)) {
        setInputVal(format(d, 'dd/MM/yyyy'))
        return
      }
    }
    // Clear display if what was typed never resolved to a valid date
    if (inputVal) setInputVal('')
  }

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date && maxDate && date > maxDate) return
    onChange(date ? format(date, 'yyyy-MM-dd') : '')
    setOpen(false)
  }

  const selected = value
    ? (() => { const d = parse(value, 'yyyy-MM-dd', new Date()); return isValid(d) ? d : undefined })()
    : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={dashboard ? "dashboard-date-picker" : "tw-date-field"}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          background: 'var(--input-bg)',
          border: dashboard ? '1px solid var(--date-picker-control-border)' : '1px solid var(--border-control)',
          borderRadius: 'var(--radius-control)',
          minHeight: 40,
          ...style,
        }}
      >
        <input
          id={id}
          className={dashboard ? "dashboard-date-input" : undefined}
          type="text"
          value={inputVal}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: inputVal ? 'var(--text-primary)' : 'var(--text-tertiary)',
            padding: '8px 12px',
            lineHeight: '20px',
            /* Dates are body content, not identifiers: sans 14, both variants. */
            fontSize: dashboard ? 'var(--date-picker-input-font)' : 14,
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            minWidth: 0,
            width: '100%',
          }}
        />
        <PopoverTrigger asChild>
          <button
            className={dashboard ? "dashboard-date-trigger" : undefined}
            type="button"
            aria-label="Open calendar"
            style={{
              background: 'none',
              border: 'none',
              borderLeft: '1px solid var(--border-subtle)',
              borderRadius: 0,
              padding: dashboard ? 8 : '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-tertiary)',
              flexShrink: 0,
            }}
          >
            <CalendarIcon size={16} />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        {...(dashboard ? { collisionPadding: 8 } : {})}
        className={dashboard ? "dashboard-date-popover" : "w-auto p-0"}
        align="start"
        style={{
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border-overlay)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-pop)',
          color: 'var(--text-primary)',
        }}
      >
        <Calendar
          {...(dashboard ? {
            className: "dashboard-date-calendar",
            classNames: DASHBOARD_CALENDAR_CLASSES,
            components: {
              IconLeft: () => <ChevronLeft size={20} />,
              IconRight: () => <ChevronRight size={20} />,
            },
          } : {})}
          mode="single"
          selected={selected}
          month={month}
          onMonthChange={setMonth}
          onSelect={handleCalendarSelect}
          disabled={maxDate ? (day: Date) => day > maxDate : undefined}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
