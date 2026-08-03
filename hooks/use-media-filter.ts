'use client'

import { useCallback, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs'

import { FilterParams, MediaFilter, SortOption } from '@/types/filter'
import { MediaResponse } from '@/types/media'
import {
  trackFilterChanged,
  trackFiltersCleared,
  trackLoadMore,
} from '@/lib/analytics'
import { discoverApi } from '@/lib/api-client'
import {
  CERTIFICATION_COUNTRY,
  DEFAULT_WATCH_REGION,
} from '@/lib/filter-options'
import { QUERY_KEYS } from '@/lib/queryKeys'

interface UseMediaFilterProps {
  mediaType: 'movie' | 'tv'
  initialData?: MediaResponse
}

// Default values for filters. NOTE: accordion open/closed state used to live here
// (and in the URL) — it's now local component state in the sidebar, so a shared
// filter URL carries only real filters, not UI chrome.
const defaultValues = {
  selectedGenres: [] as number[],
  excludedGenres: [] as number[],
  sortBy: 'popularity.desc' as SortOption,
  minRating: 0,
  maxRating: 10,
  minVotes: 0,
  fromDate: '',
  toDate: '',
  minRuntime: 0,
  maxRuntime: 300,
  originalLanguage: '',
  certification: '',
  watchProviders: [] as number[],
  watchRegion: DEFAULT_WATCH_REGION,
}

// URL state parsers
const filterParsers = {
  selectedGenres: parseAsArrayOf(parseAsInteger).withDefault(
    defaultValues.selectedGenres
  ),
  excludedGenres: parseAsArrayOf(parseAsInteger).withDefault(
    defaultValues.excludedGenres
  ),
  sortBy: parseAsString.withDefault(defaultValues.sortBy),
  minRating: parseAsFloat.withDefault(defaultValues.minRating),
  maxRating: parseAsFloat.withDefault(defaultValues.maxRating),
  minVotes: parseAsInteger.withDefault(defaultValues.minVotes),
  fromDate: parseAsString.withDefault(defaultValues.fromDate),
  toDate: parseAsString.withDefault(defaultValues.toDate),
  minRuntime: parseAsInteger.withDefault(defaultValues.minRuntime),
  maxRuntime: parseAsInteger.withDefault(defaultValues.maxRuntime),
  originalLanguage: parseAsString.withDefault(defaultValues.originalLanguage),
  certification: parseAsString.withDefault(defaultValues.certification),
  watchProviders: parseAsArrayOf(parseAsInteger).withDefault(
    defaultValues.watchProviders
  ),
  watchRegion: parseAsString.withDefault(defaultValues.watchRegion),
}

export const useMediaFilter = ({
  mediaType,
  initialData,
}: UseMediaFilterProps) => {
  const [urlState, setUrlState] = useQueryStates(filterParsers, {
    shallow: false, // Deep navigation to persist state
    clearOnDefault: true, // Remove from URL when set to default
  })

  // Convert URL state to MediaFilter format
  const filter: MediaFilter = useMemo(
    () => ({
      selectedGenres: urlState.selectedGenres,
      excludedGenres: urlState.excludedGenres,
      sortBy: urlState.sortBy as SortOption,
      minRating: urlState.minRating,
      maxRating: urlState.maxRating,
      minVotes: urlState.minVotes,
      fromDate: urlState.fromDate || undefined,
      toDate: urlState.toDate || undefined,
      minRuntime: urlState.minRuntime > 0 ? urlState.minRuntime : undefined,
      maxRuntime: urlState.maxRuntime > 0 ? urlState.maxRuntime : undefined,
      originalLanguage: urlState.originalLanguage || undefined,
      certification: urlState.certification || undefined,
      watchProviders: urlState.watchProviders,
      watchRegion: urlState.watchRegion || DEFAULT_WATCH_REGION,
    }),
    [urlState]
  )

  // Convert MediaFilter to API FilterParams
  const filterParams = useMemo((): FilterParams => {
    const params: FilterParams = {
      sort_by: filter.sortBy,
    }

    // Genre filters
    if (filter.selectedGenres.length > 0) {
      params.with_genres = filter.selectedGenres.join(',')
    }
    if (filter.excludedGenres.length > 0) {
      params.without_genres = filter.excludedGenres.join(',')
    }

    // Date filters (mediaType-aware; the action also remaps as a safety net)
    if (filter.fromDate) {
      if (mediaType === 'movie') {
        params['release_date.gte'] = filter.fromDate
      } else {
        params['first_air_date.gte'] = filter.fromDate
      }
    }
    if (filter.toDate) {
      if (mediaType === 'movie') {
        params['release_date.lte'] = filter.toDate
      } else {
        params['first_air_date.lte'] = filter.toDate
      }
    }

    // Rating filters
    if (filter.minRating && filter.minRating > 0) {
      params['vote_average.gte'] = filter.minRating
    }
    if (filter.maxRating && filter.maxRating < 10) {
      params['vote_average.lte'] = filter.maxRating
    }
    if (filter.minVotes && filter.minVotes > 0) {
      params['vote_count.gte'] = filter.minVotes
    }

    // Runtime filters (movies only)
    if (mediaType === 'movie') {
      if (filter.minRuntime && filter.minRuntime > 0) {
        params.with_runtime_gte = filter.minRuntime
      }
      if (filter.maxRuntime && filter.maxRuntime < 300) {
        params.with_runtime_lte = filter.maxRuntime
      }
    }

    // Language filter
    if (filter.originalLanguage) {
      params.with_original_language = filter.originalLanguage
    }

    // Age rating (movies only — TV discover has no certification param)
    if (mediaType === 'movie' && filter.certification) {
      params.certification = filter.certification
      params.certification_country = CERTIFICATION_COUNTRY
    }

    // Where to watch. `|` = OR (available on ANY picked provider); pairs with
    // watch_region so ids resolve against the right regional catalog.
    if (filter.watchProviders.length > 0) {
      params.with_watch_providers = filter.watchProviders.join('|')
      params.watch_region = filter.watchRegion
    }

    return params
  }, [filter, mediaType])

  // Check if any filters are active (not default values). Region alone is not a
  // filter — it only bites when providers are picked, so it's excluded here.
  const hasActiveFilters = useMemo(() => {
    return (
      urlState.selectedGenres.length > 0 ||
      urlState.excludedGenres.length > 0 ||
      urlState.watchProviders.length > 0 ||
      Boolean(urlState.fromDate) ||
      Boolean(urlState.toDate) ||
      Boolean(urlState.originalLanguage) ||
      Boolean(urlState.certification) ||
      urlState.minRating > 0 ||
      urlState.maxRating < 10 ||
      urlState.minVotes > 0 ||
      urlState.minRuntime > 0 ||
      urlState.maxRuntime < 300 ||
      urlState.sortBy !== 'popularity.desc'
    )
  }, [urlState])

  // Count of distinct active filter groups — drives the numeric badge on the
  // mobile "Filters" trigger. Sort is intentionally NOT counted (it's always set).
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (urlState.selectedGenres.length > 0)
      count += urlState.selectedGenres.length
    if (urlState.excludedGenres.length > 0)
      count += urlState.excludedGenres.length
    if (urlState.watchProviders.length > 0)
      count += urlState.watchProviders.length
    if (urlState.fromDate || urlState.toDate) count += 1
    if (urlState.minRating > 0 || urlState.maxRating < 10) count += 1
    if (urlState.minVotes > 0) count += 1
    if (urlState.minRuntime > 0 || urlState.maxRuntime < 300) count += 1
    if (urlState.originalLanguage) count += 1
    if (urlState.certification) count += 1
    return count
  }, [urlState])

  // React Query for filtered data
  const queryKey =
    mediaType === 'movie' ? QUERY_KEYS.MOVIES_KEY : QUERY_KEYS.SERIES_KEY
  const discoverFunction = (filters: FilterParams, params: { page: number }) =>
    discoverApi(mediaType, filters, params)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: [queryKey, 'filtered', filterParams],
    queryFn: async ({ pageParam = 1 }) => {
      return discoverFunction(filterParams, { page: pageParam })
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage?.total_pages && lastPage.page < lastPage.total_pages) {
        return pages.length + 1
      }
      return undefined
    },
    initialPageParam: 1,
    enabled: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
    // Only use initial data if no filters are active
    ...(hasActiveFilters
      ? {}
      : {
          initialData: {
            pages: [initialData],
            pageParams: [1],
          },
        }),
  })

  // Filter update functions
  const updateFilter = useCallback(
    (updates: Partial<MediaFilter>) => {
      Object.entries(updates).forEach(([key, value]) => {
        trackFilterChanged({ media_type: mediaType, filter_type: key, value })
      })
      const urlUpdates: Partial<typeof urlState> = {}

      if (updates.selectedGenres !== undefined)
        urlUpdates.selectedGenres = updates.selectedGenres
      if (updates.excludedGenres !== undefined)
        urlUpdates.excludedGenres = updates.excludedGenres
      if (updates.sortBy !== undefined) urlUpdates.sortBy = updates.sortBy
      if (updates.minRating !== undefined)
        urlUpdates.minRating = updates.minRating
      if (updates.maxRating !== undefined)
        urlUpdates.maxRating = updates.maxRating
      if (updates.minVotes !== undefined) urlUpdates.minVotes = updates.minVotes
      if (updates.fromDate !== undefined)
        urlUpdates.fromDate = updates.fromDate || ''
      if (updates.toDate !== undefined) urlUpdates.toDate = updates.toDate || ''
      if (updates.minRuntime !== undefined)
        urlUpdates.minRuntime = updates.minRuntime || 0
      if (updates.maxRuntime !== undefined)
        urlUpdates.maxRuntime = updates.maxRuntime || 0
      if (updates.originalLanguage !== undefined)
        urlUpdates.originalLanguage = updates.originalLanguage || ''
      if (updates.certification !== undefined)
        urlUpdates.certification = updates.certification || ''
      if (updates.watchProviders !== undefined)
        urlUpdates.watchProviders = updates.watchProviders
      if (updates.watchRegion !== undefined)
        urlUpdates.watchRegion = updates.watchRegion || DEFAULT_WATCH_REGION

      setUrlState(urlUpdates)
    },
    [setUrlState, mediaType]
  )

  // Tri-state genre cycle in a SINGLE url write (off → include → exclude → off).
  // One write, not two, so include→exclude can't race two nuqs updates. Exposing
  // exclusion this way finally wires the long-plumbed `without_genres`.
  const cycleGenre = useCallback(
    (genreId: number) => {
      const inInclude = urlState.selectedGenres.includes(genreId)
      const inExclude = urlState.excludedGenres.includes(genreId)

      let selected = urlState.selectedGenres.filter((id) => id !== genreId)
      let excluded = urlState.excludedGenres.filter((id) => id !== genreId)

      let nextState: 'include' | 'exclude' | 'off' = 'off'
      if (!inInclude && !inExclude) {
        selected = [...selected, genreId]
        nextState = 'include'
      } else if (inInclude) {
        excluded = [...excluded, genreId]
        nextState = 'exclude'
      }

      trackFilterChanged({
        media_type: mediaType,
        filter_type: 'genre',
        value: { genreId, state: nextState },
      })
      setUrlState({ selectedGenres: selected, excludedGenres: excluded })
    },
    [urlState, setUrlState, mediaType]
  )

  const setSortBy = useCallback(
    (sortBy: SortOption) => {
      updateFilter({ sortBy })
    },
    [updateFilter]
  )

  const clearFilters = useCallback(() => {
    trackFiltersCleared({ media_type: mediaType })
    setUrlState(defaultValues)
  }, [setUrlState, mediaType])

  const trackedFetchNextPage = useCallback(() => {
    trackLoadMore({
      media_type: mediaType,
      page: (data?.pages?.length ?? 0) + 1,
    })
    return fetchNextPage()
  }, [fetchNextPage, data?.pages?.length, mediaType])

  return {
    // Filter state
    filter,
    filterParams,
    hasActiveFilters,
    activeFilterCount,

    // Data
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,

    // Actions
    updateFilter,
    cycleGenre,
    setSortBy,
    clearFilters,
    fetchNextPage: trackedFetchNextPage,
    refetch,
  }
}
