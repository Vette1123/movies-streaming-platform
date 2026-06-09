'use client'

import React from 'react'

import { FilterParams, MediaFilter } from '@/types/filter'

interface FilterDebugProps {
  filter: MediaFilter
  filterParams: FilterParams
  enabled?: boolean
}

export const FilterDebug = ({
  filter,
  filterParams,
  enabled = false,
}: FilterDebugProps) => {
  if (!enabled || process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="bg-background fixed right-4 bottom-4 z-50 max-w-sm rounded-lg border p-4 text-xs shadow-lg">
      <h3 className="mb-2 font-semibold">Filter Debug</h3>
      <div className="space-y-2">
        <div>
          <strong>Selected Genres:</strong>{' '}
          {filter.selectedGenres.join(', ') || 'None'}
        </div>
        <div>
          <strong>Excluded Genres:</strong>{' '}
          {filter.excludedGenres.join(', ') || 'None'}
        </div>
        <div>
          <strong>Sort By:</strong> {filter.sortBy}
        </div>
        <div>
          <strong>API Params:</strong>
          <pre className="bg-muted mt-1 max-h-32 overflow-auto rounded p-2 text-xs">
            {JSON.stringify(filterParams, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
