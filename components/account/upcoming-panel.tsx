'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  CalendarPlus,
  Check,
  Copy,
  RefreshCw,
  Rss,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'

import { buildIcs, type UpcomingItem } from '@/lib/upcoming/ics'
import { useAccount } from '@/hooks/use-account'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SkeletonRows } from '@/components/ui/skeleton'

import { SupporterGate } from './supporter-gate'

type State = 'loading' | 'ready' | 'failed'

const hrefOf = (key: string): string => {
  const [kind, id] = key.split(':')
  return kind === 'series' ? `/tv-shows/${id}` : `/movies/${id}`
}

/**
 * How far away, in words.
 *
 * Days apart rather than a duration: both sides are floored to midnight UTC
 * first, so something airing in eight hours reads "tomorrow" if that is the day
 * it is on, which is what a schedule means.
 */
function whenLabel(date: string, todayStamp: number): string {
  const stamp = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(stamp)) return date
  const days = Math.round((stamp - todayStamp) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `In ${days} days`
  // 7 to 13 days used to read "Next week", which is a fortnight's worth of
  // dates wearing one label — something 13 days out is not next week. The
  // weekday is both shorter and true.
  if (days < 14) {
    return `Next ${new Date(stamp).toLocaleDateString(undefined, { weekday: 'long' })}`
  }
  return new Date(stamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
  })
}

const fullDate = (date: string): string => {
  const stamp = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(stamp)) return date
  return new Date(stamp).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * The schedule behind a watchlist.
 *
 * Everything shown here was already fetched by the hourly sweep for the alerts
 * it sends, so the panel costs one D1 query and no TMDB traffic at all. The
 * calendar file is built in the browser from the same rows, which is why there
 * is no second endpoint for it.
 */
interface Feed {
  success?: boolean
  items?: UpcomingItem[]
  feedPath?: string
  rssPath?: string
  /** Synced watchlist size — see the empty state, which needs it to tell the truth. */
  watchlist?: number
}

/**
 * What an empty schedule actually means.
 *
 * Two very different situations look identical from the panel's side, and
 * saying the wrong one leaves somebody waiting for something that is never
 * coming. The count is the only thing that separates them.
 */
function emptyCopy(watchlist: number): string {
  if (watchlist === 0) {
    return 'Your synced watchlist is empty, so there is nothing to put a date on. Save a few shows or films — anything with an episode still to air, or a release day still ahead, appears here within the hour and lands in your calendar on its own.'
  }
  return `Nothing on your watchlist has a date yet. Reely re-checks ${watchlist} saved ${watchlist === 1 ? 'title' : 'titles'} on a rolling schedule, and anything with an episode still to air or a release day ahead shows up here as soon as it does. Subscribing below now means it arrives in your calendar the moment it does.`
}

