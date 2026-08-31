import { siteConfig } from '@/config/site'

/**
 * What goes in `<title>`, for the pages Next does not render.
 *
 * A prerendered page gets ` | Reely` appended by the root layout's title
 * template (`app/layout.tsx`). Two places bypass that template and set the
 * title by hand — the Worker, which replaces the shell's `<title>` while
 * streaming a tail id, and `useServedMetadata`, which writes it back after
 * hydration — so without this a tail page's tab and SERP title read differently
 * from its prerendered twin. It was the last difference left between them.
 *
 * A heading that already names the site (a public profile, the lists
 * directory) is left alone rather than saying it twice.
 */
export const docTitle = (heading: string) =>
  heading.includes(siteConfig.name)
    ? heading
    : `${heading} | ${siteConfig.name}`
