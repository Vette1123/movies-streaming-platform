'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { GitCompare, SearchX, Share2 } from 'lucide-react'

import { ApiError, getJson } from '@/lib/api-client'
import {
  handleFromInput,
  matchBlurb,
  matchTopRated,
  type TasteMatch,
} from '@/lib/profile/match'
import type { ProfileTitle, PublicProfile } from '@/lib/profile/routes'
import { cn } from '@/lib/utils'
import { useShare } from '@/hooks/use-share'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountAvatar } from '@/components/account/account-identity'
import { PosterTile } from '@/components/media/poster-tile'

/**
 * Two public profiles, side by side.
 *
 * Reads `?a=` and `?b=` from the URL after mount (same pattern as /mood: a
 * `useSearchParams` read would bail this route to CSR under `output: 'export'`)
 * and writes them back on submit so a result is a link you can send. Each
 * profile is one `/api/profile/<handle>` GET — the payload the profile shell
 * already draws — and the overlap is pure (`lib/profile/match`).
 */

const loadProfile = async (handle: string): Promise<PublicProfile | null> => {
  try {
    const body = await getJson<{
      success?: boolean
      profile?: PublicProfile
    }>(`/api/profile/${encodeURIComponent(handle)}`)
    return body?.success && body.profile ? body.profile : null
  } catch (error) {
    // Only a 404 means "no public profile". A rate-limit, a 5xx or being
    // offline is a failed load, and reporting it as a wrong handle sent people
    // off to fix a name that was fine.
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Both handles, validated the same way whether typed or read off the URL. */
const checkPair = (
  rawA: string,
  rawB: string
): { pair: { a: string; b: string } } | { error: string } => {
  if (!rawA.trim() || !rawB.trim())
    return { error: 'Two handles, both filled in.' }
  const a = handleFromInput(rawA)
  const b = handleFromInput(rawB)
  if (!a || !b) {
    return { error: `@${(a ? rawB : rawA).trim()} is not a Reely handle.` }
  }
  if (a === b) return { error: 'Pick two different people.' }
  return { pair: { a, b } }
}

const missingLabel = (result: CompareResult): string => {
  if (!result.a && !result.b) return `@${result.handleA} and @${result.handleB}`
  return `@${result.a ? result.handleB : result.handleA}`
}

interface CompareResult {
  handleA: string
  handleB: string
  a: PublicProfile | null
  b: PublicProfile | null
  match: TasteMatch | null
}

const display = (profile: PublicProfile): string =>
  profile.name || profile.handle

export function CompareView() {
  const [a, setA] = React.useState('')
  const [b, setB] = React.useState('')
  // What we actually fetch — set on submit (and from the URL on mount), so
  // typing in a field never re-fires a request.
  const [pair, setPair] = React.useState<{ a: string; b: string } | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const secondField = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromA = params.get('a')
    const fromB = params.get('b')
    // After mount on purpose: the prerendered HTML knows no query string.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (fromA) setA(fromA)
    if (fromB) setB(fromB)
    // Arriving from a profile's button brings `a` only: the next thing to
    // type is the other person.
    if (fromA && !fromB) secondField.current?.focus()
    if (fromA && fromB) {
      // The same checks as a submit — a hand-edited `?a=gado&b=GADO` must not
      // compare somebody with themselves and call it 100%.
      const checked = checkPair(fromA, fromB)
      if ('pair' in checked) setPair(checked.pair)
      else setFormError(checked.error)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const { data, isPending, isError } = useQuery<CompareResult>({
    queryKey: ['taste-compare', pair?.a, pair?.b],
    enabled: Boolean(pair),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const handleA = pair!.a
      const handleB = pair!.b
      const [left, right] = await Promise.all([
        loadProfile(handleA),
        loadProfile(handleB),
      ])
      return {
        handleA,
        handleB,
        a: left,
        b: right,
        match:
          left && right ? matchTopRated(left.topRated, right.topRated) : null,
      }
    },
  })

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const checked = checkPair(a, b)
    if ('error' in checked) {
      setFormError(checked.error)
      return
    }
    const { a: left, b: right } = checked.pair

    setFormError(null)
    setA(left)
    setB(right)
    setPair(checked.pair)
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?a=${encodeURIComponent(left)}&b=${encodeURIComponent(right)}`
    )
  }

  return (
    <div className="space-y-10">
      <form onSubmit={onSubmit} className="max-w-xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <HandleField
            id="compare-a"
            name="a"
            label="First handle"
            placeholder="gado"
            value={a}
            onChange={setA}
            invalid={Boolean(formError)}
          />
          <HandleField
            ref={secondField}
            id="compare-b"
            name="b"
            label="Second handle"
            placeholder="mohamed"
            value={b}
            onChange={setB}
            invalid={Boolean(formError)}
          />
        </div>
        <p id="compare-hint" className="text-sm text-muted-foreground">
          {formError ? (
            <span role="alert" className="text-destructive">
              {formError}
            </span>
          ) : (
            'The name after reely.space/u/. Both profiles must be public.'
          )}
        </p>
        <Button type="submit" className="gap-2">
          <GitCompare className="size-4" aria-hidden />
          Compare taste
        </Button>
      </form>

      {/* Announced: the score lands well after the button press. */}
      <div aria-live="polite">
        {pair && isPending && <CompareSkeleton />}

        {pair && !isPending && isError && (
          <p className="text-sm text-muted-foreground">
            Could not load that pair. Try again in a moment.
          </p>
        )}

        {pair && !isPending && !isError && data && (
          <CompareResultView result={data} />
        )}
      </div>

      {!pair && (
        <EmptyState
          icon={GitCompare}
          title="Put two handles side by side"
          description="Open somebody's profile and use Compare taste, or type both names above. Each side has to be a public Reely profile."
        />
      )}
    </div>
  )
}

interface HandleFieldProps {
  id: string
  name: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  invalid: boolean
}

/**
 * A handle input with the `@` drawn in front. It is decoration: typing or
 * pasting your own `@` (or a whole /u/ link) is still fine, `handleFromInput`
 * strips both.
 */
const HandleField = React.forwardRef<HTMLInputElement, HandleFieldProps>(
  function HandleField(
    { id, name, label, placeholder, value, onChange, invalid },
    ref
  ) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-muted-foreground"
          >
            @
          </span>
          <Input
            ref={ref}
            id={id}
            name={name}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={placeholder}
            aria-describedby="compare-hint"
            aria-invalid={invalid || undefined}
            className="pl-7"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>
    )
  }
)

function CompareResultView({ result }: { result: CompareResult }) {
  const { a, b, match } = result
  const { share } = useShare()

  if (!a || !b || !match) {
    const both = !a && !b
    return (
      <EmptyState
        icon={SearchX}
        title="No public profile there"
        description={`${missingLabel(result)} ${both ? 'have' : 'has'} no public page. The handle is wrong, or the profile is private or unpublished.`}
      />
    )
  }

  const whoA = display(a)
  const whoB = display(b)
  const nothingRated =
    match.shared.length === 0 &&
    match.onlyA.length === 0 &&
    match.onlyB.length === 0

  // The score is the answer, so it is the headline: it used to be a chip beside
  // the names, the same weight as a genre tag.
  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex shrink-0 items-center -space-x-3">
          <PersonAvatar profile={a} />
          <PersonAvatar profile={b} />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <h2 className="flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tight text-primary tabular-nums">
              {match.score}%
            </span>{' '}
            <span className="text-lg font-semibold">in common</span>
          </h2>
          <div
            aria-hidden
            className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-primary-fill transition-[width] duration-700 ease-out"
              style={{ width: `${match.score}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            <ProfileLink profile={a} /> and <ProfileLink profile={b} />.{' '}
            {matchBlurb(match)}
          </p>
          {/* A result is a link (the handles ride the query string), and
              sending it is the point of the page: sheet on a phone, clipboard
              on desktop. The canonical handles, not whatever was typed. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              void share({
                title: `Taste match: ${whoA} and ${whoB}`,
                path: `/compare?a=${encodeURIComponent(result.handleA)}&b=${encodeURIComponent(result.handleB)}`,
                text: `${whoA} and ${whoB} are ${match.score}% in common on Reely`,
              })
            }
          >
            <Share2 className="size-4" aria-hidden />
            Share result
          </Button>
        </div>
      </header>

      {match.shared.length > 0 && (
        <Section title="In both shelves" count={match.shared.length}>
          <TitleGrid titles={match.shared} />
        </Section>
      )}

      {/* Side by side from md: the two "only" lists are a comparison, and
          stacked they read as two more rows of the same shelf. */}
      {(match.onlyA.length > 0 || match.onlyB.length > 0) && (
        <div className="grid gap-12 md:grid-cols-2 md:gap-8">
          {match.onlyA.length > 0 && (
            <Section title={`Only ${whoA}`} count={match.onlyA.length}>
              <TitleGrid titles={match.onlyA} half />
            </Section>
          )}
          {match.onlyB.length > 0 && (
            <Section title={`Only ${whoB}`} count={match.onlyB.length}>
              <TitleGrid titles={match.onlyB} half />
            </Section>
          )}
        </div>
      )}

      {nothingRated && (
        <p className="text-sm text-muted-foreground">
          Neither profile has rated anything highest yet, so there is nothing to
          line up.
        </p>
      )}
    </div>
  )
}

/** Picture or monogram, ringed in the page colour so the overlap reads. */
function PersonAvatar({ profile }: { profile: PublicProfile }) {
  return (
    <span className="rounded-full ring-4 ring-background">
      <AccountAvatar
        name={display(profile)}
        email={null}
        picture={profile.picture}
        size="xl"
      />
    </span>
  )
}

function ProfileLink({ profile }: { profile: PublicProfile }) {
  return (
    <Link
      href={`/u/${profile.handle}`}
      className="font-medium text-foreground underline-offset-4 hover:underline"
    >
      {display(profile)}
    </Link>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="flex items-baseline gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        {title}{' '}
        <span className="font-normal tracking-normal tabular-nums">
          {count}
        </span>
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Full width, or one column of the side-by-side pair (`half`). */
function TitleGrid({
  titles,
  half = false,
}: {
  titles: ProfileTitle[]
  half?: boolean
}) {
  const columns = half
    ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-3'
    : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6'
  return (
    <ul className={cn('grid gap-x-4 gap-y-8', columns)}>
      {titles.map((item) => (
        <li key={`${item.type}:${item.id}`}>
          <PosterTile
            item={item}
            sizes="(min-width: 1024px) 9.5rem, (min-width: 640px) 22vw, 45vw"
          />
        </li>
      ))}
    </ul>
  )
}

/** Holds the shape of the score header and one poster row while profiles load. */
function CompareSkeleton() {
  return (
    <div aria-hidden className="space-y-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex -space-x-3">
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="size-14 rounded-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-12 w-52" />
          <Skeleton className="h-1.5 w-72 rounded-full" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton
            key={i}
            className="aspect-2/3 w-full rounded-lg"
            style={{ animationDelay: `${i * 70}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
