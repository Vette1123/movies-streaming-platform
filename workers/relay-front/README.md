# workers/relay-front — `reely-relay-front`

The playback relays' public face. The resolver relay lives on Netlify Edge
Functions, but its `/file` URLs go straight to the browser's video element,
and `*.netlify.app` is TCP-blocked on some ISPs. This tiny worker is attached
to two custom domains and pipes each to its Netlify deployment, so browsers
talk to Cloudflare while the vault still sees Netlify's egress (it 427s
Cloudflare-egress bytes — the reason the relays cannot be CF Workers).

```
relay.reely.space   -> reely-relay.netlify.app  (relay 1,  RELAY_SECRET)
relay-b.reely.space -> origin-b.reely.space     (relay 1b, RELAY_SECRET_2)
```

Relay 1b moved to an Oracle Always Free VM on 2026-11-19, reached through the
Cloudflare Tunnel `reely-oracle-b` (setup: the relay repo's `deploy/README.md`).
It spends no Netlify credits, and a credit-pool pause takes one relay home
down, never both. The public hostnames did not change. Behind the tunnel the
relay sees plain http, so it stamps `http://origin-b...` URLs; the front
rewrites both schemes (`toPublic`).

It rewrites only the relays' small JSON answers (the `/file` URLs they stamp
with the netlify host they saw); the byte stream passes through untouched.

## Deploy

CI deploys it: the `Deploy relay front` step of `.github/workflows/deploy.yml`
runs `wrangler deploy` here on every push to main. Never deploy it by hand.

The custom domains carry over from `wrangler.jsonc` — a first-time deploy of
a NEW hostname must happen BEFORE the WAF rules apply to it
(`scripts/cf-waf-setup.mjs` exempts both hosts explicitly).

`wrangler.jsonc` sets `observability.enabled`, so every request through these
fronts accrues CF telemetry. That is the input to the relay wallet gauge:
`node scripts/relay-usage.mjs` counts requests per front (24h/48h), projects
them against the Netlify team's 300-credit monthly pool, and reads the live
credit balance from the Netlify accounts API (see the relay repo's
NETLIFY.md for the credit model).

The worker also edge-caches `/pl`, `/seg` and `/resolve` answers per colo
(`CACHE_RULES` in `worker.mjs`; `x-front-cache: hit|miss|bypass` says which
path answered). A signed URL is its own auth, so the same URL is the same
bytes for every viewer — N viewers of one title collapse toward ~1 upstream
fetch per segment per colo for the cache's life, which is what keeps the
bandwidth meter (20 credits/GB — the one a video relay hits) tolerable at
scale. `/file` streaming and `/selftest` are never cached: ranges differ per
viewer, and a selftest is a live witness, not a shareable answer.
