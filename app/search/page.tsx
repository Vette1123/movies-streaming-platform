import React, { Suspense } from 'react'
import { Metadata } from 'next'

import { Search } from 'lucide-react'
import { searchMovieAction } from '@/actions/search'
import { SearchInput } from '@/components/search/search-input'
import { SearchResults } from '@/components/search/search-results'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata(
  props: SearchPageProps
): Promise<Metadata> {
  const { q } = await props.searchParams
  return {
    title: q ? `Search: ${q}` : 'Search',
    description: q
      ? `Search results for "${q}"`
      : 'Search for movies and TV shows',
  }
}

export default async function SearchPage(props: SearchPageProps) {
  const { q } = await props.searchParams
  const query = q?.trim() || ''

  const data = query ? await searchMovieAction({ query }) : null
  const results = (data?.results ?? []).filter((item) => item.poster_path)

  return (
    <main className="container max-w-(--breakpoint-2xl) py-24 lg:py-32">
      <div className="mb-8 flex flex-col gap-4">
        <h1 className="text-2xl font-bold lg:text-3xl">
          {query ? (
            <>
              Results for{' '}
              <span className="text-white/60">&ldquo;{query}&rdquo;</span>
            </>
          ) : (
            'Search'
          )}
        </h1>
        <Suspense>
          <SearchInput />
        </Suspense>
      </div>

      {query && results.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
          <p className="text-lg text-muted-foreground">No results found</p>
          <p className="text-sm text-muted-foreground/60">
            Try a different search term
          </p>
        </div>
      )}

      <SearchResults results={results} />

      {!query && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Search className="size-7 text-white/30" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-medium text-white/60">
              Find your next watch
            </p>
            <p className="text-sm text-muted-foreground/60">
              Search across thousands of movies and TV shows
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
