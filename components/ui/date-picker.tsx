'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface DatePickerProps {
  id?: string
  label?: string
  placeholder?: string
  value?: Date | string
  onValueChange?: (value: Date | undefined) => void
  onStringValueChange?: (value: string) => void
  disabled?: boolean
  required?: boolean
  className?: string
  /** Applied to the underlying date input. Named for backward compatibility. */
  buttonClassName?: string
  minDate?: Date
  maxDate?: Date
}

// Convert a Date to the `YYYY-MM-DD` string a native date input expects.
// Uses local date parts to avoid timezone shifts.
function dateToInputValue(date: Date | undefined): string {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Parse a `YYYY-MM-DD` string into a local-timezone Date, or undefined.
function inputValueToDate(value: string): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  const date = new Date(year, month - 1, day) // month is 0-indexed
  return isNaN(date.getTime()) ? undefined : date
}

// Normalize the incoming value (Date or string) to an input string.
function toInputValue(value: Date | string | undefined): string {
  if (value instanceof Date) return dateToInputValue(value)
  if (typeof value === 'string') return value
  return ''
}

const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      id,
      label,
      placeholder = 'Select date',
      value,
      onValueChange,
      onStringValueChange,
      disabled = false,
      required = false,
      className,
      buttonClassName,
      minDate,
      maxDate,
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      // Native date inputs commit a complete `YYYY-MM-DD` string, so we can
      // forward both callbacks immediately (no debounce required).
      onStringValueChange?.(newValue)
      onValueChange?.(inputValueToDate(newValue))
    }

    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {label && (
          <Label htmlFor={id} className="text-muted-foreground text-xs">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <Input
          ref={ref}
          id={id}
          type="date"
          value={toInputValue(value)}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          className={buttonClassName}
          min={minDate ? dateToInputValue(minDate) : undefined}
          max={maxDate ? dateToInputValue(maxDate) : undefined}
          placeholder={placeholder}
        />
      </div>
    )
  }
)

DatePicker.displayName = 'DatePicker'

export { DatePicker }
