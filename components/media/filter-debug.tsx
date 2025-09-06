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
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-background border rounded-lg p-4 shadow-lg text-xs">
      <h3 className="font-semibold mb-2">Filter Debug</h3>
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
          <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-auto max-h-32">
            {JSON.stringify(filterParams, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
