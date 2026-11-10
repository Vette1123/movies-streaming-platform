# Hub titles with intent, an honest llms.txt, and the Pro auto-reply

## What

Search Console, 28 days to 8 Nov 2026: 69 clicks, 1.6k impressions, average position 55. The
queries are "<title> cast" and "<title> trailer", plus brand. Bing had no recommendations.

- Genre, year and collection pages now take the intent in `<title>`: "Horror Movies — Where to
  Watch", "Star Wars Collection — Every Film in Order". The new `hubDocHeading` and
  `collectionDocHeading` live in `lib/seo-title.ts`. Both drop the intent rather than pass
  `TITLE_MAX`. The collection version is shared by the prerendered page, the Worker tail path
  and `collection-fallback`, so all three agree.
- `/movies` and `/tv-shows` use their `ogTitle` as `<title>`; "Movies | Reely" matched nothing.
- `/compare` is `noindex, follow`, because its crawlable state is an empty form.
- The `/lists` Worker block uses an `<h2>` (`shellHasH1`), so the page no longer carries two
  identical `<h1>`s. An empty directory goes out as `noindex, follow` through the new
  `meta.robots`.
- `public/llms.txt` had wrong routes (`/genre/…` and `/year/…` are under `/movies/`), a stale
  person count, and private noindex pages listed as public.
- Pro emails now get an automatic Gmail template reply with the GitHub Sponsors link. The filter
  is `subject:"Reely Pro" -subject:re -from:me`. The site copy (/support, /terms, the checkout
  note) says so and no longer says "by hand".

## Mistakes

- The gap audit proposed "Watch Online" titles and keyworded detail descriptions. Both were
  already decided against: `lib/seo-title.ts` holds discovery framing only ("where to watch",
  never "watch free"), and `lib/seo-description.ts` already fills 150-160 characters with cast,
  trailer and where-to-watch. An audit that has not read the comments re-proposes settled calls.
- The first robots edit used `meta.robots` inside `metaTags`, which destructures its argument,
  so `meta` was undefined there. Typecheck does not cover `worker.js`; reading the signature did.

## What worked

- Checking `<title>` and robots on six routes with curl against `pnpm dev`, instead of a build.

## Rules

- A `<title>` heading for a page the Worker can also serve goes through one shared builder in
  `lib/seo-title.ts`, used by the page, the Worker and the fallback shell.
- A Worker-decorated shell that renders its own `<h1>` sets `shellHasH1`.
