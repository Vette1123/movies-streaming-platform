# Cloud-hosted scraper fleet hit 93% of the Worker quota

## What

On 2026-11-19 Cloudflare emailed: 93,348 of the 100,000 free daily Worker requests used. `pnpm cf:cpu` put 49% on `/movies/<tail id>`, 20% on `/api/media/`, 12% on `/tv-shows/`. The clients were a headless-browser fleet on Microsoft Azure (AS8075) and AWS (AS14618), ~800 requests per IP across hundreds of IPs, every one a Windows Chrome UA rotated over Chrome 103-146. GPTBot (verified, on Azure) added ~7,800 more, 4,400 of them `/api/media/` JSON.

Fixes:

- The block rule now also refuses 13 cloud ASNs on the Worker-billed paths, minus verified bots, static hubs and the CI smoke page (`scripts/lib/cloud-asn.mjs`, merged into `BLOCK_FROZEN_UAS_RULE` because all 5 free custom rules were spent).
- The rate limit went from 300 to 120 per 10 s and now counts `/collection/` and the API payloads too.
- robots.txt gives GPTBot/ClaudeBot/meta-externalagent their own group: no `/api/`, Crawl-delay 20.
- An hourly `Quota watch` workflow (`cf:health 3 --quota`) opens a `quota` issue past 50% of the cap.

## Mistakes

- The 2026-09-01 defence matched exact UA strings. The next fleet just rotated versions. A UA list is a list of what the last attacker typed; the network it runs on is the stable signal.
- Nothing watched the quota on a schedule. `cf:health` warned at 60%, but only when someone ran it, so the first alarm was Cloudflare's own email at 93%.
- Nearly broke the deploy: the smoke test fetches `/movies/550` from GitHub Actions, which is Azure. Caught by grepping the workflows for the site URL before applying.

## What worked

- `cf:cpu` for the route, then `httpRequestsAdaptiveGroups` grouped by UA and IP, then Team Cymru DNS (`<reversed-ip>.origin.asn.cymru.com` TXT) for the ASN. The zone token cannot read `clientAsn` in analytics, but `ip.src.asnum` works in free-plan WAF expressions.

## Rules

- Block by network (ASN) on paths that bill the Worker, never on static assets; always exempt `cf.client.bot`.
- Any new automated client in CI that hits a detail path has to be in `SMOKE_PATHS`, or it 403s.
- A per-IP rate limit cannot stop a distributed crawl of ~1 request per IP every 2 minutes; only the ASN rule does.
