# Meta AI search was challenged on tail pages; `/null` 404s were a crawler

## What

A full health sweep the morning after the Managed Challenge (#226) went live.
Two findings:

- `meta-webindexer` (the crawler behind Meta AI search) got a 403 on every
  Worker-rendered detail page. `config/ai-crawlers.json` listed only
  `meta-externalagent`, which is Meta's training/knowledge crawler. Added
  `meta-webindexer` to `search`. CI's `waf:apply` puts it in the allow rule,
  and cf-health now fails if it ever takes a 403.
- 175 requests in 24h to `/person/null`, `/tv-shows/null`, `/movies/null` and
  `/null`, ~95% from meta-webindexer. These are a bare `null` resolved as a
  relative URL against the page's directory. No href, src or JSON-LD url renders
  it, so they are now a known-benign cf-health bucket. Unclassified 4xx went
  from 206 to 32.

## Mistakes

- I read `/person/null` as a link built from a null id and grepped every
  `/person/${id}` builder. All of them take a typed number. The path SHAPE was
  the clue: the same `null` under every directory a page lives in means a
  relative URL, not a bad id.
- The 24h `cf:health` showed invocations at 91% of the cap, which looked like a
  regression. The window straddled last night's WAF fixes. The last 4h alone
  projected 54%. Read health over a window that starts after the change.

## What worked

- Querying Cloudflare GraphQL for `clientRequestPath_like:"%/null%"` with the
  user agent named the crawler in one call. Referer and ASN are not available on
  this plan.
- Curling a tail page with each Meta UA showed the 403/200 split directly.

## Rules

- A crawler named in the logs gets curled with its own UA against a tail page
  before anything else: verified-bot status is not guaranteed for new crawlers.
- Meta runs two crawlers: `meta-externalagent` (knowledge) and
  `meta-webindexer` (search). Wanting one does not cover the other.
