'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ImageDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  computeStats,
  hoursLabel,
  inYear,
  isExact,
  libraryYears,
  runtimeSource,
  type LibraryStats,
} from '@/lib/stats'
import { cardFileName, renderStatsCard } from '@/lib/stats-card'
import { localFullDate, localMonthYear } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useMounted } from '@/hooks/use-mounted'
import { useRuntimeBackfill } from '@/hooks/use-runtime-backfill'
import { Button, buttonVariants } from '@/components/ui/button'
import { chipVariants } from '@/components/ui/chip'
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton'

const monthName = (key: string): string => {
  const [year, month] = key.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return localMonthYear(date)
}

export function StatsPanel() {
  const { pro, name } = useAccount()
  const mounted = useMounted()
  const [history] = useLocalStorage('watchedItems', [])
  const [completed] = useLocalStorage('completedItems', [])
  const [watchlist] = useLocalStorage('watchlist', [])
  const [copied, setCopied] = useState(false)
  // null is all time, and is the default: the whole library is the honest
  // answer to "how much have I watched", and a year is the thing you post.
  const [year, setYear] = useState<number | null>(null)

  const backfill = useRuntimeBackfill(pro, completed)

  const years = useMemo(
    () => libraryYears(history, completed),
    [completed, history]
  )

  const stats = useMemo(
    () =>
      computeStats(
        inYear(history, year),
        inYear(completed, year),
        inYear(watchlist, year).length,
        backfill
      ),
    [backfill, completed, history, watchlist, year]
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
  const picker = <YearPicker years={years} selected={year} onSelect={setYear} />

  if (nothingYet) {
    return (
      <div className="max-w-[60ch] space-y-4">
        {picker}
        <p className="leading-relaxed text-muted-foreground">
          {emptyLine(year)}
        </p>
        <Link href="/movies" className={buttonVariants({ variant: 'outline' })}>
          Find something to watch
        </Link>
      </div>
    )
  }

  const summary = [
    `${isExact(stats) ? '' : 'About '}${stats.hours} hours${year === null ? '' : ` in ${year}`} on Reely.`,
    `${stats.films} films, ${stats.episodes} episodes, ${stats.seriesStarted} shows.`,
    stats.streak > 1 ? `Longest streak: ${stats.streak} days.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-10">
      {picker}

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
          value={stats.firstAt ? localFullDate(stats.firstAt) : 'Not yet'}
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
          <ShareCard stats={stats} name={name} year={year} />
        ) : (
          <p className="max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
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
  year,
}: {
  stats: LibraryStats
  name: string | null
  year: number | null
}) {
  const [busy, setBusy] = useState(false)

  const make = async (): Promise<File | null> => {
    const blob = await renderStatsCard(stats, name, year)
    if (!blob) return null
    return new File([blob], cardFileName(year), { type: 'image/png' })
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
        await navigator.share({
          files: [file],
          title: year === null ? 'My year on Reely' : `My ${year} on Reely`,
        })
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
      {year === null ? 'Get your card' : `Get your ${year} card`}
    </Button>
  )
}

/** What to say when the scope somebody picked has nothing in it. */
const emptyLine = (year: number | null): string =>
  year === null
    ? 'Nothing to count yet. Tick an episode off or finish a film and this page starts keeping score.'
    : `Nothing finished in ${year}. Saved titles and part-watched shows still count towards everything else.`

/**
 * All time, or one year.
 *
 * A row of pills rather than a select: there are rarely more than three or four
 * choices, and the whole point of the feature is that the year is one tap away
 * from the numbers it changes. Hidden entirely for a library that has only ever
 * seen one year — a picker with one real option is furniture.
 */
function YearPicker({
  years,
  selected,
  onSelect,
}: {
  years: number[]
  selected: number | null
  onSelect: (year: number | null) => void
}) {
  if (years.length < 2) return null

  const choices: Array<{ key: string; label: string; value: number | null }> = [
    { key: 'all', label: 'All time', value: null },
    ...years.map((year) => ({
      key: String(year),
      label: String(year),
      value: year,
    })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {choices.map((choice) => {
        const active = choice.value === selected
        return (
          <button
            key={choice.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(choice.value)}
            className={chipVariants({
              variant: active ? 'primary' : 'neutral',
              interactive: !active,
            })}
          >
            {choice.label}
          </button>
        )
      })}
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
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function Line({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2">
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}
