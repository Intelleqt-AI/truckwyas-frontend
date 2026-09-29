# 03 · Data, charts and copy critique (TruckWys, design-v3)

Read-only review, 28 Sep 2026. Every route captured at 1440 px in light and dark (`shots-data/*-light.png`, `*-dark.png`). Ground truth computed from the full, paginated GET API (`truth.json`, 34 invoices, 28 loads, 23 vehicles, 25 quotes, 16 drivers, 50 expenses).

**Caveats**
- Other agents were rebuilding the shell, Overview, Insights and vehicle/driver detail during capture. Overview and Insights shots use the old shell. Later shots use the new grouped sidebar. Vehicle detail (`fleet_vehicles_11-*.png`) was captured mid-rebuild, with styles missing. Read the findings as problems with the data and the design logic, not with a particular build.
- The API is limited to 60 requests a minute per user, and every agent shares `admin@`. Captures hit 429s, and that exposed a real bug (see K0).

---

## 1. Diagnosis in five lines

1. **The numbers disagree with each other.** "Owed to you" appears as five different values on five screens. The same customer is "Critical, can't be advanced" on one page and "Elevated, meets the rules" on another. The owner reads this as "horrific insights", and they are right: a finance product loses trust on the first contradiction.
2. **Most analytics quietly read only the first 20 records.** "From 20 of your 34 invoices", "20 most recent loads (of 28)", "12 of 20 vehicles" (there are 23). The subtitles admit it, which makes it worse: the text is there to explain a bug.
3. **The text does the chart's job.** Insights subtitles run 20 to 61 words. Charts are 260 px tall under 3 or 4 lines of methodology. Nothing is behind an info icon.
4. **The chart forms are fine; the craft is missing.** The waterfall, dot plot, scatter, ranked bars and ageing stack are the right forms, but they are drawn at default weight with no hero number, no emphasis, no hover and no delta. They look like a wireframe of a good dashboard.
5. **Empty and error states pretend to be data.** A 429 renders as "R 0,00", "Nobody owes you money right now" and "next 0 weeks". "This month" is the default period on a book with no activity since June, so the first panel anyone sees is empty.

---

## 2. Chart-by-chart

Verdict key: **Keep** (polish only) · **Fix** (right form, wrong execution) · **Replace** (wrong form) · **Cut**

