# workers/relay-front — `reely-relay-front`

The playback relays' public face. The resolver relay lives on Netlify Edge
Functions, but its `/file` URLs go straight to the browser's video element,
and `*.netlify.app` is TCP-blocked on some ISPs. This tiny worker is attached
to two custom domains and pipes each to its Netlify deployment, so browsers
talk to Cloudflare while the vault still sees Netlify's egress (it 427s
Cloudflare-egress bytes — the reason the relays cannot be CF Workers).

```
relay.reely.space   -> reely-relay.netlify.app    (relay 1,  RELAY_SECRET)
relay-b.reely.space -> reely-relay-b.netlify.app  (relay 2,  RELAY_SECRET_2)
```

It rewrites only the relays' small JSON answers (the `/file` URLs they stamp
with the netlify host they saw); the byte stream passes through untouched.

## Deploy

```bash
cd workers/relay-front
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npx wrangler deploy
```

The custom domains carry over from `wrangler.jsonc` — a first-time deploy of
a NEW hostname must happen BEFORE the WAF rules apply to it
(`scripts/cf-waf-setup.mjs` exempts both hosts explicitly).

`wrangler.jsonc` sets `observability.enabled`, so every request through these
fronts accrues CF telemetry. That is the input to the relay wallet gauge:
`node scripts/relay-usage.mjs` counts requests per front (24h/48h), projects
them against the Netlify team's 300-credit monthly pool, and reads the live
credit balance from the Netlify accounts API (see the relay repo's
NETLIFY.md for the credit model).
