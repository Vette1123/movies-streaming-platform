// Prove the details crossfade never leaks an unhandled rejection.
//
// Why this exists. React 19.3 starts a view transition for a details
// navigation and hangs two `.finally()` calls off the transition's `ready` and
// `finished` promises WITHOUT catching them (react-dom's RSC flush, shipped
// inside Next's app-page runtime). A transition that gets SKIPPED — the next
// navigation arrives before the first one's animations finish — rejects both
// promises with `AbortError: Transition was skipped`, and nothing catches it.
// The browser then reports an unhandled rejection, PostHog files it as a
// production error, and it lands in the tracker as a GitHub issue (#112).
//
// What it does: drives headless Chrome over the DevTools protocol (Node's own
// WebSocket, no dependency), counts `document.startViewTransition` calls and
// their transition types, and records every unhandled rejection, across a
// list → details → list navigation. Then it asserts:
//
//   1. the details link starts a transition typed `to-details`  (the crossfade
//      is still the crossfade — a fix that killed the transition to silence the
//      error would pass a noise filter and fail this)
//   2. a transition the browser skips produces NO unhandled rejection
//
// (2) is forced: the probe starts a transition and calls `skipTransition()` on
// it, which is exactly how the browser abandons one.
//
// Run: pnpm dev   then   pnpm vt:probe
// CHROME_PATH overrides the browser; default is the stock install location.

import {
  openHeadlessChrome,
  requireServer,
  sleep,
} from './lib/headless-chrome.mjs'

const url = process.argv[2] ?? 'http://localhost:3000/movies'
const PORT = Number(process.env.VT_PROBE_PORT) || 9334

const fail = (message) => {
  console.error(`? ${message}`)
  process.exitCode = 1
}

// Installed before any page script runs, so it sees the first transition too.
//
// It deliberately does NOT catch the browser transition's own promises: the
// point of the probe is to see the rejection the browser reports when nobody
// catches it, and a catch here would hide the very thing being measured.
const INIT = `(() => {
  window.__vt = { calls: [], rejections: [] };
  const original = document.startViewTransition && document.startViewTransition.bind(document);
  if (original) {
    document.startViewTransition = (options) => {
      const transition = original(options);
      window.__vt.calls.push({ types: (options && options.types) || [] });
      return transition;
    };
  }
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    window.__vt.rejections.push(
      (reason && (reason.name + ': ' + reason.message)) || String(reason)
    );
  });
})();`

await requireServer(url, 'pnpm dev must be running')

const chrome = await openHeadlessChrome({ port: PORT, label: 'vt-probe' })
try {
  await chrome.send('Page.enable')
  await chrome.send('Runtime.enable')
  await chrome.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT })

  await chrome.send('Page.navigate', { url })
  await sleep(3000)

  // A card link, the way a person reaches a detail page: a client-side
  // navigation, not a fresh document.
  const clicked = await chrome.evaluate(`(() => {
    const links = Array.from(document.querySelectorAll('a[href^="/movies/"]'));
    const link = links.find((a) => /^\\/movies\\/\\d+$/.test(a.getAttribute('href')));
    if (!link) return null;
    link.click();
    return link.getAttribute('href');
  })()`)
  if (!clicked) {
    fail('no /movies/<id> link on the list page — nothing to navigate to')
  } else {
    console.log(`  clicked ${clicked}`)
  }

  // Wait for the details page to arrive.
  for (let i = 0; i < 40; i++) {
    await sleep(250)
    const path = await chrome.evaluate('location.pathname')
    if (path && path !== '/movies') break
  }
  await sleep(1200)

  // And back again: the second navigation is what interrupts the first.
  await chrome.evaluate('history.back()')
  for (let i = 0; i < 40; i++) {
    await sleep(250)
    const path = await chrome.evaluate('location.pathname')
    if (path === '/movies') break
  }
  await sleep(1500)

  const state = JSON.parse(await chrome.evaluate('JSON.stringify(window.__vt)'))

  console.log(`\n  transitions started: ${state.calls.length}`)
  for (const call of state.calls)
    console.log(`    types: ${JSON.stringify(call.types)}`)
  console.log(`  unhandled rejections: ${state.rejections.length}`)
  for (const reason of state.rejections) console.log(`    ${reason}`)

  const details = state.calls.some((call) => call.types.includes('to-details'))
  if (!details) {
    fail('no transition typed to-details — the details crossfade did not run')
  } else {
    console.log('\n✓ the details navigation still crossfades')
  }

  // Force the skip the browser does when a second navigation interrupts the
  // first, and watch for the rejection it used to produce.
  await chrome.evaluate(`(() => {
    const transition = document.startViewTransition({ update: () => {} });
    transition.skipTransition();
    return true;
  })()`)
  await sleep(1000)

  const after = JSON.parse(await chrome.evaluate('JSON.stringify(window.__vt)'))
  const skipped = after.rejections.filter((reason) =>
    /Transition was skipped/i.test(reason)
  )
  if (skipped.length) {
    fail(
      `${skipped.length} unhandled rejection(s) from a skipped transition — the browser reports these as production errors`
    )
  } else {
    console.log('✓ a skipped transition produces no unhandled rejection')
  }
} finally {
  await chrome.close()
}
