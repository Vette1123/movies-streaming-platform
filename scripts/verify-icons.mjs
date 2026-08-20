// Checks the deployed icon surface against what it is supposed to be.
//
// `pnpm icons:build` writes a hand-packed multi-image ICO, a set of PNGs whose
// corner rounding differs per target on purpose, and a manifest that has to
// agree with all of them — none of which any build step validates, and all of
// which fail silently. A wrong ICO offset or a manifest pointing at a file that
// was renamed shows up as a missing favicon in a tab, months later.
//
// Run: pnpm icons:verify              (against production)
//      pnpm icons:verify http://localhost:3000
import sharp from 'sharp'

const ORIGIN = process.argv[2] || 'https://reely.space'
// The WAF challenges empty-UA subrequests and returns HTML instead of the asset.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`
  )
}

const get = async (path) => {
  const res = await fetch(`${ORIGIN}${path}`, { headers: { 'user-agent': UA } })
  return {
    status: res.status,
    cache: res.headers.get('cache-control'),
    cf: res.headers.get('cf-cache-status'),
    ct: res.headers.get('content-type'),
    res,
  }
}

const WEEK = 'max-age=604800'
const CACHED = [
  '/favicon.ico',
  '/site.webmanifest',
  '/browserconfig.xml',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/android-chrome-192x192-maskable.png',
  '/android-chrome-512x512-maskable.png',
  '/mstile-150x150.png',
  '/opengraph-image.png',
]

// 1. Every asset that got a _headers entry is 200 and carries the week TTL.
for (const path of CACHED) {
  const r = await get(path)
  check(
    `200 + ${WEEK}  ${path}`,
    r.status === 200 && (r.cache || '').includes(WEEK),
    `status=${r.status} cache-control=${r.cache ?? 'none'}`
  )
}

// 2. The deleted pinned-tab icon is really gone.
const pinned = await get('/safari-pinned-tab.svg')
check(
  'safari-pinned-tab.svg is gone',
  pinned.status === 404,
  `status=${pinned.status}`
)

// 3. favicon.ico carries four native-resolution images.
const ico = Buffer.from(await (await get('/favicon.ico')).res.arrayBuffer())
const entryCount = ico.readUInt16LE(4)
const sizes = []
let icoOk = ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1
for (let i = 0; i < entryCount; i++) {
  const o = 6 + i * 16
  const w = ico.readUInt8(o) || 256
  const len = ico.readUInt32LE(o + 8)
  const off = ico.readUInt32LE(o + 12)
  if (off + len > ico.length) {
    icoOk = false
    break
  }
  const png = ico.subarray(off, off + len)
  const meta = await sharp(png).metadata()
  if (meta.width !== w) icoOk = false
  sizes.push(w)
}
check(
  'favicon.ico holds 16/32/48/64 native renders',
  icoOk && sizes.join('/') === '16/32/48/64',
  `entries=${entryCount} sizes=${sizes.join('/')}`
)

// 4. Corner alpha: rounded where nothing masks, square where the platform does.
//
// Alpha alone is not enough. A corner can be transparent and the icon still
// read as a hard square — that was the actual complaint after the first pass,
// when every file here was "rounded" at Apple's 0.2237 squircle ratio and the
// 16px favicon still looked square, because 0.2237 of 16px is a 3.6px radius
// spread over about two antialiased pixels. So measure the radius too: walk in
// along the diagonal until the pixel is opaque, and express that inset as a
// fraction of the side. A pure-square icon gives 0.
const cornerGeometry = async (path) => {
  const buf = Buffer.from(await (await get(path)).res.arrayBuffer())
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const alphaAt = (x, y) => data[(y * info.width + x) * 4 + 3]
  let inset = 0
  while (inset < info.width && alphaAt(inset, inset) < 250) inset++
  return { alpha: alphaAt(0, 0), insetRatio: inset / info.width }
}

// The diagonal inset of a rounded rect is r*(1 - 1/sqrt(2)) ~= 0.293r, so a
// 0.30 radius lands near 0.088 and Apple's 0.2237 near 0.066. Floors sit just
// under each so antialiasing and palette quantization cannot trip them.
const ROUNDED = [
  { path: '/android-chrome-192x192.png', minInset: 0.08 },
  { path: '/android-chrome-512x512.png', minInset: 0.08 },
  // Rounded on purpose. iOS generates a launch screen from this icon whenever
  // no apple-touch-startup-image matches, and that generated screen does not
  // mask — a square file here is a square icon on the splash. It stays at the
  // squircle ratio rather than the rounder one: iOS clips it on the home
  // screen, and overshooting the mask leaves transparent corner slivers.
  { path: '/apple-touch-icon.png', minInset: 0.06 },
  { path: '/apple-touch-icon-precomposed.png', minInset: 0.06 },
  // Rounded AND capped. Chrome draws the maskable icon unmasked on the Android
  // splash screen, so it has to be rounded like every other unmasked surface;
  // but it is still the adaptive-icon source, so the rounding must stay inside
  // the outer ~16.7% band that every launcher mask crops. maxInset is that
  // ceiling — overshoot it and the corners start showing through the mask.
  {
    path: '/android-chrome-192x192-maskable.png',
    minInset: 0.08,
    maxInset: 0.16,
  },
  {
    path: '/android-chrome-512x512-maskable.png',
    minInset: 0.08,
    maxInset: 0.16,
  },
]
for (const { path, minInset, maxInset } of ROUNDED) {
  const { alpha, insetRatio } = await cornerGeometry(path)
  check(
    `rounded (corner transparent)  ${path}`,
    alpha === 0,
    `cornerAlpha=${alpha}`
  )
  check(
    `radius reads as rounded  ${path}`,
    insetRatio >= minInset,
    `diagonal inset=${(insetRatio * 100).toFixed(1)}% of side, need >=${(minInset * 100).toFixed(1)}%`
  )
  if (maxInset === undefined) continue
  check(
    `radius stays inside the mask  ${path}`,
    insetRatio <= maxInset,
    `diagonal inset=${(insetRatio * 100).toFixed(1)}% of side, need <=${(maxInset * 100).toFixed(1)}%`
  )
}
for (const path of ['/mstile-150x150.png']) {
  const { alpha } = await cornerGeometry(path)
  check(
    `square (platform masks it)  ${path}`,
    alpha === 255,
    `cornerAlpha=${alpha}`
  )
}

