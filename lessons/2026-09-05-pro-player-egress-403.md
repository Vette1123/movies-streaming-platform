# 2026-09-05 — The Reely Player went black: the provider blocked our egress, not our code

## What
The Reely Player (source #0, "Reely Beta PRO") stopped playing: black frame,
then the switcher's 9s stall detector hopped visitors to Server 2. Traced the
whole chain end to end and found nothing wrong with any of our code.

`vixsrc.to` now answers **403** to datacenter egress on exactly the paths the
resolve chain walks. Measured today, same request shape from three networks:

| Path | Cloudflare Worker | Deno relay | Residential browser |
| --- | --- | --- | --- |
| `/api/movie/550` | 403 | 403 | **200** |
| `/movie/550` | 403 | 403 | **200** |
| `/` | — | 403 | 200 |
| `/api/list/movie` | — | **200** (1.66 MB) | 200 |

So both tiers that can own playback are dead, and the player falls to tier 3 —
the provider's own iframe in the visitor's browser, which still works because
that IP is residential. Pro keeps playing; it loses our chrome, our subtitle
overlay, resume and progress reporting, which is the entire point of Pro.

Shipped to `reely-resolver-relay`: the full browser header block on every
provider hop (parity with `reely-pro-player/src/vixsrc.mjs`, which had it since
2026-08-22 while the relay still sent a bare UA+Referer triple), the embed hop
declared as a document navigation, the master hop carrying the embed page as
its referer, and a real error on `/resolve` instead of five words.

It did not unblock it. Verified after deploy: `/api/movie/550 -> 403 len=4545
server=cloudflare`. The header fix is still correct — the two halves must not
drift — but the gate is the network, not the fingerprint.

## Mistakes
- **Called the relay "retired" off a stale README and said so out loud.** Its
  `README.md` opened with "Status: retired. Twice over." and I repeated it as
  fact. The relay is live, deployed, and wired into the worker's `RELAY_URL` —
  on the **new** Deno Deploy (`*.reely.deno.net`), not the sunset Classic
  `*.deno.dev` the README was describing. The user corrected me twice before I
  checked the actual config. A README is a claim about the past; `RELAY_URL`
  and a `/health` probe are the present. Rewrote the README.
- **Reached for "the provider rotated their page format" first.** It is the
  failure the resolver's own error message suggests, and it was wrong. Running
  our three extraction regexes against the live embed page *from the browser*
  showed all three still matching — token, expires and playlist URL — which
  killed that theory in one call and should have been the first call.
- **Nearly concluded "vixsrc blocks datacenter IPs" from a single 403.** The
  same Deno IP gets 200 on `/api/list/movie`. It is a **path-scoped** rule, not
  an ASN ban, and that distinction is the difference between "find another
  egress" and "this host is burned".
- **Local curl was useless and briefly looked like evidence.** This machine's
  ISP SNI-blocks `vixsrc.to` (TLS handshake failure, and DNS resolves only over
  DoH), so "I can't reach it either" meant nothing about the provider. Chrome
  on the same machine reaches it fine.

## What worked
- **`wrangler tail` on the private player worker.** `resolve failed
  StreamResolveError: https://vixsrc.to/api/movie/278 -> 403` named the exact
  hop and status in one shot. The Worker had that detail all along; the relay
  did not, which is why the relay half took ten times longer to diagnose. That
  asymmetry is now closed.
- **The relay's own `/pn-probe` as a general egress prober.** It concatenates
  its `path` param onto a host, so `path=@vixsrc.to/api/movie/550` resolves as
  userinfo + host and probes the provider from Deno's egress — read-only, no
  deploy needed. That one trick produced the whole comparison table above.
- **Running the resolve chain inside the browser's own console on the provider's
  origin.** Same-origin, residential IP: API 200, embed page 200, all three
  regexes matched, master manifest 200 with three variants. That is what proved
  the code is fine and the network is not.

## Rules
- **A 403 from one egress is not a block; it is one sample.** Probe a second
  path from the same IP before concluding anything. Same IP + different path +
  different answer = a WAF rule, and rules have shapes you can work around.
- **Every hop that crosses to a third party must report status, path and
  `cf-mitigated`/`server` on failure.** A bare "resolve failed" cannot tell a
  rotated format from a missing title from a bot block, and all three arrive as
  502. `cf-mitigated` absent on a Cloudflare 403 means it is a flat WAF block,
  not a challenge — no header set will ever pass it.
- **The provider fingerprint lives in two repos and must not drift.**
  `reely-pro-player/src/vixsrc.mjs` `browserHeaders` and
  `reely-resolver-relay` `providerHeaders` are the same set on purpose. A
  header added to one and not the other is a 403 only one path can see.
- **Playlist tokens are IP-bound, so resolve and playback must share an IP.**
  That is why the relay proxies bytes through `/pl/` and `/seg/` rather than
  handing the browser a URL, and why any future egress has to carry the video
  bandwidth too, not just the three resolve hops. Price that in before buying a
  proxy.
- **This machine cannot reach the provider.** Diagnose it from `wrangler tail`,
  the relay probe, or Chrome — never from local curl.
