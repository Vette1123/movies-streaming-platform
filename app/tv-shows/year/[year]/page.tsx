import { Metadata } from 'next'

import {
  TV_YEAR_PAGE_CONFIG,
  yearMetadata,
  YearPage,
  yearStaticParams,
} from '@/components/media/year-page'

// Static and closed, exactly like the genre routes: the year set is finite, all
// of it is prebuilt, and an unknown year is a static 404 rather than an
// on-demand render. discoverSeries fetches with revalidate:false, which is what
// makes the route build-only.
export const revalidate = false
export const dynamicParams = false

interface YearPageProps {
  params: Promise<{ year: string }>
}

export function generateStaticParams() {
  return yearStaticParams()
}

export async function generateMetadata({
  params,
}: YearPageProps): Promise<Metadata> {
  const { year } = await params
  return yearMetadata(TV_YEAR_PAGE_CONFIG, year)
}

export default async function SeriesByYearPage({ params }: YearPageProps) {
  const { year } = await params
  return <YearPage config={TV_YEAR_PAGE_CONFIG} year={year} />
}
