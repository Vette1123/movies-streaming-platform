# SEO and marketing audit: what `seo:verify` could not see

## What

`pnpm seo:verify` passed 65/65, so the audit went after what it does not check.
It looked at the live crawl, the metadata code and PostHog. What shipped:

- **Stored XSS through JSON-LD.** The Worker wrote `JSON.stringify(jsonLd)` into
  `<script type="application/ld+json">`, and so did `JsonLd` in
  `lib/structured-data.tsx`. A user's list name or profile bio containing
  `</script>` would close the script tag on reely.space. Both sinks now go through
  `jsonLdText` (`lib/json-ld.ts`), which escapes `<`, U+2028 and U+2029.
- **Share images.** `og:image` was the 2560 `original`, 0.2-1 MB and past
  WhatsApp's preview limit, while `og:image:width` claimed 1280. It is now
  `w1280` resized to 1200, about 106 KB, with the real size stated
  (`getMediaShareImage`). Tail pages and collections state their size as well.
- **Inherited social tags.** Next replaces `openGraph`/`twitter` wholesale. Pages
  with their own openGraph had no `og:site_name`/`og:locale`, and pages without
  a `twitter` block unfurled with the home page's title. `withSiteSocial`
  (`lib/page-metadata.ts`) now wraps every page that sets openGraph, and a test
  fails if a page skips it.
- **RSS.** No page linked the feed: every page's `alternates` replaced the
  root's. The feed was also invalid XML, with 120 bare `&` from wsrv URLs in
  `<enclosure>`. Fixed, `lastBuildDate` added, and a test feeds it a title
  containing `&`.
- **AggregateRating.** Prerendered and tail pages disagreed (worstRating 0 vs 1,
  strings vs numbers). There is now one builder.
- **The Organization's `sameAs`** held the builder's personal profiles. Those
  now sit under `founder`.
- **Shares** carry `utm_source=share&utm_medium=<surface>` (`lib/share-url.ts`).
  Before this, share traffic counted as direct.

## Mistakes

- **The crawl subagent said every sitemap `lastmod` was the build time.** The
  live file has 122 lastmods across 33,495 entries, only on the hubs, by
  design. It sampled the hubs and generalised. Count before acting on a
  sitemap claim.
- **Two of three subagents went partly blind.** I entered the worktree while
  they were still running, and their shells were refused from then on. Enter
  the worktree first, then spawn.
- **`Write` turned ` ` in source text into the real character.** The
  character ends a JS regex literal, so the test file failed to parse with
  "Unterminated regular expression". A `sed` repair then dropped the
  backslashes. Write those escapes with `String.fromCharCode(92)` or check the
  bytes.
- **Almost blamed `/support` for a 17s LCP.** The LCP element was the home
  hero's overview link. People idled on home while the carousel rotated in new
  candidates, then navigated, and PostHog filed the home LCP under the new
  path. Check the attribution element before blaming a route.

## What worked

- PostHog first for CWV. The weekly trend showed a real mobile INP regression
  (p75 176ms early October, then 300-440ms from the week of Oct 11) in two
  queries. No lab profiling was needed, and none was possible.
- Verifying the share image's real bytes on wsrv: 1200x675 / 106 KB new,
  against 1422x800 for Fight Club's "1280" original.

## Rules

- JSON inside a `<script>` goes through `jsonLdText`. Never through bare
  `JSON.stringify`.
- Page metadata with `openGraph` is wrapped in `withSiteSocial`.
- A declared image size must equal the size requested from the image host.
- Open item, not fixed here: mobile INP regressed after 2026-10-17
  (posthog-js 1.410 to 1.438 with `defaults: 'latest'`, React 19.3, Next 16.4,
  all on one day). Settle it with field data, not a lab profile.
