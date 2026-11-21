# seo:gsc and a GSC/Bing/PostHog sweep, 2026-11-21

## What

- `pnpm seo:gsc` (same module as social-media-downloader and masareef): Search Console totals,
  top queries, striking distance (position 4-20) and pages seen 20+ times with 0 clicks. It
  uses the seo:daily service account, already a Full user on `sc-domain:reely.space`.
- 28 days to 2026-11-20: 67 clicks, 2,716 impressions, avg position 61.9. Query and page lists
  fill Google's 1,000-row cap, so the script says when a list is the top rows only.
- Sweep: 0 open issues, PostHog board 0 open, GSC read all 4 sitemaps today with 0 errors.
  Bing ConnectionTimeout 27 on 2026-11-20 (week median 1) has no match at the edge:
  `cf:health 48` shows 0 failed crawler requests and 16 eyeball 5xx of 492,046. Left red.
- Dependabot #216 failed on a Prettier warning in a lesson that main has since fixed; asked
  dependabot to rebase; it closed #216 for #247 (13 updates, verify green), merged.
- Removed 3 leftover `.claude/worktrees` folders and 3 merged remote branches
  (`git cherry` showed 0 unmerged on each).

## Mistakes

- Read a generic `document.title` on a movie page as a hydration bug. It was the page Chrome
  reloaded after Cloudflare's challenge; a normal load and the server HTML both carry the movie
  title.
- The ported script's test failed typecheck here (tests are TS, the module was untyped JS);
  fixed with JSDoc types on the module so every caller gets them.

- After merging #247, local `pnpm install` died in `@posthog/cli`'s postinstall (Windows
  PowerShell `Expand-Archive` could not load its module from the inherited `PSModulePath`), and
  the half-done install made 2 posthog-client tests fail. Not the bump: CI on Linux was green.

## What worked

- Listing the properties each service account can see (`webmasters/v3/sites`) answered
  "is access granted" for every site in one call.

## Rules

- On this PC, a postinstall that unzips with `Expand-Archive` needs
  `env -u PSModulePath pnpm install`; read a red local test after an aborted install as the install.

- Judge a page's title from a clean load or the server HTML, never the post-challenge reload.
- curl and fresh browsers get Cloudflare's challenge (403 / "Just a moment"); that is not a
  crawler failure. `cf:health` is the witness for crawlers.
