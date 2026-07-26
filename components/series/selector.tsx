import * as React from 'react'

import { SeriesDetails } from '@/types/series-details'
import { trackSeasonSelected } from '@/lib/analytics'
import { seasonsFormatter } from '@/lib/utils'
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
  selectedSeason: string
  onSeasonChange: (season: string) => void
}

export function SeasonsSelector({
  series,
  selectedSeason,
  onSeasonChange,
}: SeasonsSelectorProps) {
  const formattedSeasons = seasonsFormatter(series?.seasons)

  return (
    // Controlled, not defaultValue: continue-watching can move the selection to
    // the resumed season after mount, and an uncontrolled Select would keep
    // showing "Season 1" while the list underneath had already switched.
    <Select
      onValueChange={(value) => {
        trackSeasonSelected({ media_id: series?.id, season: Number(value) })
        onSeasonChange(value)
      }}
      value={selectedSeason}
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
