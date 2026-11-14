# PostHog check: link-scanner rejection filtered; the other flags were not bugs

## What

The one open issue was "Object Not Found Matching Id:5, MethodName:update, ParamCount:4".
That rejection comes from CefSharp's JavaScript bridge inside a link scanner (Outlook Safe
Links and similar tools). The person behind it had one pageview, no play, Windows, in the
US. `lib/error-noise.ts` now drops it, and a test pins the rule. The other flags checked
out as working:

- **Empty `status` in "Handled failures":** this week's 4 api_errors were all expected
  transport failures. A request that got no answer has no status to report.
- **18 never-fired events:** they did fire within the last 90 days. They are rare at about
  410 people a week (watchlist_added fired 2 times this week).
- **`shared` and `media_shared`:** the share button renders and is wired correctly. The
  autocapture count of share clicks is near zero since Oct 24 as well, so nobody is
  sharing. The event works.
- **`/tv-shows/:id` dead clicks:** the top one is the wrapper of an unaired episode card,
  which has no play button by design.

## Mistakes

- The SEO audit flagged a 163-character collection description. That count included
  `&#x27;` as six characters; decoded, it is 158. Measure what the reader sees.
- `posthog:query` rejects `last` as a column alias (a reserved word).

## What worked

- Confirming silence with a second signal (autocapture clicks) before calling a tracker
  broken.

## Rules

- "Never fired in 7 days" means check 90 days and the volume of the upstream action before
  treating it as a bug.
