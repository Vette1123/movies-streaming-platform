'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Languages } from 'lucide-react'

import { SUBTITLE_LANGUAGES, subtitleLabel } from '@/lib/subtitle-languages'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

/**
 * Pick a subtitle language.
 *
 * Fifty-one chips in a 12rem scroll box was the control this replaces, and it
 * was the worst thing on the settings page: no way to search, half of it below
 * a fold inside a fold, and a scrollbar sitting in the middle of a form. A
 * language is something you know the name of before you look, so the right
 * control is a search field — type "ara", press Enter.
 *
 * One component for both surfaces that offer this (the Playback settings and
 * the panel inside the player). `align` is the only thing that differs: over the
 * video the trigger sits near the right edge of a floating bar.
 */
export function SubtitleSelect({
  value,
  onSelect,
  align = 'start',
  className,
}: {
  value: string
  onSelect: (value: string) => void
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  // Radix only writes `aria-controls` on the trigger while the popover is open,
  // and a combobox has to name the list it controls whether it is open or not —
  // that is what a screen reader reads to say there is one. Naming the panel
  // ourselves also means the id is stable across opens.
  const listId = React.useId()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label="Subtitle language"
          className={cn(
            'focus-visible:ring-ring inline-flex w-full max-w-72 items-center gap-2 rounded-full border border-white/10 px-3.5 py-2 text-sm font-medium transition-colors hover:border-white/20 hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:outline-hidden',
            className
          )}
        >
          <Languages className="size-4 shrink-0 opacity-70" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">
            {subtitleLabel(value)}
          </span>
          <ChevronsUpDown
            className="size-3.5 shrink-0 opacity-50"
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent id={listId} align={align} className="w-64 p-0">
        <Command
          // cmdk scores against the item's `value`, so each row carries its
          // English name alongside the endonym: searching "arabic" has to find
          // العربية, which is the whole point of a search field here.
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search languages" />
          <CommandList>
            <CommandEmpty>No language by that name.</CommandEmpty>
            {SUBTITLE_LANGUAGES.map((language) => (
              <CommandItem
                key={language.value}
                value={`${language.label} ${language.search}`}
                onSelect={() => {
                  onSelect(language.value)
                  setOpen(false)
                }}
                className="cursor-pointer gap-2"
              >
                <Check
                  className={cn(
                    'size-4 shrink-0',
                    value === language.value ? 'opacity-100' : 'opacity-0'
                  )}
                  aria-hidden
                />
                {language.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
