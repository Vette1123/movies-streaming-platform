# IndexNow: changed URLs only

## What
`pnpm deploy` used to POST all ~14,800 sitemap URLs to IndexNow on every deploy ("every deploy re-renders every page, so every URL is a changed URL"). It now submits only URLs new to the live sitemap or whose prerendered page fingerprint (title, meta, canonical, JSON-LD, visible text; script/style dropped) differs from the page live right now. `scripts/lib/indexnow.mjs` holds the logic, `scripts/cf-deploy.mjs` takes the diff BEFORE `wrangler deploy` and submits after, `pnpm indexnow [--dry-run|--all]` inspects or pings by hand. Ported from portfolio-v1, which does it in `postbuild` on Vercel; Reely is a Cloudflare static export, so the hook is the deploy script and the built HTML is `out/`.

## Mistakes
- The brief said Vercel `postbuild`; Reely deploys to Cloudflare and had no `postbuild`. Reading cf-deploy.mjs first found the real submit path.
- First dry-run showed 1,632 "live-unreadable" pages: the WAF 403s any non-browser User-Agent, including my own `reely-indexnow-diff`. Fixed with a browser UA. Later a burst of repeated runs tripped the rate limit and the number came back (1,024); fetches now retry with backoff.
- The first fingerprint called ~19 of 100 sampled pages changed because the Worker serves the same tags as `>` and in another order, where the static file has `/>`. Tags are now compared as a normalised sorted set.
- Two collection pages in `out/` are baked "Page Not Found" noindex shells (a failed TMDB read at build). They were counted as changed. Noindex pages are now never submitted. The shells themselves still ship; not fixed here.
- I could not redeploy to prove an identical build gives 0. The remaining "changed" pages I inspected were real: newer SEO tags/JSON-LD not yet live, rating drift after the ratings snapshot, trending lists.

## What worked
Sampling 100 prerendered pages and printing the differing fingerprint lines found every false positive in minutes. Result with a fresh build vs live: 4,365 of 15,038 URLs (2,990 new, 1,362 changed, 13 unreadable) instead of all of them.

## Rules
- Diff against live BEFORE the deploy that replaces it.
- A fetch from our own scripts needs a browser UA and a retry, or the WAF turns the diff into noise.
- Compare HTML as indexed content, never as bytes.
