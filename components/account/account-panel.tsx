'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  EyeOff,
  Gift,
  Heart,
  LayoutGrid,
  ListMusic,
  ListVideo,
  Monitor,
  Palette,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
} from 'lucide-react'

import {
  SUPPORT_EMAIL,
  SUPPORT_URL,
  supportMailto,
  supportPriceRow,
} from '@/config/support'
import { signInHref, type AccountState } from '@/lib/account'
import { cn } from '@/lib/utils'
import { useAccountSession } from '@/hooks/use-account'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { buttonVariants } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AccountAvatar } from '@/components/account/account-identity'
import { AccountSkeleton } from '@/components/account/account-skeleton'
import { Icons } from '@/components/icons'

import { AlertsPanel } from './alerts-panel'
import { AppearancePanel } from './appearance-panel'
import { DataPanel } from './data-panel'
import { ForYouPanel } from './for-you-panel'
import { GiftsPanel } from './gifts-panel'
import { HiddenPanel } from './hidden-panel'
import { ImportPanel } from './import-panel'
import { LibraryPanel } from './library-panel'
import { ListsPanel } from './lists-panel'
import { NextUpPanel } from './next-up-panel'
import { PlaybackPanel } from './playback-panel'
import { ProfilePanel } from './profile-panel'
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
    id: 'for-you',
    label: 'For you',
    title: 'Because you watched',
    lede: 'What to watch next, worked out from what you actually finished.',
    Icon: Sparkles,
    Panel: ForYouPanel,
  },
  {
    id: 'hidden',
    label: 'Not interested',
    title: 'Titles you hid',
    lede: 'Everything you dismissed, and one tap to put any of it back.',
    Icon: EyeOff,
    Panel: HiddenPanel,
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
    id: 'profile',
    label: 'Public page',
    title: 'Your public page',
    lede: 'One address worth sending: what you have finished, what you rated highest, and the lists you published.',
    Icon: UserRound,
    Panel: ProfilePanel,
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
    id: 'import',
    label: 'Import',
    title: 'Bring a library in',
    lede: 'Years of Letterboxd or IMDb ratings, read straight in from their CSV export.',
    Icon: Upload,
    Panel: ImportPanel,
  },
  {
    id: 'gifts',
    label: 'Gifts',
    title: 'Gifts and referrals',
    lede: 'Hand somebody a month, redeem one you were given, and earn one for every three people who join from your page.',
    Icon: Gift,
    Panel: GiftsPanel,
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
    return <AccountSkeleton sections={SECTIONS.length} />
  }

  if (!account.signedIn) {
    return (
      <SignedOut
        error={signInError}
        failed={account.failed}
        // Nothing here is worth reading before signing in, so a visitor who
        // came to sign in is sent straight to Google — unless the last attempt
        // came back with something to say, or this browser has already been
        // sent once (see AUTO_SIGNIN_KEY): bouncing somebody who cancelled
        // straight back into the same consent screen is a trap, not a shortcut.
        auto={!signInError && !account.failed}
      />
    )
  }

  const open = SECTIONS.find((item) => item.id === section)

  return (
    <div className="space-y-10">
      <Identity account={account} />

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
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
    <>
      <SectionPicker items={items} current={current} onSelect={onSelect} />

      {/* The rail sticks under the 64px header on a laptop. Below `lg` it does
          not exist at all: twelve sections in a horizontal scroller meant three
          of them were visible, the rest were a swipe nobody takes, and the
          scrollbar sat across the page like a stray progress bar. */}
      <nav
        aria-label="Account sections"
        className="hidden lg:sticky lg:top-24 lg:flex lg:h-fit lg:flex-col lg:gap-1"
      >
        {items.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={current === id ? 'page' : undefined}
            onClick={() => onSelect(id)}
            className={cn(
              'focus-visible:ring-ring group flex w-full shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
              current === id
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            <Icon
              className={cn(
                'size-4 shrink-0 transition-colors',
                current === id ? 'text-primary' : 'group-hover:text-foreground'
              )}
            />
            {label}
          </button>
        ))}
      </nav>
    </>
  )
}

