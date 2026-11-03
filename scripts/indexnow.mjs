// pnpm indexnow             submit what the build in out/ changed vs the live site
// pnpm indexnow --dry-run   print that set and why, submit nothing
// pnpm indexnow --all       submit every sitemap URL
//
// Run BEFORE `wrangler deploy`: the live site must still be the previous
// deploy for the comparison to mean anything. scripts/cf-deploy.mjs does that
// automatically; this CLI is for inspecting the set (--dry-run) or a manual ping.
import './load-env.mjs'
import { planIndexNow, submitIndexNow } from './lib/indexnow.mjs'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

const plan = await planIndexNow()
let urlList
if (args.includes('--all')) {
  urlList = plan.urls
  console.log(`IndexNow: --all, ${urlList.length} URLs.`)
} else if (plan.changed === null) {
  urlList = plan.urls
  console.warn(`IndexNow: ${plan.why}, sending all ${urlList.length} URLs.`)
} else {
  urlList = plan.urls.filter((u) => plan.changed.has(u))
  const byReason = {}
  for (const r of plan.changed.values()) byReason[r] = (byReason[r] ?? 0) + 1
  console.log(
    `IndexNow: ${urlList.length} of ${plan.urls.length} URLs changed vs the live site`,
    JSON.stringify(byReason)
  )
  for (const u of urlList.slice(0, 50)) console.log(`  ${plan.changed.get(u)}  ${u}`)
  if (urlList.length > 50) console.log(`  ... and ${urlList.length - 50} more`)
}
if (dryRun) {
  console.log('IndexNow: --dry-run, nothing submitted.')
} else if (!urlList.length) {
  console.log('IndexNow: nothing changed, nothing submitted.')
} else {
  const n = await submitIndexNow(urlList)
  console.log(`IndexNow: submitted ${n}/${urlList.length} URLs`)
}
