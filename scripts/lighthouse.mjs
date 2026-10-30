// Lighthouse from wherever this runs, median of N, with the numbers that explain
// the score. Compare medians: one run swings 10 points.
//
//   pnpm lighthouse [url] [runs]
//
// Run it from the Lighthouse workflow, not a home connection. Measured
// 2026-10-30 from a PC 560ms from its Cloudflare colo, a 28KB stylesheet took
// 1.4s, the parser waited behind it, and the simulator charged every finished
// script to LCP: a 49KB hero scored 5.1s. Local numbers measure the local link.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url = 'https://www.reely.space/', runs = '3'] = process.argv.slice(2)
const dir = mkdtempSync(join(tmpdir(), 'lighthouse-'))

const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

function audit(formFactor, i) {
  const output = join(dir, `${formFactor}-${i}.json`)
  const device =
    formFactor === 'desktop' ? ['--preset=desktop'] : ['--form-factor=mobile']
  execFileSync(
    'pnpm',
    [
      'dlx',
      'lighthouse',
      url,
      ...device,
      '--only-categories=performance',
      '--output=json',
      `--output-path=${output}`,
      '--chrome-flags=--headless=new --no-sandbox',
      '--quiet',
    ],
    {
      stdio: ['ignore', 'ignore', 'inherit'],
      shell: process.platform === 'win32',
    }
  )
  const report = JSON.parse(readFileSync(output, 'utf8'))
  const score = report.categories.performance.score
  if (typeof score !== 'number') {
    throw new Error(
      `${formFactor} run ${i}: no score, ${report.runtimeError?.code ?? 'unknown error'}`
    )
  }
  const metric = (id) => report.audits[id].numericValue
  const observed = report.audits.metrics.details.items[0]
  return {
    score: Math.round(score * 100),
    fcp: metric('first-contentful-paint'),
    lcp: metric('largest-contentful-paint'),
    tbt: metric('total-blocking-time'),
    si: metric('speed-index'),
    cls: metric('cumulative-layout-shift'),
    observedFcp: observed.observedFirstContentfulPaint,
    observedLoad: observed.observedLoad,
    observedLcp: observed.observedLargestContentfulPaint,
    lcpImage: lcpImageTiming(report),
  }
}

// The simulator charges every script finished before the OBSERVED paint to LCP,
// so whether the hero beats the scripts matters more than the hero's size.
function lcpImageTiming(report) {
  const requests = report.audits['network-requests'].details.items
  const image = requests.find((r) => /fit=cover/.test(r.url))
  if (!image) return 'no crop requested'
  const lastScript = Math.max(
    ...requests
      .filter((r) => r.resourceType === 'Script')
      .map((r) => r.networkEndTime)
  )
  return `hero ${Math.round(image.networkRequestTime)}-${Math.round(image.networkEndTime)}ms ${Math.round(image.transferSize / 1024)}KB, last script ${Math.round(lastScript)}ms`
}

function report(formFactor, count) {
  const results = []
  for (let i = 1; i <= count; i++) {
    const r = audit(formFactor, i)
    results.push(r)
    console.log(
      `${formFactor} ${i}/${count}: ${r.score}  FCP ${Math.round(r.fcp)}ms  LCP ${Math.round(r.lcp)}ms  TBT ${Math.round(r.tbt)}ms  SI ${Math.round(r.si)}ms  CLS ${r.cls.toFixed(3)}  observed FCP ${r.observedFcp}ms, LCP ${r.observedLcp}ms, load ${r.observedLoad}ms; ${r.lcpImage}`
    )
  }
  console.log(
    `${formFactor} MEDIAN ${median(results.map((r) => r.score))}  (${results.map((r) => r.score).join(' ')})  LCP ${Math.round(median(results.map((r) => r.lcp)))}ms`
  )
}

console.log(
  `${url} from ${process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'this machine'}`
)
report('mobile', Number(runs))
report('desktop', Number(runs))
