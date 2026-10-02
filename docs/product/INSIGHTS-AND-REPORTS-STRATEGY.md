# TruckWys insights and finance reports: product strategy and design specification

Prepared 28 September 2026. Scope: Overview, Insights, Finance reports and Copilot in the TruckWys web app, plus the TMS/telematics partner surface that feeds them.
Evidence base: read-only study of `truckwys-backend` (models, services, views, `core/urls.py`), `truckwyas-frontend` (branch `truckwys/ux-overhaul` and `origin/main`), the backend audit of 23 September 2026, the brand guide v1.0.0, and external research (section 10).

Conventions in this document:
- **Today** means TruckWys holds the data now, at the stated grain. **Needs TMS** means a TMS or booking system must send it. **Needs telematics** means a Cartrack/MiX/Netstar-type feed must send it. **Needs capture** means TruckWys can collect it itself with a small model/UI change.
- **Deterministic** means arithmetic over recorded data. **ML** means a trained statistical model with a held-out evaluation. **LLM** means language generation over already-computed facts. Nothing in this spec is labelled "AI" unless it is ML or LLM, and LLM output never originates a number.
- Where I estimate, I say "estimate" and show the arithmetic. I have not invented market statistics; where no credible SA benchmark exists I say so.

---

## 1. Executive summary

**Positioning.** TruckWys is the money layer for South African road freight. A TMS moves the truck; telematics watches the truck; Xero keeps the books. TruckWys is the only system that joins the quote, the trip cost and the payment for the same load, so it is the only place a fleet owner can see what a load, a lane, a customer or a truck actually made, and act on it the same day. Every screen should reinforce that one idea: *per-load economics, from quote to cash*.

**The split, one sentence each.**
- **Finance reports** answer "what exactly happened?": reconciled, period-bound, exportable statements with a declared date basis, that an accountant can tie back to the ledger. No recommendations.
- **Insights** answer "what should I change, and what is it worth?": individual, rand-quantified findings, each with one action and a tracked outcome. No tables of totals.
- (Supporting) **Overview** answers "what needs me today?" and **Copilot** answers "ask or do anything", using the other two as its sources and never computing its own numbers.

**The rule that stops overlap.** Every number has exactly one home, defined once in a metric registry. Reports own totals and tables. Insights own findings; they may *cite* a report figure as evidence (with a link into the report, pre-filtered) but may not re-render the table. Overview shows at most five metrics, each a link into the report that owns it.

**Five moves that make TruckWys essential.**
1. **Make the numbers trustworthy first.** Fix the audit's tenant leaks on insights and cash flow, the pending-expense contamination, the silent R0 tolls, the zero-outflow cash alert, and three findings of my own (VAT-inclusive cash-basis "revenue", client-side truncation at 100 rows, three conflicting margin formulas). A beautiful insight on a wrong number destroys the product. (Section 9.)
2. **Build the load ledger.** One record per load joining quote → load → trip → costs → invoice → payments, with quoted versus actual per cost line. This single table powers every profitability report and most insights, and no TMS or accounting package has it.
3. **Ship a report library of 18 transport reports and a monthly management pack** with a one-click "send to my accountant", so the owner never opens Xero to understand the business. Xero stays the book of record; TruckWys becomes the book of understanding.
4. **Replace five dashboard tabs with an insight feed that proves its value.** 24 concrete insight types across quote better, improve margin, cut cost, get paid faster and grow revenue, each with trigger logic, rand impact, one action and a verification window. A "Value delivered" ledger counts only verified outcomes, so a line such as "TruckWys paid for itself 3.1 times this quarter" (illustrative) is a measured claim, not marketing.
5. **Become the money API for TMS and telematics vendors.** Offer CtrlFleet, Cartrack and MiX/Powerfleet an embedded quote price, cost-per-trip and get-paid layer with a revenue share, and ingest their trip, odometer, fuel and geofence data to unlock the insights TruckWys cannot compute alone (empty running, fuel burn, detention). Never build dispatch, routing, tracking or rostering.

---

## 2. Jobs to be done, per persona

### 2.1 Owner-operator, 5 trucks (Thabo, Pietermaritzburg, general freight, N3 corridor)
Drives one truck some weeks, does the quoting on WhatsApp, a bookkeeper comes in monthly. No TMS; maybe Cartrack on the trucks for insurance.

| Cadence | Decision | What TruckWys must give him |
|---|---|---|
| Per quote | "Will I make money at R18,500 Durban to City Deep, and will they accept?" | Price with fuel at the current official diesel price for his zone, actual SANRAL plazas for his toll class, his own truck's running cost, and the win likelihood (only if there is evidence). |
| Weekly | "Who must I phone about money this week?" | A short list: overdue invoices by rand, with a one-tap reminder and the promised-date history. |
| Weekly | "Can I pay diesel and wages on Friday?" | 13-week cash view with known outflows, not just receivables. |
| Monthly | "Which truck and which customer are carrying me, which are dragging me?" | Truck P&L and customer profitability, in rand, with cost per km. |
| First Wednesday of the month | "Diesel moved 40c. Which open quotes and contract rates must I adjust?" | A diesel-change insight listing affected quotes and customers with the rand exposure. |

### 2.2 Ops/finance manager, 60-truck fleet (Nadia, Germiston, reefer and tautliner, cross-border to BW/ZM)
Runs CtrlFleet or a local TMS, MiX or Cartrack telematics, Xero or Sage with an external accountant, 3 to 5 contract customers making 70% of revenue.

| Cadence | Decision | What she needs |
|---|---|---|
| Daily | Which delivered loads are not invoiced yet, and why (missing POD, missing rate)? | Delivered-not-invoiced queue with blocker reason. |
| Weekly | Which lanes and customers fell below margin floor last week? | Margin insights at lane/customer grain with actual cost where tagged, modelled cost where not, and coverage stated. |
| Weekly | Which trucks are costing above fleet norm per km? | Truck cost per km versus fleet median, with telematics km. |
| Monthly | Rate review with top customers: "what do I ask for?" | Customer profitability pack plus lane benchmark (anonymised network data) and a fuel/toll adjustment schedule. |
| Monthly | Board/owner management pack by working day 3. | Management pack PDF, reconciled to Xero. |
| Quarterly | Cross-border: are Beitbridge delays eating the Zambia contract? | Cross-border lane report with border time (needs telematics geofence) and fees. |

### 2.3 Bookkeeper / external accountant (Riana, small practice, 20 transport clients)
Does VAT201s, monthly processing, year-end. Hates re-keying invoices and chasing clients for fuel slips.

| Cadence | Decision | What she needs |
|---|---|---|
| Monthly | Are TruckWys sales and receipts in the ledger and do they tie? | Sales register and receipts register with Xero sync status per document, and a tie-out: opening debtors + invoiced − received − credit notes = closing debtors. |
| Bi-monthly (VAT period) | Output VAT on invoices issued; input VAT on costs. | VAT summary by tax period with invoice-level detail. |
| Monthly | Unallocated or unapproved costs. | Exceptions list: pending expenses, expenses with no receipt, no vehicle, no VAT split. |
| Year-end | Debtors age analysis at 28/29 Feb, doubtful debts. | As-at ageing (must reproduce the past, not just today). |

