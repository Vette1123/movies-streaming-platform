'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles, UserRound } from 'lucide-react'

import { getJson } from '@/lib/api-client'
import type { Directory, DirectoryList } from '@/lib/community/routes'
import { supporterLine } from '@/lib/community/routes'
import { getThumbPosterURL } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import { buttonVariants } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'

/**
 * Everything other people have made public, and one way in.
 *
 * Client-fetched because the page is a static asset and the rows are written by
 * people after the build. The Worker injects a crawlable copy of the same links
 * into the shell (see handleListsDirectory), so this render is for humans and
 * the injected block is for crawlers — neither is a fallback for the other.
 */
export function CommunityDirectory() {
  const { data, isError } = useQuery<Directory>({
    queryKey: ['community'],
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const body = await getJson<Directory & { success?: boolean }>(
        '/api/community'
      )
      if (!body?.success) throw new Error('directory missing')
      return body
    },
  })

  if (isError) {
    return (
      <p className="text-muted-foreground max-w-[60ch] leading-relaxed">
        The directory could not be loaded. Everything else on Reely works
        without it — try again in a moment.
      </p>
    )
  }

  if (!data) return <DirectorySkeleton />

  const empty = data.lists.length === 0 && data.people.length === 0

  return (
    <div className="space-y-16">
      {empty ? <NothingYet /> : null}

      {data.lists.length > 0 && (
        <section className="space-y-6">
          <SectionHead
            title="Lists people published"
            note="Made by hand, out of their own libraries. Open one and take whatever you like."
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.lists.map((list) => (
              <li key={list.slug}>
                <ListCard list={list} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.people.length > 0 && (
        <section className="space-y-6">
          <SectionHead
            title="People worth following"
            note="Public pages: what they have finished, what they rated highest, what they publish."
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.people.map((person) => (
              <li key={person.handle}>
                <Link
                  href={`/u/${person.handle}`}
                  className="hover:border-primary/50 hover:bg-muted/40 flex h-full items-start gap-4 rounded-lg border p-4 transition-colors"
                >
                  <Avatar picture={person.picture} name={person.name} />
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">
                      {person.name || person.handle}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      @{person.handle}
                      {person.lists > 0
                        ? ` · ${person.lists} ${person.lists === 1 ? 'list' : 'lists'}`
                        : ''}
                    </p>
                    {person.bio && (
                      <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                        {person.bio}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <JoinIn supporters={data.supporters} />
    </div>
  )
}

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground max-w-[70ch] text-sm leading-relaxed">
        {note}
      </p>
    </div>
  )
}

/**
 * One list, as a strip of its own posters.
 *
 * The posters are the card. A row of titles somebody chose says what the list
 * is faster than its name does, and it is the only part of this page that is
 * actually about films.
 */
function ListCard({ list }: { list: DirectoryList }) {
  return (
    <Link
      href={`/l/${list.slug}`}
      className="hover:border-primary/50 group block h-full space-y-3 rounded-lg border p-4 transition-colors"
    >
      {/* A fixed-height strip so a one-poster card and a five-poster card are
          the same shape — a directory of different-sized boxes reads as broken
          rather than as variety. */}
      <div className="flex h-28 gap-1.5">
        {list.posters.length > 0 ? (
          list.posters.map((path, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${path}-${index}`}
              src={getThumbPosterURL(path)}
              alt=""
              loading="lazy"
              decoding="async"
              width={300}
              height={450}
              className="h-full w-auto rounded object-cover shadow-md"
            />
          ))
        ) : (
          <div className="bg-muted/40 flex h-full w-full items-center justify-center rounded text-xs">
            <Sparkles className="text-muted-foreground size-5" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="group-hover:text-primary font-medium transition-colors">
          {list.name}
        </p>
        <p className="text-muted-foreground text-xs">{countLine(list)}</p>
        {list.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
            {list.description}
          </p>
        )}
      </div>
    </Link>
  )
}

/** A smart list has no fixed length, so it must not claim one. */
function countLine(list: DirectoryList): string {
  const who = list.owner ? ` · by ${list.owner}` : ''
  if (list.smart) return `Updates itself${who}`
  return `${list.count} ${list.count === 1 ? 'title' : 'titles'}${who}`
}

function Avatar({
  picture,
  name,
}: {
  picture: string | null
  name: string | null
}) {
  if (picture) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={picture}
        alt=""
        loading="lazy"
        width={48}
        height={48}
        className="size-12 shrink-0 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <span className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-full">
      <UserRound className="text-muted-foreground size-5" />
    </span>
  )
}

/**
 * The end of the page, which is the point of the page.
 *
 * What it says depends on how far somebody already is: a stranger is asked to
 * sign in, somebody signed in is told what publishing costs, and a supporter is
 * pointed straight at the panel that does it.
 */
function JoinIn({ supporters }: { supporters: number }) {
  const { signedIn, pro } = useAccount()

  return (
    <section className="border-primary/25 from-primary/10 rounded-lg border bg-gradient-to-br to-transparent p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-[56ch] space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">
            {pro ? 'Your shelf belongs here too' : 'Put your own shelf up'}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Everything on this page was made by somebody keeping their library
            on Reely. Signing in is free and moves your watchlist and history
            off this one browser; publishing a list or a public page is what
            support unlocks. {supporterLine(supporters)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link href="/account" className={buttonVariants()}>
            {signedIn ? 'Open your account' : 'Sign in with Google'}
            <ArrowRight className="ml-2 size-4" />
          </Link>
          {!pro && (
            <Link
              href="/support"
              className={buttonVariants({ variant: 'outline' })}
            >
              What support unlocks
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

function NothingYet() {
  return (
    <div className="max-w-[60ch] space-y-3">
      <Chip variant="outline">Early days</Chip>
      <p className="text-muted-foreground leading-relaxed">
        Nobody has published anything yet. Whoever goes first gets a page with
        their name on it and no competition for attention.
      </p>
    </div>
  )
}

function DirectorySkeleton() {
  return (
    <div aria-hidden className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-lg border p-4">
          <div className="flex h-28 gap-1.5">
            {Array.from({ length: 5 }).map((_, poster) => (
              <div
                key={poster}
                className="bg-muted/40 h-full w-[4.7rem] animate-pulse rounded"
              />
            ))}
          </div>
          <div className="bg-muted/40 h-4 w-2/3 animate-pulse rounded" />
          <div className="bg-muted/40 h-3 w-1/3 animate-pulse rounded" />
        </div>
      ))}
    </div>
  )
}
