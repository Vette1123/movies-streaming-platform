# 2026-08-23 — Gado player revival path: gado-proxy tier + self-host opt-in

## What

After the exhaustive source sweep concluded that NO public provider serves
origin-open segments, built the tier that makes OUR player work anyway:

- `gado-proxy.mjs` (reely-resolver-relay): resolves the chain AND streams
  every playlist/segment through one consistent egress IP — the only identity
  upstream token/IP gates accept (browsers fail Origin; CF Workers fail ASN;
  both measured). HMAC-signed /pl and /seg URLs (no open relay), Range
  passthrough for seeking, playlist rewriting that covers #EXT-X-MEDIA /
  I-FRAME / MAP URI attributes, response shape `{sources:[{url}]}` matching
  the client contract byte-for-byte. Walk-tested: master→variant→segment,
  zero upstream leaks, 206 ranged bytes.
- movies repo: the supporters opt-in now enables the SELF-HOST player
  (`NEXT_PUBLIC_PRO_TRIAL_SELFHOST=true` → RICH_SOURCE = reely pseudo-source
  → heroes render ReelyPlayer via the existing ticket flow). The worker needs
  zero code change: point its RELAY_URL/RELAY_SECRET at the proxy box.
- Deployed green after fixing a TS error I shipped: RICH_SOURCE dropped
  `base`, which StreamSource requires. Placeholder `.invalid` base keeps the
  type honest; heroes never fetch it.

## Mistakes

- **Shipped a type error to CI** by hand-writing an object literal against a
  stricter interface from memory. `tsc --noEmit` locally takes ten seconds —
  run it before every push, tests alone do not type-check.
- **My first leak-detector matched our own signed URLs** (the encoded
  upstream inside `u=` contains the host name). A leak test must look for
  URIs *starting* with http, not substrings anywhere.
- Two PowerShell inline-one-liner failures in a row — moved to script files
  instead of fighting quoting.

## Rules

- The client contract is `{sources:[{url}]}` with HEX HMAC sigs — new relay
  tiers conform to it and no player code changes.
- Proxy playlists MUST rewrite URI="..." attributes, not just bare lines;
  audio/subs renditions ride EXT-X-MEDIA.
- Any pseudo-source that routes away from URL building still satisfies the
  full interface — use an `.invalid` placeholder, not a type hole.
