'use client'

import { useCallback, useMemo } from 'react'
import { discoverMovies, discoverSeries } from '@/services/filter'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs'

import { FilterParams, MediaFilter, SortOption } from '@/types/filter'
import { MediaResponse } from '@/types/media'
import { QUERY_KEYS } from '@/lib/queryKeys'

interface UseMediaFilterProps {
  mediaType: 'movie' | 'tv'
  initialData?: MediaResponse
}

// Default values for filters
const defaultValues = {
  selectedGenres: [],
  excludedGenres: [],
  sortBy: 'popularity.desc' as SortOption,
  includeAdult: false,
  minRating: 0,
  maxRating: 10,
  minVotes: 0,
  fromDate: '',
  toDate: '',
  minRuntime: 0,
  maxRuntime: 300,
  originalLanguage: '',
  isFilterOpen: false,
  // Section states
  sortSection: true,
  genresSection: true,
  ratingSection: false,
  dateSection: false,
  runtimeSection: false,
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
  includeAdult: parseAsBoolean.withDefault(defaultValues.includeAdult),
  minRating: parseAsFloat.withDefault(defaultValues.minRating),
  maxRating: parseAsFloat.withDefault(defaultValues.maxRating),
  minVotes: parseAsInteger.withDefault(defaultValues.minVotes),
  fromDate: parseAsString.withDefault(defaultValues.fromDate),
  toDate: parseAsString.withDefault(defaultValues.toDate),
  minRuntime: parseAsInteger.withDefault(defaultValues.minRuntime),
  maxRuntime: parseAsInteger.withDefault(defaultValues.maxRuntime),
  originalLanguage: parseAsString.withDefault(defaultValues.originalLanguage),
  isFilterOpen: parseAsBoolean.withDefault(defaultValues.isFilterOpen),
  // Section states
  sortSection: parseAsBoolean.withDefault(defaultValues.sortSection),
  genresSection: parseAsBoolean.withDefault(defaultValues.genresSection),
  ratingSection: parseAsBoolean.withDefault(defaultValues.ratingSection),
  dateSection: parseAsBoolean.withDefault(defaultValues.dateSection),
  runtimeSection: parseAsBoolean.withDefault(defaultValues.runtimeSection),
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
      includeAdult: urlState.includeAdult,
      minRating: urlState.minRating,
      maxRating: urlState.maxRating,
      minVotes: urlState.minVotes,
      fromDate: urlState.fromDate || undefined,
      toDate: urlState.toDate || undefined,
      minRuntime: urlState.minRuntime > 0 ? urlState.minRuntime : undefined,
      maxRuntime: urlState.maxRuntime > 0 ? urlState.maxRuntime : undefined,
      originalLanguage: urlState.originalLanguage || undefined,
    }),
    [urlState]
  )

  const isFilterOpen = urlState.isFilterOpen

  // Convert MediaFilter to API FilterParams
  const filterParams = useMemo((): FilterParams => {
    const params: FilterParams = {
      sort_by: filter.sortBy,
      include_adult: filter.includeAdult,
    }

    // Genre filters
    if (filter.selectedGenres.length > 0) {
      params.with_genres = filter.selectedGenres.join(',')
    }
    if (filter.excludedGenres.length > 0) {
      params.without_genres = filter.excludedGenres.join(',')
    }

    // Debug logging can be enabled in the FilterDebug component

    // Date filters
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
    if (filter.maxRating && filter.maxRating <= 10) {
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

    return params
  }, [filter, mediaType])

  // Check if any filters are active (not default values)
  const hasActiveFilters = useMemo(() => {
    return (
      urlState.selectedGenres.length > 0 ||
      urlState.excludedGenres.length > 0 ||
      (urlState.fromDate && urlState.fromDate !== '') ||
      (urlState.toDate && urlState.toDate !== '') ||
      urlState.minRating > 0 ||
      urlState.maxRating < 10 ||
      urlState.minVotes > 0 ||
      urlState.minRuntime > 0 ||
      urlState.maxRuntime < 300 ||
      (urlState.originalLanguage && urlState.originalLanguage !== '') ||
      urlState.sortBy !== 'popularity.desc'
    )
  }, [urlState])

  // React Query for filtered data
  const queryKey =
    mediaType === 'movie' ? QUERY_KEYS.MOVIES_KEY : QUERY_KEYS.SERIES_KEY
  const discoverFunction =
    mediaType === 'movie' ? discoverMovies : discoverSeries

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
      const urlUpdates: Partial<typeof urlState> = {}

      // Map MediaFilter properties to URL state
      if (updates.selectedGenres !== undefined)
        urlUpdates.selectedGenres = updates.selectedGenres
      if (updates.excludedGenres !== undefined)
        urlUpdates.excludedGenres = updates.excludedGenres
      if (updates.sortBy !== undefined) urlUpdates.sortBy = updates.sortBy
      if (updates.includeAdult !== undefined)
        urlUpdates.includeAdult = updates.includeAdult
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

      setUrlState(urlUpdates)
    },
    [setUrlState]
  )

  const toggleGenre = useCallback(
    (genreId: number, exclude = false) => {
      const targetArray = exclude ? 'excludedGenres' : 'selectedGenres'
      const otherArray = exclude ? 'selectedGenres' : 'excludedGenres'

      const currentTargetGenres = urlState[targetArray]
      const currentOtherGenres = urlState[otherArray]

      const newTargetGenres = currentTargetGenres.includes(genreId)
        ? currentTargetGenres.filter((id) => id !== genreId)
        : [...currentTargetGenres, genreId]

      // Remove from the other array if it exists there
      const newOtherGenres = currentOtherGenres.filter((id) => id !== genreId)

      setUrlState({
        [targetArray]: newTargetGenres,
        [otherArray]: newOtherGenres,
      })
    },
    [urlState, setUrlState]
  )

  const setSortBy = useCallback(
    (sortBy: SortOption) => {
      updateFilter({ sortBy })
    },
    [updateFilter]
  )

  const clearFilters = useCallback(() => {
    setUrlState(defaultValues)
  }, [setUrlState])

  const setIsFilterOpen = useCallback(
    (open: boolean) => {
      setUrlState({ isFilterOpen: open })
    },
    [setUrlState]
  )

  const toggleFilterPanel = useCallback(() => {
    setUrlState({ isFilterOpen: !urlState.isFilterOpen })
  }, [urlState.isFilterOpen, setUrlState])

  const toggleSection = useCallback(
    (sectionKey: string) => {
      const validSectionKeys = [
        'sortSection',
        'genresSection',
        'ratingSection',
        'dateSection',
        'runtimeSection',
      ]
      if (validSectionKeys.includes(sectionKey)) {
        setUrlState({
          [sectionKey]: !urlState[sectionKey as keyof typeof urlState],
        })
      }
    },
    [urlState, setUrlState]
  )

  return {
    // Filter state
    filter,
    filterParams,
    hasActiveFilters,
    isFilterOpen,

    // Section states
    sections: {
      sort: urlState.sortSection,
      genres: urlState.genresSection,
      rating: urlState.ratingSection,
      date: urlState.dateSection,
      runtime: urlState.runtimeSection,
    },

    // Data
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,

    // Actions
    updateFilter,
    toggleGenre,
    setSortBy,
    clearFilters,
    toggleFilterPanel,
    setIsFilterOpen,
    toggleSection,
    fetchNextPage,
    refetch,
  }
}