/**
 * The same twelve sections on a phone, as one control.
 *
 * A button that says where you are, and a sheet that shows everywhere you can
 * go — every section reachable in one tap from a list you can read, instead of
 * three labels and a horizontal swipe. Same `items`, same `onSelect`: there is
 * still one definition of what a section is.
 */
function SectionPicker({
  items,
  current,
  onSelect,
}: {
  items: { id: string; label: string; Icon: SectionDef['Icon'] }[]
  current: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const active = items.find((item) => item.id === current) ?? items[0]
  const ActiveIcon = active.Icon

  const go = (id: string) => {
    setOpen(false)
    onSelect(id)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={`Section: ${active.label}. Change section`}
        className="focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/20 hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:outline-hidden lg:hidden"
      >
        <span className="bg-primary-fill/10 text-primary grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-white/10">
          <ActiveIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-muted-foreground block text-[11px]">
            Account
          </span>
          <span className="block truncate text-sm font-medium">
            {active.label}
          </span>
        </span>
        <ChevronDown className="text-muted-foreground size-4 shrink-0" />
      </SheetTrigger>

      <SheetContent
        side="bottom"
        dragToClose
        className="max-h-[85svh] overflow-y-auto rounded-t-2xl border-white/10 p-4 pt-6 pb-8"
      >
        <SheetHeader className="mt-2 mb-3 text-left">
          <SheetTitle className="text-base">Go to</SheetTitle>
        </SheetHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={current === id ? 'page' : undefined}
              onClick={() => go(id)}
              className={cn(
                'focus-visible:ring-ring flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition focus-visible:ring-2 focus-visible:outline-hidden',
                current === id
                  ? 'border-primary/40 bg-primary/10 font-medium'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
              )}
            >
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-white/10',
                  current === id
                    ? 'bg-primary-fill/20 text-primary'
                    : 'bg-primary-fill/10 text-primary/90'
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {current === id && (
                <Check className="text-primary size-4 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
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
              className="group focus-visible:ring-ring relative flex items-start gap-3.5 rounded-xl border border-white/10 bg-white/[0.03] p-4 pr-9 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_10px_30px_-12px_rgba(0,0,0,0.7)] focus-visible:ring-2 focus-visible:outline-hidden motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:[&:last-child:nth-child(odd)]:col-span-2"
            >
              <span className="bg-primary-fill/10 text-primary/90 group-hover:bg-primary-fill/20 group-hover:text-primary grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-white/10 transition-colors">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                  {lede}
                </span>
              </span>
              <ChevronRight className="text-muted-foreground/50 group-hover:text-primary absolute top-4.5 right-3 size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
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

/** Once per tab. sessionStorage, so a new tab is a fresh chance to be helped. */
const AUTO_SIGNIN_KEY = 'reely_auto_signin'

function SignedOut({
  error,
  failed,
  auto,
}: {
  error: string | null
  failed: boolean
  auto?: boolean
}) {
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (!auto) return
    try {
      if (window.sessionStorage.getItem(AUTO_SIGNIN_KEY)) return
      window.sessionStorage.setItem(AUTO_SIGNIN_KEY, '1')
    } catch {
      // Private mode. One hop is still better than a page nobody reads; the
      // guard above is what stops it repeating, and a browser without storage
      // gets the page back the moment it returns from a cancelled sign-in.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRedirecting(true)
    window.location.href = signInHref('/account')
  }, [auto])

  if (redirecting) {
    return (
      <div className="flex min-h-[50svh] flex-col items-center justify-center gap-4 text-center">
        <Icons.google className="size-8 animate-pulse" />
        <p className="text-muted-foreground text-sm">Taking you to Google…</p>
        <a
          href={signInHref('/account')}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Continue
        </a>
      </div>
    )
  }

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
            {supportPriceRow()}
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