| Page | Chart | Question it answers | Verdict | What is wrong | Fix |
|---|---|---|---|---|---|
| Overview | Revenue sparkline in "Revenue received to date" tile | Is cash coming in? | Fix | Six monthly points shown as a grey line with a blue stub for the current month. The label says "to date" but the line shows monthly flow, and the delta is replaced by "No payments in the previous 30 days to compare" (9 words). | Hero figure "Cash received, last 90 days", delta vs the prior 90 days, then a 12-point sparkline in grey with the current month in accent. Move the all-time total to Reports. |
| Overview | "Did revenue cover costs each month?" dumbbell (revenue dot, cost dot, coloured connector) | Did each month make money? | Replace | Dumbbell for a monthly gap is harder to read than a column. The red and blue connectors carry the sign while the dots carry identity: two colour systems in one small chart. "None" is printed on Jul, Aug and Sep. The subtitle is 29 words. The same question is answered on Reports (grouped bars) and Insights (waterfall) with a different number (see K3). | One chart, used everywhere: monthly **net** columns diverging from zero (accent above, `--status-danger` below), 2px gaps, value label on the latest month only, hover shows revenue, costs and net. Empty months get a hairline tick and no text. |
| Overview | Quote funnel ("How far do your quotes get?") | Where do quotes stall? | Fix | Right form, the owner's reference. But it uses 20 of 25 quotes, and "Accepted 3" contradicts the board's "Accepted 6". Drop-off notes ("16 still drafts") sit between the bars and double the height. Bars are 8px, labels 13px, with no stage rate emphasis. | Horizontal funnel with stage count large, conversion % small and muted, drop-off shown as a hatched remainder on each bar with the number in a tooltip. Use all quotes. |
| Overview | "Is the fleet working?" 28-day utilisation squares | Are trucks earning? | Fix | With no loads in 28 days the grid never draws. What shows is a 40-word paragraph and a progress bar for "18 of 20 vehicles are marked available or in use", which is status, not work. | Always draw the 23 × 28 grid, empty cells in a hairline surface. Hero: "0% utilised, last 28 days" with the last-active date in the subtitle. The status count belongs on Fleet. |
| Overview | "Owed to you" past-due meter | How stale is the debt? | Fix | A 100% bar is a one-bar chart. Dark navy in light, pale blue in dark (the ramp inverts). "All of it is past due" is red in light and amber in dark. | Swap for the ageing stack (4 segments), with the >60-day share as the delta line: "100% over 60 days". |
| Insights · Briefing | Two KPI blocks (Outstanding, Overdue) | What do I need to chase? | Fix | Outstanding and Overdue show the same R 627 151,52, which is also the wrong number (K1). Overdue is set in 32px red: a big red number with no action. The list is split into "Needs attention (6)" and "What else needs attention (14)" with different sort orders. | One list, "Overdue invoices", sorted by amount × days late, top 5 plus "Show all 20". One hero number: overdue total, with the count and oldest-days delta in muted text. |
| Insights · Margin | Cumulative waterfall ("Where did the last six months leave you?") | Am I ahead over 6 months? | Keep, fix | Right form. But "None" is printed three times, the total bar is the same blue as the positive steps, it ignores the period filter, and it is missing a R 23 000 payment (K3). Connectors are faint. | Total bar in ink (primary text colour), positives in accent, negatives in danger. Replace "None" with a flat connector. Label the start and the total only. |
| Insights · Margin | "Where does the money go" ranked bars | Which cost category is largest? | Fix | Built from 20 of 50 expenses, pending included. "These entries total R 57 325,25" restates the figure. | Use all approved expenses in the selected period. Keep the rows, drop the footer sentence, show total as the card's hero number. |
| Insights · Cash flow | Cash runway (running line + expected-in columns) | Will I run short? | Replace | Answers "will I run short" without the bank balance, so it cannot. Every invoice is 61+ days overdue but is placed "on the date that customer usually pays", producing a steep climb to R 542k in three weeks: an optimistic fiction. "Expected out" is in the legend but has no data. Subtitle 58 words. | Retitle "Expected receipts". Stacked weekly columns split into "due" vs "overdue, assumed" (hatched for assumed). No cumulative line until a bank balance exists. |
| Insights · Cash flow | "How much falls due in the next 90 days" | What is coming? | Cut | Empty by definition when everything is overdue. It takes a full card to say so. | Merge into the receipts chart above as the "not yet due" series. |
| Insights · Cash flow | Ageing 100% stack + per-customer stacked bars | Where is cash stuck? | Fix | Built from 20 of 34 invoices, so Coca-Cola shows R 67 030,05 instead of R 117 543,80. In-segment white labels on a pale ramp in dark mode fail contrast. The ramp inverts in dark, so ">90 days" becomes the lightest band and reads as least severe. Five legend slots show "None" for three of them. Every row has a red "Oldest invoice issued N days ago", which is status colour used as decoration. | Ordinal ramp validated with `--ordinal` in both themes, darkest (or most saturated) = most late in both. Legend shows only non-empty bands. Per-customer row: name, bar, amount, share, with days late in muted text (red only if over 90). One source for all three ageing views (see K2). |
| Insights · Cash flow | Payment dot plot ("Which customers pay late?") | Who pays late, against terms? | Keep, fix | The best chart in the product and the right form, but 61 words of subtitle, 20 of 34 invoices, and hollow "unpaid" rings that are 8px targets with no hover. The grey band to the terms tick reads as a bar. | Title "Who pays late". Subtitle "Days from issue to payment, against terms". Move the method to an info icon. Solid dot for paid, ring for open, a 24px hit area, and a tooltip with invoice, amount and days. |
| Insights · Fleet | 4 KPI tiles (Available 18 of 20, Health 65, Below 60: 1, Cost/km R 10,97) | Is the fleet ready? | Fix | Wrong denominator (20, should be 23). The average health counts missing scores as 0. "Below 60" disagrees with the service list's "below 70" and "below 50 means book now". Every tile has an 8 to 10 word caveat under the number. | 3 tiles, caveats moved to info icons. Choose one health threshold. Report missing data as "3 unscored", not as zeros in an average. |
| Insights · Fleet | "Which vehicles earn the most" ranked bars | Which trucks pay? | Fix | Every vehicle has exactly one trip, so this ranks single loads, not vehicles. The top earner shows "Uptime 3%". The meta line crams 4 metrics. | Rank by revenue per available day, or hide until there are 3 or more trips. Keep only "R/km" in the meta line. |
| Insights · Fleet | Driver ranking (empty) + 16-row "No revenue recorded" list | Which drivers earn? | Replace | An empty ranking followed by a list of 16 names with "0 trips / Inactive". | Empty state: one line and one action. The list of drivers belongs on Fleet → Drivers. |
| Insights · Fleet | Service check list | Which trucks need a service? | Fix | GP 234 EFG has health 50 and is labelled "Keep an eye on it", while the subtitle says below 50 means "book a service now". It is on the boundary and reads as a contradiction. Six identical amber pills. | Rows sorted by score. Pill only when action is needed ("Book service"). Otherwise a muted score. |
| Insights · Lanes | Revenue/km vs distance scatter | Which lanes are worth running? | Fix | Right form. But every mark is hollow, the average line cuts through labels, "JHB to CPT" and "Johannesburg to Cape Town" are separate lanes, and the y-axis runs to R 200 for two outliers. It uses 20 of 28 loads and says "no lane has 3+ trips" while Reports ranks Port Elizabeth → East London with 3 loads. Subtitle 61 words. | Normalise city names. Log or clipped y-axis. Label the top 3 and bottom 3 only, the rest on hover. Solid marks where n ≥ 3. |
| Insights · Lanes | Cargo ranked bars, weight-band bars | What pays per trip? | Keep, fix | Good ranked form. The weight band "Under 5 t" shows R 20 000 with no bar but sits first. Subtitles 40 to 43 words. | Unranked rows move to the bottom, muted. Subtitle to 8 words. |
| Insights · Lanes | Pipeline 3 KPIs | How much work is booked? | Replace | Three unconnected numbers for what is a flow. Built from 20 of 28 loads (Waiting 4, Transit 2, Delivered 11; the truth is 5, 4 and 16). | A funnel (the owner's reference): Quoted → Accepted → Dispatched → In transit → Delivered → Paid, with count, value and stage rate. This is the single most on-brief chart missing from the product. |
| Fleet heatmap | Pickup weekday × hour heatmap | When do we load? | Fix | Loads without a pickup time pile into 00:00, so the "busiest slot" is an artefact. 168 cells with 10 filled. | Drop untimed pickups (say how many in the info icon), or switch to weekday columns only. |
| Fleet heatmap | "Which routes do you run most?" ranked bars | Most-run routes | Fix | The top route is "TBD → TBD". Four lines of meta per row. Uses 20 of 28 loads. | Exclude unknown routes (count them), share one lane list with Insights and Reports. |
| Vehicle detail | Two 12-month sparklines + "Revenue by month" columns | What does this truck earn? | Replace | One load in 12 months is drawn three times: two sparklines and a 12-column chart with one bar (the one-bar anti-pattern). "Sept" here, "Sep" elsewhere. | With fewer than 3 loads, show the stat tile only ("R 25 573 · 1 load"). The chart appears at 3 or more months with data. |
| Customer risk | "How late does X pay?" columns with dashed 30-day line | Does this customer pay late? | Fix | The axis ticks are 45/90/135 with no unit. Saturated red full-height blocks. The KPI row says "Paid by the due date 100%" next to "Critical risk", and "Late-payment risk 77%" is a score, not a probability. | Dot plot per invoice (the same component as Insights), terms tick, and "days late" as the unit. Rename the score "Risk score 77/100". |
| Fast Pay | Ageing stack + per-customer stacked bars | What is stuck? | Fix | Same view as Insights and Reports with different numbers: 61 to 90 days = 36% here, 61% on Insights. | One ageing component and one data source (K2). |
| Fast Pay | "What would stop your invoices qualifying" ranked bars | Why can't I advance? | Keep | Good causes-of-exceptions pattern (owner reference). But 2 rows both at 100%. | Show it as "0 of 4 qualify" hero + the reasons as chips. Bars earn their place at 3+ reasons. |
| Risk scores | Tier distribution bars | How risky is my book? | Fix | Tier pills in 5 status colours plus a bar per tier: double encoding, and "Prime 0" gets a green pill. "Higher is safer" is the opposite polarity to the customer risk page. | One polarity across the product. A single 100% stacked bar with a direct label per tier. |
| Reports · P&L | Grouped revenue/expense columns | Did money in cover costs? | Replace | This is the third chart for the same question. Expenses in grey sit next to revenue in a light blue at reduced opacity (the "current month highlight" is on an empty September). "R100k" has no space; everywhere else uses "R 100k". | Use the same net chart as Overview (see above). If both series are needed, revenue = accent, costs = neutral, net line in ink. |
| Reports · Cash flow | Weekly in/out columns, 13 weeks | When will cash arrive? | Fix | 11 of 13 weeks are empty. It assumes overdue invoices pay "within two weeks", which is a different rule from Insights (usual payment time), so the two forecasts disagree. | One forecasting rule. Collapse empty weeks or show 8. Hatch the assumed receipts. |
| Reports · Receivables | Ageing ranked rows + "Who owes you the most" | How late is the money? | Keep | The cleanest ageing view in the product: neutral bars, red only for >90, top row in accent. Numbers still miss R 42 610 (K1). | Make this the canonical ageing component and reuse it on Insights and Fast Pay. |
| Reports · Lanes | Ranked lanes with est. margin | Which lanes make money? | Fix | Modelled margin at 0.1% precision ("76.7%") is false precision. Unranked rows are listed with full bars. | Round to whole %. Mark modelled with an info icon. Unranked rows muted, without a bar. |
| Expenses | 6-month spend columns + category bars | How has spending moved? | Fix | "Faded months are only partly loaded on this page": a chart that admits it is wrong. "R0" is printed above empty months, and "R25.9k" uses a decimal point. The table's Amount column overflows the card at 1440. | Server-side totals. Label the latest month only. Use a decimal comma ("R 25,9k"). Fix the overflow. |

**Colour issues seen across the product**
- The ageing ramp inverts between themes (dark = most late in light, lightest in dark). Validate the ordinal ramp per theme.
- Status red is used as decoration: "Oldest invoice issued N days ago" on every row, the Overdue hero figure, and the "Critical risk" chip beside a 100% on-time tile.
- "Expected in" is accent on Reports and grey on Insights. "Expected out" is grey on Reports and orange on Insights. A series must keep its colour across pages.
- Insights and Overview use `#C2410C` orange-red for negatives. Customer risk uses `#EF4444`. Pick one danger token.
- Dark mode flips the status tone: "All of it is past due" is red in light and amber in dark.

---

## 3. KPI consistency

Truth comes from the full API as of 28 Sep 2026. "Unpaid" means SENT, OVERDUE or PARTIALLY_PAID, drafts excluded, balance incl. VAT.

| # | Metric | Page: value shown | Correct value and definition |
|---|---|---|---|
| K0 | Any figure when the API returns 429 | Reports: "Revenue received R 0,00", "Net profit R 0,00, 0.0% margin", "Nobody owes you money right now", "When will cash arrive over the next 0 weeks?" (`shots-data/ratelimited/`) | An error state. "Figures couldn't load. Retry". Never a zero. **Most serious finding in this review.** |
| K1 | Owed to you / outstanding | Overview **R 499 530,27** ("all past due") · Insights Briefing **R 627 151,52** across 31 invoices · Invoices "Overdue balance" **R 627 151,52**, 22 invoices · Insights Cash flow **R 446 732,75** (20 of 34) · Fast Pay **R 499 530,27**, 18 invoices, 11 customers · Reports Receivables **R 499 530,27** · Reports Cash flow "expected in" **R 542 140,27** | **R 542 140,27 across 20 invoices, 12 customers, all overdue.** R 499 530,27 omits two Acme invoices (INV-20260616-70071 and INV-20260616-14253, R 42 610). R 627 151,52 includes drafts. R 446 732,75 is the first 20 invoices only. |
| K2 | Ageing split | Insights: 61 to 90 = 61% (R 274 558), 90+ = 39% (R 172 175) · Fast Pay and Reports: 61 to 90 = 36% (R 181 970, 6 inv), 90+ = 64% (R 317 560, 12 inv) | **61 to 90: 8 invoices, R 224 580,25 (41%). 90+: 12 invoices, R 317 560,02 (59%).** |
| K2b | Largest debtor | Insights Cash flow: Coca-Cola **R 67 030,05** · Fast Pay, Reports, Customer risk: **R 117 543,80** | **R 117 543,80** (3 invoices). |
| K3 | Cash received / revenue | Overview "Revenue received to date" **R 182 052,68** · Reports "Revenue received, all time" **R 182 052,68** · Reports Customers "since 1 Jan" **R 182 052,68** | Paid invoices **R 205 052,68** (10). With part-payments, **R 210 252,68**. INV-20260615-96400 (AVI Limited, R 23 000, paid 16 Jun) is missing everywhere. AVI is absent from "Which customers paid you the most". "All time" and "since 1 Jan" can't both be the same number when a Dec-dated invoice was paid in Jan. |
| K4 | Net result | Overview "Net margin, all time" **14.1%** · Reports "Net profit" **R 25 654,93**, 14.1% · Overview chart and Insights waterfall "Net over 6 months" **R 49 317,15** | Paid revenue less approved expenses, all time: R 205 052,68 − R 156 397,75 = **R 48 654,93 (23.7%)**. Six-month net: **R 72 317,15**. Also: VAT-inclusive revenue less expenses as entered is not a margin. State "incl. VAT" or use ex-VAT for both. |
| K5 | Active loads | Overview **8** · Orders "8 active", "On the road 2" · Overview attention "4 Loads In Transit" · Insights Pipeline "Waiting 4, In transit 2" | **11 active: 3 pending, 2 assigned, 2 loading, 4 in transit (R 179 907,62).** Orders shows 8 because it reads the first 20 loads. |
| K6 | Delivered work | Fleet Vehicles "Delivered revenue R 124 910 from 9 loads" · Insights Pipeline "Delivered R 184 960,23, 11 loads" · Drivers "Completed loads 12" · Reports Lanes "16 loads, R 220 053,44" | **16 delivered or invoiced loads, R 242 781,74.** |
| K7 | Fleet size and availability | Vehicles "12 of 20", "Not earning 11 of 20" · Fleet command "6 of 20 on a job" · Heatmap "30% of the fleet in use" · Overview and Insights "18 of 20 available or in use" · Overview attention "9 Vehicles Idle" · Overview "Available now 12" | **23 vehicles: 12 available, 9 in use, 2 maintenance.** The lists show 20 rows with no pagination, so 3 trucks are invisible. |
| K8 | Health score | Insights "Average 65 (missing = 0)", "Below 60: 1" · Service list threshold 70, "below 50 = book now" · Vehicle list GP 234 EFG = 50 · Vehicle detail "Health 50, Uptime 2.9%" | Pick one: the average over scored vehicles only, one threshold (e.g. below 60 = service), and "3 unscored" as a count. |
| K9 | Time to get paid | Invoices **31.9 days** (9 paid) · Overview and Fast Pay "Not measurable yet" · Customer risk Coca-Cola **42 days** | All paid invoices: **28.8 days** (10). Say "days" once, with a decimal comma: "28,8 days". "Not measurable" on one page and 31.9 on the next is a contradiction. |
| K10 | Quotes accepted | Overview funnel "Accepted 3" (20 of 25) · Quotes board "Accepted 6" | Board is right: 1 ACCEPTED + 5 converted (IT). The funnel must use all 25. |
| K11 | Customer risk polarity | Customer risk (Coca-Cola): "Late-payment risk **77%** · Critical · can't be advanced" · Risk scores: Coca-Cola **62/100, Elevated, meets the rules: Yes**, "higher is safer" | One score, one direction. Recommend **"Risk score, 0 to 100, higher = riskier"** everywhere, and one eligibility verdict. |
| K12 | Lanes with 3+ trips | Insights Lanes "No lane has 3 or more trips" · Reports Lanes ranks PE → East London (3 loads) · Heatmap top route "TBD → TBD" (4) | From all loads: TBD → TBD 3, three lanes with 2. Normalise names ("JHB → CPT" = "Johannesburg → Cape Town") and exclude TBD. |
| K13 | Expenses | Expenses and Insights "R 57 325,25" (20 of 50, all statuses) · Reports "Approved R 156 397,75" | All 50: R 243 526,75. Approved: **R 156 397,75**. Pending: R 87 129,00. |

**Root causes** (for the engineers):
1. Pages fetch `?page=1` (20 rows) and aggregate client-side. Every "from 20 of your N" subtitle is this bug. Aggregate on the server or page through everything.
2. There is no shared metric layer. "Unpaid", "active load" and "delivered" are defined four ways. Put one `metrics.ts` (or backend endpoint) behind every tile.
3. Fetch errors fall through to `?? 0`.

---

## 4. Copy rewrites (§9: title 2 to 6 words, one subtitle of 8 words or fewer, method behind an info icon)

Word counts are for the current text. ⓘ = move the current sentence into the info-icon popover, lightly trimmed.

### Overview
| Current | Words | Replacement title / subtitle | ⓘ |
|---|---|---|---|
| Revenue received to date · "No payments in the previous 30 days to compare" | 4 + 9 | **Cash received** · delta "No payments in 30 days" | Paid invoices incl. VAT, by payment date |
| Net margin, all time · "Not enough revenue in both periods to compare" | 4 + 8 | **Net margin** · "All time" | Paid revenue less approved expenses |
| Owed to you · "All of it is past due" · "Time to pay needs invoices issued in the last 90 days" | 3 + 6 + 11 | **Owed to you** · "100% overdue" | Unpaid sent invoices incl. VAT. Drafts excluded |
| Active loads · "Bookings" · "0 booked in the last 28 days" | 2 + 1 + 6 | **Active loads** · "0 new in 28 days" | |
| Did revenue cover costs each month? · "Each month shows revenue (invoices paid in the month) against costs (approved expenses dated in the month). The line between them is what was left over, or the shortfall." | 6 + 29 | **Monthly net** · "Paid revenue less approved costs" | current subtitle |
| "Covered in 2 of 3 months with activity. Net over all 6: R 49 317,15." | 15 | Cut. Put "6-month net R 72 317" as the chart's hero number. | |
| How far do your quotes get? · "Each stage counts quotes that reached it, from your 20 most recent quotes (of 25), by current status. Invoicing and payment are not linked to quotes here." | 6 + 27 | **Quote funnel** · "All quotes, by furthest stage" | Stage = furthest status reached |
| Latest five | 2 | **Recent quotes** | |
| Latest bookings · "The five most recent loads and where each one stands." | 2 + 10 | **Recent loads** · no subtitle | |
| Is the fleet working? · "Each square is a day in the last 28. Filled means the truck had a load between pickup and delivery. Only loads with a truck assigned count." | 4 + 27 | **Fleet utilisation** · "Last 28 days" | current subtitle |
| "No truck had a load on the road in the last 28 days. The most recent assigned load ended on 17 Jun 2026 (MP 123 FGH)." | 26 | "Idle since 17 Jun" (as the tile delta) | |
| What needs your attention · "Signals from your invoices, quotes and fleet." | 4 + 7 | **Needs attention** · no subtitle | |
| "Invoice Overdue: INV-20260421-1022" / "Tiger Brands Ltd owes R 20,505.65. Due 2026-06-05. Chase now." | 3 + 10 | "Tiger Brands · R 20 505,65" / "115 days late" + Chase button | |
| "9 Vehicles Idle" / "4 Loads In Transit" / "4 active deliveries on the road. All tracking normally." | 3 / 4 / 9 | "9 trucks idle" / cut the in-transit item (it is not an attention item) | |
| What changed recently · "The latest events in your workspace." | 3 + 6 | **Activity** · no subtitle | |
| "New quote created: QT-20260713-5305" | 5 | "Quote QT-…5305 created" | |

### Insights
| Current | Words | Replacement | ⓘ |
|---|---|---|---|
| Page intro "What your own records say about revenue, cash, the fleet and your lanes. Each panel states which records it uses." | 20 | Cut. Title "Insights" only. | |
| What happened this period, and what needs you · "1 Sep to 28 Sep 2026 · TruckWys (Pty) Ltd" | 8 + 10 | **This period** · "1 to 28 Sep 2026" | |
| "No invoices issued, loads delivered or quotes in this period." + "Collected R 0,00 · Costs R 0,00" + "Show the last 3 months" | 22 | "No activity since 16 Jun." + button "Show last 3 months". Better: default the period to the last complete 3 months. | |
| Receivables as of 28 Sep 2026 / Outstanding / Overdue / "Past due date" | 12 | **Receivables** · one hero "R 542 140 overdue" · delta "20 invoices, oldest 176 days" | |
| Needs attention / What else needs attention · "14 more items beyond the briefing above, worth R 374 909,27 in total. Largest amount first." | 16 | **Overdue invoices** · "Largest first" | |
| Did the business make money in this period · "1 Sep 2026 to 28 Sep 2026. Revenue is paid invoices including VAT, by payment date. Costs are approved expenses, by expense date." | 8 + 23 | **Profit this period** · "Paid revenue less approved costs" | current subtitle |
| "No invoices were paid and no expenses were approved in this period." | 12 | "Nothing paid or spent this period." + "Show last 12 months" | |
| Where did the last six months leave you? · 34-word subtitle | 7 + 34 | **Six-month position** · "Cumulative net, by calendar month" | current subtitle, plus "not affected by the period filter" |
| "Over the 6 months the business is R 49 317,15 ahead." | 11 | Cut. The total bar label says it. | |
| Where does the money go · 23-word subtitle | 5 + 23 | **Costs by category** · "Approved expenses, selected period" | |
| "These entries total R 57 325,25." | 5 | Cut. Hero number in the header. | |
| Will you run short of cash in the next 8 weeks? · 58-word subtitle | 10 + 58 | **Expected receipts** · "Next 8 weeks, by week" | current subtitle (and "excludes your bank balance") |
| "Expected receipts stay ahead of expected costs every week, ending R 542 140,27 up after 8 weeks." | 17 | Cut. | |
| How much falls due in the next 90 days · 20-word subtitle · empty line | 8 + 20 + 10 | Cut the panel (merged into Expected receipts). | |
| Where is your cash stuck, and with whom? · 42-word subtitle | 8 + 42 | **Who owes you** · "Unpaid, by days overdue" | current subtitle |
| "Your 3 largest balances add up to R 154 723,50, 35% of the R 446 732,75 listed." | 17 | Cut, or as a delta: "Top 3 = 49%" | |
| "Oldest invoice issued 172 days ago" (per row, red) | 6 | "172 days" (muted, red only over 90) | |
| Which customers pay late? · 61-word subtitle | 4 + 61 | **Who pays late** · "Days to pay against terms" | current subtitle |
| Is the fleet ready to work · "From 20 of your 23 vehicles. Current status, not filtered by period." | 6 + 12 | **Fleet readiness** · "Current status" | |
| Tile captions "2 in maintenance or other status", "Out of 100. 3 without a score count as 0", "Vehicles without a score are not counted", "3 without a cost count as R 0" | 6 / 10 / 7 / 8 | "2 in maintenance" · "3 unscored" · cut · "3 without cost data" | the rules |
| Which vehicles earn the most · 21-word subtitle | 5 + 21 | **Revenue by vehicle** · "Delivered loads, all time" | "Trip counts are not available…" |
| Which drivers bring in the most revenue · 17-word subtitle + empty line (16 words) | 7 + 33 | **Revenue by driver** · empty: "No driver has 3 trips yet." | "Drivers need 3 trips to be ranked" |
| Which vehicles need a service check · 23-word subtitle | 6 + 23 | **Service due** · "Health below 60, lowest first" | thresholds |
| "Keep an eye on it" (pill, ×6) | 5 | "Watch" (pill only below 60), "Book service" below 50 | |
| Which lanes are worth running? · 61-word subtitle | 5 + 61 | **Lane yield** · "Revenue per km against trip length" | current subtitle |
| "No lane has 3 or more trips yet, so every lane is drawn hollow: read them as early signals, not a verdict." | 22 | "Hollow = fewer than 3 trips" (legend only) | |
| Which cargo pays the most per trip · 40-word subtitle | 7 + 40 | **Revenue by cargo** · "Average per trip" | current subtitle |
| How much work is in the pipeline · 25-word subtitle | 7 + 25 | **Load pipeline** · "Count and value by stage" | |
| Do heavier loads pay more per trip · 43-word subtitle | 7 + 43 | **Revenue by weight** · "Average per trip, by band" | current subtitle |

### Fleet, bookings, customers
| Page | Current | Words | Replacement |
|---|---|---|---|
| Fleet vehicles | "Available now 12 of 20 · 6 on a job, 2 in maintenance." | 9 | "Available · 12 of 23" · delta "9 on a job, 2 in service" |
| Fleet vehicles | "Delivered revenue · From 9 delivered loads, all time." | 8 | "Delivered revenue" · "16 loads, all time" |
| Fleet vehicles | "Not earning yet · Vehicles with no delivered load yet." | 9 | "Idle trucks" · "No delivered load yet" |
| Fleet command | "On a job now 6 of 20 · Vehicles with status In use." · "Active drivers 12 of 16 · Drivers with status Active." | 12 + 9 | Cut the captions: "On a job · 9 of 23", "Active drivers · 12 of 16" |
| Heatmap | "Activity heatmap · When your loads are picked up, and the routes you run most." | 2 + 12 | **Activity** · no subtitle |
| Heatmap | "30% of the fleet has status In use." / "Ready to take a load." / "Off the road until marked available." | 8 / 5 / 7 | Cut all three captions. |
| Heatmap | When are loads picked up? · "Pickups by weekday and hour, shaded against the busiest slot. Based on the latest 20 of 28 loads." | 5 + 18 | **Pickup times** · "By weekday and hour" |
| Heatmap | Which routes do you run most? · 17-word subtitle | 6 + 17 | **Top routes** · "By number of loads" |
| Driver detail | "Performance" card with 6 rows of "—" / 0 | 12 | Cut the card until data exists. Empty state: "No trips yet." |
| Driver detail | "Hire date 2022-07-31" | | "31 Jul 2022" |
| Orders | "Waiting for a vehicle · Pending orders. Assign a vehicle to move them forward." | 4 + 9 | "Unassigned · 3" + link "Assign" |
| Orders | "On the road · In transit. 2 orders loading, 1 assigned." | 3 + 8 | "In transit · 4" · "2 loading, 2 assigned" |
| Orders | "Value of active orders · Order totals across 8 active orders." | 4 + 7 | "Active value · R 179 908" · "11 orders" |
| Quotes board | "Medium confidence" on every card | 2 × 25 | Cut. Show confidence only when high or low. |
| Load detail | "R 10.00" base rate per km | | "R 10,00" |
| Customers | "Everyone you quote and invoice, with their payment terms and credit limits." | 12 | Cut. |
| Customer detail | "You have not quoted Coca-Cola Beverages SA yet." + "Their value and win rate appear here once you send them a quote." + "No quotes yet for this customer." | 27 (3 lines saying the same) | "No quotes yet." + button "New quote" |
| Customer risk | Intro, 36 words | 36 | "Risk score 77 · Critical" + ⓘ with the rule |
| Customer risk | What does this mean for X? · "X has a late-payment risk score of 77% (CRITICAL). 5 invoices considered, 3 settled or running more than 30 days past due." | 7 + 24 | Cut the card. The tiles already say it. |
| Customer risk | How late does X pay? · 27-word subtitle | 5 + 27 | **Days late per invoice** · "Against due date" |
| Customer risk | "Paid by the due date 100% · Of 2 paid invoices" | | "Paid on time · 2 of 5" (open invoices count against it) |
| Customer risk | Which invoices drive the score? · 12-word subtitle | 5 + 12 | **Invoices scored** · "Drafts excluded" |

### Finance and Fast Pay
| Page | Current | Words | Replacement |
|---|---|---|---|
| Invoices | "Nothing invoiced in September yet · No invoice has an issue date this month, so there is nothing collected to compare. 4 drafts are ready to send." | 5 + 21 | "4 drafts to send" + button "Review drafts". Drop the half-width zero card. |
| Invoices | "Overdue balance · 22 invoices past the due date · Unpaid amount incl. VAT" | 12 | "Overdue · R 542 140" · "20 invoices" |
| Invoices | "Average time to get paid 31.9 days · Issue date to payment, across 9 paid invoices" | 12 | "Days to pay · 29" · "10 paid invoices" |
| Invoices | "This list holds the 20 most recent of 34 invoices; search and filters apply to these. The totals above cover all 34." | 22 | Delete after fixing pagination. |
| Invoice detail | "Note: Auto-generated from Load LOAD-20260616-3702" | 5 | "From load LOAD-…3702" (link) |
| Expenses | "No expenses recorded in September yet · The most recent expense is dated 16 Jun 2026. Add fuel, tolls and other costs as they happen so margins stay current." | 6 + 22 | "Last expense 16 Jun" + button "Add expense" |
| Expenses | "This page holds the 20 most recent of 50 expenses. Search, filters, totals and charts on this page use these 20; Export CSV exports the filtered list." | 27 | Delete after fixing pagination. |
| Expenses | How has spending moved over six months? · 22-word subtitle | 7 + 22 | **Monthly spend** · "All statuses, by expense date" |
| Expenses | Where does the money go? · 15-word subtitle | 5 + 15 | **Spend by category** · "Last 6 months" |
| Reports P&L | Did money in cover costs each month? · 24-word subtitle | 7 + 24 | **Monthly net** · "Last six months" |
| Reports P&L | "14.1% margin all time; revenue less approved expenses" | 8 | "23,7% margin" (as the delta) |
| Reports Cash flow | When will cash arrive over the next 13 weeks? · 45-word subtitle | 9 + 45 | **Expected receipts** · "Next 13 weeks" |
| Reports Cash flow | "Nothing is forecast going out: there are no future-dated expenses and none in the last three months to project from." | 20 | "No costs to forecast." |
| Reports Cash flow | Which weeks have money moving? · "11 weeks with nothing expected in or out are left out." | 5 + 11 | **By week** · no subtitle |
| Reports Receivables | How late is the money customers owe you? · 14-word subtitle | 8 + 14 | **Ageing** · "Unpaid, by days overdue" |
| Reports Receivables | Who owes you the most? · 16-word subtitle | 5 + 16 | **Top debtors** · no subtitle |
| Reports Customers | Which customers paid you the most this year? · 16-word subtitle | 8 + 16 | **Top payers** · "Since 1 Jan 2026" |
| Reports Lanes | Which lanes make you money? · 44-word subtitle | 5 + 44 | **Lane margin** · "Modelled, not recorded costs" |
| Reports Fast Pay | "Fast Pay is not live yet" + 22 + 41 words | 69 | "Fast Pay · Not live" + one line "Advances on delivered invoices. Coming soon." + link |
| Fast Pay page | Intro 14 words, 3 subtitles of 18, 36 and 18 words, "How Fast Pay will work" 3 × 15 to 18 words | ~120 | Title "Fast Pay" + "Not live" chip. Panels: **Waiting on customers**, **Qualifying invoices** ("0 of 4 qualify"), **How it works** (three 4-word steps: "Pick a delivered invoice", "See the fee first", "Get paid, we collect"). |
| Risk scores | Intro 34 words | 34 | **Customer risk** · "Fast Pay scoring, not live" |
| Risk scores | How are your customers spread across risk tiers? · 28-word subtitle | 8 + 28 | **Risk tiers** · "10 customers, all scores expired" |
| Risk scores | Which customers are safest to advance against? · 12-word subtitle | 7 + 12 | **Scores by customer** · "Safest first" |
| Insurance | 3 paragraphs, 56 words | 56 | "Insurance · Not live" + "Cover costs per truck, coming soon." |

**Formatting (whole product):** use a decimal comma ("31,9 days", "R 25,9k", "14,1%", "R 10,00"); a space after R in axes ("R 100k", not "R100k"); "Sep" not "Sept"; no ISO dates in UI ("2026-06-05" → "5 Jun 2026"); no Title Case in generated alerts ("Invoice Overdue", "Vehicles Idle"). "Rule-based", "Modelled" and "Default" are jammed against labels on vehicle detail ("Condition scoresRule-based", "0.35 L/kmDefault").

---

## 5. Against the owner's references

| Reference | What it does | TruckWys today | Gap |
|---|---|---|---|
| Logistics analytics page (huge KPI numbers, little text, ranked "what causes exceptions" bars, a funnel) | 4 giant numbers with one-word labels. Every chart is under a 3-word title. Ranked bars of causes. One funnel for the core process. | Numbers at 28 to 32px under 10-word captions. Ranked bars exist (cargo, categories, Fast Pay checks) but are buried under 40-word subtitles. **No load funnel anywhere**: the quote funnel stops at "Completed 0" and never reaches invoiced and paid. | Build one quote → load → invoice → paid funnel. It is the business. Make KPI numbers 40 to 48px and captions 2 to 4 words. |
| Dark KPI tiles with micro sparklines | Value, delta vs a named period, 12-point sparkline, current point highlighted | One sparkline in the product (Overview revenue). No tile shows a delta: every "vs" slot is an apology ("Not enough revenue in both periods to compare"). | Every KPI gets value · delta · sparkline, or it becomes a plain number without the empty slot. |
| Hatched-bar chart with rich tooltips | Hatched = projected or assumed. The tooltip lists every series at that X. | No hatching (forecasts look as factual as actuals). No hover on any custom chart; "Show as table" is the only way to read a value. | Hatch assumed receipts and modelled margins. Crosshair tooltips on every time series. |
| Report library of cards | A grid of named reports, each a card with a thumbnail and one line | Reports = 6 pill tabs on one page, each a single panel. Insights = 5 tabs. The two overlap on 4 subjects. | Merge Insights and Reports into one library: ~12 cards (P&L, Receipts forecast, Ageing, Top debtors, Who pays late, Lane yield, Cargo, Fleet utilisation, Service due, Quote funnel, Costs, Fast Pay readiness). Each opens a full page with one chart and one table. |

---

## 6. Top 15 changes (ordered by effect on perceived quality)

1. **Never render a failed fetch as zero.** A 429 currently shows "R 0,00 net profit" and "Nobody owes you money". Add an error state with a retry, everywhere.
2. **One metric layer.** Define unpaid, overdue, cash received, active load, delivered load, vehicle count, health and days to pay once, and feed every tile from it. This fixes K1 to K13. Owed to you = R 542 140,27 on every screen.
3. **Stop aggregating page 1.** Remove every "from 20 of your N" by aggregating server-side. That deletes about 15 subtitles for free and fixes Coca-Cola's R 67k vs R 117k.
4. **One risk score, one direction, one verdict.** Coca-Cola can't be both "Critical, can't be advanced" and "Elevated, meets the rules".
5. **Enforce §9 on every card.** Titles of 2 to 6 words, one subtitle of up to 8 words, everything else behind an info icon. Insights drops from ~500 words per tab to ~120. Use section 4 verbatim.
6. **Default Insights to the last 3 complete months** (or "since last activity"). The first thing the owner sees today is an empty "This period" card.
7. **Build the funnel.** Quote → accepted → dispatched → delivered → invoiced → paid, with count, value, stage rate and drop-off. It is the owner's reference and the core of a fleet-finance product.
8. **KPI tile contract.** 40 to 48px value, 2 to 4 word label, a delta against a named period, and a 12-point sparkline. No caveat sentences under numbers. Maximum 4 per row. Retire "Nothing invoiced in September yet" half-width zero cards.
9. **One chart per question.** "Did revenue cover costs" is drawn three ways (dumbbell, grouped bars, waterfall) with two different answers. Keep a diverging monthly net column and the six-month waterfall. Ageing is drawn three ways: keep the Reports Receivables version.
10. **Hover and focus on every chart.** Crosshair with all series on time charts. Mark-level tooltips (value first) on bars and dots with a 24px hit area. This is the biggest single "Dribbble" upgrade.
11. **Hatch what is assumed.** Forecast receipts for overdue invoices, modelled lane margins and default fuel figures get the hatched texture from the owner's reference plus an info icon, so assumption never looks like fact.
12. **Fix the colour system.** Validate the ordinal ageing ramp in both themes (it inverts today). One danger token. Status colour only for state, not for "Oldest invoice issued…" on every row. A series keeps its colour across pages (Expected in/out swap today).
13. **Hide charts that have too little data to say anything.** One load → a stat tile, not three charts (vehicle detail). An empty ranking → one line, not 16 "0 trips" rows (Insights drivers). A 168-cell heatmap with 10 midnight artefacts → weekday bars.
14. **Clean the lane data.** Normalise "JHB → CPT" / "Johannesburg → Cape Town" and exclude "TBD → TBD". Then Insights, Reports and Heatmap agree on lane counts, and the scatter gets filled marks.
15. **South African number formatting throughout.** Decimal comma ("28,8 days", "14,1%"), "R 100k" with a space, "Sep", no ISO dates, sentence-case alerts. Small, but every dot-decimal reads as imported and unfinished.

---

### Evidence index (`shots-data/`)
- Overview: `root-light.png`, `root-dark.png`
- Insights: `insights-{light,dark}.png`, `insights-{Margin_engine,Cash_flow,Fleet,Lanes}-{light,dark}.png`
- Reports: `finance_reports-{light,dark}.png`, `finance_reports-{Cash_flow,Receivables,Customers,Lanes,Fast_Pay}-{light,dark}.png`. Rate-limited zero state: `ratelimited/`
- Finance: `finance_invoices-*`, `finance_expenses-*`, `finance_invoices_33-*`
- Fleet: `fleet_vehicles-*`, `fleet_drivers-*`, `fleet_overview-*`, `fleet_heatmap-*`, `fleet_vehicles_11-*` (mid-rebuild), `fleet_drivers_1-*`, `fleet_drivers_16-*`
- Bookings: `bookings_orders-*`, `bookings_quotes-*`, `bookings_quotes_25-*`, `bookings_28-*`
- Customers and Fast Pay: `customers-*`, `customers_11-*`, `customers_11_risk-*`, `capital-*`, `capital_risk_scores-*`, `insurance-*`
- Raw inventories: `inv-*.json`, `reports-text.json`. Ground truth: `../truth.json`
