# Crawler images off wsrv.nl, 2026-11-22

## What

- Search Console read all 4 sitemaps with 0 errors, and a warning on every image entry: core 787
  of 787, movies 7,336 of 7,337, TV 5,772 of 5,772. `seo:daily` prints errors, not warnings, so
  nobody saw it.
- Cause: wsrv.nl's robots.txt ends with `User-agent: *` / `Disallow: /*?*`. Every wsrv URL is a
  query string (`?url=...&w=500`), and Google obeys robots.txt on an image's own host. So no
  poster in the sitemap or JSON-LD could be fetched by Googlebot-Image.
- Fix: `apiConfig.crawlerImage` builds a plain `image.tmdb.org/t/p/<size>` URL (TMDB serves
  `robots.txt` as a 404, which allows everything). The image sitemap, the movie/TV/person JSON-LD,
  ItemList entries and the Worker's tail-id and collection JSON-LD use it. On-page images and
  OG/Twitter tags stay on wsrv (`share:probe` covers unfurls).
- Same sweep: PostHog board 0 open, GitHub 0 open issues, Bing 0 crawl issues with 107k indexed.
  GSC's 88 apex `reely.space/...` rows are old URLs that 301 to www; no page emits apex links.
  Also fixed `tests/public-image-budget.test.ts` formatting, which had `format:check` red on main.

## Mistakes

- The earlier sweep today read the same sitemap report and logged "0 errors" as clean. The
  warnings field sat next to it.

## What worked

- Matching the warning count to the `<image:image>` count per file. An exact match on all three
  files pointed at the image host before any guessing.

## Rules

- A GSC sitemap with warnings on every row is a systemic cause, so read `warnings` as well as `errors`.
- Any URL a crawler reads bare must sit on a host whose robots.txt allows it. Check the robots.txt
  of every image proxy.
