'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookmarkPlus, Check, X } from 'lucide-react'

import { cachedProfile, hasAccountHint, savePrefs } from '@/lib/account'
import {
  trackFilterPresetApplied,
  trackFilterPresetSaved,
  trackSupportCtaClicked,
} from '@/lib/analytics'
import {
  MAX_PRESET_NAME,
  MAX_PRESETS,
  newPresetId,
  withoutPreset,
  withPreset,
} from '@/lib/filter-presets'
import { cn } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Saved filters, at the top of the browse sidebar.
 *
 * The filter state already lives entirely in the URL (nuqs), which is what
 * makes this feature small: a preset is a name and a query string, applying one
 * is a navigation, and there is no filter state to serialise by hand. If the
 * filters had lived in React state this would have needed a schema and a
 * migration path for it; because they live in the URL, it needs neither.
 *
 * Presets are stored on the account rather than in this browser, so the set of
 * searches somebody has built up follows them to their phone. That is also why
 * it is a supporter feature: the value is the syncing, not the saving.
 */
export function SavedFilters({
  hasActiveFilters,
  className,
}: {
  hasActiveFilters: boolean
  className?: string
}) {
  const { pro, prefs, signedIn } = useAccount()
  const router = useRouter()
  const pathname = usePathname()
  const [naming, setNaming] = React.useState(false)
  const [name, setName] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const presets = prefs.presets ?? []

  // Before the session has answered, hold the room the settled block will
  // need. The hint cookie says whether there is a session at all and the
  // profile cache says whether it pays and how many filters it has saved, both
  // synchronously — so a reserved slot is exact rather than a guess, and the
  // nine accordions below it never jump once the answer lands. A visitor with
  // no session reserves nothing, because nothing is what they will get.
  if (signedIn === undefined)
    return <SavedFiltersPlaceholder className={className} />

  // Signed out, this section is noise on top of the control somebody came here
  // to use. The pitch for it lives on /support and in the account console,
  // where there is room to make it.
  if (!signedIn) return null

  if (!pro) {
    return (
      <div className={cn('space-y-2 px-1 pb-4', className)}>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Supporters can save a filter like this one under a name and reopen it
          from any device.
        </p>
        <Link
          href="/support"
          onClick={() => trackSupportCtaClicked({ surface: 'saved-filters' })}
          className="text-primary text-xs underline underline-offset-2"
        >
          What support unlocks
        </Link>
      </div>
    )
  }

  const commit = async (next: typeof presets) => {
    setBusy(true)
    await savePrefs({ presets: next })
    setBusy(false)
  }

  const save = async () => {
    const trimmed = name.trim()
    // The query string is read from the address bar rather than rebuilt from
    // the filter object: the URL is already the canonical serialisation, and
    // rebuilding it here would be a second encoder to keep in step with nuqs.
    const query = window.location.search.replace(/^\?/, '')
    if (!trimmed || !query) return
    const next = withPreset(presets, {
      id: newPresetId(),
      name: trimmed,
      query,
      // Which of the two browse pages this is. The filters are the same on
      // both, so without it a preset cannot say whether it means films or
      // shows — which is exactly what a smart list built from it has to know.
      path: pathname === '/tv-shows' ? '/tv-shows' : '/movies',
    })
    setNaming(false)
    setName('')
    await commit(next)
    trackFilterPresetSaved({ preset_count: next.length })
  }

  const apply = (query: string) => {
    trackFilterPresetApplied()
    router.push(`${pathname}?${query}`)
  }

  const remove = (id: string) => void commit(withoutPreset(presets, id))

  return (
    <div className={cn('space-y-3 px-1 pb-4', className)}>
      {presets.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <li key={preset.id}>
              <span className="border-border/70 hover:bg-accent flex items-center gap-1 rounded-full border pr-1 pl-2.5 text-xs transition-colors">
                <button
                  type="button"
                  onClick={() => apply(preset.query)}
                  className="py-1"
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${preset.name}`}
                  onClick={() => remove(preset.id)}
                  className="text-muted-foreground hover:text-destructive grid size-5 place-items-center rounded-full"
                >
                  <X className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {naming ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={name}
            maxLength={MAX_PRESET_NAME}
            placeholder="Name this filter"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void save()
              if (event.key === 'Escape') setNaming(false)
            }}
            className="border-input bg-background focus-visible:ring-ring min-w-0 flex-1 rounded-md border px-2 py-1 text-xs focus-visible:ring-2 focus-visible:outline-hidden"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !name.trim()}
            onClick={() => void save()}
            className="h-7 px-2"
          >
            <Check className="size-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!hasActiveFilters || presets.length >= MAX_PRESETS}
          onClick={() => setNaming(true)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs disabled:opacity-50"
        >
          <BookmarkPlus className="size-3.5" />
          {presets.length >= MAX_PRESETS
            ? `${MAX_PRESETS} saved, the most there is room for`
            : 'Save this filter'}
        </button>
      )}
    </div>
  )
}

/**
 * The same block, at the same height, drawn from what this device already
 * knows. Kept next to the real thing so the two cannot drift apart.
 */
function SavedFiltersPlaceholder({ className }: { className?: string }) {
  if (!hasAccountHint()) return null
  const cached = cachedProfile()

  if (!cached?.pro) {
    return (
      <div aria-hidden className={cn('space-y-2 px-1 pb-4', className)}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-3.5 w-40" />
      </div>
    )
  }

  return (
    <div aria-hidden className={cn('space-y-3 px-1 pb-4', className)}>
      {cached.presets > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: cached.presets }).map((_, i) => (
            <Skeleton key={i} className="h-[26px] w-24 rounded-full" />
          ))}
        </div>
      )}
      <Skeleton className="h-4 w-32" />
    </div>
  )
}
