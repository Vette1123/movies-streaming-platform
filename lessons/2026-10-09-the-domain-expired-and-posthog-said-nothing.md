# 2026-10-09 — The domain expired, and PostHog said nothing

## What

Reported as "Reely Pro not playing, referral something". The cause was the
provider's domain: `vidsrcme.ru` lapsed at RU-CENTER (paid-till
2026-10-08T15:01Z) and now resolves to a parking IP that drops HTTPS. It took
out three things at once:

1. **Reely Beta.** The relay's first hop was `data.vidsrcme.ru` and died on
   `fetch failed`. Fixed in reely-resolver-relay: it now walks the provider's
   new `api_token` gate from `vidsrc.sh` and reads every later host off the
   pages. Production `/selftest`: movie and episode both reach a 200 segment.
2. **Server 1 for everyone who picked it.** `NEXT_PUBLIC_STREAMING_MOVIES_API_URL`
   was `https://vidsrcme.ru/embed`. It is now `https://vidsrc.sh/embed` (GitHub
   secret + `.env.local`). Server 5 moved too, `vidfast.pro` → `vidfast.vc`
   (it 301s; same early warning).
3. **Safari pro plays waited 2.5s** on a direct path that now hangs. Parked in
   reely-pro-player with `CLIENT_RESOLVE: "off"`.

In the same pass:

- **Server order.** The default slot (2) was sorted to the front, so the
  switcher read "Server 2, Server 1, Server 3". The list is now in slot order,
  and the default is picked by id (`DEFAULT_SOURCE`), not by position 0.
- **`player_failed`.** Nothing was captured when a server stalled or Reely Beta
  reported `unavailable`, so the outage was invisible in PostHog. Both now fire
  `player_failed {source, reason}`.
- **`pwa_installable` counted ~5 per person.** It was listened for twice (the
  hook and a provider tracker) and Chrome re-fires it on every full load. The
  duplicate tracker is gone, and the event is once per tab session.

## Mistakes

- **Nearly chased the Referer.** The report said "referral", and the segment
  gate IS a Referer gate, so that was the obvious first suspect. The relay's
  `/selftest` said `fetch failed` in 1.1s with no HTTP status: DNS/TLS, not a
  header. `whois` settled it in one command.
- **Thought this ISP could not reach the CDN.** A Node walk timed out on a
  Cloudflare IP; the same hop through `deno run` a minute later was 200. It
  was transient, and it nearly sent the verification to production blind.
- **An old test pinned "default first"** (`['b.example', 'a.example']`): the
  exact order the user called wrong. A test pins a decision, not a truth;
  when the decision changes, so does the test.

## What worked

- `pnpm embed:probe`-style curl sweep of the provider family's mirrors found
  `vidsrc.me` → `vidsrc.sh` in one pass.
- Running the patched relay locally (`npx -y deno run -A main.ts`) and hitting
  `/selftest` proved the whole chain down to a segment before the push.

## Rules

- `fetch failed` with no status: check DNS and `whois` before any header.
- A server that 301s to a new domain is about to lose the old one. Move the
  slot when you see the redirect, not when the domain lapses.
- Every on-screen failure state gets an event, or the next outage is silent.
