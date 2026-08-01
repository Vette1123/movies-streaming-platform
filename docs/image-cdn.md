# Image CDN & fallback chain

All TMDB poster/backdrop images route through a CDN proxy, with an automatic
multi-stage fallback so a dead/expired CDN never breaks images.

## Current setup

**Primary source:** ImageKit — env `NEXT_PUBLIC_IMAGE_CACHE_HOST_URL`
(e.g. `https://ik.imagekit.io/sblfxr6i3`). ImageKit's origin is set to
`https://image.tmdb.org/t/p`, so the proxy path mirrors TMDB exactly:

```
ImageKit : https://ik.imagekit.io/<id>/w500/abc.jpg
wsrv.nl  : https://wsrv.nl/?url=https://image.tmdb.org/t/p/w500/abc.jpg&output=webp
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

## Where it lives

- `lib/tmdbConfig.ts`
  - `apiConfig.{originalImage,w500Image,w185Image,w300Image}` — build the
    **primary** URL from `IMAGE_CACHE_HOST_URL`.
  - `getNextImageFallback(src)` — given a failed URL, return the next stage
    (recovers the TMDB path from any stage, rebuilds the next URL).
- `components/blurred-image.tsx` — `onError` walks the chain for all
  posters/backdrops (the shared image renderer).
- `components/command-menu.tsx` — same `onError` on the search-dropdown thumbs.
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
| wsrv.nl     | free (donation-funded) | WebP/AVIF | no   | public, no SLA                                                 |
| ImageKit    | 20 GB/mo (perpetual)   | yes       | yes  | current primary; "2-week" was trial credits, not the free plan |
| Cloudinary  | ~25 GB/mo              | yes       | yes  | mature managed                                                 |
| Bunny.net   | paid (~$1 min)         | yes       | yes  | cheap, reliable                                                |

## Verifying a change

```bash
pnpm exec tsc --noEmit
# probe a URL directly:
curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" \
  "https://wsrv.nl/?url=https://image.tmdb.org/t/p/w500/<file>.jpg&output=webp"
```

Then load `/movies`, block the primary host in DevTools (Network → block
request domain), reload, and confirm posters still render from the next stage.