// 5. Manifest contents.
const mf = await (await get('/site.webmanifest')).res.json()
check('manifest id is "/"', mf.id === '/', `id=${JSON.stringify(mf.id)}`)
const purposes = mf.shortcuts.map((s) =>
  (s.icons || []).map((i) => i.purpose).join('+')
)
check(
  'shortcuts declare any+maskable',
  purposes.length > 0 && purposes.every((p) => p === 'any+maskable'),
  purposes.join(', ')
)

// 6. browserconfig TileColor matches the meta tag.
const bc = await (await get('/browserconfig.xml')).res.text()
const tile = /<TileColor>(.*?)<\/TileColor>/.exec(bc)?.[1]
check('TileColor is #000000', tile === '#000000', `TileColor=${tile}`)

// 7. Rendered document: mask-icon gone, favicon sizes advertised.
const html = await (await get('/')).res.text()
check('no <link rel="mask-icon">', !html.includes('mask-icon'))
check(
  'favicon link advertises all four sizes',
  html.includes('sizes="16x16 32x32 48x48 64x64"'),
  /<link rel="icon" href="\/favicon\.ico"[^>]*>/.exec(html)?.[0] ??
    'link not found'
)
check('msapplication-TileColor is #000000', html.includes('content="#000000"'))

// 8. Manifest screenshots exist and sit inside Chrome's limits, or the richer
// install dialog silently falls back to the plain one.
for (const shot of mf.screenshots ?? []) {
  const r = await get(shot.src)
  const [w, h] = shot.sizes.split('x').map(Number)
  const ratio = Math.max(w, h) / Math.min(w, h)
  check(
    `screenshot ${shot.form_factor} ${shot.sizes}`,
    r.status === 200 &&
      Math.min(w, h) >= 320 &&
      Math.max(w, h) <= 3840 &&
      ratio <= 2.3 &&
      (r.cache || '').includes(WEEK),
    `status=${r.status} ratio=${ratio.toFixed(3)} cache=${r.cache ?? 'none'}`
  )
}
check(
  'both form factors present',
  ['wide', 'narrow'].every((f) =>
    (mf.screenshots ?? []).some((s) => s.form_factor === f)
  ),
  (mf.screenshots ?? []).map((s) => s.form_factor).join(', ')
)

// 9. Every apple-touch-startup-image the document advertises resolves, and its
// pixel size matches what the media query promises. A 404 here is a white
// launch screen, which nothing surfaces as an error.
const splashTags = [
  ...html.matchAll(
    /<link rel="apple-touch-startup-image" href="([^"]+)"[^>]*media="([^"]+)"/g
  ),
]
check(
  'document advertises launch screens',
  splashTags.length > 0,
  `${splashTags.length} tags`
)
let splashOk = splashTags.length > 0
const splashDetail = []
for (const [, href] of splashTags) {
  const r = await get(href)
  const [, ew, eh] = /-(\d+)x(\d+)\.png$/.exec(href) ?? []
  if (r.status !== 200 || !(r.cache || '').includes(WEEK)) {
    splashOk = false
    splashDetail.push(`${href} status=${r.status} cache=${r.cache ?? 'none'}`)
    continue
  }
  const meta = await sharp(Buffer.from(await r.res.arrayBuffer())).metadata()
  if (meta.width !== Number(ew) || meta.height !== Number(eh)) {
    splashOk = false
    splashDetail.push(`${href} is ${meta.width}x${meta.height}`)
  }
}
check(
  `all ${splashTags.length} launch screens resolve at their declared size`,
  splashOk,
  splashDetail.join('; ')
)

const failed = results.filter((r) => !r.pass)
console.log(
  `\n${results.length - failed.length}/${results.length} passed on ${ORIGIN}`
)
if (failed.length) {
  console.log(
    'FAILURES:\n' + failed.map((f) => `  - ${f.name} (${f.detail})`).join('\n')
  )
  process.exit(1)
}
