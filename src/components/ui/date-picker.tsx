import * as React from "react"
import { useState, useEffect } from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
  maxDate?: Date
}

// Formats tried in order when parsing typed input
const PARSE_FORMATS = ['dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd', 'd/M/yyyy', 'dd/MM/yy']

function tryParse(raw: string): Date | null {
  for (const fmt of PARSE_FORMATS) {
    const d = parse(raw, fmt, new Date())
    if (isValid(d) && d.getFullYear() > 1900 && d.getFullYear() < 2100) return d
  }
  return null
}

export function DatePicker({ value, onChange, placeholder = "DD/MM/YYYY", style, maxDate }: DatePickerProps) {
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
    const d = tryParse(raw)
    if (d && (!maxDate || d <= maxDate)) {
      onChange(format(d, 'yyyy-MM-dd'))
      setMonth(d)
    }
  }

  const handleBlur = () => {
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
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 2,
          ...style,
        }}
      >
        <input
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
            padding: '10px 12px',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            outline: 'none',
            minWidth: 0,
            width: '100%',
          }}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              borderLeft: '1px solid var(--border-subtle)',
              padding: '10px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-tertiary)',
              flexShrink: 0,
            }}
          >
            <CalendarIcon size={13} />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          color: 'var(--text-primary)',
        }}
      >
        <Calendar
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
