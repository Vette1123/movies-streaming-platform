'use client'

import { useMemo, useState } from 'react'
import { Bookmark, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  MAX_HITS,
  MIN_QUERY,
  searchLibrary,
  withAdded,
  withoutSelected,
  type LibraryHit,
  type SearchableStore,
} from '@/lib/library-search'
import { useLocalStorage, type WatchedItem } from '@/hooks/use-local-storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const STORE_LABEL: Record<SearchableStore, string> = {
  watchlist: 'Saved',
  watchedItems: 'Watched',
  reviews: 'Rated',
  hiddenItems: 'Hidden',
}

/**
 * Search the library, and act on what comes back.
 *
 * Two things people could not do before: ask where a title is (it can be in
 * four places at once, and nothing said which), and remove more than one thing
 * without visiting four pages. Both are answered here without a request — every
 * store is already in this browser, and whatever changes rides out on the
 * ordinary sync a couple of seconds later.
 */
export function LibrarySearch() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [watchlist, setWatchlist] = useLocalStorage('watchlist', [])
  const [watchedItems, setWatchedItems] = useLocalStorage('watchedItems', [])
  const [reviews, setReviews] = useLocalStorage('reviews', [])
  const [hiddenItems, setHiddenItems] = useLocalStorage('hiddenItems', [])

  const hits = useMemo(
    () =>
      searchLibrary({ watchlist, watchedItems, reviews, hiddenItems }, query),
    [hiddenItems, query, reviews, watchedItems, watchlist]
  )

  const chosen = hits.filter((hit) => selected.has(hit.id))

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const setterFor = (
    store: SearchableStore
  ): ((next: WatchedItem[]) => void) => {
    if (store === 'watchlist') return setWatchlist
    if (store === 'watchedItems') return setWatchedItems
    if (store === 'reviews') return setReviews
    return setHiddenItems
  }

  const rowsFor = (store: SearchableStore): WatchedItem[] => {
    if (store === 'watchlist') return watchlist
    if (store === 'watchedItems') return watchedItems
    if (store === 'reviews') return reviews
    return hiddenItems
  }

  const removeChosen = () => {
    // Grouped by store, because each one is its own localStorage key and a
    // single title can be selected in two of them at once.
    for (const store of new Set(chosen.map((hit) => hit.store))) {
      const items = chosen
        .filter((hit) => hit.store === store)
        .map((hit) => hit.item)
      setterFor(store)(withoutSelected(rowsFor(store), items))
    }
    toast(`Removed ${chosen.length} ${chosen.length === 1 ? 'row' : 'rows'}`)
    setSelected(new Set())
  }

  const saveChosen = () => {
    setWatchlist(
      withAdded(
        watchlist,
        chosen.map((hit) => hit.item)
      )
    )
    toast('Added to your watchlist')
    setSelected(new Set())
  }

  return (
    <section className="space-y-4 border-t pt-6">
      <div className="space-y-2">
        <Label htmlFor="library-search">Find something</Label>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="library-search"
            value={query}
            placeholder="A title you saved, watched, rated or hid"
            onChange={(event) => {
              setQuery(event.target.value)
              setSelected(new Set())
            }}
            className="pl-9"
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Searches everything at once and says where each one is. Tick rows to
          remove them, or to put them back on your watchlist.
        </p>
      </div>

      <Results
        query={query}
        hits={hits}
        selected={selected}
        onToggle={toggle}
      />

      {chosen.length > 0 && (
        <div className="bg-card/60 sticky bottom-2 flex flex-wrap items-center gap-2 rounded-lg border p-3 backdrop-blur">
          <span className="text-sm font-medium">{chosen.length} selected</span>
          <Button size="sm" variant="outline" onClick={saveChosen}>
            <Bookmark className="mr-2 size-4" />
            Add to watchlist
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={removeChosen}
          >
            <Trash2 className="mr-2 size-4" />
            Remove
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => setSelected(new Set())}
          >
            <X className="mr-2 size-4" />
            Clear
          </Button>
        </div>
      )}
    </section>
  )
}

/**
 * The result list, or the one line that explains why there is not one.
 *
 * Its own component so the three outcomes are three returns rather than a chain
 * of ternaries in the markup above.
 */
function Results({
  query,
  hits,
  selected,
  onToggle,
}: {
  query: string
  hits: LibraryHit[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (query.trim().length < MIN_QUERY) return null

  if (hits.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing in your library matches that.
      </p>
    )
  }

  return (
    <>
      <ul className="divide-border/60 max-h-96 divide-y overflow-y-auto rounded-lg border">
        {hits.map((hit) => (
          <li key={hit.id}>
            <label className="hover:bg-accent/40 flex cursor-pointer items-center gap-3 p-3 text-sm transition-colors">
              <input
                type="checkbox"
                checked={selected.has(hit.id)}
                onChange={() => onToggle(hit.id)}
                className="accent-primary size-4 shrink-0"
              />
              <span className="min-w-0 flex-1 truncate">{hit.item.title}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {STORE_LABEL[hit.store]}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {hits.length >= MAX_HITS && (
        <p className="text-muted-foreground text-xs">
          Showing the first {MAX_HITS}. Type a bit more to narrow it down.
        </p>
      )}
    </>
  )
}