### 2.4 TMS/telematics partner (product lead at CtrlFleet, partnerships at Cartrack)
| Decision | What they need to see |
|---|---|
| Does TruckWys compete with us? | A written non-compete scope (section 7.5) and an architecture where TruckWys consumes their trips rather than creating its own. |
| Will it make our customers stickier and add revenue? | Revenue share on referred fleets, an embeddable quote/cost/get-paid widget under their brand, and usage evidence. |
| Can we integrate in weeks, not quarters? | OAuth 2.0, a published data contract, sandbox, signed webhooks, idempotency, versioned API. |
| Is our data safe? | Per-fleet consent, tenant isolation proof (the audit's section 1 must be closed), no resale of their data, k-anonymity on any pooled benchmark. |

---

## 3. Information architecture

### 3.1 Four surfaces, four questions

| Surface | Question | Contains | Never contains |
|---|---|---|---|
| **Overview** | What needs me today? | Action queue (top 5 open insights by rand, overdue to chase, delivered-not-invoiced), 4 to 5 KPI tiles with delta and sparkline, each a link to its owning report. | Charts beyond sparklines, tables, narrative. |
| **Insights** | What should I change, and what is it worth? | Insight feed (open, in progress, verified), insight detail with evidence and one action, value delivered ledger, detection-to-verification funnel. | Totals tables, P&L trends, ageing buckets, fleet health dashboards. |
| **Finance reports** | What exactly happened? | Report library (pre-built and saved custom), report pages with declared date basis, filters, drill-down, export, schedule, management pack, send to accountant. | Recommendations, "you should" copy, AI narrative on the numbers (a neutral commentary field the user writes is fine). |
| **Copilot** | Ask or do anything. | Q&A that answers by citing a report (with the filter applied) or an insight; actions through proposals with review. | Its own metrics. If Copilot needs a number that no report defines, that is a missing report, not a Copilot feature. |

**Metric registry (the anti-overlap mechanism).** A backend module, e.g. `core/metrics/registry.py`, defines each metric once: id, label, formula, date basis, VAT treatment, status filter, grain, owning report. Examples:
- `revenue.invoiced_excl_vat`: Σ (`Invoice.subtotal − Invoice.discount`), status not in (DRAFT, CANCELLED), dated by `issue_date`. Owner: Management P&L.
- `revenue.collected_incl_vat`: Σ `Payment.amount`, dated by `payment_date`. Owner: Cash received.
- `cost.approved`: Σ `Expense.amount` where `status='APPROVED'`, dated by `expense_date`. Owner: Cost analysis.
- `debtors.outstanding`: Σ `Invoice.balance` where status in (SENT, VIEWED, PARTIALLY_PAID, OVERDUE) and balance > 0, as at a date. Owner: Debtors age analysis.
Every endpoint, report, insight and Copilot tool reads from the registry. A CI test fails if two endpoints compute the same label with different filters. This is what fixes "they repeat the same totals": the totals may appear in several places as links, but are computed in one.

### 3.2 Current tab mapping

Note: the owner described Finance reports tabs as Income and expenses, Receivables ageing, Expense analysis, Customer activity and Capital activity. The repository (both `origin/main` and `truckwys/ux-overhaul`) labels them P&L, Cash flow, Customer, Aging, Lanes, Capital, Fast pay. I map both; the live build may be ahead of the repo.

**Finance reports (today)**

| Current tab | What it shows today (source) | Verdict | Becomes |
|---|---|---|---|
| P&L / Income and expenses | Total revenue, total expenses, net margin, 12-month trend, expense breakdown (`/dashboard/finance/`). Revenue = PAID invoices' `total_amount` (VAT-inclusive) by `paid_at`; expenses = approved by `expense_date`. Expense breakdown reads a field the backend never returns (audit #49). | **Keep, rebuild** | R1 Management P&L (accrual, excl VAT) with a cash view toggle. |
| Cash flow | 30-day in/out and weekly forecast (`/dashboard/cashflow/`, leaks all tenants, audit #2). | **Keep, rebuild** | R10 13-week cash forecast. |
| Customer / Customer activity | Top 10 customers by paid revenue, invoice count. | **Merge** | R4 Customer profitability and R11 Customer statement. |
| Aging / Receivables ageing | Outstanding, overdue, DSO, buckets, overdue list (`/invoices/aging/`). | **Keep** | R8 Debtors age analysis (SA term), as-at date. |
| Expense analysis | Category breakdown (empty forever, audit #49; `/expenses/report/` mixes pending, audit #49). | **Keep, rebuild** | R14 Cost analysis (category × vehicle × trip). |
| Lanes | Margin by lane from `reports.margin_by_lane`, cost modelled with hardcoded defaults. | **Keep, rebuild** | R3 Lane profitability on the load ledger. |
| Capital / Fast pay / Capital activity | Facility limit, advances, fees, FastPay "savings". | **Merge, gate** | R13 FastPay statement, shown only when a fleet has an active facility. No fee copy until a capital partner is signed. |

**Insights (today)**

| Current tab | What it shows today | Verdict | Becomes |
|---|---|---|---|
| Briefing | LLM narrative + KPI + recommendations (`/dashboard/briefing/`, `/dashboard/insights/` which serves the first company in the database, audit #1). | **Keep the idea, rebuild** | "This week" summary strip at the top of the insight feed: an LLM paraphrase of the top open insights only, with every number linked to its insight. |
| Margin engine | Monthly P&L trend and cost breakdown, computed client-side from the first 100 loads and 100 expenses. | **Kill** | P&L trend lives in R1. Unique value (quote vs actual) moves to R6 Quote accuracy and insights Q3/M1. |
| Cash flow | Cash position, who owes you, weekly forecast. Duplicates Finance cash flow and ageing. | **Kill** | R8, R10, and insights P1 to P6. |
| Fleet | Fleet health summary, maintenance risk alert, AI health scores (`Vehicle.ai_health_score` etc.). | **Kill from Insights** | Truck P&L → R5. Compliance/maintenance reminders (licence, service due) → Fleet module and Overview action queue. Cost outliers → insight C1. |
| Lanes | Route bars, cargo weight bands, load pipeline status (pending, in motion, completed). | **Kill** | Lane economics → R3. Pipeline and cargo bands are TMS territory and are removed. |

**New**

| New item | Where |
|---|---|
| Load ledger (per-load economics) | Finance reports: R2, and the drill-down target for every profitability report. |
| Quote accuracy, Win/loss and pricing | Finance reports: R6, R7. |
| Fuel, tolls and border, Revenue leakage, Data completeness | Finance reports: R15, R16, R17, R18. |
| VAT summary, Sales and receipts registers | Finance reports: R19, R20. |
| Management pack and Send to accountant | Finance reports header actions. |
| Value delivered ledger and funnel | Insights: second tab. |
| Settings: cost profile (per truck fixed and variable cost), margin floor, cost of money rate, cash floor | Settings > Finance. Required inputs for insights. |

Resulting navigation:
- **Overview**
- **Insights**: For you (feed) · Value delivered
- **Finance**: Invoices · Payments · Expenses · Reports (library)
- **Copilot** (panel, available everywhere)

---

## 4. Finance reports specification

### 4.1 Principles
1. **Declared date basis on every report**, printed under the title: "Invoices by issue date · excl VAT · 1 to 31 Aug 2026". Three bases exist and are never mixed within one figure: *issue date* (accrual revenue), *payment date* (cash received), *expense date* (cost incurred, approved only). Due date is used only for ageing and forecasting.
2. **VAT explicit.** Profit reports exclude VAT. Cash reports include VAT (cash is what hits the bank). The column heading says which.
3. **Approved costs only** in profit and cost totals; pending shown as a separate, labelled line ("R 14,200.00 awaiting approval, not included").
4. **Coverage stated.** Any figure that mixes actual and modelled cost states the split: "Actual costs on 41 of 57 loads; 16 use your cost profile".
5. **Reconciles or says why not.** Each report has a tie-out rule (below) shown as a green "Ties to …" line or an amber "Does not tie: R 2,340.00 difference, 3 payments not linked to invoices" line.
6. **As-at capability.** Balance reports (debtors, FastPay) must reproduce any past date, computed from the ledger of events (invoice issued, payment dated, credit note), not from the current `balance` column.
7. **Server-side, paginated, complete.** No client-side aggregation of a `page_size=100` list (today's Insights tabs do this).
8. **Exports**: CSV (raw rows, machine-readable ISO dates and plain numbers), XLSX (formatted, one sheet per section), PDF (branded, with basis line and tie-out line). Schedule: weekly or monthly email to named recipients.

### 4.2 Data model gaps that reports need (small, all "needs capture")
| Gap | Why | Change |
|---|---|---|
| No credit notes; invoices are cancelled | Accountants need a credit note to reverse revenue in the correct period; cancelling a sent invoice rewrites history. | `CreditNote` model linked to invoice; cancellation of a SENT invoice requires one. |
| `Expense` has no VAT split, no litres, no odometer | Input VAT, fuel R/L, km per litre. | Add `vat_amount`, `litres`, `odometer_km`, `fuel_site` (optional). OCR on receipt can prefill. |
| `Trip` has no `company` FK | Tenant scoping via `load__company` everywhere; trips without loads are orphaned. | Add `company` FK and backfill from load. |
| No cost profile | `margin_calculator` uses hardcoded R3.50/km driver, R0.45 tyres, R0.65 maintenance, 1.3 deadhead for every fleet. | `CostProfile` per vehicle (or vehicle type): monthly fixed costs (instalment, insurance, licence, tracking, driver salary) and variable R/km (tyres, maintenance), with an "estimated" flag until actuals replace them. |
| No opening bank balance / bank feed | Cash forecast needs a starting balance. | User-entered balance with date, or read the bank balance from Xero's bank accounts endpoint when connected. |
| Load external id stored in `notes` (`ext_id:` substring match) | TMS dedupe and reconciliation. | `external_source`, `external_id` columns with a unique constraint per company. |

### 4.3 The report library

Grouped in the library as **Profit**, **Cash**, **Cost**, **Accountant**. Grain, basis and source are precise; "Today" means the fields exist in the current models.

#### Profit

**R1 Management P&L**
- Question: Did we make money this month, and where did it go?
- Grain: month (columns) × line (rows): revenue by service type (local, long-distance, cross-border), cost by category (fuel, tolls, driver cost, maintenance, insurance, overhead, other), gross margin, overheads, net operating profit, operating ratio (cost ÷ revenue).
- Filters: period, compare to (prior period, same month last year), branch/depot (later), customer group.
- Basis: revenue by `Invoice.issue_date`, excl VAT (`subtotal − discount`), less credit notes by credit note date; cost by `Expense.expense_date`, APPROVED. A "cash view" toggle switches to receipts by `payment_date` and costs by paid date (needs expense paid date; until then, labelled "cost by expense date").
- Source: today (Invoice, Expense). Service type split needs `Quote.is_cross_border`/distance banding, today.
- Export: PDF (pack page 2), XLSX, CSV.
- Reconciliation: revenue ties to R20 Sales register for the same period; cost ties to R14. When Xero is connected: "Ties to Xero sales account 200 within R 0.00" using synced invoice ids.

**R2 Load ledger (load profitability)**
- Question: What did each load actually make, versus what we quoted?
- Grain: one row per load.
- Columns: load number, customer, lane (origin → destination code), vehicle, driver, pickup and delivered dates, planned km (`Load.distance`), actual km (telematics), quoted price (`Quote.total_amount`), invoiced excl VAT, quoted cost by line (fuel, tolls, border, driver, other), actual cost by line (expenses tagged to the load's trip), allocated fixed cost (cost profile, per day in use), margin R, margin %, cost coverage (actual, partly actual, modelled), invoice status, days to payment.
- Filters: period (by delivered date), customer, lane, vehicle, driver, coverage, margin below floor.
- Basis: delivered date (`Load.actual_delivered_at`) for inclusion; revenue excl VAT.
- Source: today for quote, load, invoice and trip-tagged expenses. Actual km, actual litres: needs telematics. Waiting time: needs telematics/TMS.
- Export: CSV, XLSX.
- Reconciliation: Σ invoiced excl VAT over loads delivered in period + revenue not linked to a load = R1 revenue; unlinked invoices listed.

**R3 Lane profitability**
- Question: Which lanes make money per km and per day?
- Grain: lane (origin code → destination code, direction-specific), with vehicle type sub-rows.
- Columns: loads, revenue excl VAT, revenue/km, cost/km (actual where covered), margin %, avg days on road, return-load rate (share of trips with a paid return, needs TMS for non-TruckWys loads), market rate band (network benchmark where k-anonymity allows), win rate on quotes for the lane.
- Filters: period, vehicle type, customer, one-way/round trip.
- Basis: delivered date; excl VAT.
- Source: today (load ledger). Market band: today via `lane_benchmark` (k ≥ 5 quotes from ≥ 2 companies).
- Reconciliation: Σ lane revenue = R2 total for the same filter.

**R4 Customer profitability**
- Question: Which customers are worth keeping, repricing or dropping?
- Columns: revenue excl VAT, loads, margin R and %, revenue/km, avg days to pay (actual, `payment_date − issue_date`, amount weighted), terms, overdue now, disputes, cost of money tied up (see 6.2), accessorials billed vs quoted, quote win rate, share of revenue (concentration).
- Basis: issue date for revenue; payment date for days to pay.
- Source: today.
- Reconciliation: Σ revenue = R1 revenue.

**R5 Truck P&L (vehicle profitability)**
- Question: Is each truck earning its instalment?
- Columns: plate, type, days on load, loads, km (planned today; odometer from telematics), revenue excl VAT, variable cost by category, fixed cost (cost profile), margin, revenue/km, cost/km, fuel L/100km (needs litres + km), maintenance cost/km, utilisation % (days with a load ÷ working days).
- Basis: revenue by delivered date of loads assigned to the vehicle; cost by expense date where `Expense.vehicle` set.
- Source: today for revenue and tagged costs; km and fuel efficiency need telematics or odometer capture.
- Reconciliation: Σ vehicle cost + unallocated cost = R14 total; unallocated shown as its own row (never silently dropped).

**R6 Quote accuracy**
- Question: Are our quotes pricing cost correctly?
- Grain: accepted quote converted to a delivered load with at least one actual cost line.
- Columns: quote number, lane, quoted cost by line versus actual by line, variance R and %, fuel price at quote (`fuel_price_at_creation`) versus official price on trip date, toll plazas priced versus toll expenses, border fees quoted versus paid.
- Summary: median variance per cost line over the period; lanes with systematic under-costing.
- Source: today where trip costs are tagged; stronger with fuel card and e-toll feeds.
- Reconciliation: row count = accepted quotes with delivered loads in period; excluded quotes counted with reason.

**R7 Win/loss and pricing**
- Question: What are we winning and losing, and why?
- Columns: quotes sent, accepted, rejected, expired, win rate, median response time (quote created to sent), price ratio to market (`QuoteOutcome.price_ratio`), rejection reasons (grouped), revenue won/lost.
- Grain: lane, customer, vehicle type, price-ratio band.
- Source: today (Quote, QuoteOutcome).

#### Cash

**R8 Debtors age analysis**
- Question: Who owes us, how long overdue, as at a date?
- Grain: customer (expandable to invoice).
- Columns: current, 1 to 30, 31 to 60, 61 to 90, 90+ days past due, total, terms, avg days to pay, last reminder, promised date.
- Filters: as at date (default today), age by due date (default) or by invoice date (accountants often want invoice date), customer, include disputed.
- Basis: VAT-inclusive balances; outstanding statuses only; balance > 0.
- Source: today (as-at requires computing from invoices and payments by date, not the `balance` column).
- Reconciliation: total = opening debtors + invoiced (incl VAT) − receipts − credit notes, over the period to the as-at date. Printed at the foot.

**R9 Cash received**
- Question: What cash came in, from whom, and how fast?
- Columns: payment date, customer, invoice(s), amount, method, days from issue, days from due, after reminder (yes/no, days since reminder).
- Summary: collected this period, DSO (see definition below), collected after TruckWys reminder.
- Basis: `Payment.payment_date`, VAT-inclusive.
- DSO definition (shown on the page): debtors at period end ÷ credit sales (incl VAT, by issue date) over the trailing 90 days × 90. One formula, used everywhere.
- Reconciliation: Σ payments = decrease in debtors from receipts in R8 roll-forward.

**R10 13-week cash forecast**
- Question: Will I run short in the next quarter?
- Grain: week × (opening balance, receipts expected, payments expected by category, closing balance).
- Receipts: each open invoice placed on its predicted payment week (customer's own trailing median days late, minimum 5 paid invoices; otherwise due date, labelled). Probability weighting is not applied to amounts; uncertainty is shown as a range band on the closing line.
- Payments: scheduled and recurring costs (instalments, insurance, salaries from cost profile), plus a per-category trailing 13-week run rate for fuel and tolls (fixes audit #47's all-category baseline), plus VAT payable estimate for the next VAT period.
- Source: today for receivables and recorded costs; opening balance needs capture or Xero.
- Reconciliation: week 1 opening balance equals the entered or Xero bank balance and its date is printed.

**R11 Customer statement**
- One page per customer, sendable: opening balance, invoices, payments, credit notes, closing balance, ageing strip, remittance details. PDF, email from TruckWys.

**R12 Collections activity**
- Reminders sent (by channel), promises to pay, promise kept rate, cash collected within 7 days of a reminder, disputes opened/resolved.
- Source: today (`Invoice.reminder_count`, `last_reminder_at`); needs a `ReminderEvent` log (one row per send, which also fixes audit #25's idempotency gap).

**R13 FastPay statement** (visible only for fleets with a signed facility)
- Advances requested, approved, disbursed, settled; fees; days early; effective annualised cost (`reports.fastpay_value` logic, today). Hidden until a capital partner exists. No marketing copy about fee levels or speed.

#### Cost

**R14 Cost analysis**
- Category × month, category × vehicle, category × driver, top vendors. Pending and rejected listed separately. Basis: expense date, approved, excl VAT once VAT is captured. Reconciliation: equals R1 cost lines.

**R15 Fuel report**
- Question: What do we spend on fuel, per km and per rand of revenue, and are we paying fair prices?
- Columns: fuel spend, litres, R/L paid, official diesel reference price for the date and zone (FuelPrice, inland/coastal 50ppm), variance R/L, fuel % of revenue, L/100km per truck (needs km), fuel cost per km.
- Source: spend today; litres need capture (Expense field) or fuel card feed; km need telematics or odometer capture.
- Context line on the page, sourced: "The RFA estimates diesel at R35 to R55 of every R100 of running costs" (see sources).

**R16 Tolls and border costs**
- Quoted tolls (per plaza, class) versus toll expenses per trip; border fees quoted versus paid; unpriced toll sections flagged (after audit #34 fix); round trips missing the return crossing (audit #36).
- Source: quoted side today; actual e-toll transactions need capture or a toll-account export.

**R17 Revenue leakage**
- Delivered not invoiced (by days since delivery, blocker: POD missing, rate missing, customer missing); invoiced below load/quote rate; quoted accessorials not on invoice; cancelled loads with costs incurred.
- Source: today.

**R18 Data completeness**
- Loads without trip, trips without costs, expenses without vehicle or receipt, invoices not synced to Xero, vehicles without cost profile, quotes without fuel snapshot. Each row links to the fix.
- This report is how an ops manager raises the "coverage" percentage that every profitability figure prints.

#### Accountant

**R19 VAT summary**
- Output VAT by invoice issue date (tax invoices), less credit notes; input VAT from expenses where captured; per VAT period (monthly or bi-monthly per the company's category). Supports VAT201 preparation; TruckWys does not file. Zero-rated exports (cross-border freight may qualify; the accountant decides) flagged by destination country for review.

**R20 Sales and receipts registers**
- Every invoice and credit note (number, date, customer, excl, VAT, incl, Xero id, sync status); every payment (date, amount, invoice, method, Xero id, sync status). CSV in a Xero/Sage-importable column order.

### 4.4 Monthly management pack
Generated on working day 2 of each month for the prior month, and on demand. One PDF, 8 pages, plus an XLSX with each report as a sheet.
1. Cover: month, fleet, basis line, coverage statement, tie-out status.
2. Summary: 6 KPI tiles (revenue excl VAT, operating profit, operating ratio, cash collected, debtors 60+, DSO), each with prior month and same month last year.
3. Management P&L (R1).
4. Customer profitability, top 10 plus "all others" (R4).
5. Lane profitability, top 10 (R3).
6. Truck P&L (R5).
7. Debtors age analysis at month end (R8) and 13-week cash (R10).
8. Value delivered this month (section 6) and open insights over R 5,000 impact.
A free-text "Owner's commentary" box the user writes before sending; no LLM text in the pack unless the user inserts a draft and edits it.

### 4.5 Send to my accountant
1. Settings: accountant name, email, practice; access level (receive packs only, or read-only login with Reports and Invoices).
2. Monthly: "Close August" button (after the pack is generated) runs checks: pending expenses, unsynced invoices, receipts without invoices. Each check is a line with a count and "Fix" link; the user can send with open exceptions, which are listed on the pack cover.
3. Send: the accountant receives an email with a secure link (expires in 30 days) to the pack PDF, the XLSX, R19, R20 and receipts (zip of `receipt_file`s for the month). Every send is logged (who, when, what).
4. Period lock (optional): after sending, August invoices and expenses become read-only unless an owner unlocks with a reason. This is what makes the pack a stable record.

---

## 5. Insights specification

### 5.1 The insight object
Every insight is a persisted record, not a computed banner.

```
Insight
  id, company, type (e.g. LANE_BELOW_FLOOR), category (quote|margin|cost|cash|growth)
  subject (lane | customer | vehicle | invoice | quote | load), subject_id
  detected_at, detection_run_id, rule_version
  evidence: {inputs, sample_size, coverage, period, links to report filters}
  impact: {amount_zar, basis ('measured'|'estimated'), method (formula text), horizon_days}
  confidence: 'high'|'medium'|'low' (rule defined per type, section 5.3)
  action: {kind, target, payload}  (exactly one primary action)
  status: open → seen → accepted | dismissed(reason) | snoozed(until)
          accepted → actioned(action_ref, actioned_at)
          actioned → verifying(window_end) → verified(outcome) | not_verified(reason)
  outcome: {measured_zar, method, measured_at, comparison_baseline}
```

Rules:
- An insight appears only if its impact ≥ a per-company threshold (default R 1,000) and its evidence meets the type's minimum.
- Dismiss requires a reason from a short list (not relevant, already handled, data wrong, disagree). "Data wrong" dismissals feed R18 and rule QA.
- Deduplication: one open insight per (type, subject). Re-detection updates evidence and impact, keeps history.
- Every rand figure shows "measured" or "estimated" and opens the formula.

### 5.2 Catalogue: 24 insight types

Legend: **D** deterministic, **ML** trained model with evaluation, **LLM** language only. Data: **T** today, **Cap** needs small capture, **TMS**, **Tel** telematics.

#### Quote better

**Q1 Diesel moved since you quoted** (D; T after audit #32/#33/#37 fixes)
- Trigger: on each official diesel adjustment (first Wednesday of the month, DMPR announcement ingested with source and effective date), for every quote SENT/ACCEPTED not yet delivered and every contract customer rate, compute Δ = current official price for the company's zone − `fuel_price_at_creation`. Fire if |Δ| ≥ 20 c/L and exposure ≥ threshold.
- Impact: Σ (quote distance (incl. return leg if round trip) ÷ 100 × vehicle L/100km × Δ). Estimated.
- Evidence: official price, effective date, source; per-quote litres.
- Action: "Review 12 quotes" opens a bulk reprice list with a fuel adjustment line.
- Verification (30 days): Σ accepted fuel adjustments on those quotes, measured.

**Q2 Lane priced below your margin floor** (D; T)
- Trigger: lane with ≥ 5 delivered loads in 90 days, median margin % < `company.margin_target_pct` (actual cost where coverage ≥ 60%, otherwise modelled from the fleet's cost profile and labelled).
- Impact: (price needed for target margin − median price) × loads in the last 90 days. Estimated annualised ×4 is shown only as secondary text.
- Action: "Set lane rate" (updates a lane rate card used as the default in New quote).
- Verification (90 days): median price and margin on the lane after the action versus the 90-day baseline; measured = Σ (price − baseline median) over loads after action, capped at the target price.

**Q3 Quoted cost keeps missing actual** (D; T where costs tagged)
- Trigger: on a lane or customer, actual cost exceeded quoted cost by > 10% on ≥ 3 of the last 5 delivered loads with coverage.
- Impact: median shortfall × expected loads next 90 days (trailing 90-day count). Estimated.
- Evidence: per-line variance (fuel, tolls, border, driver, other) from R6.
- Action: "Adjust cost assumptions" (edits the vehicle cost profile or the lane toll set).
- Verification: next 5 loads' variance within ±5%.

**Q4 Quote is missing a known cost** (D; T after audit #34 and #36 fixes)
- Trigger, either of: (a) the route geometry contains toll sections not matched to a priced `TollPlaza` row, on an open quote or a lane quoted in the last 90 days; (b) a ROUND_TRIP cross-border quote whose fee lines contain the outbound crossing only.
- Impact: (a) unmatched sections × the class tariff of the nearest priced plaza on the same road, estimated and labelled "possible"; (b) the exact missing fee from `BorderCrossingFee` and `CountryTransitRate`, measured.
- Action: "Add missing cost to quote" (toll amount with source, or the return crossing line).
- Verification: the quote is re-sent with the line; the accepted amount of the added line is measured.

**Q5 Price sensitivity on this lane** (ML; T when enough outcomes)
- Trigger: a lane or customer where win probability falls sharply above a price ratio (from `QuoteOutcome.price_ratio`), and the fleet is quoting in the steep part.
- Requirements: model trained on ≥ 200 labelled outcomes for the company (or the pooled global model with per-company calibration), AUC and calibration shown in the evidence panel, else the insight type is disabled. No heuristic dressed as a model (consistent with `margin_optimizer` docstring).
- Impact: expected profit difference between current median price and the optimiser's price (`optimize_price`), × expected quotes. Estimated.
- Action: "Use suggested price on next quote".
- Verification: win rate and realised margin on the lane for 60 days versus prior 60.

#### Improve margin

**M1 Customer below margin floor** (D; T)
- Trigger: customer with ≥ 5 loads in 90 days, margin % < floor, coverage stated.
- Impact: as Q2, at customer grain, including cost of money on their debtor days (6.2).
- Action: "Prepare rate review" (generates a PDF for the customer conversation: loads, lanes, fuel and toll movement since the rate was set, proposed rate). The PDF uses official price and SANRAL tariff changes as the justification, not the fleet's margin.
- Verification (90 days): new rate applied on subsequent invoices; measured uplift.

**M2 Delivered but not invoiced** (D; T)
- Trigger: load DELIVERED > 24 hours with no invoice, or invoice DRAFT > 24 hours.
- Impact: load `total_amount` excl VAT. Measured (exact).
- Evidence: blocker (POD missing, rate missing, customer email missing).
- Action: "Create and send invoice" (or "Request POD from TMS").
- Verification: invoice sent; value counted in "Revenue leakage stopped" only if the invoice was created after the insight fired.

**M3 Billed less than agreed** (D; T)
- Trigger, either of: invoice subtotal is below the load `total_amount` (excl VAT) or the accepted quote total by more than R 50; or the quote carries `additional_charges` or `driver_allowance` that are absent from the invoice's `line_items`.
- Impact: the difference, or the missing line total. Measured.
- Action: "Add to invoice" (draft) or "Issue supplementary invoice" (sent); "Agreed discount" is a dismiss reason.
- Verification: supplementary amount invoiced and paid.

**M4 Waiting time you are not billing** (D; needs TMS or Tel)
- Trigger: geofence dwell at pickup or delivery > the customer's free time (setting, default 2 hours) on ≥ 3 loads in 30 days.
- Impact: Σ billable hours × the fleet's detention rate (setting; no default rand value). Estimated until the fleet sets a rate.
- Action: "Add detention to invoice" or "Add detention clause to rate review".
- Verification: detention lines invoiced and paid.

#### Cut cost

**C1 Truck costs more per km than your fleet** (D; T for tagged costs, Tel for km)
- Trigger: vehicle cost/km over 60 days > fleet median × 1.15, with ≥ 3,000 km in the period (telematics or odometer; planned distance allowed only when labelled).
- Impact: (vehicle cost/km − median) × km. Estimated.
- Evidence: category split showing the driver (fuel, maintenance, tyres).
- Action: "Open truck P&L" with a drill into the category; secondary: "Book a service" deep link to the fleet's workshop or telematics partner, not a TruckWys workshop module.
- Verification: cost/km over the next 60 days.

**C2 Paying above the official diesel price** (D; Cap: litres on fuel expense or fuel card feed)
- Trigger: R/L paid on fuel expenses exceeds the official 50ppm reference for the zone and date by > 5% on ≥ 3 fills in 30 days, grouped by fuel site/vendor. (Diesel is deregulated at retail, so a premium exists; the rule compares against a site-level norm, not zero.)
- Impact: litres × (paid − fleet's median premium). Estimated.
- Action: "Compare sites" (list of sites the fleet already uses with their average premium).
- Verification: premium on next 30 days.

**C3 Fuel burn drifting on a truck** (D; Tel, or Cap odometer + litres)
- Trigger: rolling 30-day L/100km > the truck's own 90-day baseline × 1.08 with ≥ 3 fills (fill-to-fill method) or telematics fuel.
- Impact: extra litres × current price. Estimated.
- Action: "Flag for inspection" (sends to the telematics partner's maintenance workflow or creates a Fleet task).
- Verification: return to baseline.

**C4 Trucks standing** (D; T)
- Trigger: vehicle with no load for ≥ 3 working days in the last 14 (from `Load.vehicle` and dates).
- Impact: fixed cost per day from the vehicle's cost profile × idle days. Estimated; not shown at all if the vehicle has no cost profile. Replaces today's hardcoded "R 8,000/day" in `DashboardSignalsView`.
- Action: "Find loads on your lanes" (opens rejected/expired quotes and dormant customers on lanes the truck can run: G1, G2).
- Verification: utilisation over the next 14 days.

**C5 Empty running on your lanes** (D; TMS or Tel)
- Trigger: share of km without a load > 30% for a vehicle or lane over 30 days (loaded legs from TruckWys loads + TMS; total km from telematics).
- Impact: empty km × variable cost/km. Estimated; the finding is a cost, the action is revenue (G3).
- Action: "See backhaul options" → G3.

#### Get paid faster

**P1 Customer paying slower than before** (D; T)
- Trigger: customer's median days-to-pay on the last 5 paid invoices > prior 10 by ≥ 10 days, and balance outstanding ≥ R 20,000.
- Impact: cost of money: balance × extra days × (company cost-of-money rate ÷ 365). Estimated; rate is a setting (the fleet's overdraft or facility rate), no default.
- Action: "Send statement" (R11) or "Call" (logs the call and promise date).
- Verification: next 3 payments' days-to-pay.

**P2 Overdue with no follow-up** (D; T)
- Trigger: invoice past due > 7 days with no reminder in 7 days and not disputed.
- Impact: balance (at risk, measured balance, not a loss).
- Action: "Send reminder" (server-composed, idempotent, audit #24/#25 fixed first).
- Verification: payment within 14 days; counted in "cash collected after a TruckWys action".

**P3 One customer holds too much of your debtors** (D; T)
- Trigger: one customer > 30% of debtors and > 60 days average age.
- Impact: balance at risk. Measured exposure, not a predicted loss.
- Action: "Set a credit limit" (Customer.credit_limit exists) and warn on new quotes above it.

**P4 Cash gap ahead** (D; T + opening balance)
- Trigger: R10 closing balance < the company's cash floor (setting) in any of the next 6 weeks.
- Impact: the shortfall amount in the lowest week. Estimated with range.
- Action: "See which invoices close the gap" (ranked by expected date and size) and, only when a facility is active, "Request FastPay on eligible invoices".
- Replaces the audit #46 alert (zero outflows, fixed R 50,000 threshold).

**P5 Likely to pay late** (ML; T, needs volume)
- Trigger: invoice with predicted P(paid > 30 days late) ≥ 0.6 from the payment model trained on `PaymentOutcome` and invoice history.
- Requirements: ≥ 300 labelled invoice outcomes (pooled across tenants only with consent and per-tenant features), calibration plot in evidence, and the audit #10 cross-tenant contamination fixed. Until then disabled; `customer_risk` deterministic band shown on the invoice page instead.
- Action: "Send early reminder" 3 days before due.
- Verification: realised lateness versus prediction, tracked as model quality.

**P6 Disputes slowing payment** (D; T)
- Trigger: ≥ 2 DISPUTED invoices for a customer in 90 days, or dispute reason POD in ≥ 2 invoices.
- Impact: disputed balance. Measured.
- Action: "Attach POD and resend" (POD from TMS where connected).

#### Grow revenue

**G1 Lost quotes worth a second look** (D; T)
- Trigger: quotes REJECTED or EXPIRED in 30 days where the lane's benchmark median (k-anonymous) or the fleet's own later accepted price is ≤ the rejected price, or where diesel has since fallen.
- Impact: none in rand (count and quoted value shown as "quoted value", not "revenue").
- Action: "Re-quote" (copies the quote with current costs).
- Verification: accepted re-quotes, measured revenue.

**G2 Regular customer has gone quiet** (D; T)
- Trigger: customer with ≥ 6 loads in 180 days whose days since last booking > 2 × their median booking interval.
- Impact: their trailing 90-day revenue ÷ 90 × days quiet (revenue at risk). Estimated.
- Action: "Send a quote" or "Log a call".

**G3 Backhaul you already have customers for** (D; T, stronger with TMS)
- Trigger: for each lane A→B the fleet runs loaded ≥ 3 times in 30 days, find customers with quotes or loads on B→A (or B→near A within 100 km) in the last 180 days.
- Impact: estimated contribution per backhaul = benchmark or last price B→A − incremental cost (fuel, tolls, driver for the loaded return versus running empty). Estimated.
- Action: "Offer return load" (pre-filled quote to that customer).
- Verification: accepted backhaul loads; contribution measured on delivery.

**G4 You are below market on a lane** (D over pooled data; T)
- Trigger: lane where the fleet's median accepted price is below the network benchmark p25, with k-anonymity satisfied (≥ 5 quotes, ≥ 2 companies, per `lane_benchmark`), and win rate ≥ 70% (a sign of underpricing).
- Impact: (benchmark median − fleet median) × loads in 90 days × 0.5 (only half the gap is assumed capturable; the factor is stated). Estimated.
- Action: "Test a higher price on the next 3 quotes".
- Verification: win rate and price on the next quotes.

That is 24 types: Q1 to Q5, M1 to M4, C1 to C5, P1 to P6, G1 to G4. (Duplicate expenses and slow quote response were considered and moved out: duplicates are a data-hygiene row in R18, and response time is a column in R7, because neither carries a defensible rand impact.)

Data availability summary:

| Availability | Insight types |
|---|---|
| Today's data, deterministic (some after audit fixes) | Q1, Q2, Q3, Q4, M1, M2, M3, C4, P1, P2, P3, P6, G1, G2, G3, G4 (16) |
| Today's data plus a small capture (opening balance, litres, odometer) | P4, C2, C1 (km) (3) |
| Needs TMS or telematics | M4, C3, C5 (3) |
| ML, volume-gated on today's data | Q5, P5 (2) |

Only Q5 and P5 are ML. The "This week" summary is the only LLM surface in Insights.

### 5.3 Confidence rules
- **High**: measured inputs, coverage ≥ 80%, sample ≥ the type minimum ×2.
- **Medium**: coverage 50 to 80% or modelled cost used and labelled.
- **Low**: shown only in the "Worth checking" collapsed group, never on Overview.
Confidence is a rule, not a score; the evidence panel says which rule applied ("Medium: actual costs on 6 of 10 loads").

### 5.4 Where LLM is honestly useful
- The "This week" summary: paraphrase of the top 3 open insights, numbers passed in as tokens and rendered from the insight record, never generated.
- Rate review letter draft (M1): the user edits before sending.
- Receipt OCR and expense categorisation (litres, VAT, vendor) to raise coverage.
- Copilot questions that map to a report and filter ("show me Sasol loads last quarter under 10% margin" → R2 with filters).
Not LLM: scoring, impact, triggers, forecasts.

---

## 6. The closed loop: value delivered

### 6.1 What the owner sees
A second Insights tab, **Value delivered**, and one tile on Overview. The headline counts **measured** value only. Estimated value is shown underneath, visibly separate, and never enters the headline or the payback ratio.

```
Value delivered · 1 Jul to 30 Sep 2026

Measured value                     TruckWys fees this quarter     Payback
R 71,480.00                        R 22,500.00                     3.2 times
Verified on 38 outcomes            Subscription R 13,500.00        Measured value ÷ fees
                                   Booking fees R 9,000.00

Estimated value, not included above: R 18,900.00 (cost of money on cash collected earlier, fuel premium avoided)
```
(All figures illustrative.)

### 6.2 Components and exact measurement

| Component | Counts | Measured how | Basis |
|---|---|---|---|
| **Revenue recovered** | M3 billed less than agreed; Q4 missing costs added | Σ amount (excl VAT) of supplementary invoices or added lines created after the insight fired, counted when **paid**. | Measured |
| **Price recovered** | Q1 diesel adjustment accepted; Q2/M1 lane or customer rate change | For each load delivered in the 90-day window after the action on the same subject: (price − baseline price), where baseline is the subject's median price excl VAT in the 90 days before the action, adjusted for the official diesel change between the two periods (fuel share taken from the fleet's own quoted cost lines). Counted when invoiced and paid. Capped at the target price in the insight. | Measured against a stated baseline |
| **Leakage stopped** | M2 delivered not invoiced | Counted only if the load was delivered more than 30 days before the insight fired (i.e. would likely never have been billed). Otherwise it counts in cash earlier, not revenue. | Measured |
| **Cash collected earlier** | P1, P2, P6 actions; invoices auto-sent on delivery | Days earlier = max(0, the customer's trailing median days-to-pay before TruckWys, measured on at least 5 paid invoices − actual days-to-pay). Rand-days = amount × days earlier. Shown as rand-days and days, which are measured. The rand value = rand-days × the fleet's cost-of-money rate ÷ 365, which is **estimated** because the rate is the fleet's input. | Days measured; rand value estimated |
| **Cost avoided** | C1, C2, C3 | (baseline cost/km or R/L − post-action) × post-action km or litres over 60 days. | Estimated (many causes move fuel and maintenance) |

Rules that keep this honest:
1. **Attribution**: a rand is counted once, to the first insight that fired on that subject, and only if the action was taken inside TruckWys or confirmed by the user within the verification window. If the subject changed before the insight fired, nothing is counted.
2. **Paid, not promised**: revenue components count when the invoice is paid, not when it is issued.
3. **Ledger, not a number**: the headline opens a table of every counted outcome (insight, subject, action, date, formula, amount), exportable. An accountant or a sceptical owner can check every rand.
4. **Fees are real**: the denominator is actual billing (`BillingTransaction` for the subscription and `DeliveryFeeCharge` for the 0.25%), not list price.
5. **No outcomes, no claim**: if measured value is zero, the tile says "No verified outcomes yet" and shows open insights instead. It never shows an estimate in its place.

### 6.3 The detection-to-verification funnel
Adapted from the reference image's detected → resolved funnel, for margin and cash:

```
Detected 124  →  Seen 101  →  Accepted 63  →  Actioned 51  →  Verified 38
                                  │
                                  └ Dropped out: dismissed 22 (not relevant 9, data wrong 7, disagree 6), snoozed 16
```
Plus a ranked list, "What is costing you margin" (the reference's "What causes exceptions"), grouped by root cause with count and rand: fuel moved after quote, tolls missing from quote, billed less than agreed, customer paying slowly, trucks standing. Each bar links to the filtered insight list. "Data wrong" dismissals route to R18 and to rule QA; a rule with more than 20% "data wrong" dismissals over 30 days is disabled automatically and flagged to the team.

### 6.4 How TruckWys measures itself
- Share of active fleets opening a report or the pack each month.
- Insight action rate (actioned ÷ seen) per type; kill or fix types below 15% after 60 days.
- Measured value per fleet per quarter and payback ratio distribution (median, not mean).
- Cost coverage (share of delivered loads with actual cost lines), the leading indicator for every margin figure.

---

## 7. TMS and telematics partner strategy

### 7.1 The pitch in one line
"Your platform runs the truck. TruckWys turns every trip into a priced quote, an invoice on POD, and a margin number, inside your product, and pays you a share."

### 7.2 What TruckWys offers a partner
| Offer | What it is | Why the partner wants it |
|---|---|---|
| **Embedded quote price** | `POST /v1/price` with origin, destination, stops, vehicle class, weight, dates; returns price, cost lines (fuel with official price and zone, each SANRAL plaza with class tariff and tariff year, border and permit fees, driver, other) and provenance flags. Also an embeddable widget. | Most TMS products take a rate as input; few calculate it from live diesel and actual plazas. Their users quote inside their tool. |
| **Cost per trip** | `GET /v1/loads/{external_id}/economics` returns the load ledger row: quoted versus actual cost, margin, coverage. | A "margin per trip" column in their trip list, without building a finance engine. |
| **Get-paid layer** | Invoice on POD (their POD event triggers our invoice), reminders, customer statements, payment status back to them by webhook. FastPay only once a capital partner is signed. | Closes the loop from delivery to cash, which is the owner's top pain, without the TMS holding customer money or VAT invoices. |
| **White-label insight cards** | A subset (M2 delivered not invoiced, M3 billed less than agreed, P2 overdue with no follow-up, Q1 diesel moved) as embeddable cards. | Retention feature for their dashboard. |
| **Revenue share** | Proposal to test: a share of the R4,500 subscription on fleets they refer, for a fixed term (for example 20% for 24 months), plus a share of the 0.25% booking fee on bookings originated through their embed. | Research found no public revenue-share terms for Cartrack, MiX, Samsara or Motive marketplaces (section 10), so terms are a negotiation, not a market standard. The numbers here are a starting proposal, not a benchmark. |

### 7.3 What TruckWys needs from a partner (data contract v1)
| Object | Fields | Unlocks |
|---|---|---|
| Trip | external id, vehicle registration, driver ref, start/end time, odometer start/end (or distance driven), legs with loaded/empty flag, stops with arrival and departure time | Actual km, empty running (C5), waiting time (M4), truck cost/km (C1) |
| Fuel | per trip or per fill: litres, fuel used from CAN, fuel card transaction (site, litres, R/L, time, vehicle) | Fuel burn drift (C3), fuel premium (C2), fuel report (R15) |
| Geofence events | site id, arrive, depart | Detention (M4), border dwell for cross-border lanes |
| Toll transactions | plaza, class, amount, time (where the partner or the fleet's toll account exposes them) | Tolls quoted versus actual (R16) |
| POD | load external id, time, signed by, document URL | Invoice on POD (M2), disputes (P6) |
| Idle | idle minutes per trip | Cost of idle (fuel), fed into C3 evidence only |

### 7.4 Integration surface
What exists today in the backend:
- Inbound `POST /api/v1/integrations/trips/sync/` with `X-API-Key` (`IntegrationAPIKey`, quota and IP allowlist, metered): accepts origin, destination, cargo, weight, distance per trip and creates Loads. Dedupe matches `ext_id:` inside `Load.notes`, which is fragile.
- Fleet sync endpoints and webhooks: `fleet/trips/sync/`, `fleet/bookings/sync/`, `fleet/webhooks/trip-update/`, `vehicle-event/`, `driver-event/`, `fleet/webhooks/ctrlfleet/`.
- Cartrack: vehicle status and door-event polling into `Vehicle` (position, speed, ignition, temperatures, door). No trip km or fuel ingestion yet.
- CtrlFleet: vehicle roster match by plate and position sync.
- Xero: OAuth connect, invoice and payment sync, sync log.
- Outbound `WebhookSubscription` with event types such as `invoice.created`, `load.delivered`.

What v1 must add:
1. **OAuth 2.0 authorisation code flow** per fleet with scopes (`quotes:write`, `loads:read`, `invoices:read`, `trips:write`, `fuel:write`), alongside API keys for server-to-server. Samsara and Motive marketplaces both expect OAuth 2.0 apps with scopes and redirect URIs, and MiX Integrate is OAuth 2.0; matching that pattern lowers review friction.
2. **External identity columns** (`external_source`, `external_id`, unique per company) on Load, Trip, Vehicle, Driver, Customer.
3. **Idempotency keys** on every write (`Idempotency-Key` header), stored per company.
4. **Signed webhooks** (HMAC-SHA256 with timestamp) for `quote.accepted`, `load.invoiced`, `invoice.sent`, `invoice.paid`, `invoice.overdue`, `insight.created`; retries with backoff; replay endpoint.
5. **Versioned API** (`/v1/`), OpenAPI spec, sandbox tenant with synthetic data, and a public changelog.
6. **Consent and data rights**: the fleet grants access; partner data is used only for that fleet's reports and insights and, with explicit opt-in, for k-anonymous benchmarks; never resold; deletion on disconnect.
7. **Prerequisite**: every audit section 1 tenant-isolation item closed and regression-tested. A partner security review will ask for this.

### 7.5 First three partners in South Africa, and why
1. **CtrlFleet** (TMS, Paarl, founded 2024). SA-native, cloud TMS aimed at the same small and mid-size fleets, positioned to integrate with existing telematics rather than replace it, and TruckWys already has a connector (roster, positions, webhook endpoint). A young TMS benefits most from adding quoting, invoicing and margin without building them. Goal: first embedded price and invoice-on-POD integration live, used as the reference case.
2. **Cartrack (Karooooo)**. Already connected for status. It publishes a Fleet API with trips, fuel and idle data, which is exactly the data contract above, and its own SA content frames fuel as 35 to 55% of fleet operating costs, the same argument TruckWys makes in rand per load. Most 3 to 30 truck fleets in the TruckWys ICP are likely to already run a tracker of this kind (my assessment, not a measured figure). Goal: actual km and fuel per trip for C1, C3, C5, and a co-marketed "cost per load" feature for Cartrack customers.
3. **MiX Telematics (now part of Powerfleet)**. MiX Integrate is a documented REST API with OAuth 2.0, and MiX is strong with larger fleets (the 60 to 200 truck persona) that will pay for the management pack and multi-depot reporting. Goal: enterprise data contract and one 60+ truck reference customer.

Later: Netstar (offers data-as-a-service feeds), Trimble/Transporeon and Descartes (enterprise and shipper-side; relevant once TruckWys serves shippers' carriers), Samsara and Motive (large marketplaces with clear listing processes, but in my assessment less common in the SA mid-market; list once the OAuth app exists, because the marginal cost is low).

### 7.6 What TruckWys must never build
Written into partner agreements and the product principles:
- Dispatch, load planning, job allocation.
- Routing or route optimisation. (TruckWys calculates a route only to price tolls and fuel on a quote.)
- Live tracking maps as a product surface. The current Fleet page's live position from Cartrack should stay a thin status, not grow into tracking.
- Driver rostering, hours of service, driver behaviour coaching.
- Workshop or maintenance management (job cards, parts). TruckWys shows maintenance cost per km and deep-links to the partner.
- A driver POD app beyond the current fallback for fleets without a TMS. Ingest POD from partners first.
- Fuel card issuing.
The line: TruckWys owns price, invoice, payment, cost attribution and margin. If a feature needs a truck's live state to function, it belongs to the partner.

---

## 8. Screen designs

Common rules (brand guide v1.0.0): sentence case for every title, tab, button, label and column; page title 22/28 semibold (one H1); section and card titles 16/24 semibold; body 14/20; labels and supporting text 13/20; primary metric 28/36 semibold with tabular numerals; money right-aligned with tabular numerals and two decimals (R 1,234.56); identifiers (invoice, quote, load numbers, plates) 13/20 mono; cards 8px radius, 24px padding desktop, 16px phone; blue action accent (#2563EB light, #4D9EFF dark); semantic text colours for success, warning and danger with a text label, never colour alone; no em dashes in copy; unavailable values shown as "Not available" with a reason (the brand guide suggests an em dash glyph for unavailable values; given the owner's no-em-dash rule, this spec uses words instead, which the brand guide should adopt in its next version). Light surfaces #FFFFFF on #F3F4F6, dark #101215 on #060709; every screen specified below must be checked in both at 390px and 1440px.

### 8.1 Insights home (For you)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Insights                                                     [ Ask Copilot ] │  22/28 H1
│ Findings worth money, each with one next step.                                │  13/20 muted
│ ( For you )  ( Value delivered )                                              │  tabs 14/20, 2px underline
├──────────────────────────────────────────────────────────────────────────────┤
│ This week                                                                     │  16/24
│ Diesel rose 43c on Wednesday and 12 open quotes are affected. Two customers   │  14/20 LLM paraphrase,
│ are paying 11 days slower than in July. 3 delivered loads are not invoiced.   │  numbers rendered from
│ Updated 06:00 today · Based on 9 open insights                                │  insight records
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────────┤
│ Open value   │ Actioned this│ Verified this│ Cost coverage│ Debtors 60+ days │  label 13/20
│ R 84,210.00  │ month 14     │ quarter      │ 72%          │ R 212,400.00     │  28/36 tabular
│ 9 insights   │ R 31,050.00  │ R 71,480.00  │ of delivered │ ▁▂▃▅▆ +R 18,300  │  delta + sparkline
│              │              │ measured     │ loads        │ vs last month    │  each tile links to owner
├──────────────┴──────────────┴──────────────┴──────────────┴──────────────────┤
│ Filter: [ All ▾ ] Quote better · Improve margin · Cut cost · Get paid faster ·│
│         Grow revenue        Sort: [ Highest value ▾ ]                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ ● Get paid faster                                        R 46,000.00 at risk │
│ Beitbridge Logistics is paying 11 days slower                   Measured     │  16/24 title
│ Last 5 invoices paid in a median 52 days, against 41 before. R 46,000 is     │  14/20
│ outstanding.                                                                  │
│ Confidence high · 15 paid invoices                    [ Send statement ]  ⋯  │  one primary action
├──────────────────────────────────────────────────────────────────────────────┤
│ ● Quote better                                          R 18,400.00 exposure │
│ Diesel moved 43c since you quoted 12 open quotes                 Estimated   │
│ Official inland 50ppm price effective 7 Oct 2026, source DMPR.               │
│ Confidence high · 12 quotes                              [ Review quotes ]  ⋯│
├──────────────────────────────────────────────────────────────────────────────┤
│ ● Improve margin                                          R 12,960.00 / 90d  │
│ Durban to City Deep is priced below your 18% floor               Estimated   │
│ Median margin 9.4% on 14 loads. Actual costs on 11 of 14.                    │
│ Confidence medium · 14 loads                               [ Set lane rate ] ⋯│
├──────────────────────────────────────────────────────────────────────────────┤
│ ▸ Worth checking (4 lower-confidence findings)                               │  collapsed
│ ▸ In progress (6)   ▸ Verified (38)   ▸ Dismissed (22)                        │
└──────────────────────────────────────────────────────────────────────────────┘
```
Behaviour: the "⋯" menu holds Snooze, Dismiss (with reason), Share. The category dot is decorative; the category name is text. On phones the KPI row becomes a two-column grid; cards stack; the primary action is full width at 48px. Empty state: "No findings above R 1,000 right now. We check again tonight." with a link to R18 if coverage is under 50% ("Most loads have no actual costs yet, so margin findings are limited. Add costs to loads"). Error state: "Insights did not load. Your data is safe. Retry." never "all clear".

### 8.2 Insight detail (Q2 lane below floor)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Insights                                                                    │
│ Durban to City Deep is priced below your margin floor                         │  22/28 H1
│ Improve margin · Detected 2 Oct 2026 · Open                                   │  13/20
├───────────────────────────────────────────────┬──────────────────────────────┤
│ What we found                                  │ Worth                        │
│ Median margin on this lane was 9.4% over the   │ R 12,960.00                  │  28/36
│ last 90 days, below your 18% floor.            │ Estimated, next 90 days      │
│                                                │ How we calculated this ▾     │
│ Evidence                                       │  (R 21,400 target price −    │
│ Loads             14 (1 Jul to 30 Sep)         │   R 20,474 median price)     │
│ Actual costs      11 of 14 loads               │   × 14 loads                 │
│ Median price      R 20,474.00 excl VAT         ├──────────────────────────────┤
│ Median cost       R 18,550.00                  │ Next step                    │
│ Fuel share        41% of cost                  │ [ Set lane rate R 21,400 ]   │  primary
│ Network median    R 21,900.00 (k = 23, 6 fleets)│ Applies to new quotes on    │
│                                                │ this lane. Existing quotes   │
│ Cost per load, quoted against actual           │ stay as they are.            │
│ ▁▁▂▂▃▂▃▃▂▃▃ (bar per load, labelled)           │ Other options                │
│ View these 14 loads in the load ledger →       │ Prepare rate review          │
│                                                │ Dismiss                      │
├───────────────────────────────────────────────┴──────────────────────────────┤
│ What happens next                                                             │
│ Detected ✓ → Seen ✓ → Accepted → Actioned → Verified                          │
│ We will compare the next 90 days of loads on this lane with the median above │
│ and count only paid invoices.                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ History: detected 2 Oct · evidence updated 9 Oct (2 new loads)               │
└──────────────────────────────────────────────────────────────────────────────┘
```
The evidence table is a real table with sentence-case headings. The link opens R2 pre-filtered; the insight never re-renders the ledger itself. The network median row appears only when k-anonymity holds and shows k and the fleet count.

### 8.3 Reports library

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Reports                                  [ Management pack ▾ ] [ New report ]│
│ Transport reports that tie to your books.                                     │
│ [ Search reports ]    ( All ) Profit · Cash · Cost · Accountant · Saved       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Management pack · August 2026                                                 │
│ Ready · Ties to Xero · 2 exceptions        [ Review and send to accountant ] │
├──────────────────────────────────────────────────────────────────────────────┤
│ Profit                                                                        │
│ ┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────┐ │
│ │ Management P&L         │ │ Load ledger            │ │ Lane profitability │ │  16/24
│ │ Did we make money this │ │ What each load made    │ │ Which lanes pay    │ │  13/20
│ │ month, and where did it│ │ against what we quoted │ │ per km and per day │ │
│ │ go?                    │ │                        │ │                    │ │
│ │ Issue date · excl VAT  │ │ Delivered date         │ │ Delivered date     │ │  basis chip
│ │ Scheduled monthly      │ │ Coverage 72%           │ │ Coverage 72%       │ │
│ └────────────────────────┘ └────────────────────────┘ └────────────────────┘ │
│ Customer profitability · Truck P&L · Quote accuracy · Win and loss            │
│ Cash                                                                          │
│ Debtors age analysis · Cash received · 13-week cash forecast ·                │
│ Customer statements · Collections activity                                    │
│ Cost                                                                          │
│ Cost analysis · Fuel · Tolls and border costs · Revenue leakage ·             │
│ Data completeness                                                             │
│ Accountant                                                                    │
│ VAT summary · Sales and receipts registers                                    │
│ Saved reports                                                                 │
│ Name                       Based on               Owner      Updated          │
│ Sasol lanes Q3             Load ledger            Nadia M.   2 Oct 2026       │
└──────────────────────────────────────────────────────────────────────────────┘
```
Each card: title, one-line question, date-basis chip, coverage or schedule chip. A saved report is a pre-built report plus stored filters and column choice; no free-form SQL builder in v1. Copilot can create a saved report from a question and names which pre-built report it used.

### 8.4 Report page (R8 Debtors age analysis)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Reports                                                                     │
│ Debtors age analysis                     [ Schedule ] [ Export ▾ ] [ Share ] │  22/28
│ Balances incl VAT · aged by due date · as at 30 Sep 2026                      │  basis line, 13/20
├──────────────────────────────────────────────────────────────────────────────┤
│ As at [ 30 Sep 2026 ]  Age by [ Due date ▾ ]  Customer [ All ▾ ]              │
│ [x] Include disputed                                                          │
├──────────┬──────────┬──────────┬──────────┬──────────┬───────────────────────┤
│ Total    │ Current  │ 1 to 30  │ 31 to 60 │ 61 to 90 │ Over 90               │
│ R 812,340│ R 402,110│ R 198,600│ R 99,230 │ R 64,000 │ R 48,400              │  28/36 tabular
│ .00      │ .00      │ .00      │ .00      │ .00      │ .00                   │  (full value wraps,
│ 41 inv.  │ 18       │ 11       │ 6        │ 3        │ 3                     │   never truncated)
├──────────┴──────────┴──────────┴──────────┴──────────┴───────────────────────┤
│ Customer          Terms  Current   1 to 30   31 to 60  61 to 90  Over 90  Total│
│ ▸ Beitbridge Log. 30d    82,000.00 46,000.00 …                                 │  right-aligned
│ ▸ Karoo Agri      60d    …                                                     │  expandable to
│ ...                                                                            │  invoices
│ Total                    402,110.00 198,600.00 99,230.00 64,000.00 48,400.00  │
├──────────────────────────────────────────────────────────────────────────────┤
│ ✓ Ties: opening debtors R 790,110.00 + invoiced R 1,104,630.00                │
│   − received R 1,068,800.00 − credit notes R 13,600.00 = R 812,340.00         │
│ Related insights: 2 open (Beitbridge Logistics paying slower, 3 overdue with  │
│ no follow-up) →                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```
On phones: summary buckets become a two-column grid; the customer table scrolls inside a labelled region ("Debtors by customer, scroll sideways") and the page never scrolls sideways. The report links to insights; it does not show recommendations inline. Export menu: CSV, XLSX, PDF; Share sends to a saved recipient (accountant) with the same secure-link flow as 4.5.

---

## 9. Prerequisites and sequencing

### 9.1 Data-trust fixes that must land first
From the 23 September audit (numbers are the audit's):

| Area | Audit items | Why it blocks insights and reports |
|---|---|---|
| Tenant isolation | #1 dashboard insights serve `Company.objects.first()`; #2 cash-flow forecast aggregates all tenants; #3 to #5, #7, #8, #10 risk engine mixes tenants | An insight showing another fleet's debtor is a breach, and any partner security review fails on it. |
| Payment ledger | #15 edit/delete never recomputes the invoice; #16 payment re-pointing; #17 no idempotency; #18 no role guard; #21 ignored invoice filter | Debtors, cash received, DSO and "cash collected earlier" are all computed from payments. |
| Reporting integrity | #43 briefing counts pending and rejected expenses; #49 expense breakdown field missing and `/expenses/report/` mixes pending; #50 outstanding includes DRAFT/CANCELLED/DISPUTED; #44, #45 failures returned as HTTP 200 zeros; #46 cash alert with zero outflows and fixed R 50,000; #47 one all-category cost baseline; #48 date params echoed but unused | These are the numbers the current tabs show. |
| Pricing honesty | #32 copilot quotes without fuel snapshot; #33 stale fuel with no provenance; #37 fabricated fuel benchmarks; #34 silent R0 tolls; #35 R0 border fee cannot stick; #36 round trip misses return crossing; #39 margin calculator fuel-blind; #40 float money | Q1, Q3, Q4 and R6 compare quoted with actual; a silent R0 toll makes every lane look more profitable than it is. |
| Collections safety | #23, #24, #25 reminders on paid invoices, no idempotency | P2's one action is "Send reminder"; it must be safe to press. |

Additional findings from this study (not in the audit; each verified in code on 28 September 2026):
- **F1 "Revenue" is VAT-inclusive cash, "expenses" are accrual.** `FinanceDashboardView` (`core/views_finance.py`, from line 659) sums `Invoice.total_amount` (includes VAT) for `status='PAID'` by `paid_at`, and subtracts approved expenses by `expense_date`. Partially paid invoices are excluded, VAT inflates revenue by up to 15%, and "net margin" compares two different bases. R1 fixes this with the metric registry.
- **F2 Insights tabs aggregate truncated lists in the browser.** `src/pages/Insights.tsx` computes Margin engine, Fleet and Lanes from `loads/?page_size=100` and `expenses/?page_size=100`. Any fleet with more than 100 loads or expenses gets silently wrong totals.
- **F3 Three different margin formulas.** `reports.margin_by_lane` uses `margin_calculator` with hardcoded defaults (articulated, R3.50/km driver, 1.3 deadhead, no tolls passed) for every fleet; `IntelligenceService._calculate_customer_margin` counts only fuel litres and tolls; quotes carry their own `margin_percentage`. The same lane can show three margins. One definition, on the load ledger, with a cost profile per fleet.
- **F4 Fabricated values in signals.** `DashboardSignalsView` (`core/views.py`, from line 4037) states "Estimated revenue loss: R 8,000/day" per idle vehicle and "Advance at 2–3% fee. Cash in 4 hours" for FastPay, with no capital partner signed; the overdue signal uses `total_amount` rather than `balance`. Remove before anything else ships; it contradicts the brand guide's "no speculative monetary benefit".
- **F5 Hardcoded fleet cost per km.** `core/views.py` lines 1327 to 1328 fall back to R22.0/km and a R20.0/km target when data is missing.
- **F6 Fleet efficiency alert cannot run correctly.** `IntelligenceService._check_fleet_efficiency` filters `Vehicle.status='ACTIVE'` (default status is 'AVAILABLE'), reads `vehicle.registration_number` (the field is `plate`), and queries `Customer.objects.filter(is_active=True)` and `Trip.objects.filter(...)` without company scope.
- **F7 Model gaps**: `Trip` has no company FK; `Expense` has no VAT, litres or odometer; no credit note model; TMS external ids live in `Load.notes`.
- **F8 Test suite red**: the audit reports 11 failures and 25 errors on main; reports and insights need a green baseline plus their own reconciliation tests.

### 9.2 Phased roadmap
Effort in engineer-weeks, estimated from the size of comparable changes in the codebase (each report is roughly one backend endpoint on the registry plus one frontend page on a shared report shell; each deterministic insight is one rule plus tests on the insight framework). Assumes the current team size of roughly two backend and two frontend engineers; adjust linearly.

**Phase 0: Trust (now, about 3 weeks, 6 to 8 engineer-weeks)**
- Close the audit items in 9.1 in the audit's own order: tenant isolation, payment ledger, reporting integrity, pricing honesty, collections safety.
- F1 to F6; remove F4 copy immediately (hours, not weeks).
- Metric registry with the ten core metrics; CI test that no two endpoints compute a registry label differently.
- Exit criteria: synthetic two-tenant test suite green on every insight and report endpoint; R1 revenue ties to the sales register to the cent on fixture data.

**Phase 1: Foundation (next 6 to 8 weeks, about 20 engineer-weeks)**
- Load ledger service and R2; cost profile per vehicle; model captures (F7: Trip company FK, Expense VAT, litres, odometer, external ids, credit notes).
- Reports: R1, R2, R8, R9, R14, R17, R18, R20 on a shared report shell (basis line, filters, export, tie-out line).
- Management pack v1 and Send to accountant (without period lock).
- Insight framework (object, lifecycle, dedupe, thresholds, evidence, dismiss reasons) and 8 deterministic types: Q1, Q2, M1, M2, M3, P1, P2, P4.
- New Insights home; remove Margin engine, Cash flow, Fleet, Lanes tabs; Overview action queue.
- Dependencies: Phase 0 complete; Q1 needs audit #32, #33, #37; P2 needs #23 to #25; P4 needs opening balance capture.

**Phase 2: Depth and proof (following 8 to 10 weeks, about 24 engineer-weeks)**
- Reports: R3, R4, R5, R6, R7, R10, R11, R12, R15, R16, R19; saved reports; scheduled sends; period lock; Xero tie-out line.
- Insights: Q3, Q4, C1 (planned km, labelled), C2, C4, P3, P6, G1, G2, G3, G4.
- Value delivered ledger, funnel, "What is costing you margin".
- Partner API v1: OAuth 2.0, idempotency, signed webhooks, OpenAPI, sandbox. First partner: CtrlFleet embedded price and invoice on POD.
- Dependencies: load ledger coverage above 50% on design-partner fleets before C1 and Q3 go live.

**Phase 3: Network and telematics (later, a quarter or more)**
- Cartrack and MiX data contract: trips with odometer and loaded/empty legs, fuel, geofence events. Unlocks C1 on actual km, C3, C5, M4.
- ML: Q5 price sensitivity and P5 late payment, only when the volume gates in 5.2 pass, with evaluation shown in the evidence panel.
- R13 FastPay statement when a capital partner is signed.
- White-label insight cards and revenue share live with the first two partners.
- Listings on Samsara and Motive marketplaces once the OAuth app exists.

### 9.3 Dependency chain (critical path)
Tenant isolation → payment ledger → metric registry → load ledger + cost profile → reports R1/R2/R8 → insight framework → value delivered → partner API → telematics data contract → ML insights.
Anything that skips a step inherits the untrustworthy number beneath it.

---

## 10. Sources

### Internal (read-only)
- `truckwys-backend/docs/audit/BACKEND-AUDIT-2026-09-23.md`
- `truckwys-backend/core/models/` (quote.py, quote_outcome.py, load.py, trip.py, invoice.py, payment.py, expense.py, vehicle.py, driver.py, customer.py, company.py, fuel_price.py, toll_plaza.py, border_crossing_fee.py, country_transit_rate.py, risk_score.py, facility.py, advance_request.py, payment_outcome.py, delivery_fee_charge.py, billing.py, integration_api_key.py, webhook_subscription.py)
- `truckwys-backend/core/services/` (margin_calculator.py, reports.py, intelligence.py, cashflow.py, llm_insights.py, quote_analysis.py, margin_optimizer.py, lane_benchmark.py, customer_risk.py, aging_service.py, outcome_capture.py, quote_ml.py, cartrack_sync.py, ctrlfleet_sync.py)
- `truckwys-backend/core/views_finance.py` (FinanceDashboardView, TripCostView), `core/views.py` (DashboardSignalsView, fleet KPIs), `core/views_integrations.py` (TripSyncView), `core/views_fleet.py`, `core/urls.py`
- `truckwyas-frontend/src/pages/FinanceReports.tsx`, `src/pages/Insights.tsx`, `src/pages/Overview.tsx`, `src/components/insights/ExecutiveBriefing.tsx` (branch `truckwys/ux-overhaul`, compared with `origin/main`)
- `truckwyas-frontend/docs/brand/BRAND-GUIDELINES.md`

### Finance and analytics product patterns
- Ramp Intelligence launch: https://ramp.com/blog/announcing-ramp-intelligence
- Ramp price intelligence: https://support.ramp.com/price-intelligence-on-ramp
- Ramp savings insights: https://support.ramp.com/ramp-savings-insights
- Ramp reporting agent: https://support.ramp.com/reporting-agent
- Ramp procurement agents: https://www.prnewswire.com/news-releases/ramp-launches-fleet-of-ai-agents-across-its-procurement-platform-302756657.html
- Brex spend insights: https://www.brex.com/product-announcements/spend-insights
- Brex reporting: https://www.brex.com/support/brex-reporting
- Mercury insights: https://mercury.com/blog/introducing-insights and https://support.mercury.com/hc/en-us/articles/44277089544084-Insights-page-overview
- Stripe Sigma: https://docs.stripe.com/data/sigma and https://stripe.com/sigma
- Stripe Revenue Recognition: https://stripe.com/revenue-recognition
- Close reporting library: https://help.close.com/docs/reporting and https://help.close.com/docs/opportunity-funnels-report

### Fleet analytics
- Fleetio total cost of ownership: https://www.fleetio.com/features/total-cost-of-ownership
- Fleetio cost per mile benchmark (US): https://www.fleetio.com/blog/cost-per-mile-total-cost-ownership-trucking-logistics
- Samsara Fuel and Energy hub: https://kb.samsara.com/hc/en-us/articles/14909522972301-Fuel-Energy-Hub and https://kb.samsara.com/hc/en-us/articles/360062066652-Fuel-Energy-Overview
- Samsara fuel efficiency benchmarks: https://www.samsara.com/blog/fuel-efficiency-benchmarks-report
- Motive IFTA automation: https://gomotive.com/products/features/ifta-reporting-automation/
- Motive spend management (fuel benchmark; detail from search snippet only): https://gomotive.com/products/spend-management/
- Transporeon analytics and rate benchmark: https://www.transporeon.com/en/platform/freight-audit-payment-hub/analytics and https://www.transporeon.com/en/community/blog/optimize-logistics-decisions-with-rate-benchmark
- Descartes fleet analytics: https://www.descartes.com/solutions/routing-mobile-and-telematics/route-execution-and-fleet-performance-management/fleet-analytics-and-ai
- ATRI operational costs of trucking, 2025 update (US, used only as a definition reference, not an SA benchmark): https://truckingresearch.org/2025/07/new-atri-report-shows-trucking-profitability-severly-squeezed-by-high-costs-low-rates/

### South African context
- RFA on diesel share of running costs (September 2026): https://scrolla.africa/fuel-hikes-hammer-motorists-taxis-and-truckers/ and https://allafrica.com/stories/202609140139.html
- Cartrack on fuel share and fuel price impact: https://www.cartrack.co.za/faqs/fuel-price-increase-and-its-effects-on-your-business-get-all-the-facts
- RFA vehicle cost schedule: https://rfa.co.za/SA/vehicle-cost-schedule/
- SANRAL 2026 toll adjustment (3.12% from 1 March 2026): https://www.nra.co.za/sanral-pages/view/sanral-announces-toll-tariff-adjustment-effective-1-march-2026 and https://www.sanews.gov.za/south-africa/sanral-increases-toll-tariffs
- N3 heavy vehicle toll totals 2026 (press): https://iol.co.za/motoring/industry-news/2026-03-11-heres-how-much-youll-pay-in-toll-fees-on-south-africas-major-routes-after-sanrals-2026-increase/ and https://satrucker.co.za/sanral-announces-toll-fee-increase-from-1-march-2026-here-is-what-you-will-pay/
- DMPR fuel price adjustment statement: https://www.gov.za/news/media-statements/mineral-and-petroleum-resources-announces-adjustment-fuel-prices-effective-0
- October 2026 fuel outlook (projection): https://www.riotimesonline.com/south-africa-petrol-price-october-2026-record-outlook/
- Late payment (government invoices over 30 days): https://www.engineeringnews.co.za/article/late-payment-crisis-detrimental-to-smes-business-partners-says-2026-03-11
- RTMS and SANS 1395: https://rtms-sa.org/ and https://rtms-sa.org/rtms-standard-sans-1395/
- C-BRTA permits: https://www.cbrta.co.za/permits
- Beitbridge delays, July 2026: https://iol.co.za/news/south-africa/2026-07-26-beitbridge-truck-gridlock-deepens-as-bma-points-to-zimbabwe-side-delays/ and https://www.freightnews.co.za/article/beitbridge-delays-worsen
- Invoice discounting in SA logistics (vendor guides, used for context only): https://www.sourcefin.co.za/invoice-discounting-logistics-south-africa/ and https://www.tradefinanceglobal.com/posts/debtor-finance-a-viable-alternative-to-overdrafts-for-smes-in-south-africa/

### Partner programmes
- Cartrack Fleet API: https://developer.cartrack.com/docs/fleet-api/fleet-api/ and https://developer.cartrack.com/docs/fleet-api-general/use-cases/
- Karooooo and VW Group Info Services: https://karooooo.com/press-release/cartrack-and-volkswagen-group-info-services-ag-form-partnership-for-fleet-data-integration/
- MiX Integrate: https://www.mixtelematics.com/us/products/mix-integrate/ and Powerfleet Unity Integrate: https://knowledge.powerfleet.com/hc/en-us/articles/22269815314066
- Samsara partner application, OAuth and marketplace listing: https://developers.samsara.com/docs/application-process , https://developers.samsara.com/docs/oauth-20 , https://developers.samsara.com/docs/marketplace-apps , https://developers.samsara.com/docs/technology-partner-program
- Motive partnerships and OAuth: https://helpcenter.gomotive.com/hc/en-us/articles/31079400480285-Partnerships-Overview , https://marketplace.gomotive.com/ , https://developer-docs.gomotive.com/docs/oauth-20
- Netstar data-as-a-service: https://www.netstar.co.za/daas
- CtrlFleet: https://ctrlfleet.co/ and https://www.connectingafrica.com/innovation-hub/hot-startup-of-the-month-south-africa-s-ctrlfleet

### Evidence gaps (stated, not filled)
- No public SA benchmark was found for operating ratio, empty running %, driver cost share or maintenance cost per km. The RFA vehicle cost schedule is a member product and describes itself as a hypothetical model. TruckWys should show each fleet its own figures and, later, k-anonymous network medians, rather than quote an industry number.
- No transport-specific SA debtor-days study was found. Weakly sourced SME figures were excluded.
- No public revenue-share terms were found for any telematics marketplace.
