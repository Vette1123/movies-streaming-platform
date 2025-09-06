'use client'

import * as React from 'react'
import { CalendarIcon, ChevronDownIcon } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'

import { cn, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

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
  buttonClassName?: string
  calendarClassName?: string
  mode?: 'calendar' | 'input' | 'both'
  debounceMs?: number
  minDate?: Date
  maxDate?: Date
  showIcon?: boolean
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
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
      calendarClassName,
      mode = 'both',
      debounceMs = 500,
      minDate,
      maxDate,
      showIcon = true,
      align = 'start',
      side = 'bottom',
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
      value instanceof Date ? value : value ? new Date(value) : undefined
    )

    // Convert date to string for input field
    const dateToString = (date: Date | undefined): string => {
      if (!date) return ''
      // Use local date to avoid timezone issues
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Convert string to date
    const stringToDate = (dateString: string): Date | undefined => {
      if (!dateString) return undefined
      // Parse date string in local timezone to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number)
      if (year && month && day) {
        const date = new Date(year, month - 1, day) // month is 0-indexed
        return date instanceof Date && !isNaN(date.getTime()) ? date : undefined
      }
      return undefined
    }

    // Update internal state when external value changes
    React.useEffect(() => {
      if (value instanceof Date) {
        setSelectedDate(value)
      } else if (typeof value === 'string') {
        setSelectedDate(stringToDate(value))
      } else if (value === undefined) {
        setSelectedDate(undefined)
      }
    }, [value])

    // Debounced callbacks
    const debouncedOnValueChange = useDebouncedCallback(
      (date: Date | undefined) => {
        onValueChange?.(date)
      },
      debounceMs
    )

    const debouncedOnStringValueChange = useDebouncedCallback(
      (value: string) => {
        onStringValueChange?.(value)
      },
      debounceMs
    )

    const handleDateSelect = (date: Date | undefined) => {
      setSelectedDate(date)
      setOpen(false)

      // Call both callbacks immediately (no debounce for calendar selection)
      onValueChange?.(date)
      if (onStringValueChange) {
        onStringValueChange(dateToString(date))
      }
    }

    // Format display date
    const displayDate = selectedDate ? formatDate(selectedDate) : placeholder

    // Validate date range
    const isDateDisabled = (date: Date) => {
      if (minDate && date < minDate) return true
      if (maxDate && date > maxDate) return true
      return false
    }

    // Create debounced input change handler
    const debouncedInputChange = useDebouncedCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        const date = stringToDate(newValue)
        setSelectedDate(date)

        // Call both callbacks
        debouncedOnValueChange(date)
        if (onStringValueChange) {
          debouncedOnStringValueChange(newValue)
        }
      },
      debounceMs
    )

    if (mode === 'input') {
      return (
        <div className={cn('flex flex-col gap-2', className)}>
          {label && (
            <Label htmlFor={id} className="text-sm font-medium">
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
          )}
          <Input
            id={id}
            type="date"
            defaultValue={dateToString(selectedDate)}
            onChange={debouncedInputChange}
            disabled={disabled}
            required={required}
            className={buttonClassName}
            min={minDate ? dateToString(minDate) : undefined}
            max={maxDate ? dateToString(maxDate) : undefined}
            placeholder={placeholder}
          />
        </div>
      )
    }

    if (mode === 'calendar') {
      return (
        <div className={cn('flex flex-col gap-2', className)}>
          {label && (
            <Label htmlFor={id} className="text-xs text-muted-foreground">
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
          )}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                ref={ref}
                variant="outline"
                id={id}
                disabled={disabled}
                className={cn(
                  'w-full justify-between font-normal',
                  !selectedDate && 'text-muted-foreground',
                  buttonClassName
                )}
                {...props}
              >
                <div className="flex items-center gap-2">
                  {showIcon && <CalendarIcon className="h-4 w-4" />}
                  <span className="truncate">
                    {selectedDate ? formatDate(selectedDate) : placeholder}
                  </span>
                </div>
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0"
              align={align}
              side={side}
              sideOffset={4}
            >
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                captionLayout="dropdown"
                disabled={isDateDisabled}
                className={cn('p-3', calendarClassName)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )
    }

    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {label && (
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <div className="flex gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                ref={ref}
                variant="outline"
                id={id}
                disabled={disabled}
                className={cn(
                  'flex-1 justify-between font-normal',
                  !selectedDate && 'text-muted-foreground',
                  buttonClassName
                )}
                {...props}
              >
                <div className="flex items-center gap-2">
                  {showIcon && <CalendarIcon className="h-4 w-4" />}
                  <span className="truncate">{displayDate}</span>
                </div>
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0"
              align={align}
              side={side}
              sideOffset={4}
            >
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                captionLayout="dropdown"
                disabled={isDateDisabled}
                className={cn('p-3', calendarClassName)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {mode === 'both' && (
            <Input
              type="date"
              defaultValue={dateToString(selectedDate)}
              onChange={debouncedInputChange}
              disabled={disabled}
              required={required}
              className="w-32"
              min={minDate ? dateToString(minDate) : undefined}
              max={maxDate ? dateToString(maxDate) : undefined}
            />
          )}
        </div>
      </div>
    )
  }
)

DatePicker.displayName = 'DatePicker'

export { DatePicker }
