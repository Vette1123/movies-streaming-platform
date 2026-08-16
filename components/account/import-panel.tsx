'use client'

import { useRef, useState } from 'react'
import { Download, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { parseImport, type ImportRow } from '@/lib/import/parse'
import type { ResolvedRow } from '@/lib/import/routes'
import { useAccount } from '@/hooks/use-account'
import {
  readStore,
  writeStore,
  type WatchedItem,
} from '@/hooks/use-local-storage'
import { Button } from '@/components/ui/button'

import { SupporterGate } from './supporter-gate'

/**
 * Bringing a library in from somewhere else.
 *
 * The switching cost is the reason people stay where they are: a decade of
 * Letterboxd ratings is not something anybody retypes. Both Letterboxd and IMDb
 * export CSV, so the file is parsed on this device (lib/import/parse.ts) and
 * only the titles that need a TMDB id are ever sent anywhere — never the
 * ratings, never the dates, never the file.
 *
 * Resolution runs a batch at a time so the whole thing stays inside the
 * 50-subrequest ceiling however large the export is, and nothing is written to
 * the library until every batch is done and the count is on screen.
 */

/** Matches lib/import/routes.ts. Kept in step by the two files that own it. */
const BATCH = 20
/** A whole Letterboxd history, and then some. Above this the UI says so. */
const MAX_ROWS = 2000

type Phase = 'idle' | 'working' | 'done'

interface Outcome {
  matched: number
  unmatched: number
  rated: number
  destination: 'history' | 'watchlist'
}

const nowIso = () => new Date().toISOString()

/**
 * Build the library row for a resolved title.
 *
 * Deliberately thin: an import knows an id, a name and a poster, and inventing
 * an overview or a backdrop it does not have would put placeholder text in
 * somebody's library. Everything else fills in the first time the title is
 * opened.
 */
function toItem(row: ResolvedRow, rating: number | null): WatchedItem {
  const stamp = nowIso()
  const item: WatchedItem = {
    id: row.id,
    type: row.type,
    title: row.title,
    overview: '',
    backdrop_path: '',
    poster_path: row.poster_path ?? '',
    added_at: stamp,
    modified_at: stamp,
  }
  if (rating !== null) item.rating = rating
  return item
}

/** Merge in, never overwrite: an existing row is somebody's own, and it wins. */
function mergeInto(key: string, incoming: WatchedItem[]): number {
  const existing = readStore(key)
  const seen = new Set(existing.map((item) => `${item.type}:${item.id}`))
  const added = incoming.filter((item) => !seen.has(`${item.type}:${item.id}`))
  if (added.length > 0) writeStore(key, [...existing, ...added])
  return added.length
}

export function ImportPanel() {
  const { pro } = useAccount()
  const fileInput = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  if (!pro) {
    return (
      <SupporterGate
        title="Bring your Letterboxd or IMDb library with you"
        Icon={Upload}
        surface="import"
        cta="Unlock importing"
      >
        Years of ratings and a watchlist you have been adding to since forever —
        exported from Letterboxd or IMDb as a CSV and read straight in, matched
        to real titles, with your scores carried over onto Reely&rsquo;s
        ten-point scale. The file is read on this device and never uploaded;
        only the titles that need looking up are sent, and never your ratings.
      </SupporterGate>
    )
  }

  const run = async (file: File) => {
    setPhase('working')
    setOutcome(null)

    const parsed = parseImport(await file.text())
    if (parsed.kind === 'unknown' || parsed.rows.length === 0) {
      setPhase('idle')
      toast.error(
        'That does not look like a Letterboxd or IMDb export. Look for ratings.csv or watchlist.csv.'
      )
      return
    }

    const rows = parsed.rows.slice(0, MAX_ROWS)
    setProgress({ done: 0, total: rows.length })

    const items: WatchedItem[] = []
    let unmatched = 0
    let rated = 0

    for (let start = 0; start < rows.length; start += BATCH) {
      const slice = rows.slice(start, start + BATCH)
      const resolved = await resolveBatch(slice)

      for (const row of resolved) {
        const source = slice[row.index]
        if (!source) continue
        if (source.rating !== null) rated++
        items.push(toItem(row, source.rating))
      }
      unmatched += slice.length - resolved.length
      setProgress({
        done: Math.min(start + BATCH, rows.length),
        total: rows.length,
      })
    }

    // A file with ratings is a history; a file without them is a watchlist.
    // That is exactly what the two exports mean, and asking somebody to
    // classify their own file is asking them to do the reading for us.
    const destination = rated > 0 ? 'history' : 'watchlist'
    const matched = mergeInto(
      destination === 'history' ? 'watchedItems' : 'watchlist',
      items
    )
    // The scores go to the reviews store, which is where a rating lives — see
    // hooks/use-review. Same rows, so an unrated import writes nothing here.
    if (rated > 0) {
      mergeInto(
        'reviews',
        items.filter((item) => item.rating !== undefined)
      )
    }

    setOutcome({ matched, unmatched, rated, destination })
    setPhase('done')
  }

  return (
    <div className="max-w-[65ch] space-y-6">
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Export from{' '}
          <strong className="text-foreground font-medium">Letterboxd</strong>{' '}
          (Settings → Import &amp; Export → Export your data) or{' '}
          <strong className="text-foreground font-medium">IMDb</strong> (a list
          → Export), then drop the CSV here. A file with ratings becomes watch
          history and scores; a file without them becomes your watchlist.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          The file never leaves this device. Only titles that need a TMDB id are
          looked up, and your ratings are not part of that lookup.
        </p>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Cleared immediately so picking the same file twice still fires.
          event.target.value = ''
          if (file) void run(file)
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={phase === 'working'}
          onClick={() => fileInput.current?.click()}
        >
          {phase === 'working' ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          Choose a CSV
        </Button>
        {phase === 'working' && progress.total > 0 && (
          <span className="text-muted-foreground font-mono text-sm tabular-nums">
            {progress.done} / {progress.total}
          </span>
        )}
      </div>

      {outcome && <Result outcome={outcome} />}
    </div>
  )
}

async function resolveBatch(rows: ImportRow[]): Promise<ResolvedRow[]> {
  try {
    const response = await fetch('/api/import/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Only what a lookup needs. The rating stays on this device.
        rows: rows.map((row) => ({
          imdb: row.imdb,
          title: row.title,
          year: row.year,
        })),
      }),
    })
    const body = await response.json()
    if (!response.ok || !body?.success) return []
    return (body.resolved ?? []) as ResolvedRow[]
  } catch {
    return []
  }
}

function Result({ outcome }: { outcome: Outcome }) {
  const where =
    outcome.destination === 'history' ? 'watch history' : 'watchlist'

  return (
    <div className="space-y-2 rounded-lg border p-5">
      <p className="text-sm font-semibold">
        {outcome.matched} added to your {where}
      </p>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {outcome.rated > 0 &&
          `${outcome.rated} ratings came across onto the ten-point scale. `}
        {outcome.unmatched > 0
          ? `${outcome.unmatched} could not be matched to a title and were left out — usually a short, a re-release, or a name that means something different on TMDB.`
          : 'Everything in the file was matched.'}
      </p>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Anything already in your library was left exactly as it was. Your
        devices catch up on the next sync.
      </p>
    </div>
  )
}
