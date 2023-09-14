import * as React from 'react'

import { SeriesDetails } from '@/types/series-details'
import { seasonsFormatter } from '@/lib/utils'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SeasonsSelectorProps {
  series: SeriesDetails
  setSelectedSeason: React.Dispatch<React.SetStateAction<string>>
}

export function SeasonsSelector({
  series,
  setSelectedSeason,
}: SeasonsSelectorProps) {
  const { seasonQuerySTR } = useSearchQueryParams()
  const formattedSeasons = seasonsFormatter(series?.seasons)

  return (
    <Select
      onValueChange={setSelectedSeason}
      defaultValue={seasonQuerySTR || '1'}
      disabled={!formattedSeasons?.length}
    >
      <SelectTrigger className="mb-4 w-full disabled:cursor-not-allowed lg:w-60">
        <SelectValue placeholder="Select a season" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Seasons</SelectLabel>
          {formattedSeasons?.map(
            (season, idx) =>
              season && (
                <React.Fragment key={season?.id}>
                  <SelectItem
                    key={season?.id}
                    value={String(season?.season_number)}
                  >
                    {season.name.startsWith('Season')
                      ? season.name
                      : `Season ${season?.season_number}`}
                  </SelectItem>
                  {idx !== formattedSeasons?.length - 1 && <SelectSeparator />}
                </React.Fragment>
              )
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
