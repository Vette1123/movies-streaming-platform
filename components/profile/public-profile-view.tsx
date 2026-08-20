'use client'

import Link from 'next/link'
import { Film, ListVideo, Star, Tv } from 'lucide-react'

import type { PublicProfile } from '@/lib/profile/routes'
import { getThumbPosterURL } from '@/lib/utils'
import { PosterTile } from '@/components/media/poster-tile'
import { StrangerPitch } from '@/components/support/stranger-pitch'
import { SupporterBadge } from '@/components/support/supporter-badge'

import { ReferralCookie } from './referral-cookie'

/**
 * Somebody's profile, as a stranger sees it.
 *
 * The Worker renders the title, description, OG tags and ProfilePage JSON-LD
 * server-side (see `handleProfilePage`) and hands this shell the drawing, so an
 * unfurl and a crawler get the real thing. Both halves read the same rows
 * through `loadPublicProfile`.
 *
 * Nothing here is an ordinary account's data: a handle is claimed by supporters
 * and the page only answers while support is live, so a visitor is always
 * looking at what supporting the site buys.
 */
export function PublicProfileView({ profile }: { profile: PublicProfile }) {
  const who = profile.name || profile.handle
  const joined = new Date(profile.since).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="container max-w-5xl py-20 lg:py-28">
      <ReferralCookie handle={profile.handle} />
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <Avatar picture={profile.picture} who={who} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
              {who}
            </h1>
            <SupporterBadge />
          </div>
          <p className="text-muted-foreground text-sm">
            @{profile.handle} · keeping score since {joined}
          </p>
          {profile.bio && (
            <p className="max-w-[60ch] leading-relaxed">{profile.bio}</p>
          )}
        </div>
      </header>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure
          icon={<Film className="size-4" />}
          value={profile.counts.finished}
          label="films finished"
        />
        <Figure
          icon={<Tv className="size-4" />}
          value={profile.counts.episodes}
          label="episodes ticked off"
        />
        <Figure
          icon={<Star className="size-4" />}
          value={profile.counts.reviews}
          label="titles rated"
        />
        <Figure
          icon={<ListVideo className="size-4" />}
          value={profile.counts.lists}
          label={profile.counts.lists === 1 ? 'public list' : 'public lists'}
        />
      </div>

      {profile.topRated.length > 0 && (
        <section className="mt-14">
          <SectionHeading>Rated highest</SectionHeading>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
            {profile.topRated.map((item) => (
              <li key={`${item.type}:${item.id}`}>
                <PosterTile
                  item={item}
                  // One column of a 2/4/6-up grid inside a 64rem container.
                  sizes="(min-width: 1024px) 9.5rem, (min-width: 640px) 22vw, 45vw"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.lists.length > 0 && (
        <section className="mt-14">
          <SectionHeading>Lists</SectionHeading>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {profile.lists.map((list) => (
              <li key={list.slug}>
                <Link
                  href={`/l/${list.slug}`}
                  className="group hover:bg-card/60 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition duration-200 hover:-translate-y-0.5 hover:border-white/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  {list.poster_path ? (
                    // A plain img: one 48px-wide thumbnail per list, on a
                    // page that already carries a grid of optimised posters.
                    // getThumbPosterURL is w300, which covers 48 CSS px at
                    // dpr 3 without a hand-written srcset.
                    <img
                      src={getThumbPosterURL(list.poster_path)}
                      alt=""
                      width={46}
                      height={69}
                      loading="lazy"
                      decoding="async"
                      className="aspect-2/3 w-12 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="bg-muted aspect-2/3 w-12 shrink-0 rounded" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{list.name}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {list.description ||
                        `${list.count} ${list.count === 1 ? 'title' : 'titles'}`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <StrangerPitch
        surface="public_profile"
        heading={`${who} keeps their films on Reely, and Reely is free`}
        cta="Make your own page"
      />
    </div>
  )
}

function Avatar({ picture, who }: { picture: string | null; who: string }) {
  if (picture) {
    return (
      <img
        src={picture}
        alt=""
        width={96}
        height={96}
        referrerPolicy="no-referrer"
        className="size-24 shrink-0 rounded-full object-cover ring-1 ring-white/15"
      />
    )
  }
  return (
    <div className="bg-primary-fill/15 text-primary ring-primary/20 grid size-24 shrink-0 place-items-center rounded-full text-3xl font-semibold ring-1">
      {who.slice(0, 1).toUpperCase()}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
      {children}
    </h2>
  )
}

function Figure({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: number
  label: string
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
      </p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{label}</p>
    </div>
  )
}
