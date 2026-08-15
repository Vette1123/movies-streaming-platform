'use client'

import { cn } from '@/lib/utils'

/**
 * The controls the settings panels are built from.
 *
 * Every panel here is the same two shapes — pick one of a few, or turn a thing
 * on and off — and hand-rolling each one is how the accent picker and the
 * density picker ended up as two copies of the same markup. `components/ui/chip`
 * is deliberately not reused: those are display pills with no pressed state, and
 * bending them into radios would cost both.
 */

export interface ChoiceOption {
  id: string
  label: string
  /** Rendered as a dot before the label. Used by the accent picker. */
  swatch?: string
}

export function ChoiceChips({
  legend,
  options,
  value,
  onSelect,
  hint,
}: {
  legend: string
  options: readonly ChoiceOption[]
  value: string
  onSelect: (id: string) => void
  hint?: string
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onSelect(option.id)}
            className={cn(
              'focus-visible:ring-ring flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
              value === option.id
                ? 'border-primary bg-accent'
                : 'hover:bg-accent'
            )}
          >
            {option.swatch && (
              <span
                aria-hidden
                className="size-3 rounded-full"
                style={{ background: option.swatch }}
              />
            )}
            {option.label}
          </button>
        ))}
      </div>
      {hint && (
        <p className="text-muted-foreground max-w-[60ch] text-sm leading-relaxed">
          {hint}
        </p>
      )}
    </fieldset>
  )
}

/**
 * A labelled on/off row.
 *
 * A real `<button role="switch">` rather than a styled checkbox: it carries its
 * own state to a screen reader, and the whole row is the target, which is what
 * makes it usable with a thumb.
 */
export function SettingSwitch({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'hover:bg-accent/50 focus-visible:ring-ring flex w-full items-start justify-between gap-4 rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="text-muted-foreground mt-1 block max-w-[60ch] text-sm leading-relaxed">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-primary bg-primary-fill' : 'bg-muted'
        )}
      >
        <span
          className={cn(
            'bg-background size-4 rounded-full transition-transform',
            checked ? 'translate-x-5' : 'translate-x-1'
          )}
        />
      </span>
    </button>
  )
}
