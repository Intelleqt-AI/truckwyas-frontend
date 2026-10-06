# TruckWys backend review: consolidated findings and fix order

Scope: API, pricing engine, fuel price automation and AI, reviewed read-only against `truckwys-backend` main @ 45039ee (28 Sep 2026). Builds on the September audit (`docs/audit/BACKEND-AUDIT-2026-09-23.md`, 50 issues) without repeating it. Nothing was changed. Full reports: `01-API.md`, `02-PRICING.md`, `03-FUEL.md`, `04-AI.md` in this folder.

## The one-paragraph verdict

The engineering foundations are better than the product's numbers. SANRAL mainline tolls match the official 2026 tariffs exactly, auth is secure by default, and the win-probability model's training pipeline is well designed. But the numbers a fleet owner sees are not yet trustworthy: quotes use a stale hand-set diesel price and have no real cost model, several screens show invented figures, the same KPI gives different answers on different endpoints, and much of what is labelled "AI" is fixed rules, some of it contradicting what the website promises. None of this is hard to fix; most of the first wave is small.

## What matters most, commercially

1. **Quotes are under-priced on fuel.** The quote builder uses a hand-set company diesel price (R23.50 on every dev company) instead of the live price (R29.11). About R3,140 under on a 1,400 km load. The saved snapshot records the live price, so no alert can catch the gap. (Pricing C2, Fuel verdict)
2. **There is no cost model.** Price = base rate per km (unsourced defaults R8.50 to R35) + fuel + tolls + a driver allowance defaulting to R0. No wages, finance, insurance, maintenance, empty return or waiting time. Four screens define cost and margin four different ways; Revenue Guard counts only fuel and tolls, so it always says safe. (Pricing C1, C3)
3. **Invented numbers reach users.** Fleet Overview falls back to hard-coded figures ("+11.8% improvement" with revenue at R0); a rule curve shows a 98% win chance for any R5,000 load and is saved on every quote with a hard-coded "MEDIUM" confidence; dashboard signals claim "2 to 3% fee, cash in 4 hours" for an unlaunched product. (API C1, AI 2, Sept audit)
4. **Privacy and promises.** The website says models never learn from other fleets; the fallback model and lane benchmark pool tenants' data. The Copilot sends every driver's licence number and accident history to a US AI provider on each message. (AI 1, 10)
5. **The fuel feed is fragile.** One failed nightly fetch overwrites a good price with a fake table; wrong grade (500ppm stored as 50ppm); wrong effective dates; admin overrides last under a day. (Fuel F2, F5, F7)

## Recommended fix order

Each wave is independently shippable as small PRs with regression tests. Effort is engineering time for one experienced developer; estimates, not commitments.

### Wave 0: stop showing wrong numbers (about 1 week)
- Quotes use the live dated diesel price, and the snapshot records the price actually used. (Pricing C2, Fuel F8)
- Remove invented figures: Fleet Overview fallbacks, dashboard FastPay/idle-truck claims, the rule-based win % and hard-coded "MEDIUM" (null it and show "not enough history"). (API C1, AI 2)
- Stop fuel overwrites on failure; fix grade and effective dates; make the three fuel tests offline. (Fuel phase 0)
- Fix silently ignored filters on invoices, payments and expenses; honour `page_size`. (API C3, C4)
- Fix the broken API docs endpoint (`/api/schema/` 500s). (API C2)
- Fix toll class mapping by axles, stop VAT on VAT for tolls. (Pricing H2, H4)
- Website copy: correct the "never pooled" and "40 of your loads" claims until the behaviour matches. (AI 1)

### Wave 1: the September security and ledger backlog (about 2 to 3 weeks)
Tenant isolation, payment ledger integrity and copilot send guards from the September audit, in that order. These are release-critical and already specified with packet references.

### Wave 2: a real cost model and one definition of margin (about 3 to 4 weeks)
Fleet-configured time-and-distance costing (wages, finance, insurance, maintenance, tyres, overheads, empty return, waiting), one shared cost and margin function used by the quote screen, Revenue Guard, the optimiser and reports, full input snapshots so every quote can be reproduced, and toll tariff versioning. (Pricing target spec)

### Wave 3: trustworthy data platform (about 2 to 3 weeks)
API contract standard (money as 2-dp strings, one error shape, pagination everywhere, single KPI definitions), N+1 fixes, one cached Overview endpoint, a throttle policy real users cannot hit, token expiry, Sentry and health checks. (API phases 1 and 2)

### Wave 4: honest, measurable AI (about 3 to 4 weeks)
One LLM gateway with timeouts, cost logging and a per-tenant off switch; POPIA data minimisation; untrusted-text framing in prompts; fix train/serve skew, leakage and calibration before the win model ever trains; extraction evals in CI; rename rule-based "AI" labels. (AI phases 1 to 3)

### Later: partner platform
Scoped partner keys or OAuth, idempotency keys, a signed webhook outbox, and a partner API with its own docs and sandbox. Prerequisite for the TMS partnerships in the strategy doc. (API phase 3)

## Decisions needed from the owner

1. Approve Wave 0 to start (all small, all reduce wrong numbers users see today).
2. Pooled learning across fleets: keep it (and change the website and add consent) or remove it (and keep the promise).
3. Cost model inputs: which costs each fleet configures versus sensible sourced defaults.
4. Whether Copilot may send driver personal data to the AI provider at all.
