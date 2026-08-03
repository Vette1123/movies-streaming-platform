<a href="https://www.reely.space">
  <img src="./public/opengraph-image.png" alt="Reely — discover, track, and stream movies and TV shows" width="100%" />
</a>

# 🎬 Reely

> Discover, track, and stream movies and TV shows — a fast, modern, TMDB-powered viewing experience.

[![Deploy](https://github.com/Vette1123/movies-streaming-platform/actions/workflows/deploy.yml/badge.svg)](https://github.com/Vette1123/movies-streaming-platform/actions/workflows/deploy.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)

### 🚀 [Watch on Reely Space →](https://www.reely.space)

Browse trending titles, dive into rich detail pages, and pick up exactly where you left off — all from a single keyboard-friendly UI.

Reely is a production-grade movie and TV show tracker built on the TMDB API. It is designed to feel native: prerendered to static assets for speed, animated for delight, and instrumented for serious frontend craftsmanship.

⭐ If Reely is useful to you, please star the repo.

## ✨ Features

- **TMDB-powered catalog** — trending, popular, top-rated, now-playing, and on-the-air movies and TV shows, pulled live from the TMDB API.
- **Animated hero slider** — auto-rotating showcase of trending media on the landing page, with a muted trailer that plays inline while a slide holds the frame. Autoplay is opt-out via an on-slide toggle, and starts switched off on low-power devices so a weak phone isn't handed a video player and a full-screen Ken Burns at once. Your explicit choice always overrides that default.
- **Browse movies & TV** — dedicated listing pages with a deep, live-applying filter system and infinite scroll (TanStack `useInfiniteQuery` + intersection observer).
- **Advanced filters** — sort, tri-state genre pills (include / exclude / off), TMDB rating, vote count, runtime, release year (decade chips + range slider), original language, age rating (certification), and _where to watch_ (streaming-provider logo grid + region picker). All filters live-apply on a 300ms debounce — no "Save" button — with an active-filter chips bar (tap to remove, or clear all) above the grid.
- **Rich detail pages** — synopsis, cast, similar titles, recommendations, trailer, and ratings — fetched in a single TMDB `append_to_response` call.
- **In-page streaming player** — watch movies and individual TV episodes via a configurable external source (see the in-app disclaimer).
- **Season & episode navigator** — drill into any TV show by season and episode with a dedicated selector.
- **Trailers** — YouTube trailer dialog plus a hero trailer preview.
- **Collections** — franchise / collection pages that group a series of films.
- **Command-palette search (⌘K)** — instant, debounced search across movies and TV via a `cmdk` dialog, with All / Movies / TV chips and remembered recent searches. No page reload.
- **Genre pages & chips** — jump straight into any genre for movies or TV.
- **Real IMDb ratings (opt-in)** — genuine IMDb scores layered over TMDB, served from prebuilt static shards (`pnpm imdb:ratings`) with a TMDB fallback. Behind `NEXT_PUBLIC_IMDB_RATINGS` and **off by default**: enriching list rows costs one TMDB subrequest per item, which overruns the Workers free-plan 50-subrequests-per-invocation cap.
- **Watchlist** — save titles you want to watch, kept on your device (no account required).
- **Watch history** — track watched movies and episodes, remove single items, or clear everything, on a dedicated page.
- **URL-synced filters** — every active filter lives in the URL via `nuqs`, so filtered views are shareable and back-button friendly (transient UI chrome like open accordions stays out of the URL, keeping shared links clean).
- **Web Share** — share any title through the native share sheet.
- **Privacy-first** — watchlist, history, and recent searches live entirely in your browser; there's no login and nothing is stored on a server.
- **SEO & structured data** — full JSON-LD (Website, Organization, CollectionPage, Breadcrumb), Open Graph, Twitter Cards, dynamic OG image generation, sitemap, and robots.
- **Accessible & responsive** — skip-to-content, aria roles, a dedicated mobile nav, and a dark aurora UI that scales cleanly to phones.
- **Optimized imagery** — ImageKit CDN with an automatic `wsrv.nl` → TMDB origin fallback chain, driven by a custom `next/image` loader so every image still ships a real `srcset` and each device downloads the size it actually renders.
- **Installable PWA** — see the [Progressive Web App](#-progressive-web-app) section below.
- **Analytics built in** — PostHog product analytics, client-side only, with every event centralized in `lib/analytics.ts` and build-time source-map upload so minified production stack traces symbolicate.
- **Deployed on the edge** — see [Architecture](#-architecture) below.

## 📲 Progressive Web App

Reely is a fully installable PWA — not just a manifest, but a working offline-resilient app shell.

- **Installable** — "Add to Home Screen" on Android/Chromium (native `beforeinstallprompt` nudge) and iOS (Share → Add to Home Screen hint). Runs standalone, portrait, with a black theme.
- **App shortcuts** — long-press the icon for **Browse Movies** and **Browse TV Shows** jump links.
- **Offline-resilient** — a hand-written service worker (`public/sw.js`, no `next-pwa`/serwist/Workbox) with a per-request caching strategy:
  - immutable `/_next/static/*` assets → **cache-first**
  - page navigations → **network-first**, falling back to the last cached page, then a custom `/offline.html`
  - icons, manifest, and images → **stale-while-revalidate**
  - never cached: the streaming player, `/api/*`, RSC payloads, and any cross-origin request
- **Native touches** — maskable icons (192 / 512), Apple touch icon, theme colors, `browserconfig.xml` / mstile, and a Safari pinned-tab icon.

> Streamed video is live third-party content and is intentionally never cached for offline playback.

## 🏗️ Architecture

Reely ships as a **Next.js static export (`output: 'export'`) on Cloudflare Workers Static Assets**, plus one hand-written Worker for the parts that cannot be static. Next.js does not run in production at all.

This replaced an OpenNext deployment. Under OpenNext, 20–46% of Worker invocations were being killed on the free plan's 10ms CPU budget: any detail id outside the prerendered set re-rendered React on every request and could never become a cache hit, because Cloudflare will not edge-cache Worker-generated HTML. After the migration that figure is 0.0%, and p99 CPU went from ~700ms to ~8ms.

- **Static assets match before the Worker runs.** Every prerendered page is a plain file: zero CPU, and it doesn't count against the invocations cap.
- **The Worker handles only what can't be static** — `/api/*` (search, filtering, infinite scroll, season details, watch providers) and detail ids outside the prerendered set. A tail id costs one TMDB fetch plus an `HTMLRewriter` pass that injects the real title, OG/Twitter tags, JSON-LD, and a crawlable `<h1>`, so crawlers and unfurlers can't tell it from a prerendered page.
- **No Server Actions.** A static export can't contain them; the browser talks to the Worker over HTTP instead, and the Worker calls the very same `services/*` functions the build calls.
- **`caches.default` is keyed by URL + Next build id**, because cached fallback HTML references content-hashed chunks that the next deploy deletes.
- **The real ceiling on site size is the 20,000-file asset cap** — a static export writes ~10 files per route, so route depth is tuned in `lib/media-page.ts`.

Detail pages use TMDB `append_to_response` so a whole page renders on one TMDB request, and every TMDB call goes through a single governed client (`lib/fetch-client.ts`) with a concurrency cap and 429 backoff.

## 🛠️ Tech Stack

| Layer           | Technology                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router, Turbopack, RSC, static export) + React 19                                   |
| Language        | TypeScript 6                                                                                        |
| Styling         | Tailwind CSS 4 + `tailwindcss-animate` + `@tailwindcss/typography`                                  |
| UI              | shadcn/ui + Radix UI, `lucide-react` icons, Framer Motion, `sonner` toasts                          |
| Data fetching   | TanStack Query 5 + React Server Components                                                          |
| URL state       | `nuqs`                                                                                              |
| Search          | `cmdk` command palette + `use-debounce`                                                             |
| Infinite scroll | `react-intersection-observer`                                                                       |
| PWA             | Web App Manifest + hand-written service worker (no `next-pwa`/serwist)                              |
| Data source     | [TMDB API](https://www.themoviedb.org/documentation/api) + optional IMDb ratings + ImageKit imagery |
| Streaming       | External, configurable video source                                                                 |
| Analytics       | PostHog (client-side only)                                                                          |
| Deployment      | Static export on Cloudflare Workers Static Assets + one hand-written Worker                         |
| Tooling         | ESLint, Prettier, Husky, Commitlint, Renovate                                                       |

## 📖 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- A free [TMDB API key](https://www.themoviedb.org/settings/api)

### Install & run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for production

```bash
pnpm build:cf   # static export to out/ + bundle the Worker
```

`pnpm build` still runs a plain `next build` and is useful for diagnosing a prerender issue, but it is not what ships — the deployed artifact is the static export plus the Worker bundle. Note that it prerenders ~1000 routes and is slow; for day-to-day work use the dev server.

### Deploy to Cloudflare Workers

```bash
pnpm preview      # build:cf + wrangler dev (the real workerd runtime)
pnpm deploy       # deploy (needs CLOUDFLARE_API_TOKEN)
pnpm deploy:full  # build:cf + deploy
pnpm waf:apply    # push the Cloudflare WAF + CDN cache rules
```

### Environment variables

Copy `.env.sample` to `.env.local` and fill in the values you need. Only TMDB-related variables are required to run the app locally; the rest enable optional integrations.

| Variable                                               | Description                                              |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `TMDB_API_KEY`                                         | TMDB v3 API key (required)                               |
| `TMDB_HEADER_KEY`                                      | TMDB v4 bearer token used in request headers (required)  |
| `NEXT_PUBLIC_TMDB_BASEURL`                             | TMDB API base URL (e.g. `https://api.themoviedb.org/3`)  |
| `NEXT_PUBLIC_BASE_URL`                                 | Public base URL of your deployment                       |
| `NEXT_PUBLIC_STREAMING_MOVIES_API_URL`                 | Streaming source base URL used by the player             |
| `NEXT_PUBLIC_SEARCH_ACTOR_GOOGLE`                      | Google search URL template for actor lookups             |
| `NEXT_PUBLIC_IMAGE_CACHE_HOST_URL`                     | Optional image cache/CDN host                            |
| `NEXT_PUBLIC_IMDB_RATINGS`                             | `true` to enable IMDb ratings (optional, off by default) |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | PostHog project credentials (optional)                   |
| `CLOUDFLARE_API_TOKEN`                                 | Required only for `pnpm deploy` to Cloudflare Workers    |

## 🙌 Credits

Built by [Mohamed Gado](https://www.mohamedgado.com/). Data and imagery courtesy of [TMDB](https://www.themoviedb.org/) — Reely is not endorsed or certified by TMDB.

[![Buy Me A Coffee!](https://cdn.buymeacoffee.com/buttons/default-orange.png)](https://buymeacoffee.com/vetteotp)
