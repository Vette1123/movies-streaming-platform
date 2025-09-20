// IMDB rating service using reliable APIs
export const getIMDbRating = async (imdbId: string): Promise<string | null> => {
  try {
    if (!imdbId || !imdbId.startsWith('tt')) {
      return null
    }

    // Use suggestion API directly (more reliable)
    return await getIMDbRatingFromSuggestion(imdbId)
  } catch (error) {
    return null
  }
}

// Primary method using suggestion API with scraping fallback
const getIMDbRatingFromSuggestion = async (
  imdbId: string
): Promise<string | null> => {
  try {
    // Try the suggestion API first
    const suggestionUrl = `https://v2.sg.media-imdb.com/suggestion/${imdbId[2]}/${imdbId}.json`

    const suggestionResponse = await fetch(suggestionUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Movie-Platform/1.0)',
        Accept: 'application/json',
      },
      cache: 'force-cache',
      next: { revalidate: 86400 },
    })

    if (suggestionResponse.ok) {
      try {
        const suggestionData = await suggestionResponse.json()

        if (suggestionData.d && suggestionData.d.length > 0) {
          const movieData = suggestionData.d.find(
            (item: any) => item.id === imdbId
          )
          if (movieData && movieData.r) {
            const rating = parseFloat(movieData.r)
            if (rating >= 0 && rating <= 10) {
              return rating.toFixed(1)
            }
          }
        }
      } catch (jsonError) {
        console.warn('Failed to parse suggestion API JSON:', jsonError)
      }
    }

    // Last resort: minimal scraping
    const pageResponse = await fetch(`https://www.imdb.com/title/${imdbId}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Movie-Platform/1.0)',
      },
      cache: 'force-cache',
      next: { revalidate: 86400 },
    })

    if (pageResponse.ok) {
      const html = await pageResponse.text()

      // Look for JSON-LD structured data first
      const jsonLdMatch = html.match(
        /<script type="application\/ld\+json"[^>]*>([^<]*)<\/script>/
      )
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1])
          if (jsonData.aggregateRating?.ratingValue) {
            const rating = parseFloat(jsonData.aggregateRating.ratingValue)
            if (rating >= 0 && rating <= 10) {
              return rating.toFixed(1)
            }
          }
        } catch (e) {
          // Continue to regex fallback
        }
      }

      // Regex fallback
      const patterns = [
        /"ratingValue":"([\d.]+)"/,
        /"aggregateRating"[^}]*"ratingValue":"([\d.]+)"/,
        /class="AggregateRatingButton__RatingScore[^"]*">(\d+\.?\d*)</,
      ]

      for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match && match[1]) {
          const rating = parseFloat(match[1])
          if (rating >= 0 && rating <= 10) {
            return rating.toFixed(1)
          }
        }
      }
    }

    return null
  } catch (error) {
    return null
  }
}
