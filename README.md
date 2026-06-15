# 🎬 Reely

> Discover, track, and stream movies and TV shows — a fast, modern, TMDB-powered viewing experience.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)

### 🚀 [Watch on Reely Space →](https://www.reely.space)

Browse trending titles, dive into rich detail pages, and pick up exactly where you left off — all from a single keyboard-friendly UI.

Reely is a production-grade movie and TV show tracker built on the TMDB API. It is designed to feel native: server-rendered for speed, animated for delight, and instrumented for serious frontend craftsmanship.

⭐ If Reely is useful to you, please star the repo.

## ✨ Features

- **TMDB-powered catalog** — trending, popular, top-rated, and now-playing movies and TV shows pulled live from the TMDB API.
- **Hero slider** — auto-rotating, animated showcase of trending media on the landing page.
- **Movies & TV shows browsing** — dedicated, filterable listing pages with infinite-scroll style pagination.
- **Rich detail pages** — synopses, credits, ratings, related media, and extra metadata for every title.
- **Season & episode navigator** — drill into TV shows by season and episode with a dedicated selector UI.
- **Command palette search (⌘K)** — debounced, instant search across movies and TV shows via a `cmdk`-powered dialog.
- **Persistent watch history** — track what you've watched, revisit it on the dedicated history page, and clear entries you no longer want.
- **Filter sidebar & sheet** — genre, rating, and date filters powered by `nuqs` for shareable, URL-synced state.
- **SEO & structured data** — full JSON-LD (Website, Organization, CollectionPage, Breadcrumb), Open Graph, Twitter Cards, and dynamic OG image generation.
- **PWA-ready** — manifest, Apple touch icons, theme colors, and viewport tuned for mobile installs.
- **Analytics built in** — PostHog for product analytics plus Google Tag Manager support.
- **Deployed on the edge** — ships to Cloudflare Workers via OpenNext, with a Cloudflare WAF setup script included.

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) + React 19 |
| Language | TypeScript 6 |
| Styling | Tailwind CSS 4 + `tailwindcss-animate` + `@tailwindcss/typography` |
| UI primitives | Radix UI + custom components (shadcn-style) |
| Data fetching | TanStack Query 5 + React Server Components |
| URL state | `nuqs` |
| Animation | Framer Motion 12 |
| Carousels | Splide |
| Search | `cmdk` command palette |
| Forms / dates | `react-day-picker`, `date-fns` |
| Notifications | `sonner` |
| Data source | [TMDB API](https://www.themoviedb.org/documentation/api) |
| Analytics | PostHog + Google Tag Manager |
| Deployment | Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare) |
| Tooling | ESLint, Prettier, Husky, Commitlint, Renovate |

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
pnpm build
pnpm start
```

### Deploy to Cloudflare Workers

```bash
pnpm preview   # build + preview the worker locally
pnpm deploy    # deploy via wrangler
```

### Environment variables

Copy `.env.sample` to `.env.local` and fill in the values you need. Only TMDB-related variables are required to run the app locally; the rest enable optional integrations.

| Variable | Description |
| --- | --- |
| `TMDB_API_KEY` | TMDB v3 API key (required) |
| `TMDB_HEADER_KEY` | TMDB v4 bearer token used in request headers (required) |
| `NEXT_PUBLIC_TMDB_BASEURL` | TMDB API base URL (e.g. `https://api.themoviedb.org/3`) |
| `NEXT_PUBLIC_BASE_URL` | Public base URL of your deployment |
| `NEXT_PUBLIC_STREAMING_MOVIES_API_URL` | Streaming source base URL used by the player |
| `NEXT_PUBLIC_SEARCH_ACTOR_GOOGLE` | Google search URL template for actor lookups |
| `NEXT_PUBLIC_IMAGE_CACHE_HOST_URL` | Optional image cache/CDN host |
| `GOOGLE_GTM_ID` / `GOOGLE_MEASUREMENT_ID` | Google Tag Manager & GA4 IDs (optional) |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | PostHog project credentials (optional) |
| `CLOUDFLARE_API_TOKEN` | Required only for `pnpm deploy` to Cloudflare Workers |

## 🙌 Credits

Built by [Mohamed Gado](https://mohamedgado.com). Data and imagery courtesy of [TMDB](https://www.themoviedb.org/) — Reely is not endorsed or certified by TMDB.

[![Buy Me A Coffee!](https://cdn.buymeacoffee.com/buttons/default-orange.png)](https://buymeacoffee.com/vetteotp)
