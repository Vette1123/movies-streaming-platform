// Screen a candidate streaming-embed provider for one thing: does it load
// inside a sandboxed iframe?
//
// Why this exists. The streaming embed is a third party funded by ads, and the
// only lever an embedder has over popups, pop-unders, tab-hijack redirects and
// drive-by downloads is the iframe `sandbox` attribute — see lib/embed-policy.ts
// for the full reasoning and for the measurement showing the CURRENT provider
// refuses to load inside one at all. Nothing else in the parent page can reach
// into a cross-origin frame.
//
// So the question "can we block the ads" reduces, per provider, to a single
// boolean, and this renders it side by side:
//
//   left   no sandbox   — the control. Proves the provider works at all and
//                         that the id in the URL is right. Without it, a typo
//                         looks exactly like a sandbox rejection.
//   right  sandboxed    — the same URL under the tokens a player actually
//                         needs. Player renders => usable. Refusal page or
//                         blank => not usable, no token combination will help
//                         (measured: granting every token is still refused when
//                         a provider checks for the attribute itself).
//
// The YouTube preset is a POSITIVE CONTROL and the reason this is trustworthy:
// it is known to tolerate sandboxing, so if its right-hand cell is also broken,
// the probe itself is wrong — not the provider.
//
// It runs its own HTTP server rather than opening a file:// page because a
// file:// document sends no Referer, and these providers gate on it. That would
// report "blocked" for a provider that works fine, which is the one failure
// this tool must not have.
//
// Run: pnpm embed:probe        then open the printed URL and read the two cells.

import { createServer } from 'node:http'

const PORT = Number(process.env.EMBED_PROBE_PORT) || 4321

// Exactly the tokens lib/embed-policy.ts would ship if a provider ever allowed
// it. Keep the two in sync — probing a laxer set than we would ship would pass
// providers that then break in production.
const SANDBOX = 'allow-scripts allow-same-origin allow-presentation'

const PRESETS = [
  [
    'YouTube (positive control — must pass)',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  ],
  ['vidsrcme.ru', 'https://vidsrcme.ru/embed/movie/550'],
  ['vidsrc.to', 'https://vidsrc.to/embed/movie/550'],
]

const html = `<!doctype html>
<meta charset="utf-8">
<title>Embed sandbox probe</title>
<style>
  :root { color-scheme: dark }
  body { margin:0; font:14px/1.5 system-ui, sans-serif; background:#0b0b0d; color:#e5e7eb }
  header { padding:12px 16px; border-bottom:1px solid #27272a; display:flex; gap:8px; flex-wrap:wrap; align-items:center }
  input { flex:1; min-width:320px; padding:8px 10px; background:#18181b; color:inherit; border:1px solid #3f3f46; border-radius:6px; font:inherit }
  button { padding:8px 12px; background:#1d4ed8; color:#fff; border:0; border-radius:6px; font:inherit; cursor:pointer }
  button.preset { background:#27272a }
  .presets { display:flex; gap:6px; flex-wrap:wrap; padding:8px 16px; border-bottom:1px solid #27272a }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:8px; height:calc(100vh - 190px) }
  .cell { display:flex; flex-direction:column; border:1px solid #27272a; border-radius:8px; overflow:hidden; min-height:0 }
  .cell h2 { margin:0; padding:6px 10px; font-size:13px; background:#18181b; font-weight:600 }
  .cell h2 small { font-weight:400; color:#a1a1aa; font-family:ui-monospace, monospace }
  iframe { flex:1; width:100%; border:0; background:#000; min-height:0 }
  .how { padding:10px 16px; color:#a1a1aa; border-top:1px solid #27272a }
  .how b { color:#e5e7eb }
</style>
<header>
  <input id="url" placeholder="https://provider.example/embed/movie/550" />
  <button id="run">Probe</button>
</header>
<div class="presets">
  ${PRESETS.map(
    ([label, url]) =>
      `<button class="preset" data-url="${url}">${label}</button>`
  ).join('')}
</div>
<div class="grid">
  <div class="cell">
    <h2>1 — no sandbox <small>(control: does it work at all?)</small></h2>
    <iframe id="control" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"></iframe>
  </div>
  <div class="cell">
    <h2>2 — sandboxed <small>${SANDBOX}</small></h2>
    <iframe id="sandboxed" sandbox="${SANDBOX}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"></iframe>
  </div>
</div>
<p class="how">
  <b>Read it:</b> left plays + right plays &rarr; provider is usable sandboxed, and popups / tab-hijack
  redirects / drive-by downloads can all be switched off for it.
  Left plays + right shows a refusal or stays blank &rarr; not usable; no other token combination will help.
  Left broken too &rarr; wrong URL or dead provider, the right-hand cell means nothing.
  <b>Give it 30 seconds before believing a blank cell</b> — vidsrc.to measured ~30s to first paint, and a slow
  provider looks exactly like a dead one at 10s.
  <b>Always run the YouTube preset first</b> — its right cell must play. If it does not, this probe is broken, not the provider.
</p>
<script>
  const control = document.getElementById('control')
  const sandboxed = document.getElementById('sandboxed')
  const input = document.getElementById('url')
  const load = (url) => {
    if (!url) return
    input.value = url
    // Blank both first so a stale frame is never mistaken for a fresh result.
    control.src = 'about:blank'
    sandboxed.src = 'about:blank'
    setTimeout(() => { control.src = url; sandboxed.src = url }, 50)
  }
  document.getElementById('run').onclick = () => load(input.value.trim())
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(input.value.trim()) })
  for (const b of document.querySelectorAll('.preset')) {
    b.onclick = () => load(b.dataset.url)
  }
  // ?url=... probes a candidate straight from the address bar, so the page is
  // shareable and scriptable rather than click-only. Defaults to the positive
  // control, which is the one that should always be run first anyway.
  const fromQuery = new URLSearchParams(location.search).get('url')
  load(fromQuery || ${JSON.stringify(PRESETS[0][1])})
</script>
`

createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(html)
}).listen(PORT, () => {
  console.log(`Embed sandbox probe: http://localhost:${PORT}`)
  console.log('Run the YouTube preset first — its sandboxed cell must play.')
  console.log('Ctrl+C to stop.')
})
