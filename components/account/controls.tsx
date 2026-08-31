'use client'

import { surface, surfaceDivide } from '@/lib/surfaces'
import { cn } from '@/lib/utils'

/**
 * The controls every settings panel is built from.
 *
 * Every panel here is the same three shapes — pick one of a few, turn a thing on
 * and off, or pick one of fifty — and hand-rolling each one is how the accent
 * picker and the density picker ended up as two copies of the same markup, and
 * how the playback panel ended up with a second chip component that differed
 * from this one only in its corner radius.
 *
 * The other half of the job is that a settings screen has ONE surface. Rows live
 * inside a `SettingGroup` and are separated by a hairline; nothing draws its own
 * box. `components/ui/chip` is deliberately not reused for the chips: those are
 * display pills with no pressed state, and bending them into radios would cost
 * both.
 */

export interface ChoiceOption {
  id: string
  label: string
  /** Rendered as a dot before the label. Used by the accent picker. */
  swatch?: string
}

/**
 * A bordered group of setting rows.
 *
 * Everything a panel offers goes in one of these. A panel that mixes grouped
 * rows with bare controls is the layout that made the switches look like stray
 * boxes: the group is what tells you where the settings start and stop.
 */
export function SettingGroup({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(surface, surfaceDivide, 'overflow-hidden', className)}>
      {children}
    </div>
  )
}

/**
 * One setting: its name, what it does, and the control under it.
 *
 * Stacked rather than label-left / control-right, because the controls here are
 * chip rows that need the full width. The switch is the one exception and has
 * its own component below.
 */
export function SettingRow({
  label,
  description,
  children,
  className,
}: {
  label: string
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-3 p-4', className)}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * A row of chips where exactly one is chosen.
 *
 * The label lives on the `SettingRow` around it, not here: a fieldset legend
 * plus a row heading is the same words twice, and it was drifting between the
 * two copies this replaces.
 */
export function ChoiceChips({
  options,
  value,
  onSelect,
  ariaLabel,
  className,
}: {
  options: readonly ChoiceOption[]
  value: string
  onSelect: (id: string) => void
  /** Names the group for a screen reader when the visible label is elsewhere. */
  ariaLabel?: string
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {options.map((option) => {
        const active = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(option.id)}
            className={cn(
              'focus-visible:ring-ring inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
              // Active is stated by fill AND border, not by border alone: on a
              // dark page a 1px accent hairline against an unfilled chip is not
              // a legible "this one is on".
              active
                ? 'border-primary/70 bg-primary/15 text-foreground'
                : 'text-muted-foreground hover:text-foreground border-white/10 hover:border-white/20 hover:bg-white/[0.06]'
            )}
          >
            {option.swatch && (
              <span
                aria-hidden
                className="size-2.5 rounded-full ring-1 ring-white/25"
                style={{ background: option.swatch }}
              />
            )}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * A labelled on/off row.
 *
 * A real `<button role="switch">` rather than a styled checkbox: it carries its
 * own state to a screen reader, and the whole row is the target, which is what
 * makes it usable with a thumb. Borderless — the `SettingGroup` around it draws
 * the box, and the description is capped at 65ch so the text column and the
 * switch do not end up with a hole between them.
 */
export function SettingSwitch({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description?: React.ReactNode
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
        'focus-visible:ring-ring flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:outline-hidden focus-visible:-outline-offset-2',
        disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent'
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="text-muted-foreground mt-1 block max-w-[65ch] text-sm leading-relaxed">
            {description}
          </span>
        )}
      </span>
      <Toggle checked={checked} />
    </button>
  )
}

/** The switch itself, so the player's settings panel can reuse the exact look. */
export function Toggle({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors',
        checked
          ? 'border-primary bg-primary-fill'
          : 'border-white/15 bg-white/5'
      )}
    >
      <span
        className={cn(
          'bg-background size-4 rounded-full shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
      />
    </span>
  )
}
