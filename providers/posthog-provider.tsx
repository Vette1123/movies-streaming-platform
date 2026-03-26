// app/providers.js
'use client'

import { PropsWithChildren } from 'react'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST as string,
    person_profiles: 'always',
    capture_pageview: false, // we handle this manually in PostHogPageView
    debug: process.env.NODE_ENV === 'development',
  })
}
export function CSPostHogProvider({ children }: PropsWithChildren) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
