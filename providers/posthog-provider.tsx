// app/providers.js
'use client'

import { PropsWithChildren } from 'react'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST as string,
    person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
  })
}
export function CSPostHogProvider({ children }: PropsWithChildren) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
