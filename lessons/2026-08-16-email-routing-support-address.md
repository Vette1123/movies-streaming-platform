# support@reely.space via Cloudflare Email Routing

## What

Stood up `support@reely.space`, forwarding to a personal inbox, on Cloudflare
Email Routing. The zone had been hardened on 2026-07-30 as a domain that neither
sends nor receives mail, so this crossed two of the three records that hardening
put in place.

Live state after the work:

```
routing   enabled=true status=ready
MX        38/76/81 route3/route1/route2.mx.cloudflare.net
SPF       v=spf1 include:_spf.mx.cloudflare.net -all      (one record)
DKIM      cf2024-1._domainkey  (Cloudflare) + *._domainkey null policy
DMARC     p=reject  (unchanged)
rule      [on] support: to == support@reely.space -> forward boogado@yahoo.com
catch-all [on] all -> forward boogado@yahoo.com
```

Catch-all forwards every other `@reely.space` address to the same inbox. That is
a deliberate trade: nothing addressed to the domain is lost, at the cost of every
dictionary-attack spam run landing in a personal mailbox. Flip it back to `drop`
via `PUT /zones/{id}/email/routing/rules/catch_all` if that turns noisy.

## Mistakes

**Trusted "I enabled it in the dashboard".** The zone reported
`enabled: false, status: "unconfigured"` — the wizard had been opened, not
completed, and it was blocked on a conflict it could not resolve itself. Reading
`GET /zones/{id}/email/routing` first cost one call and reframed the whole task.
Assume a dashboard step is half-done until the API says otherwise.

**Nearly let the wizard publish a second SPF record.** Its "records to add" list
includes `v=spf1 include:_spf.mx.cloudflare.net ~all`, and the zone already had
`v=spf1 include:spf.efwd.registrar-servers.com -all`. Two SPF TXT records on one
name is a permerror, not a merge — the whole domain's SPF fails open. The fix is
to edit the existing record's `include:` in place _before_ running the wizard,
never to accept its record alongside yours.

**The wizard silently reset `-all` to `~all` anyway.** Even with a single merged
record, enabling routing rewrote the qualifier — caught only because the public
DoH lookup disagreed with what had just been written through the API. Two
takeaways: check the authoritative record after any Email Routing change, and
`pnpm dns:harden` is the thing that puts the hard-fail back (its SPF branch only
touches the trailing qualifier, so it composes with whatever `include:` Email
Routing wants).

**Assumed one broken permission meant all of Email Routing was unreachable.**
`/email/routing/rules` returned `Authentication error`, so the plan became "ask
the user to widen the token". But `POST /email/routing/enable` succeeded on the
same token — enable rides on zone settings, while rules and addresses are their
own scopes (Zone → Email Routing Rules, Account → Email Routing Addresses). Half
the work was scriptable immediately. Probe each endpoint rather than
generalising from the first 403.

**Drifted into answering in French for two turns.** Nothing in the user's input
prompted it. Unrelated to the domain work, recorded because it wasted three
exchanges of an operator's time mid-task.

## What worked

- **`GET /zones/{id}/email/routing/dns` is the source of truth for what to
  create.** It returns Cloudflare's exact desired record set (MX priorities,
  DKIM key, SPF), so the records can be created through the DNS API and the
  wizard has nothing left to do. No hand-copying from the dashboard.
- **Deleting the conflicting MX records after printing them.** The five
  `eforward*.registrar-servers.com` records were dumped to the log before the
  `DELETE` calls, so the previous state was restorable from the transcript.
- **Verifying through public DNS (`cloudflare-dns.com/dns-query`), not only the
  API.** That is the only reason the `~all` regression was caught.
- Destination-address verification genuinely cannot be automated — it is a click
  in an email. Everything else can.

## What could not be tested from here

Delivery itself. The plan was an SMTP `RCPT TO` probe against
`route1.mx.cloudflare.net:25` — a recipient-accept check that never sends a
message — but outbound port 25 is blocked on this connection (connect timeout),
as it is on most consumer ISPs. Cloudflare exposes no "send test message"
endpoint either. So config is confirmed (routing `ready`, both rules `on`,
destination verified, MX + SPF resolving on a public resolver, MX hosts resolving
to `162.159.205.0/24`) but **the first real message is the only proof of
delivery** — and Yahoo is aggressive with forwarded mail, so check spam before
concluding the rule is wrong.

## Rules

- Read `GET /email/routing` before believing the dashboard was configured; check
  `status`, not just presence of the object.
- **One SPF TXT record per name, ever.** Merge `include:` mechanisms into the
  existing record; never publish the wizard's SPF next to yours.
- Re-run `pnpm dns:harden` after any Email Routing change — the wizard resets the
  SPF qualifier to `~all`.
- Verify mail DNS against a public resolver, not only the Cloudflare API.
- Email Routing spans three permission scopes (zone settings for enable, Zone →
  Email Routing Rules, Account → Email Routing Addresses). One `Authentication
error` does not mean the whole feature is out of reach.
- Receiving mail does not soften SPF/DKIM/DMARC. Those govern who may send _as_
  the domain; Email Routing forwards under its own envelope sender (SRS), so
  `p=reject` and `-all` stay correct. See `scripts/cf-dns-hardening.mjs`.
