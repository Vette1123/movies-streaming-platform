'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  ExternalLink,
  Heart,
  LayoutGrid,
  ListMusic,
  ListVideo,
  Loader2,
  Monitor,
  Palette,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react'

import {
  SUPPORT_EMAIL,
  SUPPORT_PRICES,
  SUPPORT_URL,
  supportMailto,
} from '@/config/support'
import { signInHref, type AccountState } from '@/lib/account'
import { cn } from '@/lib/utils'
import { useAccountSession } from '@/hooks/use-account'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { buttonVariants } from '@/components/ui/button'
import { AccountAvatar } from '@/components/account/account-identity'
import { Icons } from '@/components/icons'

import { AlertsPanel } from './alerts-panel'
import { AppearancePanel } from './appearance-panel'
import { DataPanel } from './data-panel'
import { LibraryPanel } from './library-panel'
import { ListsPanel } from './lists-panel'
import { NextUpPanel } from './next-up-panel'
import { PlaybackPanel } from './playback-panel'
import { UpcomingPanel } from './upcoming-panel'

const SIGN_IN_ERRORS: Record<string, string> = {
  expired:
    'That sign-in took too long or was started in another browser. Try again.',
  failed: 'Google could not complete the sign-in. Try again.',
  email:
    'Google did not return a verified email address, so there is nothing to attach an account to.',
}

interface SectionDef {
  id: string
  label: string
  title: string
  lede: string
  Icon: React.ComponentType<{ className?: string }>
  Panel: React.ComponentType
}

/**
 * The sections of the console, in the order they are worth reading.
 *
 * One table rather than a nav written next to a stack of panels: the rail, the
 * heading, the hash route and the content all read from this, so a section
 * cannot exist in the menu and be missing from the page.
 */
const SECTIONS: SectionDef[] = [
  {
    id: 'library',
    label: 'Library',
    title: 'Your library',
    lede: 'Saved titles, watch history and every episode you have ticked off.',
    Icon: LayoutGrid,
    Panel: LibraryPanel,
  },
  {
    id: 'next-up',
    label: 'Up next',
    title: 'Up next',
    lede: 'Every show you are in the middle of, and the exact episode you are up to.',
    Icon: ListVideo,
    Panel: NextUpPanel,
  },
  {
    id: 'lists',
    label: 'Lists',
    title: 'Lists',
    lede: 'Collections you build from your own library, with a note and a score on anything worth one.',
    Icon: ListMusic,
    Panel: ListsPanel,
  },
  {
    id: 'upcoming',
    label: 'Coming up',
    title: 'Coming up',
    lede: 'Every dated episode and release day on your watchlist, soonest first — and a calendar file of the lot.',
    Icon: CalendarDays,
    Panel: UpcomingPanel,
  },
  {
    id: 'alerts',
    label: 'Alerts',
    title: 'Alerts',
    lede: 'A notification when something you follow actually airs.',
    Icon: BellRing,
    Panel: AlertsPanel,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    title: 'Appearance',
    lede: 'How Reely looks, everywhere you sign in.',
    Icon: Palette,
    Panel: AppearancePanel,
  },
  {
    id: 'playback',
    label: 'Playback',
    title: 'Playback',
    lede: 'Which server streams come from, what plays on its own, and what waits to be asked.',
    Icon: PlayCircle,
    Panel: PlaybackPanel,
  },
  {
    id: 'data',
    label: 'Data & privacy',
    title: 'Data & privacy',
    lede: 'Take it with you, wipe it, or close the account entirely.',
    Icon: ShieldCheck,
    Panel: DataPanel,
  },
]

const OVERVIEW = 'overview'

const sectionExists = (id: string): boolean =>
  id === OVERVIEW || SECTIONS.some((section) => section.id === id)

/**
 * Which section is open, kept in the URL hash.
 *
 * The hash rather than a query parameter: `nuqs`/`useSearchParams` would bail
 * the whole route out to client rendering, and this page is a prerendered static
 * asset like every other one here. The hash also means the header menu can link
 * straight to `/account#lists` and land on it.
 */
