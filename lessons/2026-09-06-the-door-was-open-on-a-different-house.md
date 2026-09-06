# 2026-09-06 — The door was open on a different house

## What

The Reely Player plays real HLS again: our controls, our subtitle overlay, the
quality picker, resume, progress, the Gado chip. Verified on production against
a film and a series episode.

Yesterday's conclusion was that the category was closed and Pro's value had to
come from what we own. That was right about the provider and wrong about the
category, and the difference cost a day.

### What was actually shut

`vixsrc` is unresolvable by anything we control, and re-measuring it took
thirty seconds:

| hop                       | our egress (Deno) | a browser on reely.space                 |
| ------------------------- | ----------------- | ---------------------------------------- |
| `/api/movie/550`          | 403               | `cors` throws, `no-cors` opaque in 140ms |
| `/embed/<id>`             | 403               | same                                     |
| `/api/list/movie`         | 200 (1.66 MB)     | -                                        |
| master + variant playlist | -                 | 200, `ACAO: *`                           |

Both doors on the same room: no server of ours may mint a token, and no browser
of ours may read the response that carries one. Nothing about that has changed
and nothing will.

### What was open

`vidsrcme` — already configured as Server 1, already known to answer our
egress, and dismissed a day earlier as "JSON + WASM decrypt". The decryptor is
a 3.5 KB script with a docblock at the top explaining exactly what it does, and
the chain underneath is four hops:

1. `data.vidsrcme.ru/api.php?type=movie&tmdb=<id>&stream_urls` — addressed by
   TMDB id, so the two embed pages their own site walks can be skipped entirely
   from a server. They exist to carry a gate token into a browser.
2. `data.stream_urls` is base64 `nonce || ciphertext`; `vs.wasm_url` is a
   five-minute ChaCha20 window shipped as WebAssembly. The module exports
   `alloc` and `decrypt` and writes the plaintext back at `ptr + 12`. Deno
   Deploy compiles fetched WASM, so this is fifteen lines.
3. `<cdn>/generate.php` mints a short-lived, IP-bound playlist token.
4. Stamp it onto the URL and you have the master manifest.

Measured from the relay after deploying: resolve 324-591ms, master and variant
valid, a 388 KB segment in 30ms, three movies and two series episodes, and a
clean `no stream_urls` in 230ms for an id that does not exist.

### The gate that decided the architecture

Their CDN allowlists player origins on the **segments** and leaves the
playlists open to everyone. Eight header combinations against one segment URL:

| request                            | result         |
| ---------------------------------- | -------------- |
| no Origin, no Referer              | 200, `ACAO: *` |
| `Origin: <their player>`           | 200, `ACAO: *` |
| `Origin: reely.space`              | 403            |
| `Referer: reely.space` (no Origin) | 403            |
| `Origin: null`                     | 403            |
| the same eight against the .m3u8   | 200 every time |

A browser always sends `Origin` on a CORS fetch, and hls.js needs CORS to read
segment bytes, so no page of ours can fetch these directly. The relay can,
because it sends neither header — which is exactly what `/pl/` and `/seg/` were
already built to do, for a provider that no longer works. The playlist token is
IP-bound, and the relay both mints and spends it, so the one design constraint
that killed resolve-here-play-there is satisfied by construction.

## Mistakes

- **Concluded a category was closed from one provider.** Yesterday's lesson
  ends with "do not reopen stream extraction for this category again", derived
  from an invariant — segments gated on Origin AND ASN — that turned out to
  hold for one provider and not the next one along. The invariant was real; the
  quantifier was wrong. A rule written from a single sample reads exactly like
  a rule written from a survey.
- **Dismissed the winning provider on a one-line summary.** "JSON + WASM
  decrypt" sounded like a reverse-engineering project. It is a documented
  script and four fetches, and reading it took four minutes. The summary was in
  our own notes and had never been opened.
- **Spent an hour trying to walk the provider in the automation browser.** Its
  embed vendors `disable-devtool` with `disableIframeParents: true`, which
  navigates the tab to `about:blank` on detection — that is what the mysterious
  blank tabs were. `curl` from this machine reads every page in the chain in
  under a second. The right tool was the boring one.
- **Believed the local network could not reach these hosts.** The note that
  "this machine cannot reach the provider" is true of exactly one hostname.
  Every other host in the survey answers curl here directly, which turned a
  deploy-and-guess loop into a two-second edit-and-run loop.
- **Did the Origin/Referer discrimination late.** The first segment probe set
  both headers together and reported "origin-gated", which is what the earlier
  survey had recorded too. Splitting them, and adding the absent-header case,
  is what produced the design: the relay does not need to impersonate anyone,
  it needs to say nothing.

## What worked

- **Reading the provider's own source.** Their route chunk is 1.8 KB and their
  decryptor 3.5 KB, both unminified, both commented. Every question about the
  contract — the envelope, the re-wrap, the token endpoint, the query
  passthrough — was answerable from the file rather than from a trace.
- **A `walk.mjs` in the scratchpad.** The whole chain in forty lines of Node,
  runnable in a second, before a single line landed in the relay. By the time
  the real implementation was written there was nothing left to discover.
- **`/selftest` on the relay.** `RELAY_SECRET` lives only on the playback
  worker, so `/resolve` cannot be called from a shell, and the alternative was
  deploying blind and reading a black frame three hops away. One unsigned
  endpoint that reports stage, status and byte count turned every verification
  into one curl.
- **Cutting a header at a time.** The eight-row table above is the whole
  design decision, and it took two minutes.

## Rules

- **A closed door is a fact about one host.** Re-derive the invariant on the
  next provider before quoting it as a category. Yesterday's table was correct
  and yesterday's conclusion was not.
- **Read the obfuscation before pricing it.** "WASM decrypt" was a docblock and
  an `alloc`/`decrypt` pair. The cost of opening the file is always lower than
  the cost of routing around what might be inside it.
- **Probe headers one at a time.** Origin and Referer sent together answer a
  question you did not ask. The case worth testing first is neither.
- **Prefer curl to the automation browser for provider archaeology.** These
  pages ship anti-devtools scripts that blank the tab; the shell has no such
  problem, and it is faster anyway.
- **Give any signed endpoint an unsigned self-test.** Not being able to call
  your own resolver from a shell turns every hypothesis into a deploy.
