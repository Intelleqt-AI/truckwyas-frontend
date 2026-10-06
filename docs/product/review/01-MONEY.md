# 01 · Money side product review: Overview, Insights, Finance, Fast Pay, Customer risk

Read-only review of TruckWys at `localhost:3815`, branch `truckwys/design-v2` (74ff1e9), 28 Sep 2026. Evidence: every page captured in light mode at 1440px (`big-review/shots/money/*.png` with the page text beside each as `.txt`), the frontend source for each page, the backend models and services under `truckwys-backend/core`, read-only SQL on the dev database (`db.sqlite3`, opened `mode=ro`) to get the owner's real figures, the strategy spec (`origin/truckwys/insights-reports-strategy`), and the backend review (`backend-review/00-SUMMARY.md`, `04-AI.md`). Nothing was changed.

Dev-data caveat: `admin@truckwys.co.za` is a superuser, so list pages also show a few rows from other tenants (28 loads on screen, 21 belong to company 1; 34 invoices, 31 belong to company 1). All insight figures below use company 1 only.

---

## 1. The verdict in one paragraph

The owner is right. Today's Insights is a reporting product that calls itself intelligence. Across Overview, Insights, Invoices, Reports and Fast Pay the same receivables list is rendered **six times**, with **three different totals** for "what customers owe me" (R 499 530,27, R 627 151,52 and R 446 732,75), and the "Needs attention" block is one alert per overdue invoice because the backend rule (`IntelligenceService._check_overdue_invoices`) literally emits one alert per invoice. Nothing on these pages tells the owner something he did not already know from his invoice list, and almost nothing ends in an action with a rand value that TruckWys then verifies. Meanwhile the dev data holds genuinely valuable findings that no screen surfaces: **R 127 621,25 of invoices were created in June and never sent**, **Coca-Cola Beverages SA paid two invoices on time and then stopped paying, skipping one invoice**, **not one reminder has ever been sent on R 499 530,27 of overdue debt**, **R 87 129,00 of unapproved costs make the 14.1% margin a loss**, and **every long-haul quote is priced about R 3 150 light on diesel**. The redesign is: one ranked feed of findings like these (Insights), one "what needs me today" page that is mostly that feed's top five (Overview), and one library of reconciled reports that makes Xero unnecessary for answers (Reports). Every number is defined once.

---

## 2. What is broken underneath (fix before any redesign ships)

These are why a user cannot trust the money pages today. Each is verified on dev data.

