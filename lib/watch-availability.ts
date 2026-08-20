import type { TmdbWatchProviders } from '@/lib/push/providers'

/**
 * "Where to watch" for one title, in one region — the crawlable half.
 *
 * The site already knew this: `lib/push/providers.ts` reads the same TMDB block
 * to decide when to tell a supporter a title has landed somewhere. That module
 * answers "what changed since last hour" for a set of alert regions; this one
 * answers "what can a person watch it on right now", with the logos a page
 * needs. Same payload, two different questions, so the types are shared and
 * the logic is not.
 *
 * Why it matters for SEO: "is <title> on netflix" is one of the highest-volume
 * query shapes in this whole category, and until now the answer lived in a
 * client-only component that no crawler ever executed.
 *
 * Only ONE region is rendered. A prerendered page is a single document served
 * to the whole world, so it cannot be honest about all of them at once — it
 * names the region it is talking about instead, and the interactive picker
 * stays client-side.
 */

/** The region the prerendered sentence is about. */
export const SEO_REGION = 'US'
export const SEO_REGION_LABEL = 'the United States'

export interface AvailabilityProvider {
  id: number
  name: string
  logoPath: string | null
}

export interface TitleAvailability {
  region: string
  /** Included with a subscription somebody already pays for. */
  subscription: AvailabilityProvider[]
  /** Free, usually with ads. Worth naming: it is the best answer there is. */
  free: AvailabilityProvider[]
}

/** As many as a sentence can name before it stops reading like one. */
const MAX_PER_KIND = 6

interface RawProvider {
  provider_id?: number
  provider_name?: string
  logo_path?: string | null
}

/**
 * TMDB lists reseller add-ons beside the service itself — "HBO Max Amazon
 * Channel" next to "HBO Max". Both are the same subscription bought two ways,
 * and naming both makes the sentence read like a bug ("streaming on HBO Max
 * Amazon Channel and HBO Max"). The direct service is the answer.
 */
const isResellerChannel = (name: string) => / Channel$/.test(name)

const clean = (list: RawProvider[] | null | undefined) => {
  const out: AvailabilityProvider[] = []
  const seen = new Set<number>()
  for (const item of list ?? []) {
    const id = item.provider_id
    const name = item.provider_name?.trim()
    if (typeof id !== 'number' || !name || seen.has(id)) continue
    if (isResellerChannel(name)) continue
    seen.add(id)
    out.push({ id, name, logoPath: item.logo_path ?? null })
    if (out.length >= MAX_PER_KIND) break
  }
  return out
}

/**
 * Subscription and free only.
 *
 * Rent and buy are dropped for the same reason the alert drops them: a film has
 * been rentable on five stores since release, so listing them would make every
 * title permanently "available" and the section would say nothing.
 */
export function titleAvailability(
  payload: TmdbWatchProviders | null | undefined,
  region: string = SEO_REGION
): TitleAvailability | null {
  const entry = payload?.results?.[region] as
    | {
        flatrate?: RawProvider[] | null
        free?: RawProvider[] | null
        ads?: RawProvider[] | null
      }
    | undefined
  if (!entry) return null

  const subscription = clean(entry.flatrate)
  // TMDB splits genuinely-free from free-with-ads; a person reading the page
  // does not care about the difference, and both mean "press play, pay nothing".
  const free = clean([...(entry.free ?? []), ...(entry.ads ?? [])])
  if (!subscription.length && !free.length) return null

  return { region, subscription, free }
}
