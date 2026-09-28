# TruckWys product review: what to build next

Consolidated from three product reviews (money, operations, platform) and four backend reviews (API, pricing, fuel, AI), all read-only against the design-v2 branch and backend main, 28 September 2026. Full detail: `01-MONEY.md`, `02-OPERATIONS.md`, `03-PLATFORM.md` in this folder, and the backend reviews in `backend/`.

## The verdict

Design v2 fixed how TruckWys looks. It did not fix what TruckWys says. Three problems sit underneath every screen:

1. **The same number has different values on different screens.** "What customers owe me" is R 499 530 (correct), R 627 151 (counts unsent invoices) or R 446 733 (first 20 invoices only), depending on the page. Overview alone gives four different counts of loads on the road.
2. **Screens repeat instead of deciding.** The receivables list appears six times. Insights is mostly the same lists with an intelligence label. Of 87 operations panels: 26 keep, 18 merge, 18 remove, 25 rebuild.
3. **Structure follows the database, not the job.** Navigation is Bookings, Fleet, Customers, Finance, Capital, Insights, Insurance, Copilot. The job is: price a load, get paid, know your numbers.

Meanwhile, the owner's own data already holds findings no screen shows (R 127 621 never billed, a key customer who stopped paying, R 327 137 never chased, a reported 14.1% margin that is really a R 61 474 loss once pending costs count). That gap is the product opportunity.

## Urgent, independent of everything else

- **PR #116: shared driver password in a public repo.** Merge now, then reset existing driver accounts on production (steps in the PR).
- **Customers cannot pay by EFT.** Invoices say banking details are "available on invoice" but the company record has no bank fields. Small backend change.

## The four jobs (the rule that ends the repetition)

| Surface | Its one job | Must never |
|---|---|---|
| **Today** (was Overview) | What needs me today, in under 10 seconds | Hold reports or charts that live elsewhere |
| **Insights** | What to change, what it is worth, then proof it worked | Show a list of records |
| **Reports** | Exactly what happened, reconciled, accountant-ready | Make recommendations |
| **Ask TruckWys** (was Copilot) | Answers any question by citing a report or insight | Compute its own numbers |

## Navigation

Today · Quote · Get paid · Numbers · Customers · Fleet. Fast Pay and Insurance move to a "Coming soon" group. Copilot becomes a panel on every page (⌘K), not a destination. On phones: five fixed tabs plus More (the current scrolling tab bar hides Insights, Copilot and Settings off-screen and must be replaced).

## The new Insights: a ranked feed of findings

Each card: one finding, the rand amount, one action, and a later check that the action worked. From the owner's current data, the first cards would be:

1. **R 127 621 never billed.** 4 invoices from June were created but never sent. Action: review and send.
2. **Coca-Cola stopped paying.** Paid twice on time, then R 117 544 went 86 to 127 days late with an older invoice skipped (typical of a dispute or missing POD). Action: call about the skipped invoice.
3. **R 327 137 never chased.** 10 customers, average 105 days past due, zero reminders sent. Action: send statements.
4. **Your margin is a loss once pending costs count.** 14.1% reported, R 61 474 loss with 11 unapproved costs (R 87 129). Action: approve or reject costs.
5. **Quotes are short on diesel.** Priced at R 21 to R 24.50 against R 29.11; about R 3 150 under per 1 500 km quote. Action: update the diesel basis (backend fix).
6. **R 70 010 has no proof of delivery.** Action: upload PODs so the invoices can be collected.

24 insight types are specified; 16 run on data TruckWys already holds.

## Build order

| Wave | What | Where the work is | Rough time |
|---|---|---|---|
| **0 Now** | #116 driver password; bank details on invoices; one definition for "owed", "loads on the road" and margin; remove remaining invented numbers and fake "AI"/confidence labels; phone navigation (5 tabs + More) | Mostly frontend, bank details and definitions need backend | 1 to 2 weeks |
| **1 Trust the numbers** | Backend Wave 0 and the September security/ledger backlog: live diesel in quotes, fuel pipeline fixes, ignored filters and 20-row lists, tenant isolation, payment ledger | Backend | 3 to 4 weeks |
| **2 Structure** | New navigation, Today page, onboarding that asks for fuel zone, VAT, bank, terms and truck costs, Settings restructure, Reports library v1 | Frontend with small backend | 3 weeks |
| **3 Insights engine** | Server-side insight engine and the first 8 insight types, inline insights at the point of decision (for example a warning on a quote to a slow payer), outcome tracking | Backend and frontend | 4 to 6 weeks |
| **4 Real cost model** | Per-truck cost profile, one margin definition everywhere, the "Is your price enough?" quote panel, truck and customer economics | Backend and frontend | 4 weeks |
| **5 Ask TruckWys** | Copilot as a ⌘K panel with sources and report/pricing tools, prompt-injection protection, POPIA data minimisation | Backend and frontend | 3 to 4 weeks |
| **Later** | Fast Pay launch (with a partner), TMS partner platform and integrations | Both | — |

Times are estimates for one experienced developer per wave.

## Decisions needed

1. **Approve the direction:** the four jobs, the new navigation, and Insights as a findings feed.
2. **Approve Wave 0** to start now.
3. **Signup:** keep card-before-value, or offer a trial or a number of free quotes first (the code already supports a trial status; biggest lever on time to first value).
4. **Learning across fleets:** keep it (update the website, add consent) or remove it (keep the promise).
5. **Driver data and AI:** may Copilot send driver personal data to the AI provider at all?
6. **Cost model inputs:** which costs each fleet sets itself versus sourced defaults.
