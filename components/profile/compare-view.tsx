'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitCompare, SearchX } from 'lucide-react'

import { ApiError, getJson } from '@/lib/api-client'
import {
  handleFromInput,
  matchBlurb,
  matchTopRated,
  type TasteMatch,
} from '@/lib/profile/match'
import type { ProfileTitle, PublicProfile } from '@/lib/profile/routes'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
          <div className="space-y-2">
            <Label htmlFor="compare-a">First handle</Label>
            <Input
              id="compare-a"
              name="a"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="gado"
              value={a}
              onChange={(event) => setA(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="compare-b">Second handle</Label>
            <Input
              ref={secondField}
              id="compare-b"
              name="b"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="mohamed"
              value={b}
              onChange={(event) => setB(event.target.value)}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {formError ? (
            <span role="alert" className="text-destructive">
              {formError}
            </span>
          ) : (
            'The name from reely.space/u/… — both profiles must be public.'
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

function CompareResultView({ result }: { result: CompareResult }) {
  const { a, b, match } = result

  if (!a || !b || !match) {
    const both = !a && !b
    return (
      <EmptyState
        icon={SearchX}
        title="No public profile there"
        description={`${missingLabel(result)} ${both ? 'have' : 'has'} no public page — the handle is wrong, or the profile is private or unpublished.`}
      />
    )
  }

  const whoA = display(a)
  const whoB = display(b)

  return (
    <div className="space-y-12">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">
          {whoA} &amp; {whoB}
        </h2>
        <Chip variant="primary">{match.score}% in common</Chip>
        <p className="w-full text-sm text-muted-foreground sm:w-auto">
          {matchBlurb(match)}
        </p>
      </header>

      {match.shared.length > 0 && (
        <Section title="In both shelves">
          <TitleGrid titles={match.shared} />
        </Section>
      )}

      {match.onlyA.length > 0 && (
        <Section title={`Only ${whoA}`}>
          <TitleGrid titles={match.onlyA} />
        </Section>
      )}

      {match.onlyB.length > 0 && (
        <Section title={`Only ${whoB}`}>
          <TitleGrid titles={match.onlyB} />
        </Section>
      )}

      {match.shared.length === 0 &&
        match.onlyA.length === 0 &&
        match.onlyB.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Neither profile has a title rated highest yet — there is nothing to
            line up.
          </p>
        )}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function TitleGrid({ titles }: { titles: ProfileTitle[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
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
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-6 w-28 rounded-full" />
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
