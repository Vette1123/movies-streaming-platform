/**
 * reely-relay-front - the playback relays' public face.
 *
 * The resolver relay lives on Netlify Edge Functions, but its /file URLs are
 * handed to the BROWSER (the video element streams them directly), and some
 * ISPs - ours included - TCP-block *.netlify.app. This worker is attached to
 * two custom domains and pipes each to its Netlify deployment, so browsers
 * talk to Cloudflare's edge while the VAULT still sees Netlify's egress (it
 * 427s Cloudflare-egress bytes, which is why the relays are not CF workers).
 *
 *   relay.reely.space   -> reely-relay.netlify.app     (relay 1, RELAY_SECRET)
 *   relay-b.reely.space -> reely-relay-b.netlify.app   (relay 2, RELAY_SECRET_2)
 *
 * One rewrite: the relays stamp /file URLs with the host they saw
 * (netlify.app) inside their JSON answers (resolve, selftest). Those are
 * small plain-text responses, so they are host-rewritten before they leave;
 * the byte stream of /file passes through untouched. Upstream fetches always
 * ask for identity encoding so the rewrite never sees compressed bytes.
 */

const PAIRS = [
  {
    origin: 'https://reely-relay.netlify.app',
    public: 'https://relay.reely.space',
  },
  {
    origin: 'https://reely-relay-b.netlify.app',
    public: 'https://relay-b.reely.space',
  },
]

export default {
  async fetch(req) {
    const u = new URL(req.url)
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
    if (loc && loc.startsWith(pair.origin))
      out.set('location', pair.public + loc.slice(pair.origin.length))

    const ct = res.headers.get('content-type') ?? ''
    if (res.status < 300 && ct.includes('application/json')) {
      const text = (await res.text()).replaceAll(pair.origin, pair.public)
      out.delete('content-length')
      return new Response(text, { status: res.status, headers: out })
    }
    return new Response(res.body, { status: res.status, headers: out })
  },
}
