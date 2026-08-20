import React from 'react'

import { apiConfig } from '@/lib/tmdbConfig'
import { listSentence } from '@/lib/utils'
import type { TitleAvailability } from '@/lib/watch-availability'
import { SEO_REGION_LABEL } from '@/lib/watch-availability'

/**
 * "Where to watch", rendered on the server.
 *
 * The site has always known this — the filter sidebar filters by provider — but
 * it knew it in a client component that fetches on mount, which means no
 * crawler has ever seen a word of it. "is <title> on netflix" is one of the
 * highest-volume queries in this category and this page could not answer it.
 *
 * Everything here comes from the block appended to the detail fetch the page
 * already makes (lib/tmdb-append.ts), so it costs zero extra TMDB requests,
 * zero client JavaScript and zero Worker CPU: the block is fetched only where
 * React renders, which in production is only ever the build.
 *
 * One region, named out loud. A prerendered page is one document served to the
 * whole world, so a bare "streaming on Netflix" would be wrong for most of it.
 */

const LOGO_PX = 32

const ProviderChip = ({
  name,
  logoPath,
}: {
  name: string
  logoPath: string | null
}) => (
  <li className="border-border/70 bg-card/40 flex items-center gap-2 rounded-full border py-1 pr-3 pl-1">
    {logoPath ? (
      // A plain <img>: these are 32px square logos on a static page, so
      // next/image's loader would buy nothing and cost a wrapper. The 2x source
      // is written by hand for the same reason (see lib/utils.ts).
      <img
        src={apiConfig.logoImage(logoPath, LOGO_PX)}
        srcSet={`${apiConfig.logoImage(logoPath, LOGO_PX)} 1x, ${apiConfig.logoImage(logoPath, LOGO_PX * 2)} 2x`}
        alt=""
        width={LOGO_PX}
        height={LOGO_PX}
        loading="lazy"
        decoding="async"
        className="size-8 rounded-full object-cover"
      />
    ) : (
      <span className="bg-muted size-8 rounded-full" aria-hidden />
    )}
    <span className="text-sm font-medium">{name}</span>
  </li>
)

const Group = ({
  label,
  providers,
}: {
  label: string
  providers: TitleAvailability['subscription']
}) => {
  if (!providers.length) return null
  return (
    <div className="space-y-2">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {label}
      </h3>
      <ul className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <ProviderChip
            key={provider.id}
            name={provider.name}
            logoPath={provider.logoPath}
          />
        ))}
      </ul>
    </div>
  )
}

/**
 * The sentence is the point.
 *
 * Logos are what a person scans; a plain line of prose naming the services is
 * what actually answers the query, and it is the part a snippet can quote.
 */
const availabilitySentence = (
  title: string,
  availability: TitleAvailability
): string => {
  const subscription = availability.subscription.map((item) => item.name)
  const free = availability.free.map((item) => item.name)
  const clauses: string[] = []
  if (subscription.length) {
    clauses.push(`streaming on ${listSentence(subscription)}`)
  }
  if (free.length) {
    clauses.push(`free to watch on ${listSentence(free)}`)
  }
  return `${title} is ${clauses.join(', and ')} in ${SEO_REGION_LABEL}.`
}

export function WhereToWatch({
  title,
  availability,
}: {
  title: string
  availability?: TitleAvailability
}) {
  if (!availability) return null

  return (
    <section
      aria-labelledby="where-to-watch"
      className="container scroll-mt-24 pt-8"
      id="where-to-watch-section"
    >
      <div className="border-border/70 bg-card/30 space-y-4 rounded-2xl border p-5 sm:p-6">
        <div className="space-y-1">
          <h2 id="where-to-watch" className="text-lg font-semibold">
            Where to watch {title}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {availabilitySentence(title, availability)}
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
          <Group label="Subscription" providers={availability.subscription} />
          <Group label="Free" providers={availability.free} />
        </div>
        <p className="text-muted-foreground/80 text-xs">
          Availability data from JustWatch, for {SEO_REGION_LABEL}. It changes
          often, and can differ where you are.
        </p>
      </div>
    </section>
  )
}
