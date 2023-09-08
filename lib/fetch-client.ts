import { toast } from 'sonner'

import { apiConfig } from '@/lib/tmdbConfig'

export const fetchClient = {
  get: async <T>(
    url: string,
    params?: Record<string, string | number>,
    isHeaderAuth = false
  ): Promise<T> => {
    const query = {
      ...params,
      ...(!isHeaderAuth && { api_key: apiConfig.apiKey! }),
    }

    try {
      const res = await fetch(
        `${apiConfig.baseUrl}${url}?${new URLSearchParams(query)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(isHeaderAuth && {
              Authorization: `Bearer ${apiConfig.headerKey}`,
            }),
          },
        }
      )
      return await res.json()
    } catch (error: any) {
      toast.error(error.message)
      throw error
    }
  },
  post: async <T>(url: string, body = {}): Promise<T> => {
    try {
      const res = await fetch(`${apiConfig.baseUrl}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify(body),
      })
      return await res.json()
    } catch (error: any) {
      toast.error(error.message)
      throw error
    }
  },
}
