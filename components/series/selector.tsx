import * as React from 'react'

import { SeriesDetails } from '@/types/series-details'
import { trackSeasonSelected } from '@/lib/analytics'
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
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'

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
      onValueChange={(value) => {
        trackSeasonSelected({ media_id: series?.id, season: Number(value) })
        setSelectedSeason(value)
      }}
      defaultValue={seasonQuerySTR || '1'}
      disabled={!formattedSeasons?.length}
    >
      <SelectTrigger className="mb-3 h-11 w-full font-medium disabled:cursor-not-allowed">
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
                    <span className="flex items-center gap-2">
                      {season.name.startsWith('Season')
                        ? season.name
                        : `Season ${season?.season_number}`}
                      <NewBadgeWhenRecent
                        date={season?.air_date}
                        className="relative top-0 left-0"
                      />
                    </span>
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
