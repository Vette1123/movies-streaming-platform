import { Metadata } from 'next'

import {
  genreMetadata,
  GenrePage,
  genreStaticParams,
  TV_GENRE_PAGE_CONFIG,
} from '@/components/media/genre-page'

// Static: the genre set is finite and fixed, so all slugs are prebuilt below and
// served from static assets — never rendered on the Worker (no free-plan
// subrequest/CPU caps). revalidate=false → refreshed by the 2x/day CI deploy.
// dynamicParams MUST stay true: under OpenNext/Cloudflare, dynamicParams=false
// 404s even the prebuilt SSG pages. discoverSeriesAction fetches with
// revalidate:false (actions/filter.ts), which is what makes the route build-only —
// revalidate=false alone would be floored to 8h by the fetch's own revalidate.
export const revalidate = false
export const dynamicParams = true

interface GenrePageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return genreStaticParams(TV_GENRE_PAGE_CONFIG)
}

export async function generateMetadata({
  params,
}: GenrePageProps): Promise<Metadata> {
  const { slug } = await params
  return genreMetadata(TV_GENRE_PAGE_CONFIG, slug)
}

export default async function TvGenrePage({ params }: GenrePageProps) {
  const { slug } = await params
  return <GenrePage config={TV_GENRE_PAGE_CONFIG} slug={slug} />
}