function useHashSection(): [string, (id: string) => void] {
  const [section, setSection] = useState(OVERVIEW)

  useEffect(() => {
    const read = () => {
      const id = window.location.hash.replace('#', '')
      setSection(sectionExists(id) ? id : OVERVIEW)
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  const go = useCallback((id: string) => {
    setSection(id)
    // replaceState, not a hash assignment: this is a tab, and filling the back
    // button with six entries of the same page is not what Back means here.
    window.history.replaceState(
      null,
      '',
      id === OVERVIEW ? window.location.pathname : `#${id}`
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return [section, go]
}

/**
 * The account console.
 *
 * Signed out it is a pitch and one button; signed in it is a rail of sections
 * with one open at a time. Everything is a static asset like the rest of the
 * site — nothing here is server-rendered, and the only request it makes is the
 * one refresh that establishes who is looking.
 */
export function AccountPanel() {
  const account = useAccountSession()
  const [section, go] = useHashSection()
  const [signInError, setSignInError] = useState<string | null>(null)

  // The auth handlers redirect failures back here with a reason rather than
  // rendering JSON at a human. Read once, then scrub it out of the URL so a
  // reload or a shared link does not repeat the message.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reason = params.get('signin')
    if (!reason) return
    // The query string is state that exists outside React and only after a
    // redirect; there is no render-time way to read it under `output: 'export'`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignInError(SIGN_IN_ERRORS[reason] ?? SIGN_IN_ERRORS.failed)
    params.delete('signin')
    const query = params.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    )
  }, [])

  if (account.signedIn === undefined) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
        <Loader2 className="size-4 animate-spin" /> Checking your account
      </div>
    )
  }

  if (!account.signedIn) {
    return <SignedOut error={signInError} failed={account.failed} />
  }

  const open = SECTIONS.find((item) => item.id === section)

  return (
    <div className="space-y-10">
      <Identity account={account} />

      <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <SectionRail current={section} onSelect={go} />

        <div className="min-w-0">
          {open ? (
            <section className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight">
                  {open.title}
                </h2>
                <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
                  {open.lede}
                </p>
              </div>
              <open.Panel />
            </section>
          ) : (
            <Overview account={account} onSelect={go} />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The section nav: a sticky rail on a wide screen, a scrollable row of chips on
 * a narrow one. Same list, same state, one definition.
 */
function SectionRail({
  current,
  onSelect,
}: {
  current: string
  onSelect: (id: string) => void
}) {
  const items = [
    { id: OVERVIEW, label: 'Overview', Icon: Monitor },
    ...SECTIONS.map(({ id, label, Icon }) => ({ id, label, Icon })),
  ]

  return (
    <nav
      aria-label="Account sections"
      // The row scrolls on a phone rather than wrapping to three lines; the rail
      // sticks under the 64px header on a laptop.
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:h-fit lg:flex-col lg:overflow-visible lg:px-0"
    >
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={current === id ? 'page' : undefined}
          onClick={() => onSelect(id)}
          className={cn(
            'focus-visible:ring-ring flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden lg:w-full',
            current === id
              ? 'bg-accent text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          )}
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </button>
      ))}
    </nav>
  )
}

/**
 * The landing section: what state this account is in, and the one thing worth
 * doing next. Every tile is a real number read from the same stores the panels
 * use, so it can never say something the section it links to contradicts.
 */
function Overview({
  account,
  onSelect,
}: {
  account: AccountState
  onSelect: (id: string) => void
}) {
  const [watchlist] = useLocalStorage('watchlist', [])
  const [history] = useLocalStorage('watchedItems', [])
  const [completed] = useLocalStorage('completedItems', [])

  return (
    <div className="space-y-8">
      <PlanSection account={account} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile value={watchlist.length} label="saved titles" />
        <Tile value={history.length} label="titles in your history" />
        <Tile value={completed.length} label="episodes ticked off" />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Where to go next</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {SECTIONS.map(({ id, label, lede, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="hover:bg-accent/50 focus-visible:ring-ring flex items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
            >
              <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                  {lede}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Counting hours instead?{' '}
        <Link href="/stats" className="hover:text-foreground underline">
          Your year in Reely
        </Link>
      </p>
    </div>
  )
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-card/50 rounded-lg border p-4">
      <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-1 text-xs">{label}</p>
    </div>
  )
}

function SignedOut({
  error,
  failed,
}: {
  error: string | null
  failed: boolean
}) {
  return (
    <div className="max-w-2xl space-y-8">
      {error && (
        <p className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {failed && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          Accounts are not reachable at the moment. Everything else on Reely
          works exactly as normal: your watchlist and history live in this
          browser and do not need an account.
        </p>
      )}

      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">
          Sign in, or do not. Reely works either way.
        </h2>
        <p className="text-muted-foreground max-w-[60ch] leading-relaxed">
          Everything on this site is free and needs no account. Signing in adds
          one thing: somewhere to keep your library that is not this browser,
          and a place to manage it if you support the project.
        </p>
      </div>

      <a
        href={signInHref('/account')}
        className={buttonVariants({ size: 'lg' })}
      >
        <Icons.google className="mr-2 size-4" />
        Continue with Google
      </a>

      <ul className="text-muted-foreground grid gap-2 text-sm">
        <li>Google handles the password. Reely never sees one.</li>
        <li>
          We store your email address, your name and avatar as Google reports
          them, and nothing about what you watch that you did not save yourself.
        </li>
        <li>
          Deleting the account is one button here, and it takes everything with
          it.
        </li>
      </ul>

      <p className="text-muted-foreground text-sm">
        <Link href="/privacy" className="hover:text-foreground underline">
          Privacy
        </Link>{' '}
        ·{' '}
        <Link href="/terms" className="hover:text-foreground underline">
          Terms
        </Link>
      </p>
    </div>
  )
}

function Identity({ account }: { account: AccountState }) {
  const since = account.createdAt
    ? new Date(account.createdAt).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex flex-wrap items-center gap-4">
      <AccountAvatar
        name={account.name}
        email={account.email}
        picture={account.picture}
        size="xl"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {account.name ?? 'Your account'}
          </h1>
          {account.pro && (
            <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
              <Heart className="size-3" />
              Supporter
            </span>
          )}
        </div>
        <p className="text-muted-foreground truncate text-sm">
          {account.email}
          {since ? ` · here since ${since}` : ''}
        </p>
      </div>
    </div>
  )
}

/**
 * What entitles this account, said plainly.
 *
 * Three real states, not a status enum printed on screen: supported by a live
 * grant, supported through a date that was paid for, and not supporting. The
 * middle one is the hand-converted one-off coffee, and it names its end date
 * because that is the only fact its holder needs.
 */
function PlanSection({ account }: { account: AccountState }) {
  const plan = account.plan
  const endsAt = plan?.endsAt ?? null
  // No "is that date still in the future" check here, deliberately. The server
  // has already made that decision — `pro` is false once the paid period ends
  // (see isEntitled) — so re-deciding it against the browser's clock would only
  // add a way for the two to disagree, and would read the clock during render.
  const throughDate =
    !plan?.granted && endsAt
      ? new Date(endsAt).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null

  if (!account.pro) {
    return (
      <section className="border-primary/30 from-primary/10 rounded-lg border bg-gradient-to-br to-transparent p-6">
        <h2 className="text-xl font-semibold tracking-tight">
          You are on the free plan, and it is a real one
        </h2>
        <p className="text-muted-foreground mt-2 max-w-[60ch] leading-relaxed">
          Nothing you use today depends on paying, and nothing ever will.
          Supporting Reely adds the things an account makes possible: your
          library everywhere, backup servers when a stream will not start, your
          watchlist as a live feed in your own calendar, lists worth sharing,
          alerts when a new episode lands, and a say in what gets built.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/support" className={buttonVariants()}>
            See what support unlocks
          </Link>
          <span className="text-muted-foreground text-sm">
            ${SUPPORT_PRICES.monthly}/month · ${SUPPORT_PRICES.yearly}/year · $
            {SUPPORT_PRICES.lifetime} once
          </span>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-lg border p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">
            Thank you. Everything is unlocked.
          </h2>
          <p className="text-muted-foreground mt-2 max-w-[60ch] leading-relaxed">
            {throughDate
              ? `Supporter access is yours through ${throughDate}.`
              : 'Your support is what pays for the TMDB traffic, the domain, and the hours. Every supporter feature here is on.'}
          </p>
        </div>
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: 'outline' })}
        >
          Manage on Buy Me a Coffee
          <ExternalLink className="ml-2 size-4" />
        </a>
      </div>
      {/* Printed for supporters specifically. Everyone else can open an issue or
          close the tab; somebody who has paid and hit a problem needs an address,
          and needs it where they already are rather than three pages away. */}
      <p className="text-muted-foreground mt-5 text-sm">
        Anything wrong with your membership — the wrong address, a payment that
        did not register, a refund — email{' '}
        <a
          href={supportMailto('Membership')}
          className="text-foreground underline underline-offset-4"
        >
          {SUPPORT_EMAIL}
        </a>{' '}
        and I will sort it myself.
      </p>
    </section>
  )
}
