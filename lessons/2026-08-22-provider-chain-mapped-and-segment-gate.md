# 2026-08-22 — The vidsrcme chain, fully mapped, and the wall at the last inch

## What

Continued from the morning's "self-host disabled" session. The JACKPOT lead —
`Access-Control-Allow-Origin: *` on a streaming API — was chased to its end.
The provider family behind **Server 1** (`vidsrcme.ru`, same software as
vixsrc) turned out to be fully walkable client-side up to the very last hop:

1. `data.vidsrcme.ru/api.php?type=movie|tv&tmdb=<id>&stream_urls` — plain JSON,
   CORS `*`, no gate, no referer. Returns title + an encrypted `stream_urls`
   blob + `vs: { w, wasm_url }`.
2. The blob decrypts with **their public WASM** (ChaCha20, base64
   nonce‖ciphertext; key rotates per 5-minute window). Replicated outside the
   browser in Node via their own exports: `alloc(len)` → write bytes →
   `decrypt(ptr,len)` → plaintext starts at `ptr+12`. Movie and TV both work;
   TV hands back a different rotating CDN domain per title.
3. `<cdn>/generate.php` (CORS `*`) mints an HS256 JWT valid 4h carrying
   `"ip_cidr":"a.b.c.0/24"` — bound to the minter's /24.
4. Master playlist with `?token=<jwt>` → 200, valid HLS, CORS `*`, and the
   server **pre-stamps the token into every child URL**.

Then the wall: `/content/*` **segments respond without ACAO to any foreign
origin**. Proven in a real Chrome from two foreign origins
(`http://localhost` and the scratch Worker `reely-streamprobe.boogado66.workers.dev`):
manifest parses, level loads, then every fragment fails; paired fetches showed
cors-mode rejecting while no-cors completes — so HTTP works, TLS works, the
token is fine; the app layer simply withholds the CORS header on segment bytes
unless the request comes from their own player origin
(`cloudorchestranova.com`). Origin is browser-controlled, therefore
unspoofable: **the iframe is the product. Lifting it out is impossible by
design**, and production already uses the iframe (Server 1).

Consequences acted on:
- **No app changes.** The native/self-host source cannot work even behind a
  tester gate — verified negative end-to-end. Nothing was added back.
- **The relay repo is dead twice over**: premise void (IP-bound tokens,
  this morning), and now **Deno Deploy Classic was sunset 2026-07-20** —
  `reely-resolver-relay.deno.dev` returns `DEPLOYMENT_NOT_FOUND`. Its README
  now records this.
- A throwaway assets-only Worker (`reely-streamprobe`) serves the probe page
  for manual re-verification; isolated from reely.space, holds no secrets.

## Mistakes

- **Trusted a stale health check in my head.** Yesterday's lesson said the
  relay was healthy; tonight its entire platform no longer serves
  deployments. Infrastructure facts rot — re-probe before building on them.
- **Burned three public proxies on the cross-IP question** (allorigins,
  codetabs → 522, jina → connection refused) before finding the test that
  actually discriminates: pair `fetch()` cors-mode against mode `'no-cors'`
  from a real page. Rejection-with-completing-opaque-request isolates
  "missing ACAO" from "connection blocked" in one shot.
- **Read curl's 403 on segments as token rejection.** It was never about the
  token — curl fails those paths on fingerprint grounds, and the browser
  fails them on missing ACAO. Two different walls, same status code.
- **The first prototype stalled silently** because the fatal-error handler
  destroyed hls before diagnostics could read state. Instrument frag counters
  and keep the instance alive when you expect to inspect a failure.
- **Fought the harness twice**: `new_tab` attached to omnibox junk tabs, and
  their `disable-devtool.js` nuked the tab to `about:blank` mid-inspection.
  Neither mattered once testing moved into pages we serve ourselves.

## What worked

- Reading **their own code comments as primary intel**: "short-lived,
  host-bound gate token", "generate a token in the browser (IP-bound)" — the
  operator documents his own walls better than any probe.
- **Replicating the WASM decryption in Node** — full URL extraction with no
  browser, repeatable for movie and TV shapes.
- A **scratch assets-only Worker as the foreign HTTPS origin** for browser
  tests: deploy in seconds, zero contact with the site, deletable.
- The **cors/no-cors fetch pair** as the cleanest single discriminator of
  where a cross-origin wall actually sits.

## Rules

- For the vidsrcme/vixsrc family: API, decryptor, token mint and playlists
  are CORS-open; **segment bytes are origin-gated**. Server-resolve is dead
  (JWT binds to /24, 4h); native-player extraction is dead (Origin cannot be
  forged). Iframe embedding is the ceiling — do not reopen either design
  without a fundamentally different provider.
- "The browser can call this API" only matters if the **bytes** are also
  open. Test the last hop, not the metadata hops, before architecting.
- Pair every failed cross-origin fetch with a `no-cors` twin before blaming
  bot-fighting or tokens; the pair separates network blocks from withheld
  headers.
- Scratch Workers on workers.dev are the right isolation for provider probes;
  never route experiments through the site zone.
- Re-verify yesterday's infrastructure claims before building on them
  (Deno Deploy Classic died between sessions).
