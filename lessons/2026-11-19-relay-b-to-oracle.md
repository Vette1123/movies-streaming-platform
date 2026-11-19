# Relay-b moves to the Oracle VM

## What

`relay-b.reely.space` now pipes to `origin-b.reely.space`: relay 1b on an
Oracle Always Free VM (Jeddah) behind the Cloudflare Tunnel `reely-oracle-b`,
instead of the Netlify site `reely-relay-b2`. The front worker now deploys from
CI (`Deploy relay front` in `deploy.yml`, after the WAF step) instead of by
hand, and the WAF play-host exemption covers `origin-b`.

## Mistakes

- **Swapping the origin URL alone would have shipped a broken player.** Behind
  cloudflared the relay sees plain `http://origin-b...` and stamps that into
  its `/file` URLs; the front only rewrote the `https://` origin, so browsers
  would have received an http link that skips the front. Caught by reading
  how the relay builds `url.origin` before switching, not after. `toPublic`
  now rewrites both schemes, pinned by `tests/relay-front.test.ts`.
- The front's README told people to `npx wrangler deploy` from a laptop, which
  the standing never-deploy-locally rule forbids; there was no CI route at all.

## What worked

- Proving the new front before merge by importing `worker.mjs` in Node with a
  stub `caches.default` and sending a real signed resolve plus a 1 KB range
  through it: 200, URL rewritten, 206.

## Rules

- A relay behind a tunnel sees the tunnel's scheme, not the browser's; any
  host rewrite must match both.
- Every worker in this repo deploys from CI, the front included.
