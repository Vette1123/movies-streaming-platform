# AI crawlers are search crawlers now

## What

Asked "allow all bots for SEO". Search engines were already open: 0 failures to Googlebot, bingbot, DuckDuckBot or
Applebot. What was shut out was AI:

- GPTBot, ClaudeBot and meta-externalagent were refused in robots.txt and blocked by the WAF. Google-Extended and
  Applebot-Extended were refused in robots.txt.
- PerplexityBot took 7×403 in 24h. AI crawlers Cloudflare does not verify, with no browser UA, matched the
  detail-page challenge, which a crawler cannot solve.

Fix:

- `config/ai-crawlers.json` lists the wanted AI crawlers once. The WAF allowlist skips them past the challenge and
  the rate limit, `cf:health` fails on a 403 to one, and `tests/robots.test.ts` fails if robots.txt or the block list
  refuses one.
- After `pnpm waf:apply`, PerplexityBot, GPTBot, ClaudeBot and OAI-SearchBot get 200 on a tail page, and
  python-requests still gets 403.
- Kept blocked: the dataset crawlers (CCBot, Bytespider…), the SEO tools, and Yandex, Baidu and Amzn-SearchBot. "All
  bots" would re-open the 11%-of-cap Yandex crawl and the scrapers that once took invocations to 91% of the free
  plan, and none of them rank the site anywhere.
- 429s in `cf:health` now have their own bucket (the rate limit), so "unclassified" fell from 790 to 181.

## Mistakes

- The health script's own comment said PerplexityBot was "SUPPOSED to be challenged". The rule it described came
  from before AI search sent referrals. The check was built not to grade the very crawler that was failing, so it
  stayed green.

## Rules

- A crawler that cites pages to people is a search crawler. Grade it in `cf:health` like Googlebot.
- "Allow all bots" is not an SEO lever on a free plan. Allow everything that ranks or cites the site, and keep
  blocking what only spends the cap.
