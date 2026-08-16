'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  CalendarPlus,
  Check,
  Copy,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

import { buildIcs, type UpcomingItem } from '@/lib/upcoming/ics'
import { useAccount } from '@/hooks/use-account'
import { Button, buttonVariants } from '@/components/ui/button'

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
  if (days < 14) return 'Next week'
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
}

export function UpcomingPanel() {
  const { pro } = useAccount()
  const [items, setItems] = useState<UpcomingItem[]>([])
  const [feedPath, setFeedPath] = useState<string | null>(null)
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
        there. Save a show today and next season&rsquo;s premiere appears in
        your calendar on its own, months from now, without you doing anything.
        Reely already tracks these dates to send your alerts; supporting turns
        them into something you can plan around.
      </SupporterGate>
    )
  }

  if (state === 'loading') {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" /> Reading your schedule
      </div>
    )
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
            Nothing dated yet. This fills in from your watchlist: shows with an
            episode still to air, and films that have not reached their release
            day. A title saved in the last hour or two may not have been picked
            up yet — the schedule refreshes on its own. Subscribing below now
            means it arrives in your calendar the moment it does.
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
  items,
  onRotate,
}: {
  feedPath: string | null
  items: UpcomingItem[]
  onRotate: () => Promise<boolean>
}) {
  const [copied, setCopied] = useState(false)
  const [rotating, setRotating] = useState(false)

  if (!feedPath) return null

  // Built in the browser rather than sent by the server so the link always
  // matches the host somebody is actually reading this on.
  const url = `${window.location.origin}${feedPath}`
  // webcal:// is what makes a single click open the subscribe dialog in Apple
  // Calendar and Outlook instead of downloading a one-off file.
  const webcal = url.replace(/^https?:/, 'webcal:')

  const rotate = async () => {
    if (
      !window.confirm(
        'Replace this link? Any calendar already subscribed to the old one stops updating, and you will need to add the new link there.'
      )
    ) {
      return
    }
    setRotating(true)
    const ok = await onRotate()
    setRotating(false)
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
          to your watchlist from now on turns up in it without another import.
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
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? (
            <Check className="mr-2 size-4" />
          ) : (
            <Copy className="mr-2 size-4" />
          )}
          {copied ? 'Copied' : 'Copy link'}
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
        <Button
          size="sm"
          variant="ghost"
          disabled={rotating}
          onClick={() => void rotate()}
        >
          <RefreshCw
            className={`mr-2 size-4 ${rotating ? 'animate-spin' : ''}`}
          />
          Replace link
        </Button>
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
