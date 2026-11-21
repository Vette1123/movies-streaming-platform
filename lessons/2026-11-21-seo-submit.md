# Sitemap submit to Search Console and Bing on every deploy, 2026-11-21

## What

- Ported portfolio-v1's sitemap submit: `scripts/lib/search-engines.mjs` (Web Crypto service-account
  JWT, GSC `sitemaps` PUT, Bing `SubmitFeed`). `cf-deploy.mjs` calls it after IndexNow whenever the
  deploy changed URLs; `pnpm seo:submit` does it by hand.
- The index AND every child are submitted, so a new child (tv.xml) can't sit unread again.
- Secrets `GSC_SERVICE_ACCOUNT_JSON` (sadge-430319 SA, Full on sc-domain:reely.space) and
  `BING_API_KEY` set in GitHub and `.env.local`. First live run: 4 × GSC 204, 4 × Bing 200.

## Mistakes

- First draft had the deploy fetch the live sitemap. CI is on Azure, which the WAF blocks; the
  deploy now reads `out/sitemap.xml`, the same bytes that just went live.

## What worked

- Reusing the IndexNow change set as the trigger: no second diff, no D1 table.

## Rules

- A sitemap index is submitted with its children, never alone.
- Bing's site is the apex (`https://reely.space`); www feeds submit under it.
