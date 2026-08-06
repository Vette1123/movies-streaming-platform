import { Metadata } from 'next'

import {
  genreMetadata,
  GenrePage,
  genreStaticParams,
  MOVIE_GENRE_PAGE_CONFIG,
} from '@/components/media/genre-page'

// Static: the genre set is finite and fixed, so all slugs are prebuilt below and
// served from static assets — never rendered on the Worker (no free-plan
// subrequest/CPU caps). revalidate=false → refreshed by the 4x/day CI deploy.
// dynamicParams=false is required by `output: 'export'`, and is finally safe
// here: the old OpenNext bug where false 404'd even prebuilt SSG pages died with
// OpenNext itself. The genre set is closed and every slug is prebuilt below, so
// nothing legitimate is lost — an unknown slug is now a static 404 instead of an
// on-demand render, which is strictly cheaper.
// discoverMovies fetches with revalidate:false (services/discover.ts), which is
// what makes the route build-only — revalidate=false alone would be floored to 8h
// by the fetch's own revalidate.
export const revalidate = false
export const dynamicParams = false

interface GenrePageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return genreStaticParams(MOVIE_GENRE_PAGE_CONFIG)
}

export async function generateMetadata({
  params,
}: GenrePageProps): Promise<Metadata> {
  const { slug } = await params
  return genreMetadata(MOVIE_GENRE_PAGE_CONFIG, slug)
}

export default async function MovieGenrePage({ params }: GenrePageProps) {
  const { slug } = await params
  return <GenrePage config={MOVIE_GENRE_PAGE_CONFIG} slug={slug} />
}
