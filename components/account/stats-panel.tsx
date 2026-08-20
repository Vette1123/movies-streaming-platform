'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ImageDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  computeStats,
  hoursLabel,
  isExact,
  runtimeSource,
  type LibraryStats,
} from '@/lib/stats'
import { renderStatsCard } from '@/lib/stats-card'
import { useAccount } from '@/hooks/use-account'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useMounted } from '@/hooks/use-mounted'
import { useRuntimeBackfill } from '@/hooks/use-runtime-backfill'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton'

const monthName = (key: string): string => {
  const [year, month] = key.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function StatsPanel() {
  const { pro, name } = useAccount()
  const mounted = useMounted()
  const [history] = useLocalStorage('watchedItems', [])
  const [completed] = useLocalStorage('completedItems', [])
  const [watchlist] = useLocalStorage('watchlist', [])
  const [copied, setCopied] = useState(false)

  const backfill = useRuntimeBackfill(pro, completed)

  const stats = useMemo(
    () => computeStats(history, completed, watchlist.length, backfill),
    [backfill, completed, history, watchlist.length]
  )

  // localStorage is unread on the server and on the first paint, so every number
  // below would otherwise be a zero that flickers into the real value.
  if (!mounted) {
    return (
      <div aria-hidden className="space-y-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-28 w-full rounded-lg"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
        <SkeletonRows rows={3} rowClassName="h-16 rounded-lg" />
      </div>
    )
  }

  const nothingYet = stats.episodes === 0 && stats.films === 0

  if (nothingYet) {
    return (
      <div className="max-w-[60ch] space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          Nothing to count yet. Tick an episode off or finish a film and this
          page starts keeping score.
        </p>
        <Link href="/movies" className={buttonVariants({ variant: 'outline' })}>
          Find something to watch
        </Link>
      </div>
    )
  }

  const summary = [
    `${isExact(stats) ? '' : 'About '}${stats.hours} hours on Reely.`,
    `${stats.films} films, ${stats.episodes} episodes, ${stats.seriesStarted} shows.`,
    stats.streak > 1 ? `Longest streak: ${stats.streak} days.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure value={`${stats.hours}`} label={hoursLabel(stats)} primary />
        <Figure value={`${stats.films}`} label="films finished" />
        <Figure value={`${stats.episodes}`} label="episodes ticked off" />
        <Figure value={`${stats.seriesStarted}`} label="shows started" />
      </div>

      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Line
          term="Longest streak"
          value={
            stats.streak > 1
              ? `${stats.streak} days in a row`
              : 'Still building'
          }
        />
        <Line
          term="Busiest month"
          value={stats.busiestMonth ? monthName(stats.busiestMonth) : 'Not yet'}
        />
        <Line
          term="First tracked"
          value={
            stats.firstAt
              ? new Date(stats.firstAt).toLocaleDateString()
              : 'Not yet'
          }
        />
        <Line
          term="Saved for later"
          value={`${stats.saved} ${stats.saved === 1 ? 'title' : 'titles'}`}
        />
        <Line term="Runtimes" value={runtimeSource(stats)} />
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard?.writeText(summary)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? (
            <Check className="mr-2 size-4" />
          ) : (
            <Copy className="mr-2 size-4" />
          )}
          {copied ? 'Copied' : 'Copy your summary'}
        </Button>
        {pro ? (
          <ShareCard stats={stats} name={name} />
        ) : (
          <p className="text-muted-foreground max-w-[52ch] text-sm leading-relaxed">
            These numbers come from this browser alone, and they stop at this
            browser too. Supporting Reely counts everything you watch on every
            device, survives a cleared browser, and turns the year into a card
            worth posting.{' '}
            <Link href="/support" className="text-foreground underline">
              What support unlocks
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * The card, and the two ways to get it off the device.
 *
 * `navigator.share` with a file is the good path on a phone — it opens the real
 * share sheet, so the card goes straight into a story or a chat. Everything else
 * gets a download, which is what a desktop wants anyway. Both are Pro: the
 * numbers behind the card only mean anything once a library follows somebody
 * between devices, and this is the part people show other people.
 */
function ShareCard({
  stats,
  name,
}: {
  stats: LibraryStats
  name: string | null
}) {
  const [busy, setBusy] = useState(false)

  const make = async (): Promise<File | null> => {
    const blob = await renderStatsCard(stats, name)
    if (!blob) return null
    return new File([blob], 'reely-year.png', { type: 'image/png' })
  }

  const share = async () => {
    setBusy(true)
    try {
      const file = await make()
      if (!file) {
        toast(
          'This browser cannot draw the card. The summary above still copies.'
        )
        return
      }
      // canShare with the file, not just a share check: desktop Chrome has
      // navigator.share and refuses files, and calling share anyway throws.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My year on Reely' })
        return
      }
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      // A share sheet the user dismissed throws AbortError. Nothing went wrong
      // and nothing needs saying.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button disabled={busy} onClick={() => void share()}>
      {busy ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <ImageDown className="mr-2 size-4" />
      )}
      Get your card
    </Button>
  )
}

function Figure({
  value,
  label,
  primary = false,
}: {
  value: string
  label: string
  primary?: boolean
}) {
  return (
    <div className="rounded-lg border p-5">
      <p
        className={`font-mono text-4xl font-semibold tabular-nums ${primary ? 'text-primary' : ''}`}
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-2 text-xs">{label}</p>
    </div>
  )
}

function Line({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2">
      <dt className="text-muted-foreground text-sm">{term}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}
