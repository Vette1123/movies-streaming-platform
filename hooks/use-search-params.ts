import React from 'react'
import { useSearchParams } from 'next/navigation'

export const useSearchQueryParams = () => {
  const searchParams = useSearchParams()
  const seasonQuerySTR = searchParams.get('season')
  const episodeQuerySTR = searchParams.get('episode')
  const seasonQueryINT = Number(seasonQuerySTR)
  const episodeQueryINT = Number(episodeQuerySTR)
  return {
    seasonQueryINT,
    episodeQueryINT,
    seasonQuerySTR,
    episodeQuerySTR,
  }
}