| # | Problem | Evidence | Consequence |
|---|---|---|---|
| B1 | "Owed to you" has three values | Overview and Receivables report and Fast Pay: R 499 530,27 (18 invoices, statuses SENT/OVERDUE/PARTIALLY_PAID). Insights briefing and Invoices page: R 627 151,52 (22 invoices). Insights Cash flow: R 446 732,75 ("20 of your 34 invoices, drafts included"). | Owner cannot know which is true. The R 627k figure counts **4 unsent drafts (R 127 621,25) as overdue**, because it filters on due date and not-paid, not on sent. |
| B2 | Client-side truncation | Insights, Invoices and Expenses compute totals and charts from the first 20 rows (`page_size` is ignored by the API, API review C4). Expenses shows "Waiting for approval R 13 873,75, 4 expenses"; the real figure is **R 87 129,00 across 11**. | Every "where does the money go" chart and every pending total is wrong. |
| B3 | Margin is VAT-mixed and excludes pending | "Net margin, all time 14.1%" = paid invoices **incl VAT** (R 182 052,68) less approved costs (R 156 397,75). 11 pending costs (R 87 129,00) are ignored. With them the all-time result is **a loss of R 61 474,07**. | The headline profitability number on Overview and Reports is not a real margin. |
| B4 | Zero cost coverage | 0 trips in the database; 0 of 39 approved expenses linked to a trip or load; 15 have no vehicle. 0 of 12 delivered loads have any actual cost. | Every lane, customer and truck margin shown today is modelled from hard-coded defaults (Reports Lanes shows margins up to 85.4%). |
| B5 | Stale diesel in every quote | Company setting R 23,50/L; open quotes snapshotted at R 21,18 and R 24,50 (the latter is the `FALLBACK` fake table row). Official inland 50ppm since 1 Sep: **R 29,11** (FIASA row in `fuel_prices`). | About R 3 150 under-recovered per 1 500 km quote (section 5, card 5). |
| B6 | DSO has four answers | Invoices: "31.9 days". Overview and Fast Pay: "not measurable, no invoices in 90 days". Customer risk: per customer "42 days". Insights KPI: hidden. | Different formulas and windows per endpoint (Wave 3 metric registry). |
| B7 | "Needs attention" is a per-invoice rule | `services/intelligence.py:211` emits `OVERDUE_ALERT` per invoice; `_check_cash_flow` uses `expected_out = 0` and a fixed R 50 000 threshold; recommendations are not company-scoped (audit #1). | The list the owner complained about is the backend's design, not a UI choice. The fix is a new insight engine, not a restyle. |
| B8 | Fast Pay shows invented facts | Advance #21 shows "Approved", fee 5.0% while the same page says the tier range is 3.5% to 4.5%, net payout R 11 556,81 on a R 19 261,35 invoice. Risk scores page: 7 pillars that are about 25% hard-coded assumptions (AI review F6), all expired. | Violates "no fake data" for a product that is not live. |

---

## 3. Verdict tables, page by page

Legend for "Action?": **Yes (R)** ends in an action with a rand value; **Yes** ends in an action without rand; **No** is a read-only display.

### 3.1 Overview (`/`)

| Panel | Question it answers | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| Quick actions (Add expense, View reports, Create invoice) | "Let me do the common thing" | Section headers | Yes | KEEP | Cheap, useful. Replace "View reports" with "Send drafts (4)" when drafts exist. |
| KPI: Revenue received to date R 182 052,68 | How much cash came in, ever? | Reports P&L tile "Revenue received, all time"; Reports Customers total | No | REBUILD | "All time" is not a weekly question. Becomes "Cash collected this month vs last month" linking to R9. |
| KPI: Net margin, all time 14.1% | Am I profitable? | Reports P&L "Net profit, all time"; Insights Margin engine | No | REBUILD | Wrong basis (B3). Becomes "Operating margin, last month, excl VAT" and only renders when cost coverage is at least 50%; otherwise says why and links to fix. |
| KPI: Owed to you R 499 530,27, 100% past due | Who owes me? | Insights briefing (R 627k), Invoices (R 627k), Insights Cash flow (R 446k), Reports Receivables, Fast Pay | No | KEEP, fix | The one KPI that matters weekly. One registry definition, link to R8. Show "R 317 560 over 90 days" as the sub-line. |
| KPI: Active loads 8, 0 booked in 28 days | What is on the road? | Bookings list, Fleet | No | REMOVE | Operations question; TMS territory. Load count is not money. |
| Chart: Did revenue cover costs each month? | Was each month profitable? | Reports P&L chart (same question, same data); Insights "Where did the last six months leave you?" | No | REMOVE | Third copy of the same series. Lives in R1 only. |
| How far do your quotes get? (funnel + latest five) | Do my quotes convert? | Bookings > Quotes list | No | MERGE into R7 Win/loss | Real monthly question, wrong home. Overview keeps one queue item: "2 sent quotes waiting for a reply". |
| Latest bookings | What happened to my last loads? | Bookings list | No | REMOVE | Pure list, TMS territory. |
| Is the fleet working? (28-day grid) | Are trucks earning? | Fleet heatmap, Fleet overview | No | REMOVE | Utilisation becomes insight C4 (trucks standing, with the rand cost from the cost profile) and a column in R5. |
| What needs your attention | What should I do? | Insights briefing "Needs attention" (same overdue invoices) | Partly | REBUILD | Reporting dressed as insight: three single-invoice "Chase now" rows plus "4 loads in transit, all tracking normally", which needs nobody's attention. Becomes the action queue: the top five open insights by rand. |
| What changed recently | What happened in the app? | Notifications, audit log | No | REMOVE | "New quote created 76d ago" five times. Audit trail, not a decision. |

### 3.2 Insights (`/insights`, tabs held in component state; the `?tab=` URL does not select a tab)

Page chrome:

| Panel | Question | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| Period filter (This month to Custom) | "Show me a period" | Reports | No | REMOVE | Findings are about now. Periods belong to reports. With "This month" selected the briefing says nothing happened. |
| Five tabs (Briefing, Margin engine, Cash flow, Fleet, Lanes) | Five dashboards | Reports tabs one-for-one | No | REBUILD | Becomes two tabs: **For you** (feed) and **Value delivered**. |

Briefing tab:

| Panel | Question | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| "What happened this period, and what needs you": This period box | What happened? | Reports P&L | No | REBUILD | Says "No invoices issued, loads delivered or quotes in this period. Collected R 0,00". Becomes the "This week" strip: a paraphrase of the top three open insights, numbers taken from the insight records. |
| Receivables as of today: Outstanding R 627 151,52 / Overdue R 627 151,52 (red) | Who owes me? | Overview, Invoices, Reports, Fast Pay | No | REMOVE | Wrong number (B1), shown twice in one box. |
| Needs attention: "6 overdue invoices" list | Which invoices are overdue? | Invoices (Overdue filter), Reports Receivables, Insights Cash flow | Link only | REMOVE | **The owner's exact complaint.** Six invoice numbers with days overdue. No grouping by customer, no cause, no reminder history, no one action. It is the aging report's bottom rows. |
| Full summary (collapsed narrative) | Tell me in words | Nowhere | No | MERGE into "This week" | LLM or deterministic text over KPIs, not over findings. |
| "Is revenue growing, and how fast do customers pay" KPI pair | Is revenue up? DSO? | Overview KPI, Invoices DSO | No | MERGE into Overview KPI and R9 | Hidden on dev (no prior-period revenue). |
| What else needs attention: "14 overdue invoices", R 374 909,27 | More overdue invoices | Same as above | Link only | REMOVE | Continuation of the same list. Together these two blocks are 20 invoice rows. |

Margin engine tab:

| Panel | Question | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| Did the business make money in this period (waterfall) | Profit this period? | Reports P&L tiles, Overview margin | No | REMOVE | R1 owns it. |
| Where did the last six months leave you? (cumulative) | Am I ahead over six months? | Overview chart, Reports P&L chart | No | REMOVE | Third rendering of one series. |
| Where does the money go (20 of 50 expenses, pending included) | Cost mix | Expenses page panel, identical text and numbers | No | REMOVE | Truncated (B2) and duplicated. R14 owns it. The one real question here ("which cost is growing faster than revenue") becomes an insight only when there is a trend. |

Cash flow tab:

| Panel | Question | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| Will you run short of cash in the next 8 weeks? | Can I pay Friday's diesel and wages? | Reports Cash flow (13 weeks, different outflow assumption: "nothing forecast going out") | No | REBUILD | Starts at zero, not at the bank balance, so it cannot answer its own title. Two pages forecast the same R 542 140,27 inflow with contradictory outflows. Becomes insight P4 (fires only when a gap exists) plus R10. |
| How much falls due in the next 90 days | What is coming in? | R8 | No | REMOVE | Empty on dev; a column in R8/R10. |
| Where is your cash stuck, and with whom? (buckets + by customer) | Who owes me and how late? | Reports Receivables, Fast Pay, Overview | No | REMOVE | Third number (R 446 732,75, drafts included). R8 owns it. |
| Which customers pay late? (dot plot) | Who pays late? | Customer risk page (per customer) | No | MERGE | Good chart, wrong home. Moves into R4/R9; the finding (a customer getting slower) becomes insight P1. |

Fleet tab:

| Panel | Question | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| Is the fleet ready to work (availability, health score 65, cost/km R 10,97) | Is the fleet OK? | Fleet overview, Vehicles | No | REMOVE | "Health score" is a weighted rule (AI review #11), and cost/km averages zeros for vehicles without data. Fleet module. |
| Which vehicles earn the most (revenue per plate) | Which truck carries me? | Vehicle financial profile | No | MERGE into R5 Truck P&L | Revenue without cost or trips is half a question. |
| Which drivers bring in the most revenue | Driver ranking | Driver profile | No | REMOVE | No driver has 3 trips; and driver revenue is not a money decision the owner acts on. |
| Which vehicles need a service check | Maintenance | Fleet | No | REMOVE | Maintenance scheduling is TMS/telematics territory. Cost outliers become insight C1. |

Lanes tab:

| Panel | Question | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| Which lanes are worth running? (R/km vs km scatter, revenue only) | Which lanes pay? | Reports Lanes (with modelled cost) | No | MERGE into R3 | Two lane views with different metrics; neither uses actual cost. |
| Which cargo pays the most per trip ("first two words of the cargo description") | Cargo mix | None | No | REMOVE | Not a decision anyone makes from this. |
| How much work is in the pipeline | Loads by stage | Bookings | No | REMOVE | TMS territory. The money part (delivered, not invoiced) becomes insight M2. |
| Do heavier loads pay more per trip | Weight vs price | None | No | REMOVE | Curiosity. At most a column in R7. |

### 3.3 Finance: Invoices (`/finance/invoices`)

| Panel | Question | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| "Nothing invoiced in September yet, 4 drafts are ready to send" + Review drafts | Have I billed? | None | Yes | KEEP, sharpen | This is actually the best insight in the product and it is buried as a banner. Say the value and age: "4 drafts worth R 127 621,25 have waited since June". |
| Overdue balance R 627 151,52, 22 invoices | How much is late? | Overview, Insights, Reports, Fast Pay | No | REBUILD | Wrong (includes drafts, B1). Use registry `debtors.overdue`, link to R8. |
| Average time to get paid 31.9 days | How fast do they pay? | Overview (says "not measurable"), Customer risk | No | KEEP, fix | Single DSO definition. |
| Status filters + list ("20 most recent of 34; filters apply to these") | Find an invoice | None | Yes | KEEP, fix | A list page is right here. Server-side filters and pagination (API C3, C4). |
| Row Fast Pay risk tier chip | Can I advance this? | Fast Pay | No | REMOVE until live | Replace with the customer's usual days to pay, which helps collections today. |

### 3.4 Finance: Invoice detail (`/finance/invoices/:id`)

| Panel | Question | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| Header: total, status, Download PDF, Send, Send reminder, Record payment | What is this and what can I do? | None | Yes | KEEP | Right actions. |
| What is being charged / How is the total made up | Is it correct? | PDF | No | KEEP | Add a check against the load and accepted quote (insight M3, "billed less than agreed"). |
| What has been paid / Record a payment | Did they pay? | None | Yes | KEEP | |
| Where is this invoice at? (created, sent, reminders) | Where is it stuck? | None | No | KEEP, extend | Add "Expected payment: 12 Oct, based on this customer's last 5 payments" and the reminder log. |
| Fast Pay (coming soon) | Can I get paid early? | Fast Pay | No | REMOVE until live | |
| Missing | What did this load make? | Nowhere | | ADD | Link to the load ledger row (quoted vs actual cost, margin, coverage). |

### 3.5 Finance: Expenses (`/finance/expenses`)

| Panel | Question | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| "No expenses recorded in September" banner | Am I capturing costs? | None | Yes | KEEP | Good data-completeness nudge. |
| Waiting for approval R 13 873,75 (4 in the loaded list) | What is unapproved? | None | Yes | REBUILD | Real figure R 87 129,00 across 11 (B2). This is the single biggest distortion of margin in the product. |
| Filters + list | Find and approve | None | Yes | KEEP | Add an "Attach to load" column and a bulk "match to loads by vehicle and date" suggestion (24 of 39 approved expenses have a vehicle). |
| How has spending moved over six months? | Cost trend | Insights margin | No | MERGE into R14 | All statuses, truncated. |
| Where does the money go? | Cost mix | Insights margin (identical) | No | MERGE into R14 | Duplicate. |

### 3.6 Finance: Reports (`/finance/reports`)

| Tab / panel | Question | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| P&L: three tiles, all time (revenue received, approved expenses, net profit 14.1%) | Did I make money? | Overview KPIs | No | REBUILD as R1 | All-time cash-basis VAT-inclusive is not a P&L an accountant recognises. Month columns, excl VAT, accrual with a cash toggle, compare to prior. |
| P&L: Did money in cover costs each month? | Monthly result | Overview, Insights | No | REBUILD inside R1 | One home. |
| Cash flow: 13-week forecast, "Nothing is forecast going out" | Will I run short? | Insights Cash flow (8 weeks, different outflows) | No | REBUILD as R10 | With no outflows and no opening balance it is a receivables schedule. Needs cost profile and opening balance. |
| Cash flow: Which weeks have money moving? | Weekly detail | Same | No | MERGE into R10 | |
| Receivables: aging buckets, R 499 530,27 | How late is the money? | Overview, Insights, Invoices, Fast Pay | No | KEEP as R8 | The correct owner of this number. Add as-at date, reminder count, last contact, promised date, per-invoice drill, statement send. |
| Receivables: Who owes you the most? | Biggest debtors | Fast Pay, Insights | Link | KEEP inside R8 | |
| Customers: Which customers paid you the most this year? | Who are my best customers? | Overview (none), Customer detail | No | REBUILD as R4 | Revenue alone is what Xero already shows. Add margin, days to pay, cost of money, share of revenue. |
| Lanes: Which lanes make you money? (modelled margin) | Which lanes pay? | Insights Lanes | No | REBUILD as R3 | Modelled costs from hard-coded defaults (B4). Durban to Pietermaritzburg at 85.4% is not believable. Rebuild on the load ledger, print coverage. |
| Fast Pay: "not live yet" + waiting-on summary | What will Fast Pay do? | Fast Pay page | No | REMOVE tab | Appears only once a facility exists (R13). |
| Missing | Per-load economics, truck P&L, quote accuracy, VAT, registers, management pack | | | ADD | See section 7. |

### 3.7 Fast Pay (`/capital`, `/capital/request`, `/capital/advances/:id`, `/capital/risk-scores`)

| Panel | Question | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| Capital: How much cash is waiting on your customers (R 499 530,27, buckets, by customer) | Who owes me? | Fourth copy (Overview, Reports, Insights, Invoices) | No | REMOVE | Replace with one line and a link to R8. |
| Capital: What would stop your invoices qualifying (no POD 4 of 4, older than 90 days 4 of 4) | Why can't I get paid early? | None | Yes | KEEP | Unique and useful even before launch: "attach POD" is a real action that also speeds normal payment. Feed it as a Get-paid insight. |
| Capital: How Fast Pay will work (3 steps) + disabled Request | What is this? | Reports Fast Pay tab | No | KEEP | Correct pre-launch pattern. |
| Request advance (0 eligible, disabled) | Can I request? | | No | KEEP (disabled) or hide route | |
| Advance detail #21: "Approved", fee 5.0%, tier range 3.5% to 4.5%, net payout R 11 556,81, risk score 48 | What did I get? | | No | REMOVE from UI until live | Seeded record presented as a real approval; internally contradictory fee. Violates "no fake data". |
| Risk scores: tiers, 7 pillars, customer table (all expired) | How safe is each debtor? | Customer risk | No | REMOVE from customer UI | Underwriting rules with about 25% hard-coded assumptions (AI review F6). Keep internal for the lender console. |

### 3.8 Customer risk (`/customers/:id/risk`)

| Panel | Question | Repeated where | Action? | Verdict | Reason |
|---|---|---|---|---|---|
| Late-payment risk 77% "Critical" (Coca-Cola) | Will this customer pay? | Risk scores page | No | REBUILD | A fixed formula labelled as a risk probability (AI review #5). Rename "Payment behaviour", show facts not a pseudo-probability. |
| Average time to pay / Paid by due date / Owed 30+ days late | How do they pay? | Insights Cash flow dot plot | No | KEEP, move | Into a "Payment behaviour" section on Customer detail. |
| How late does X pay? (per-invoice chart) | Pattern | Insights dot plot | No | KEEP, move | This is where the real finding hides: Coca-Cola paid 16 and 18 Apr invoices on time but skipped 9 Apr. The chart shows it; nothing says it. |
| Which invoices drive the score? | Detail | Invoices | Link | KEEP, move | |
| Missing | What do I do? | | | ADD | "Send statement", "Log a call and promise date", "Set credit limit" (the `credit_limit` field exists, nothing uses it). |

### 3.9 Panels that are reporting dressed up as insight

1. Insights > Briefing > **Needs attention: 6 overdue invoices** (the owner's example).
2. Insights > Briefing > **What else needs attention: 14 overdue invoices**.
3. Overview > **What needs your attention** (single-invoice "Chase now" rows, "4 loads in transit, all tracking normally", "9 vehicles idle" without a cost).
4. Insights > **Margin engine** (the P&L three times over, called an engine).
5. Insights > Cash flow > **Where is your cash stuck** (the aging report).
6. Insights > Fleet > **Which vehicles need a service check** (a rule-based score threshold).
7. Insights > Lanes > **Which cargo pays the most / Do heavier loads pay more** (descriptive statistics on 20 loads).
8. Fast Pay > **Customer risk scores** ("model" tiers from mostly assumed inputs).
9. Customer risk > **Late-payment risk 77%** (a formula output shown as a probability).

---

## 4. Four surfaces, four jobs

| Surface | One-sentence job | Contains | Never contains |
|---|---|---|---|
| **Overview** | Tell me what needs me today, in under ten seconds. | The top five open insights as an action queue, four KPI tiles each linking to its owning report, and a data-health line when something blocks the numbers. | Charts beyond sparklines, lists of records, activity feeds, operations status. |
| **Insights** | Tell me what to change and what it is worth, then prove it worked. | A ranked feed of persisted findings, each with evidence, a rand value marked measured or estimated, one action and a verification window; a Value delivered ledger. | Totals, tables, period filters, aging buckets, P&L charts. |
| **Reports** | Tell me exactly what happened, in a form my accountant accepts. | A library of period-bound reports with a declared basis, tie-out line, drill-down, export, schedule, monthly pack and "send to accountant". | Recommendations or "you should" copy. |
| **Copilot** | Answer any question or do any task by citing a report or an insight. | Answers that open a report with filters applied or an insight; proposals the user confirms. | Its own numbers. A number Copilot needs that no report defines is a missing report. |

Fast Pay is not a surface of its own until live. Before launch it is one explainer page plus the POD-eligibility check.

Rule that ends duplication: each metric is defined once in a backend registry (`core/metrics/registry.py`, strategy 3.1). Overview and Insights may cite a registry value and link to its report; they never re-render the report's table.

---

## 5. The new Insights home: a ranked feed

### 5.1 Ranking and hygiene rules
- **Rank score** = rand impact x confidence weight (high 1.0, medium 0.6, low 0.3) x urgency (1.5 if the value is lost or grows within 14 days, for example an invoice passing 120 days or a quote about to be accepted at an old price; otherwise 1.0). Ties broken by newest evidence.
- **One card per subject.** A customer appears in at most one card; grouped cards exclude subjects already carried by a higher card. (Coca-Cola is card 2, so card 3 excludes it.)
- **Threshold**: rand impact at least R 1 000 (company setting), minimum sample per type.
- **Low confidence** findings go to a collapsed "Worth checking" group and never reach Overview.
- **Blocking data problems** are not cards; they are a single line above the feed ("Margin findings are limited: 0 of 12 delivered loads have costs attached. Attach costs") that links to R18.
- Every rand figure is labelled **Measured** (exact from records) or **Estimated** (formula shown on click).

### 5.2 The top eight, written as the user would see them (owner's dev data, 28 Sep 2026)

**Card 1 · Get paid · Measured · R 127 621,25**
> **4 invoices were created in June and never sent**
> Bidvest Group (R 32 822,15), Famous Brands (R 42 514,35), RCL Foods (R 28 479,75) and Acme Mining (R 23 805,00) have invoices dated 8 to 16 June that are still drafts. Their due dates have passed, but the customers have never seen them. The oldest is 112 days old.
> Suggested: review and send all four today.
> **[ Review and send 4 invoices ]**   Confidence high · 4 invoices

- Trigger: invoice `status = DRAFT` and `created_at` older than 2 days, or load `DELIVERED` for more than 24 hours with no invoice (strategy M2). Grouped into one card.
- Rand: sum of `total_amount` (incl VAT). Measured.
- Action: bulk review drawer (line items, customer email present, POD attached), then send.
- Verification: `sent_at` set after the insight fired; counted in Value delivered as **leakage stopped** when paid (only for drafts older than 30 days, strategy 6.2) and as cash collected when paid.
- Data: **today**. Backend: stop counting drafts as overdue in every endpoint (B1).

**Card 2 · Get paid · Measured · R 117 543,80 at risk**
> **Coca-Cola Beverages SA stopped paying in May**
> They paid their 16 and 18 April invoices on time, in 41 and 42 days. Since then three invoices worth R 117 543,80 are unpaid, now 86 to 127 days late, and no reminder has been sent. They paid two newer invoices but skipped INV-20260409-1020 (R 32 474,85), which usually means a dispute or a missing proof of delivery.
> Suggested: call their accounts payable, send a statement, and attach the POD for the 9 April invoice.
> **[ Send statement and log call ]**   Confidence high · 5 invoices of history

- Trigger (combines strategy P1 and a new "skipped invoice" rule): customer whose last paid invoices were within terms and who now has an open balance at least 30 days past due, **or** who paid an invoice issued after an older one that is still unpaid. Balance at least R 20 000.
- Rand: open balance, measured. Cost of carrying it is shown as a secondary line only when the fleet has set its overdraft rate.
- Action: sends the customer statement (R11) with the POD attached, and opens a call log with a promise-date field.
- Verification: payment within 14 days; days-to-pay on the next three invoices back to the 42-day baseline. Counted as cash collected after a TruckWys action.
- Data: **today** (`Invoice`, `Payment`, `reminder_count`). Backend: statement endpoint; call/promise log (`ReminderEvent`, strategy R12).

**Card 3 · Get paid · Measured · R 327 137,12 at risk**
> **Nobody has chased R 327 137 owed by 10 customers**
> 13 invoices are on average 105 days past due, 8 of them more than 90 days. Not one reminder has been sent on any of them. Largest: Clover Industries R 93 876,80, Nampak R 49 202,75, SA Steel Mills R 48 670,02.
> Suggested: send a statement to all 10 customers now; TruckWys will follow up on day 7 and day 14.
> **[ Review and send 10 statements ]**   Confidence high · 13 invoices
> Secondary line when an overdraft rate is set: "At the 12% rate you set, carrying this for 105 days has cost about R 11 290." (Example rate; there is no default.)

- Trigger (strategy P2, grouped by customer instead of per invoice): invoices past due more than 7 days with no reminder in the last 7 days and not disputed. Excludes customers carried by higher cards.
- Rand: open balance, measured.
- Action: bulk statement send with a review step (server-composed, idempotent; audit #24 and #25 fixed first). Turns on scheduled dunning for these customers (`run_dunning` is not in Celery beat today, AI review F13).
- Verification: cash received within 14 days of the send, per customer.
- Data: **today**. Backend: schedule dunning, reminder log, statement PDF.

**Card 4 · Know your margin · Measured · R 87 129,00 of costs missing**
> **Your profit figure leaves out R 87 129 of costs**
> 11 expenses are still waiting for approval: 6 fuel (R 31 439,00) and 5 maintenance (R 55 690,00), dated January to June. Your reports show a 14.1% margin because unapproved costs are excluded. With them, the six months are a loss of R 61 474.
> Suggested: approve or reject the 11 expenses so your margins are real.
> **[ Review 11 expenses ]**   Confidence high · 11 expenses

- Trigger: pending expenses older than 7 days whose total exceeds 5% of the period's approved costs.
- Rand: pending total, measured. The consequence line recomputes margin with and without them (same registry function as R1).
- Action: approval queue, pre-filtered.
- Verification: pending count and value for the period reach zero; no rand is claimed in Value delivered (this is accuracy, not money earned).
- Data: **today**. Backend: pending totals from the server, not from a 20-row page (B2).

**Card 5 · Quote better · Estimated · R 6 755 on 2 open quotes, then about R 3 150 per long-haul quote**
> **Diesel is R 29,11, your quotes use R 21,18 to R 24,50**
> The official inland 50ppm price has been R 29,11 per litre since 1 September (source: FIASA/DMPR). Your company fuel setting is R 23,50. Accepted quote QT-20260616-9013 (Johannesburg to Cape Town, not yet on the road) was priced at R 21,18 and under-recovers about R 4 160 on fuel. Sent quote QT-20260713-3182 was priced at R 24,50 and is about R 2 590 short. Every new 1 500 km quote at your current setting is about R 3 150 short.
> Suggested: use the live diesel price for quotes, and add a fuel adjustment to the accepted quote.
> **[ Use live diesel price ]**  Secondary: [ Review 2 quotes ]   Confidence high · litres from your own quote lines

- Trigger (strategy Q1 plus a stale-setting rule): on each official price change, or when the company fuel setting differs from the official zone price by more than 50c/L; for every SENT or ACCEPTED quote not yet delivered, delta = official price − `fuel_price_at_creation`, fire if at least 20c/L.
- Rand: litres x delta, litres taken from the quote's own fuel line (13 781 ÷ 24,50 = 562,5 L for 1 562,5 km, about 36 L/100 km). Estimated, formula on click.
- Action: switch the quote builder to the live dated price (backend Wave 0, Pricing C2), and a pre-filled fuel adjustment line on the affected quotes.
- Verification: accepted fuel adjustments on those quotes (measured, counted as price recovered when paid); company setting now tracks the official price.
- Data: **today** after the Wave 0 fuel fixes (the R 24,50 snapshot is itself the `FALLBACK` fake-table price, Fuel F2).

**Card 6 · Get paid · Measured · R 54 849,35 short-paid**
> **Shoprite and Imperial paid R 100 against invoices of R 55 049**
> Shoprite Holdings paid R 100,00 of R 34 851,90 (INV-20260405-1029) and Imperial Logistics paid R 100,00 of R 20 197,45 (INV-20260510-1028). A token or partial payment usually means a query on the invoice or a payment allocated to the wrong invoice.
> Suggested: ask both for their remittance advice and any query on the invoice.
> **[ Request remittance from 2 customers ]**   Confidence medium · 2 invoices

- Trigger (new type, "short-paid"): payment recorded against an invoice for less than 90% of its total, with no further payment in 14 days and no agreed credit note.
- Rand: unpaid remainder, measured.
- Action: templated remittance request; the dismiss reason "agreed discount" creates a credit note (needs the `CreditNote` model, strategy 4.2).
- Verification: remainder paid or credited within 30 days.
- Data: **today**. Backend: credit notes (needs capture). Note: on dev these R 100 payments look like test entries; in production this pattern is common and worth catching.

**Card 7 · Improve margin · Estimated · Worth checking (low confidence)**
> **Johannesburg to Cape Town may be priced below cost**
> Your one delivered load on this lane made a modelled margin of −6.2% at R 18,36 per km. You have 12 draft quotes on the same lane at R 20,30 to R 22,10 per km, all priced with R 24,50 diesel. There are not enough delivered loads with actual costs to be sure.
> Suggested: attach actual costs to your next three loads on this lane, then TruckWys will tell you the price you need for your 10% target.
> **[ Attach costs to loads ]**   Confidence low · 1 load, 0 with actual costs

- Trigger (strategy Q2): lane with at least 5 delivered loads in 90 days and median margin below `company.margin_target_pct` (10% on dev). Below the minimum it is shown only in "Worth checking", which is what this card demonstrates.
- Rand when it qualifies: (price for target margin − median price) x loads in the last 90 days. Estimated.
- Action once qualified: "Set lane rate" (a lane rate card used as the default in New quote).
- Verification: 90-day median price and margin on the lane after the action.
- Data: **needs backend work** (load ledger, cost profile, expense-to-load linking; coverage is 0 today).

**Card 8 · Get paid · Measured · R 70 010,57 cannot be proven delivered**
> **4 unpaid invoices have no proof of delivery attached**
> R 70 010,57 across 4 sent invoices has no POD on file. Customers who query an invoice ask for the POD first, and it is also what Fast Pay will require.
> Suggested: attach the signed POD to each invoice (or pull it from your TMS).
> **[ Attach PODs ]**   Confidence high · 4 invoices

- Trigger: sent invoice unpaid past due with no `pod_document` on its load and no `pod_uploaded` trip (the same check the Fast Pay page already runs).
- Rand: balance, measured.
- Action: upload per invoice, or a "request POD" webhook to a connected TMS.
- Verification: POD attached, then paid within 30 days.
- Data: **today** (upload); **needs TMS** for automatic POD.

Not in the top eight on dev data, but in the feed as soon as they trigger: trucks standing (C4, needs a cost profile to carry a rand value; today all 20 trucks had no load in 28 days but there is no fixed-cost figure to price it), customer gone quiet (G2, no customer has 6 loads in 180 days on dev), backhaul (G3), billed less than agreed (M3, all 12 load-linked invoices match their load exactly on dev), and the cash-gap card (P4, needs an opening balance).

### 5.3 Catalogue changes versus the strategy
- **Add** "Invoiced but never sent" as an explicit M2 variant (card 1). It is the biggest measured leak in the dev data.
- **Add** "Skipped invoice" to P1 (card 2). A customer paying newer invoices while an older one is open is a stronger dispute signal than slower median days.
- **Add** "Short-paid invoice" (card 6).
- **Add** "Costs awaiting approval distort margin" (card 4), with no Value delivered claim.
- **Add** "No proof of delivery on unpaid invoices" (card 8), reusing the Fast Pay check.
- **Keep** the strategy's other 24 types unchanged.

---

## 6. Wireframes

### 6.1 Insights home, desktop

```
Insights                                                        [ Ask Copilot ]
Findings worth money, each with one next step.
( For you )  ( Value delivered )

This week
4 invoices worth R 127 621 were never sent. Coca-Cola has stopped paying
(R 117 544). Nobody has chased R 327 137 owed by 10 customers. Diesel is
R 29,11 and your quotes use R 24,50.
Updated 06:00 today · from 8 open findings · every number links to its card

8 open findings  ·  Actioned this month 0  ·  Verified this quarter: no verified outcomes yet

Margin findings are limited: 0 of 12 delivered loads have costs attached.  Attach costs >

[ All ] Get paid  Quote better  Improve margin  Cut cost  Grow revenue     Sort: Highest value

+---------------------------------------------------------------------------+
| Get paid                                          R 127 621,25  Measured  |
| 4 invoices were created in June and never sent                            |
| Bidvest, Famous Brands, RCL Foods and Acme Mining. Oldest 112 days.       |
| Confidence high · 4 invoices                [ Review and send 4 invoices ] ⋯|
+---------------------------------------------------------------------------+
| Get paid                                   R 117 543,80 at risk  Measured |
| Coca-Cola Beverages SA stopped paying in May                              |
| Paid in 41 to 42 days until April. 3 invoices now 86 to 127 days late.    |
| Confidence high · 5 invoices          [ Send statement and log call ]   ⋯ |
+---------------------------------------------------------------------------+
| Get paid                                   R 327 137,12 at risk  Measured |
| Nobody has chased R 327 137 owed by 10 customers                          |
| 13 invoices, average 105 days past due. 0 reminders sent.                 |
| Confidence high · 13 invoices          [ Review and send 10 statements ] ⋯|
+---------------------------------------------------------------------------+
| Know your margin                           R 87 129,00 missing  Measured  |
| Your profit figure leaves out R 87 129 of costs                           |
| Confidence high · 11 expenses                     [ Review 11 expenses ] ⋯|
+---------------------------------------------------------------------------+
| Quote better                                     R 6 755,00  Estimated    |
| Diesel is R 29,11, your quotes use R 21,18 to R 24,50                     |
| Confidence high · 2 open quotes                [ Use live diesel price ] ⋯|
+---------------------------------------------------------------------------+
  ... cards 6 and 8 ...

> Worth checking (1)      > In progress (0)     > Verified (0)     > Dismissed (0)
```
Rand values are not summed across cards (cards 3 and 8 can share invoices), so there is no "total open value" headline. The ⋯ menu holds Snooze, Dismiss (with a reason: not relevant, already handled, data wrong, disagree) and Share.

### 6.2 Insights home, phone (390px)

```
Insights
( For you ) ( Value delivered )

This week  [ 4 lines, collapsible ]

Margin findings are limited. Attach costs >

[ All v ]  [ Highest value v ]

+-----------------------------+
| Get paid        Measured    |
| R 127 621,25                |
| 4 invoices were created in  |
| June and never sent         |
| High · 4 invoices           |
| [ Review and send 4 ]  48px |
+-----------------------------+
```

### 6.3 Insight detail (card 2)

```
< Insights
Coca-Cola Beverages SA stopped paying in May
Get paid · Detected 28 Sep 2026 · Open

+--------------------------------------------+ +-------------------------------+
| What we found                              | | At risk                       |
| They paid two invoices on time, then       | | R 117 543,80                  |
| stopped. One older invoice was skipped.    | | Measured: open balance        |
|                                            | | How we calculated this v      |
| Evidence                                   | +-------------------------------+
| Invoice      Issued   Due     Paid   Late  | | Do this                       |
| INV-...1020  9 Apr    24 May  no    +127   | | [ Send statement and log call]|
| INV-...1010  16 Apr   31 May  28 May  -3   | | Statement with POD for        |
| INV-...1016  18 Apr   2 Jun   29 May  -4   | | INV-20260409-1020 attached.   |
| INV-...1013  26 Apr   10 Jun  no    +110   | | You review before it sends.   |
| INV-...1019  20 May   4 Jul   no     +86   | |                               |
|                                            | | Other options                 |
| Baseline: 41 to 42 days to pay (2 paid)    | | Set a credit limit            |
| Reminders sent: 0 · Terms: 45 days         | | Pause new quotes to customer  |
| Source: R8 Debtors age analysis, filtered >| +-------------------------------+
+--------------------------------------------+ | How we will check             |
                                               | Payment within 14 days, and   |
Confidence: high. Rule: 5 invoices of history, | the next 3 invoices paid in   |
all amounts from your records.                 | under 45 days. Counted in     |
                                               | Value delivered when paid.    |
History: detected 28 Sep · seen · ...          +-------------------------------+
```

### 6.4 Overview, desktop

```
Overview                                   Monday 28 Sep 2026   [ Create invoice ]

What needs you today                                              See all 8 >
  Send 4 invoices never sent                       R 127 621,25   [ Review ]
  Call Coca-Cola Beverages SA                      R 117 543,80   [ Open ]
  Chase 10 customers with no reminder              R 327 137,12   [ Review ]
  Approve 11 expenses                              R 87 129,00    [ Review ]
  Update diesel price in quotes                    R 6 755,00     [ Fix ]

+-------------------+-------------------+-------------------+-------------------+
| Cash collected    | Owed to you       | Invoiced, excl VAT| Operating margin  |
| Sep R 0,00        | R 499 530,27      | Sep R 0,00        | Not shown yet     |
| Aug R 0,00        | R 317 560 over 90d| Aug R 0,00        | 0 of 12 loads have|
| > R9 Cash received| > R8 Debtors      | > R1 P&L          | costs. Attach >   |
+-------------------+-------------------+-------------------+-------------------+

Value delivered: no verified outcomes yet. Actions above are tracked once you take them.
```
Nothing else. No charts, no lists of loads or activity.

---

## 7. Finance Reports library

Grouped as Profit, Cash, Cost, Accountant. "Why not Xero" names what Xero or QuickBooks cannot answer, so the owner never needs to open them for understanding (Xero stays the book of record).

| Report | Question | Basis (printed under the title) | Why not Xero | Build priority |
|---|---|---|---|---|
| R1 Management P&L | Did we make money this month, and where did it go? | Revenue by issue date excl VAT less credit notes; approved costs by expense date; pending shown as a separate line; cash-view toggle | Transport lines (fuel, tolls, driver, maintenance) and operating ratio from operational records, with coverage stated | v1 |
| R2 Load ledger | What did each load make versus what we quoted? | One row per load by delivered date; quoted vs actual cost per line; coverage flag | Xero has no load, quote or trip | v1 (needs backend) |
| R3 Lane profitability | Which lanes make money per km and per day? | Delivered date, excl VAT, actual cost where covered | No lane concept | v2 |
| R4 Customer profitability | Which customers to keep, reprice or drop? | Issue date revenue; days to pay by payment date; cost of money | Xero knows revenue by contact, not margin or days-to-pay cost | v1 |
| R5 Truck P&L | Is each truck earning its instalment? | Loads by vehicle, costs by vehicle, cost profile fixed costs; unallocated row | No vehicle dimension without tracking categories | v2 |
| R6 Quote accuracy | Are quotes pricing cost correctly? | Accepted quotes with delivered loads and actual costs | Xero has no quotes-to-cost link | v2 |
| R7 Win/loss and pricing | What are we winning and losing, and why? | Quotes by created date; outcomes; price ratio | Not in accounting | v1 (absorbs the Overview quote funnel) |
| R8 Debtors age analysis | Who owes us, how late, as at a date? | Incl VAT balances, sent invoices only, as-at, by due date or invoice date | Adds reminders, promises, POD status and one-click statements | v1 (exists, fix) |
| R9 Cash received | What came in, from whom, how fast, and after which reminder? | Payment date, incl VAT; one DSO formula | Attribution to reminders | v1 |
| R10 13-week cash forecast | Will I run short? | Opening balance (entered or Xero bank), receipts on each customer's own pay pattern, outflows from cost profile and run rates | Xero's short-term cash flow has no customer-specific pay behaviour or fleet costs | v2 (needs opening balance, cost profile) |
| R11 Customer statement | What does this customer owe, sendable? | Ledger per customer | Available in Xero but not from where the owner works | v1 |
| R12 Collections activity | Are reminders working? | Reminder log, promises, cash within 7 days | Not in accounting | v2 (needs reminder log) |
| R13 Fast Pay statement | Advances, fees, days early | Only for fleets with a signed facility | | Hidden until live |
| R14 Cost analysis | Where does cost go, by category, truck, driver, vendor? | Expense date, approved; pending and rejected listed apart | Vehicle and trip dimensions | v1 (replaces three duplicate charts) |
| R15 Fuel report | Fuel spend per km and per rand revenue; paying fair prices? | Official diesel reference by date and zone | Official price comparison, litres | v2 (litres capture) |
| R16 Tolls and border | Quoted vs paid tolls and fees | Quote lines vs expenses | Not in accounting | v3 |
| R17 Revenue leakage | What was delivered or agreed but not billed? | Delivered not invoiced, drafts not sent, billed below quote | Not in accounting | v1 |
| R18 Data completeness | What stops the numbers being complete? | Loads without costs, expenses without vehicle/receipt, unsynced invoices | | v1 (drives coverage) |
| R19 VAT summary | Output and input VAT per period | Issue date, credit notes, input VAT where captured | Prepares VAT201 from operational records | v2 (needs VAT on expenses) |
| R20 Sales and receipts registers | Do TruckWys and the ledger tie? | Every invoice and payment with Xero sync status | Tie-out to Xero | v1 |

Header actions on the library: **Management pack** (monthly PDF + XLSX, 8 pages, strategy 4.4) and **Send to my accountant** (secure link, period lock, strategy 4.5). These two are what make TruckWys the place the owner and accountant meet.

---

## 8. What "AI" should honestly mean here

The backend AI review found that most "AI" is rules: the customer "AI risk" score is a fixed three-term formula, the vehicle "AI health score" is a weighted average, the win probability shown on quotes is a hand-tuned sigmoid (R 5 000 on any lane scores 98%), the underwriting model is about 25% hard-coded assumptions, and automatic collections are not scheduled. Honest labelling for the money side:

| Thing | Honest label | Where it may say "AI" |
|---|---|---|
| Insight triggers, rand values, rankings, forecasts | "Calculated from your records" (deterministic) | Never |
| "This week" summary on Insights | "Summary written by AI from the findings below" | Yes, with numbers injected from records and a numeric check that rejects any figure not in the input |
| Rate-review letter, reminder and statement wording drafts | "Draft written by AI, review before sending" | Yes |
| Receipt reading (amount, VAT, litres, vendor) and expense categorisation | "Read by AI, check the values" | Yes, with an extraction eval in CI |
| Copilot answers | "AI assistant" that cites the report or insight it used | Yes |
| Win probability, late-payment prediction | Hidden until a model trained on at least 200 (quotes) or 300 (invoice) outcomes passes calibration; then "Predicted by a model trained on N of your outcomes" | Only then |
| Customer payment score, vehicle health score | "Payment behaviour" and "Service status", rules, no percentage presented as a probability | Never |

The product's intelligence claim becomes "TruckWys finds money in your own records and proves it", which is true today, rather than "AI", which mostly is not.

---

## 9. Prioritised build order

**BE** = needs backend work. **FE** = frontend only. Effort is an estimate for one experienced developer.

| # | Step | What changes | Needs | Effort |
|---|---|---|---|---|
| 1 | One definition for "owed", "overdue", DSO and margin | Drafts excluded from overdue everywhere; server totals instead of 20-row client totals; one DSO; margin excl VAT with pending shown apart | **BE** (metric registry, pagination and filter fixes, API C3/C4) + FE | 1 week |
| 2 | Strip duplicates | Remove the Margin engine, Cash flow, Fleet and Lanes tabs; remove the aging copies on Overview, Insights and Fast Pay; remove Latest bookings, activity feed, fleet grid, seeded advance detail and risk-score pages from customer UI | FE | 2 to 3 days |
| 3 | Insight record and engine | `Insight` model with status, evidence, impact (measured/estimated), action, verification; nightly and on-event detection; company-scoped (replaces `IntelligenceService`) | **BE** | 1.5 to 2 weeks |
| 4 | First six insight types on today's data | Cards 1, 2, 3, 4, 6, 8 (never sent, stopped paying/skipped, not chased, pending costs, short-paid, no POD) | **BE** (rules) + FE (feed, detail) | 1.5 weeks |
| 5 | Actions that make the cards work | Bulk send drafts, customer statement PDF, scheduled dunning with reminder log, call and promise log, POD upload from the card | **BE** (statement, `ReminderEvent`, Celery beat) + FE | 1.5 weeks |
| 6 | New Overview | Action queue from insights + four tiles + data-health line | FE (after 1 and 3) | 3 days |
| 7 | Fuel card (card 5) | Live dated diesel in quotes, snapshot the price used, fuel adjustment line | **BE** (Wave 0 fuel and pricing fixes) + FE | 1 week, mostly in Wave 0 |
| 8 | Reports v1 | R1, R4, R7, R8 fix, R9, R11, R14, R17, R18, R20 with basis and tie-out lines | **BE** (report endpoints on the registry) + FE | 3 weeks |
| 9 | Value delivered | Verification jobs, ledger, funnel, Overview line; only measured outcomes in the headline | **BE** + FE | 1.5 weeks |
| 10 | Load ledger and cost profile | Expense-to-load linking (with suggested matches), `CostProfile` per truck, R2, R3, R5, R6 | **BE** (Wave 2 cost model) + FE | 3 to 4 weeks |
| 11 | Margin insights | Q2 lane below floor, M1 customer below floor, Q3 quote missing actual, C4 trucks standing (card 7 graduates from "worth checking") | **BE**, depends on 10 | 1.5 weeks |
| 12 | Cash forecast and cash gap | Opening balance (entered or Xero bank), R10, P4 insight | **BE** + FE | 1.5 weeks |
| 13 | Management pack and send to accountant | PDF/XLSX pack, secure link, period lock | **BE** + FE | 2 weeks |
| 14 | "This week" LLM summary | Paraphrase over insight records with a numeric guard | **BE** (LLM gateway, AI Wave 4) + FE | 1 week |
| 15 | TMS and telematics insights | M4 waiting time, C3 fuel burn, C5 empty running, automatic POD | **Needs TMS / telematics** via the partner API | Later |
| 16 | ML insights | Q5 price sensitivity, P5 likely to pay late, only after data volume and calibration gates | **BE**, volume-gated | Later |

Steps 1, 2 and 4 alone would have changed the owner's experience today: instead of 20 invoice rows he would see six cards, each naming a customer or a cause, a rand value and one button.

---

## Appendix: evidence

- Screenshots and page text: `big-review/shots/money/` (overview, insights-briefing, insights-margin-engine, insights-cash-flow, insights-fleet, insights-lanes, invoices, invoice-detail, expenses, reports-*, capital, capital-request, advance-detail, risk-scores, customer-risk, customer-risk-coke).
- Capture script: `big-review/money-cap.mjs` (GET only, dialogs dismissed).
- SQL used (read-only, company 1): invoice status totals; open balance by customer with days late and reminder count; drafts; paid history; skipped-invoice join; part-paid invoices; quotes with fuel snapshot; pending expenses by category; trips and expense-to-trip coverage.
- Key backend references: `core/services/intelligence.py` (per-invoice overdue rule, `expected_out = 0` cash rule), `core/views.py` `DashboardSignalsView` (hard-coded "R 8 000/day", "2 to 3% fee, cash in 4 hours"), `core/models/company.py` (`margin_target_pct` 10, `fuel_price_per_litre` 23,50), `core/models/customer.py` (`credit_limit` unused), `core/services/collections.py` (`run_dunning` not scheduled).
