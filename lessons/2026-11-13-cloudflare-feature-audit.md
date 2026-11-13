# Cloudflare feature audit: hotlink 403 on our own share image, DNSSEC on

## What

Read every live zone setting (`/zones/:id/settings`, bot management, tiered
cache, DNSSEC, Speed Brain) and checked each against a live response.

- **Hotlink Protection was on** and answered 403 to `/opengraph-image.png`
  for a google.com or pinterest.com Referer. That file is the `og:image` of
  home and every hub, so Google Images and Pinterest showed a broken picture.
  Bandwidth is free on Cloudflare, so the setting protected nothing. Now
  `off` in `scripts/cf-waf-setup.mjs`, which CI re-asserts on every deploy.
  Verified: 403 → 200 for both referers.
- **DNSSEC was disabled.** `pnpm dns:harden` now turns zone signing on and
  prints the DS record. It stays `pending` until the DS is published at the
  registrar (Namecheap), which is a manual step.

Already right, and left alone: Tiered Cache + Smart Topology, HTTP/3, 0-RTT,
zstd/brotli served, TLS 1.3 + PQ key exchange + ECH, HSTS, Full (Strict),
Speed Brain, Early Hints off (on purpose: 504s), Bot Fight Mode off (on
purpose: breaks Googlebot), Polish/Cache Reserve/Argo are paid plans only.

## Mistakes

- Started out to loosen the Bingbot `Crawl-delay: 20` because the sitemap
  is now 33,495 URLs, not the 14,900 the comment says. `pnpm cf:health 24`
  showed invocations at 48% of the daily cap, up from 28% in September.
  The delay is the budget, so it stays. Price a crawl change against the
  cap before touching robots.txt.
- Considered Turnstile for `/api/newsletter/subscribe`. It only stores
  addresses and sends nothing, so spam costs a row, not a reputation.
  Not worth the friction.

## What worked

- One script dumping all zone settings, then a curl per suspicious setting
  with the Referer or encoding that would trip it. Settings alone said
  "hotlink on"; only the curl showed it hit our own og:image.

## Rules

- A zone setting that blocks requests gets a curl from the outside (foreign
  Referer, crawler UA) before it is called harmless.
- The DS record is published only while the zone is signed. Remove the DS
  at the registrar BEFORE ever turning zone signing off, or the domain goes
  dark for every validating resolver.
