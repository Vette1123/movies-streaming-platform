'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Copy } from 'lucide-react'

import { computeStats } from '@/lib/stats'
import { useAccount } from '@/hooks/use-account'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useMounted } from '@/hooks/use-mounted'
import { Button, buttonVariants } from '@/components/ui/button'

const monthName = (key: string): string => {
  const [year, month] = key.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function StatsPanel() {
  const { pro } = useAccount()
  const mounted = useMounted()
  const [history] = useLocalStorage('watchedItems', [])
  const [completed] = useLocalStorage('completedItems', [])
  const [watchlist] = useLocalStorage('watchlist', [])
  const [copied, setCopied] = useState(false)

  const stats = useMemo(
    () => computeStats(history, completed, watchlist.length),
    [completed, history, watchlist.length]
  )

  // localStorage is unread on the server and on the first paint, so every number
  // below would otherwise be a zero that flickers into the real value.
  if (!mounted) {
    return <div aria-hidden className="h-64" />
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
    `About ${stats.hours} hours on Reely.`,
    `${stats.films} films, ${stats.episodes} episodes, ${stats.seriesStarted} shows.`,
    stats.streak > 1 ? `Longest streak: ${stats.streak} days.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure value={`${stats.hours}`} label="hours, roughly" primary />
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
        <Line term="Saved for later" value={`${stats.saved} titles`} />
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
        {!pro && (
          <p className="text-muted-foreground max-w-[52ch] text-sm leading-relaxed">
            These numbers come from this browser alone. Supporting Reely syncs
            your library, so they count everything you watch on every device and
            survive a cleared browser.{' '}
            <Link href="/support" className="text-foreground underline">
              What support unlocks
            </Link>
          </p>
        )}
      </div>
    </div>
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
