# Image CDN & fallback chain

All TMDB poster/backdrop images route through a CDN proxy, with an automatic
multi-stage fallback so a dead/expired CDN never breaks images.

## Current setup

**Primary source:** ImageKit — env `NEXT_PUBLIC_IMAGE_CACHE_HOST_URL`
(e.g. `https://ik.imagekit.io/sblfxr6i3`). ImageKit's origin is set to
`https://image.tmdb.org/t/p`, so the proxy path mirrors TMDB exactly:

```
ImageKit : https://ik.imagekit.io/<id>/w500/abc.jpg
wsrv.nl  : https://wsrv.nl/?url=https://image.tmdb.org/t/p/w500/abc.jpg&w=500&q=70&output=webp&we
TMDB     : https://image.tmdb.org/t/p/w500/abc.jpg
```

**Fallback chain** (each image `onError` advances one stage):

1. **ImageKit** — primary managed CDN
2. **wsrv.nl** — free, keyless, Cloudflare-backed proxy; serves the TMDB origin
   as WebP (still optimized when ImageKit is down)
3. **TMDB origin direct** — free, keyless, unmetered, never expires — final
   safety net

Once at TMDB origin, `getNextImageFallback` returns `null` (chain exhausted).
External hosts (Unsplash, Twitter avatars) are left untouched.

## The fallback is not a quality downgrade (and why it used to be)

At the **same width and quality**, wsrv and ImageKit return byte-identical
WebP — measured on the same backdrop:

| request   | ImageKit | wsrv.nl  |
| --------- | -------- | -------- |
| w1200 q65 | 10 678 B | 10 678 B |
| w1200 q82 | 18 252 B | 18 252 B |

So the chain never had a per-pixel problem. It had a **width** problem, and the
fallback looked bad for two reasons, both fixed:

- **The width was pinned.** `lib/image-loader.ts` only rewrote ImageKit URLs and
  passed everything else through, so a wsrv URL produced a `srcset` whose
  candidates were all the same file under different `w` descriptors. Every
  device got the single width baked into the fallback URL — 2560 for anything
  off `/original`. A phone that fell off ImageKit downloaded a **118 KB** hero
  where the width it paints costs **4 KB**. The loader now rewrites wsrv's `w`
  and `q` too, so the fallback is fully responsive at the same 65/70 quality.
- **wsrv was upscaling.** TMDB's `original` is not a width: plenty of backdrops
  are natively 1280 or 780 px, and wsrv will enlarge one to whatever it is
  asked for. Measured on a w780 source asked for w=2560: **45.8 KB of blur**,
  against **10.1 KB** for the same request with `&we` ("without enlargement").
  That upscale was the visible "fallback looks terrible". `buildWsrvURL` now
  always sends `&we`.

wsrv has **no AVIF saver** (`Supported savers: jpg, png, webp, tiff, gif, jxl`),
so once off ImageKit the site is WebP-only. That is the one real regression and
it costs bytes, not pixels — `avifSrcSet` correctly returns `undefined` for any
non-ImageKit URL, so nothing offers an AVIF `<source>` that would 400.

## Circuit breaker

ImageKit running out of quota is not one broken image, it is every image on
every page. `lib/tmdbConfig.ts` keeps a module-level flag: the first failure on
the primary host trips it, and every mounted `BlurredImage` (subscribed via
`useSyncExternalStore`) re-renders straight onto wsrv. Without it each `<img>`
pays a doomed request first, and the hero's `<link rel=preload imagesrcset>`
names a URL that will 4xx.

It is deliberately **not persisted** — a fresh tab probes ImageKit once more,
which is also how the site notices the quota reset without a deploy.

## Where it lives

- `lib/tmdbConfig.ts`
  - `apiConfig.{originalImage,w500Image,w185Image,w300Image}` — build the
    **primary** URL from `IMAGE_CACHE_HOST_URL`.
  - `getNextImageFallback(src)` — given a failed URL, return the next stage
    (recovers the TMDB path from any stage, rebuilds the next URL).
  - `buildWsrvURL(path, width?, quality?)` — the single wsrv URL builder, shared
    by the chain and the loader.
  - `demoteFromPrimary` / `markPrimaryImageHostDown` / `subscribePrimaryImageHost`
    — the circuit breaker above.
  - `handleImageFallbackError(el)` — the shared `onError` for plain `<img>`s.