export function UpcomingPanel() {
  const { pro } = useAccount()
  const [items, setItems] = useState<UpcomingItem[]>([])
  const [feedPath, setFeedPath] = useState<string | null>(null)
  const [rssPath, setRssPath] = useState<string | null>(null)
  const [watchlist, setWatchlist] = useState(0)
  const [state, setState] = useState<State>('loading')

  const load = useCallback(async (rotate = false): Promise<boolean> => {
    try {
      const response = await fetch('/api/upcoming', {
        method: rotate ? 'POST' : 'GET',
      })
      const body = (await response.json()) as Feed
      if (!response.ok || !body.success) {
        setState('failed')
        return false
      }
      setItems(body.items ?? [])
      setFeedPath(body.feedPath ?? null)
      setRssPath(body.rssPath ?? null)
      setWatchlist(body.watchlist ?? 0)
      setState('ready')
      return true
    } catch {
      setState('failed')
      return false
    }
  }, [])

  useEffect(() => {
    if (!pro) return
    // Fetching from the Worker is the "synchronise with an external system" case
    // an effect exists for; the rule fires only because the failure path settles
    // its state without awaiting anything.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [pro, load])

  // Floored to midnight UTC once, and outside the row loop: comparing dates
  // against a clock that moves while the list renders is how a row ends up
  // saying "Tomorrow" next to one that says "In 1 days".
  const todayStamp = useMemo(
    () => Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`),
    []
  )

  if (!pro) {
    return (
      <SupporterGate
        title="A calendar of everything you are waiting for"
        Icon={CalendarDays}
        surface="upcoming"
        cta="Unlock the schedule"
      >
        Every dated episode and release day across your whole watchlist, on one
        page, soonest first — plus a private calendar link that puts all of it
        straight into Google Calendar, Apple Calendar or Outlook and keeps it
        there, with a reminder the morning before each one. Save a show today
        and next season&rsquo;s premiere appears in your calendar on its own,
        months from now, without you doing anything. Reely already tracks these
        dates to send your alerts; supporting turns them into something you can
        plan around.
      </SupporterGate>
    )
  }

  if (state === 'loading') {
    return <SkeletonRows rows={5} rowClassName="h-16 rounded-lg" />
  }

  if (state === 'failed') {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        The schedule is not reachable at the moment. Your watchlist and alerts
        are unaffected — try this section again in a minute.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {items.length === 0 ? (
        <div className="max-w-[60ch] space-y-4 rounded-lg border border-dashed p-5">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {emptyCopy(watchlist)}
          </p>
          <Link
            href="/watchlist"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Go to your watchlist
          </Link>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li
              key={`${item.key}-${item.date}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4"
            >
              <div className="min-w-0">
                <Link
                  href={hrefOf(item.key)}
                  className="hover:text-primary text-sm font-medium underline-offset-4 hover:underline"
                >
                  {item.name}
                </Link>
                {item.label && (
                  <span className="text-muted-foreground ml-2 font-mono text-xs">
                    {item.label}
                  </span>
                )}
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {fullDate(item.date)}
                </p>
              </div>
              <span className="text-primary shrink-0 text-xs font-semibold">
                {whenLabel(item.date, todayStamp)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <FeedSection
        feedPath={feedPath}
        rssPath={rssPath}
        items={items}
        onRotate={() => load(true)}
      />
    </div>
  )
}

/**
 * The subscription link, which is the part worth paying for.
 *
 * A downloaded .ics is a snapshot that goes stale the day it is imported. This
 * URL is polled by the calendar app itself, so a show saved months from now
 * turns up in the same calendar with no second import — which is why it is
 * offered first and the download is offered as the fallback for a calendar that
 * cannot subscribe.
 */
function FeedSection({
  feedPath,
  rssPath,
  items,
  onRotate,
}: {
  feedPath: string | null
  rssPath: string | null
  items: UpcomingItem[]
  onRotate: () => Promise<boolean>
}) {
  const [copied, setCopied] = useState<'ics' | 'rss' | null>(null)

  if (!feedPath) return null

  // Built in the browser rather than sent by the server so the link always
  // matches the host somebody is actually reading this on.
  const url = `${window.location.origin}${feedPath}`
  // webcal:// is what makes a single click open the subscribe dialog in Apple
  // Calendar and Outlook instead of downloading a one-off file.
  const webcal = url.replace(/^https?:/, 'webcal:')

  const rotate = async () => {
    const ok = await onRotate()
    toast(ok ? 'New calendar link ready' : 'Could not replace the link')
  }

  return (
    <section className="bg-card/40 space-y-4 rounded-lg border p-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">
          Put this in your real calendar
        </h3>
        <p className="text-muted-foreground max-w-[62ch] text-sm leading-relaxed">
          A private link your calendar app checks on its own. Anything you add
          to your watchlist from now on turns up in it without another import,
          with a reminder the morning before it airs, and the past week stays in
          there so you can see what you missed. The same schedule is an RSS feed
          too, if a reader is where you would rather see it.
        </p>
      </div>

      <code className="border-border/60 bg-background block overflow-x-auto rounded border px-3 py-2 font-mono text-xs whitespace-nowrap">
        {url}
      </code>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(url)
            setCopied('ics')
            setTimeout(() => setCopied(null), 2000)
          }}
        >
          {copied === 'ics' ? (
            <Check className="mr-2 size-4" />
          ) : (
            <Copy className="mr-2 size-4" />
          )}
          {copied === 'ics' ? 'Copied' : 'Copy link'}
        </Button>
        <a
          href={webcal}
          className={buttonVariants({ size: 'sm', variant: 'outline' })}
        >
          <CalendarDays className="mr-2 size-4" />
          Subscribe now
        </a>
        <Button
          size="sm"
          variant="outline"
          disabled={items.length === 0}
          onClick={() => downloadIcs(items)}
        >
          <CalendarPlus className="mr-2 size-4" />
          Download once
        </Button>
        {rssPath && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(
                `${window.location.origin}${rssPath}`
              )
              setCopied('rss')
              setTimeout(() => setCopied(null), 2000)
            }}
          >
            {copied === 'rss' ? (
              <Check className="mr-2 size-4" />
            ) : (
              <Rss className="mr-2 size-4" />
            )}
            {copied === 'rss' ? 'Copied' : 'Copy RSS link'}
          </Button>
        )}
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="ghost">
              <RefreshCw className="mr-2 size-4" />
              Replace link
            </Button>
          }
          title="Replace this calendar link?"
          description="A new private link is minted straight away, and this one stops working the moment it is."
          confirmLabel="Replace link"
          cancelLabel="Keep this one"
          Icon={ShieldAlert}
          onConfirm={rotate}
        >
          {/* The consequence people actually care about, and the one a single
              sentence buries: a calendar that is already subscribed does not
              follow the change, it just quietly stops updating. */}
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li className="flex gap-2">
              <span aria-hidden className="text-destructive">
                &bull;
              </span>
              Any calendar already subscribed to the old link stops updating.
              You will need to add the new one there.
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-destructive">
                &bull;
              </span>
              Anyone you shared the old link with loses access immediately —
              which is the point, if that is why you are here.
            </li>
          </ul>
        </ConfirmDialog>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Google Calendar: <em>Other calendars → From URL</em>. Apple Calendar:{' '}
        <em>File → New Calendar Subscription</em>. Treat the link like a
        password — anyone who has it can see this schedule. Replace it any time.
      </p>
    </section>
  )
}

/**
 * Build the file and hand it to the browser.
 *
 * A blob URL rather than a route: the rows are already here, and a download
 * endpoint would mean a second authenticated Worker invocation to produce bytes
 * this page can produce for free.
 */
function downloadIcs(items: UpcomingItem[]): void {
  const ics = buildIcs(items, window.location.origin, Date.now())
  const url = URL.createObjectURL(
    new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'reely-upcoming.ics'
  link.click()
  URL.revokeObjectURL(url)
}
