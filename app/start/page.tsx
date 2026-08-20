import { Metadata } from 'next'
import { getPopularMovies } from '@/services/movies'
import { getPopularSeries } from '@/services/series'

import { siteConfig } from '@/config/site'
import type { TastePick } from '@/lib/taste'
import { TastePicker } from '@/components/start/taste-picker'

export const metadata: Metadata = {
  title: 'What should I watch?',
  description: `Pick a few films and shows you like and ${siteConfig.name} works out what to watch next — no account, no sign-up, no waiting.`,
  alternates: { canonical: '/start' },
}

/**
 * The thirty-second version of the whole site.
 *
 * Fully static: the candidates are the popular lists the build already fetches
 * for the browse pages, so this page costs no extra TMDB traffic and ships as
 * plain HTML. Everything after the first tap happens in the browser against
 * `/api/filter`, which is already cached at the edge for everybody else.
 *
 * It exists because the honest pitch for an account is "here is what you get",
 * not "here is what you would get" — somebody who has just been handed twelve
 * things worth watching has a reason to keep them.
 */
export default async function StartPage() {
  const [movies, series] = await Promise.all([
    getPopularMovies(),
    getPopularSeries(),
  ])

  const candidates: TastePick[] = [
    ...(movies.results ?? []).slice(0, 12).map((item) => ({
      id: item.id,
      type: 'movie' as const,
      title: item.title ?? '',
      poster_path: item.poster_path ?? null,
      genre_ids: item.genre_ids ?? [],
    })),
    ...(series.results ?? []).slice(0, 12).map((item) => ({
      id: item.id,
      type: 'series' as const,
      title: item.name ?? '',
      poster_path: item.poster_path ?? null,
      genre_ids: item.genre_ids ?? [],
    })),
  ]

  return (
    <section className="container max-w-6xl min-h-svh py-20 lg:py-28">
      <div className="mb-10 max-w-[62ch] space-y-3">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          What should I watch?
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Tap a few you already like. That is the whole setup — no account, no
          questionnaire, and nothing is sent anywhere. You get a real answer at
          the bottom and can keep it if you want to.
        </p>
      </div>

      <TastePicker candidates={candidates} />
    </section>
  )
}