- `lib/image-loader.ts` — rewrites width/quality for **both** ImageKit and wsrv
  URLs, so both stages get a real `srcset`.
- `components/blurred-image.tsx` — `onError` walks the chain for all
  posters/backdrops (the shared image renderer).
- `components/command-menu.tsx` — `handleImageFallbackError` on the
  search-dropdown thumbs.
- `next.config.mjs` — `images.remotePatterns` allows `image.tmdb.org` and
  `wsrv.nl` (only enforced if `images.unoptimized` is ever turned off).

## How to change the PRIMARY source later

The fallback chain already covers outages. Only change the primary if you want
to **drop ImageKit entirely** (e.g. it expires and you don't renew).

### Option A — make wsrv.nl the primary (free, still optimized)

Edit `lib/tmdbConfig.ts` `apiConfig` image builders to emit wsrv URLs:

```ts
const WSRV = 'https://wsrv.nl/?url=https://image.tmdb.org/t/p'
const apiConfig = {
  // ...
  originalImage: (p: string) => `${WSRV}/original${p}&output=webp`,
  w500Image: (p: string) => `${WSRV}/w500${p}&output=webp`,
  w185Image: (p: string) => `${WSRV}/w185${p}&output=webp`,
  w300Image: (p: string) => `${WSRV}/w300${p}&output=webp`,
}
```

Then in `getNextImageFallback`, stage 0 becomes wsrv, so drop straight to TMDB
origin (or leave as-is — an already-wsrv URL is stage 1, which already falls to
origin). No other change needed. `IMAGE_CACHE_HOST_URL` can be removed.

**Trade-off:** wsrv is a free public service — no SLA. TMDB-origin fallback
still covers wsrv outages.

### Option B — make TMDB origin the primary (simplest, zero deps)

No proxy, no optimization, but free/unlimited/never-expires. Two ways:

- **Cheapest:** set env `NEXT_PUBLIC_IMAGE_CACHE_HOST_URL=https://image.tmdb.org/t/p`
  — the existing builders (`${HOST}/w500${p}`) then produce origin URLs
  directly. No code change.
- Or hard-code the builders to `https://image.tmdb.org/t/p` and delete the env.

**Trade-off:** posters ship as JPEG (~2x the WebP size). Fine for the small
poster sizes; heavier for `original` backdrops.

### Option C — swap to a different managed CDN (Cloudinary, Bunny, new ImageKit key)

Point that CDN's origin/fetch at `https://image.tmdb.org/t/p`, then set
`NEXT_PUBLIC_IMAGE_CACHE_HOST_URL` to the new base. As long as the path stays
`/{size}/{file}`, `getNextImageFallback` keeps working unchanged. If the new
host uses a different path shape, update `extractTMDBPath` / `imageStage` in
`lib/tmdbConfig.ts`.

## Alternatives comparison

| Option      | Free tier              | Optimize  | Key? | Notes                                                          |
| ----------- | ---------------------- | --------- | ---- | -------------------------------------------------------------- |
| TMDB origin | unlimited              | no        | no   | never expires; JPEG only                                       |
| wsrv.nl     | free (donation-funded) | WebP only | no   | public, no SLA; measured: no AVIF saver                        |
| ImageKit    | 20 GB/mo (perpetual)   | yes       | yes  | current primary; "2-week" was trial credits, not the free plan |
| Cloudinary  | ~25 GB/mo              | yes       | yes  | mature managed                                                 |
| Bunny.net   | paid (~$1 min)         | yes       | yes  | cheap, reliable                                                |

## Verifying a change

```bash
pnpm images:check        # asserts every URL shape in the chain + the loader
pnpm images:check:live   # same, then fetches each one and prints status/bytes
pnpm exec tsc --noEmit
```

`scripts/check-image-fallback.mjs` bundles the real TS modules with esbuild
rather than re-implementing them, so it cannot drift from the code it checks.

Then load `/movies`, block the primary host in DevTools (Network → block
request domain), reload, and confirm posters still render from the next stage.
