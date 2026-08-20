'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Globe, Plus, Star, Trash2, Wand2, X } from 'lucide-react'

import { presetMediaType, type FilterPreset } from '@/lib/filter-presets'
import type { ListItem, StoredList } from '@/lib/lists/routes'
import { useAccount } from '@/hooks/use-account'
import { useLocalStorage, type WatchedItem } from '@/hooks/use-local-storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SkeletonRows } from '@/components/ui/skeleton'
import { SmartListGrid } from '@/components/media/smart-list-grid'

import { SupporterGate } from './supporter-gate'

/**
 * Lists: the part of an account that is actually creative rather than
 * administrative.
 *
 * Everything is built from titles the visitor has already saved or watched, so
 * there is no search, no TMDB call, and no empty text field to stare at. The
 * library is the palette.
 */
export function ListsPanel() {
  const { pro, prefs } = useAccount()
  const [lists, setLists] = useState<StoredList[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/lists')
      if (!response.ok) {
        setLists([])
        return
      }
      const data = await response.json()
      setLists(data.lists ?? [])
    } catch {
      setError('Could not load your lists.')
      setLists([])
    }
  }, [])

  useEffect(() => {
    if (!pro) return
    // Fetch-on-mount: the lists live on the server and there is nothing to show
    // until they arrive. The rule fires on the synchronous failure branch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load, pro])

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true)
      setError(null)
      try {
        const response = await fetch('/api/lists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok || data?.success !== true) {
          setError(data?.error ?? 'That did not save. Try again.')
          return null
        }
        await load()
        return data as { id?: string; slug?: string | null }
      } catch {
        setError('Could not reach the server.')
        return null
      } finally {
        setBusy(false)
      }
    },
    [load]
  )

  if (!pro) {
    return (
      <SupporterGate title="Lists worth sharing">
        Group titles into lists that mean something — a weekend, a marathon, the
        five films you make everyone watch. Add a note and a personal score to
        each, then publish any list as a real link that unfurls with poster art
        wherever you paste it.
      </SupporterGate>
    )
  }

  if (lists === null) {
    return <SkeletonRows rows={3} />
  }

  const open = lists.find((list) => list.id === editing) ?? null

  return (
    <div className="space-y-4">
      {error && <p className="text-destructive text-sm">{error}</p>}

      {open ? (
        <ListEditor
          list={open}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(payload) =>
            send({ action: 'save', id: open.id, ...payload })
          }
          onPublish={(publish) =>
            send({ action: publish ? 'publish' : 'unpublish', id: open.id })
          }
          onDelete={async () => {
            await send({ action: 'delete', id: open.id })
            setEditing(null)
          }}
        />
      ) : (
        <>
          {lists.length === 0 ? (
            <p className="text-muted-foreground max-w-[60ch] text-sm leading-relaxed">
              No lists yet. Start one and pull titles into it from everything
              you have saved or watched.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {lists.map((list) => (
                <li key={list.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(list.id)}
                    className="hover:border-primary/50 hover:bg-card w-full rounded-lg border p-4 text-left transition-colors"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{list.name}</span>
                      {list.slug && (
                        <Globe className="text-primary size-4 shrink-0" />
                      )}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {summaryOf(list)}
                      {list.slug ? ' · public' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <NewList
            busy={busy}
            presets={prefs.presets ?? []}
            onCreate={async (name, smart) => {
              const created = await send({
                action: 'save',
                name,
                items: [],
                smart_query: smart ?? null,
              })
              if (created?.id) setEditing(created.id)
            }}
          />
        </>
      )}
    </div>
  )
}

/** What a row says it holds. A smart list has no fixed count to report. */
const summaryOf = (list: StoredList): string => {
  if (list.smart_query) return 'follows a filter'
  return `${list.items.length} ${list.items.length === 1 ? 'title' : 'titles'}`
}

function NewList({
  busy,
  presets,
  onCreate,
}: {
  busy: boolean
  presets: FilterPreset[]
  onCreate: (name: string, smart?: string) => void
}) {
  const [name, setName] = useState('')
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) return
        onCreate(trimmed)
        setName('')
      }}
    >
      <div className="min-w-[12rem] flex-1 space-y-2">
        <Label htmlFor="new-list">New list</Label>
        <Input
          id="new-list"
          value={name}
          maxLength={80}
          placeholder="Sunday marathon"
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy || !name.trim()}>
        <Plus className="mr-2 size-4" />
        Create
      </Button>

      {presets.length > 0 && (
        <div className="w-full space-y-2 pt-2">
          <p className="text-muted-foreground text-sm">
            Or start one from a filter you saved — a smart list keeps itself up
            to date instead of holding the titles you put in it.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={busy}
                onClick={() =>
                  onCreate(
                    preset.name,
                    `${preset.query}&mediaType=${presetMediaType(preset)}`
                  )
                }
                className="border-border/70 hover:bg-accent flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
              >
                <Wand2 className="size-3" />
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}

interface EditorProps {
  list: StoredList
  busy: boolean
  onClose: () => void
  onSave: (payload: {
    name: string
    description: string | null
    items: ListItem[]
    smart_query: string | null
  }) => Promise<unknown>
  onPublish: (publish: boolean) => Promise<unknown>
  onDelete: () => void
}

function ListEditor({
  list,
  busy,
  onClose,
  onSave,
  onPublish,
  onDelete,
}: EditorProps) {
  const [name, setName] = useState(list.name)
  const [description, setDescription] = useState(list.description ?? '')
  const [items, setItems] = useState<ListItem[]>(list.items)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    await onSave({
      name: name.trim() || list.name,
      description: description.trim() || null,
      items,
      // Sent back unchanged: the save is one UPDATE of the whole row, so
      // omitting it would turn a smart list into an empty ordinary one.
      smart_query: list.smart_query,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="w-full max-w-md space-y-3">
          <div className="space-y-2">
            <Label htmlFor="list-name">Name</Label>
            <Input
              id="list-name"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="list-description">Description</Label>
            <Input
              id="list-description"
              value={description}
              maxLength={400}
              placeholder="What ties these together"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Back">
          <X className="size-4" />
        </Button>
      </div>

      {list.smart_query ? (
        <section className="space-y-3">
          <p className="text-muted-foreground max-w-[62ch] text-sm leading-relaxed">
            This list follows a saved filter. Nothing is added or removed by
            hand — what it holds is whatever matches right now, here and on the
            public page. Below is what that is at this moment.
          </p>
          <SmartListGrid
            query={list.smart_query}
            sizes="(min-width: 1024px) 10rem, (min-width: 640px) 24vw, 45vw"
          />
        </section>
      ) : (
        <>
          <ListItems items={items} onChange={setItems} />

          <AddFromLibrary
            items={items}
            onAdd={(item) => setItems((current) => [...current, item])}
          />
        </>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button onClick={() => void save()} disabled={busy}>
          {saved ? <Check className="mr-2 size-4" /> : null}
          {saved ? 'Saved' : 'Save list'}
        </Button>

        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void onPublish(!list.slug)}
        >
          <Globe className="mr-2 size-4" />
          {list.slug ? 'Make private' : 'Publish'}
        </Button>

        {list.slug && <ShareLink slug={list.slug} />}

        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive ml-auto"
          disabled={busy}
          onClick={onDelete}
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </Button>
      </div>
    </div>
  )
}

function ShareLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  const url =
    typeof window === 'undefined' ? '' : `${location.origin}/l/${slug}`

  return (
    <Button
      variant="secondary"
      onClick={() => {
        void navigator.clipboard?.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? (
        <Check className="mr-2 size-4" />
      ) : (
        <Copy className="mr-2 size-4" />
      )}
      {copied ? 'Link copied' : 'Copy link'}
    </Button>
  )
}

function ListItems({
  items,
  onChange,
}: {
  items: ListItem[]
  onChange: (next: ListItem[]) => void
}) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing in this list yet. Add something from your library below.
      </p>
    )
  }

  const update = (index: number, patch: Partial<ListItem>) => {
    onChange(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    )
  }

  return (
    <ul className="grid gap-3">
      {items.map((item, index) => (
        <li
          key={`${item.type}:${item.id}`}
          className="bg-card/50 grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto]"
        >
          <div className="min-w-0 space-y-2">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <Input
              value={item.note ?? ''}
              maxLength={500}
              placeholder="Why it is here"
              onChange={(event) => update(index, { note: event.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Rating
              value={item.rating ?? 0}
              onChange={(rating) => update(index, { rating })}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${item.title}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <X className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * A 1-10 score, as ten buttons rather than a slider.
 *
 * A slider would need a label to say what it currently reads, and a rating is
 * chosen, not dialled. Ten targets is also the only version of this that works
 * with a thumb.
 */
function Rating({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Rating">
      {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
        <button
          key={score}
          type="button"
          aria-label={`${score} out of 10`}
          aria-pressed={value === score}
          onClick={() => onChange(value === score ? 0 : score)}
          className="group p-0.5"
        >
          <Star
            className={
              score <= value
                ? 'fill-primary text-primary size-3.5'
                : 'text-muted-foreground/40 group-hover:text-muted-foreground size-3.5'
            }
          />
        </button>
      ))}
    </div>
  )
}

/**
 * The picker: everything already in the library, minus what is already in this
 * list, filtered by whatever is typed.
 */
function AddFromLibrary({
  items,
  onAdd,
}: {
  items: ListItem[]
  onAdd: (item: ListItem) => void
}) {
  const [query, setQuery] = useState('')
  const [watchlist] = useLocalStorage('watchlist', [])
  const [history] = useLocalStorage('watchedItems', [])

  const present = useMemo(
    () => new Set(items.map((item) => `${item.type}:${item.id}`)),
    [items]
  )

  const candidates = useMemo(() => {
    const seen = new Map<string, WatchedItem>()
    for (const item of [...watchlist, ...history]) {
      const key = `${item.type}:${item.id}`
      if (present.has(key) || seen.has(key)) continue
      seen.set(key, item)
    }
    const needle = query.trim().toLowerCase()
    const all = [...seen.values()]
    const matched = needle
      ? all.filter((item) => item.title.toLowerCase().includes(needle))
      : all
    return matched.slice(0, 12)
  }, [history, present, query, watchlist])

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="space-y-2">
        <Label htmlFor="list-add">Add from your library</Label>
        <Input
          id="list-add"
          value={query}
          placeholder="Type a title you have saved or watched"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {candidates.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing left to add from your library.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {candidates.map((item) => (
            <button
              key={`${item.type}:${item.id}`}
              type="button"
              onClick={() =>
                onAdd({
                  id: item.id,
                  type: item.type,
                  title: item.title,
                  poster_path: item.poster_path || null,
                })
              }
              className="hover:border-primary/60 hover:bg-accent rounded-full border px-3 py-1.5 text-xs"
            >
              <Plus className="mr-1 inline size-3" />
              {item.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
