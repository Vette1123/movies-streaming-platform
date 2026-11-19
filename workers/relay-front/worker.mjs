/**
 * reely-relay-front - the playback relays' public face.
 *
 * Relay 1 lives on an Oracle Always Free VM and relay-b on Netlify Edge
 * Functions, but their /file URLs are handed to the BROWSER (the video
 * element streams them directly), and a raw *.netlify.app host is TCP-blocked
 * on some ISPs - ours included. This worker is attached to both custom
 * domains and pipes each to its home, so browsers talk to Cloudflare's edge
 * while the VAULT still sees the relay home's own egress (it 427s
 * Cloudflare-egress bytes, which is why the relays are not CF workers).
 *
 *   relay.reely.space   -> origin-b.reely.space      (relay 1,  RELAY_SECRET)
 *   relay-b.reely.space -> reely-relay-b2.netlify.app (relay-b, RELAY_SECRET_2)
 *
 * Since 2026-11-19 relay 1 has run on an Oracle Always Free VM (Jeddah)
 * behind the Cloudflare Tunnel `reely-oracle-b`: the primary home, spending
 * no Netlify credits, with the vault seeing the VM's egress rather than
 * Cloudflare's because the tunnel carries the request TO the VM and the VM
 * fetches the vault itself. Netlify is the cold fallback (relay-b, its own
 * credit pool), so one wallet pause or bad deploy can never take both homes
 * down at once. The public hostnames did not move.
 *
 * One rewrite: the relays stamp /file URLs with the host they saw (the
 * tunnel host or netlify.app) inside their JSON answers (resolve, selftest).
 * Those are small plain-text responses, so they are host-rewritten before
 * they leave; the byte stream of /file passes through untouched. Upstream
 * fetches always ask for identity encoding so the rewrite never sees
 * compressed bytes.
 *
 * CACHE (CACHE_RULES below): /pl, /seg and /resolve answers are cached per
 * colo and shared across viewers. The relay marks its answers `private`
 * because its own cache is per-isolate, but a signed URL IS the auth - the
 * same URL carries the same bytes for everyone - so this front can share
 * them. Every edge hit is an upstream invocation and an egress that never
 * happen - a VM fetch on relay 1, a Netlify invocation and credit on relay-b
 * (lessons 2026-11-18: bandwidth at 20 credits/GB is the meter a Netlify
 * relay hits) - so N viewers of one title collapse toward ~1 upstream fetch
 * per segment per colo for the cache's life.
 */

const PAIRS = [
  {
    origin: 'https://origin-b.reely.space',
    public: 'https://relay.reely.space',
  },
  {
    origin: 'https://reely-relay-b2.netlify.app',
    public: 'https://relay-b.reely.space',
  },
]

const CACHE_RULES = [
  // Playlists: the relay keeps its rewritten playlists 10 min (PLAYLIST_CACHE_S);
  // mirror that, so a cold isolate never becomes a viewer's second fetch.
  {
    match: (p) => p.startsWith('/pl/'),
    ttl: 600,
    type: 'application/vnd.apple.mpegurl',
  },
  // Segments are immutable over the relay's own 3h segment cache
  // (SEGMENT_CACHE_S); 30 min here stays well inside the vault's signed
  // life (3600 measured) and never outlives a token window.
  { match: (p) => p.startsWith('/seg/'), ttl: 1800, type: 'video/' },
  // Resolve answers: bursts only - the relay's RESOLVED cache is the long
  // layer. Only answers that actually carry sources are kept, so a 200
  // `{error: no stream}` JSON is never cached for a minute.
  {
    match: (p) => p === '/resolve',
    ttl: 60,
    type: 'application/json',
    needs: '"sources"',
  },
]

/**
 * The origin's own host, in both schemes, swapped for the public front. A VM
 * home sits behind cloudflared, which talks plain http to the relay on
 * 127.0.0.1, so the relay stamps `http://origin-b...` into its answers; a
 * Netlify home stamps `https://`. Either must leave as the https front.
 */
export const toPublic = (text, pair) =>
  text
    .replaceAll(pair.origin, pair.public)
    .replaceAll(pair.origin.replace(/^https:/, 'http:'), pair.public)

const worker = {
  async fetch(req, ctx) {
    const u = new URL(req.url)

    // Only plain GETs share a cache: /file streaming arrives as Range
    // requests (ranges differ per viewer, and a film exceeds entry limits),
    // and /selftest is never cached - it is a live witness; a cached yes
    // would lie. A HEAD bypasses too: nothing to serve it from.
    const rule =
      req.method === 'GET' && !req.headers.has('range')
        ? CACHE_RULES.find((r) => r.match(u.pathname))
        : null

    if (rule) {
      try {
        const hit = await caches.default.match(req)
        if (hit) {
          const out = new Response(hit.body, {
            status: hit.status,
            headers: new Headers(hit.headers),
          })
          out.headers.set('x-front-cache', 'hit')
          return out
        }
      } catch {
        // A broken cache read must never fail a play; fall through upstream.
      }
    }

    const pair = PAIRS.find((p) => p.public === u.origin) ?? PAIRS[0]
    const headers = new Headers(req.headers)
    headers.delete('host') // fetch sets it from the upstream URL
    headers.set('accept-encoding', 'identity')
    let res
    try {
      res = await fetch(pair.origin + u.pathname + u.search, {
        method: req.method,
        headers,
        body:
          req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
        redirect: 'manual',
      })
    } catch (e) {
      return new Response(`relay-front upstream error: ${e?.message ?? e}`, {
        status: 502,
        headers: { 'content-type': 'text/plain' },
      })
    }

    const out = new Headers(res.headers)
    if (!out.has('cache-control')) out.set('cache-control', 'no-store')
    const loc = out.get('location')
    if (loc) out.set('location', toPublic(loc, pair))

    const ct = res.headers.get('content-type') ?? ''
    let jsonText = null
    let final
    if (res.status < 300 && ct.includes('application/json')) {
      jsonText = toPublic(await res.text(), pair)
      out.delete('content-length')
      final = new Response(jsonText, { status: res.status, headers: out })
    } else {
      final = new Response(res.body, { status: res.status, headers: out })
    }
    final.headers.set('x-front-cache', rule ? 'miss' : 'bypass')

    // Worth keeping? Only a 200 of the route's real type - an error page, a
    // 429 HTML body or an empty resolve is never cached into the middle of
    // a film or a boot. The stored copy needs a public directive for the
    // edge to keep it; the viewer's copy keeps whatever the relay said.
    let putNote = ''
    if (rule && res.status === 200) {
      const typeOk = ct.startsWith(rule.type)
      const bodyOk = rule.needs ? (jsonText ?? '').includes(rule.needs) : true
      if (typeOk && bodyOk) {
        try {
          if (!ctx) throw new Error('no execution context')
          const stored = final.clone()
          stored.headers.set('cache-control', `public, max-age=${rule.ttl}`)
          if (jsonText !== null) {
            // Small, already-materialized answers store inline: guaranteed
            // to land before a fast second request can race it.
            await caches.default.put(req, stored)
          } else {
            // Segments stream: return bytes to the viewer now and let the
            // tee fill the cache in the background.
            ctx.waitUntil(caches.default.put(req, stored).catch(() => {}))
          }
        } catch (e) {
          putNote = String(e?.message ?? e).slice(0, 90)
        }
      }
    }
    final.headers.set(
      'x-front-cache',
      rule ? (putNote ? `miss; put=${putNote}` : 'miss') : 'bypass'
    )
    return final
  },
}

export default worker
