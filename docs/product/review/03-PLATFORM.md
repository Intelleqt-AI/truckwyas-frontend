# 03 · Platform review: IA, Copilot and AI, first run, settings, public pages

Reviewed 28 Sep 2026, read-only, against `truckwyas-frontend` on `truckwys/design-v2` (app at localhost:3815) and `truckwys-backend` main. Inputs read first: `docs/brand/DESIGN-PRINCIPLES.md`, the insights and reports strategy spec (`origin/truckwys/insights-reports-strategy`), and `backend-review/00-SUMMARY.md` and `04-AI.md`. Nothing in either repo was changed. Only GET requests were made; every non-GET API call was aborted in the Playwright route handler. No Copilot prompt was sent, and no public quote was accepted or declined.

Evidence lives in `big-review/shots/`, named `plat-*`:
- desktop and mobile captures, with the page text in matching `.txt` files
- `plat-empty-*`: a brand-new fleet, simulated by zeroing every GET response in the browser (arrays become empty, numbers become 0), with no data changed
- `plat-public-*`: the client-facing quote and invoice pages

The scripts are `big-review/plat-shots.mjs`, `plat-empty.mjs`, `plat-overflow.mjs` and `plat-public.mjs`.

---

## The verdict in one paragraph

Design v2 fixed how the screens look. It did not fix what they say. The navigation is organised around the objects the database holds: bookings, fleet, customers, finance, capital, insights, insurance, copilot. The product story is a sequence of jobs: price a load, get it paid, know what it made, then get capital. As a result the same money figure appears in five places, and on this build those places disagree.
- "Owed to you" is **R 499 530,27 on 18 invoices** on Overview and Fast Pay.
- It is **R 627 151,52 on 31 invoices** on Insights.
- Overview gives four different answers for how many loads are on the road.

A new fleet sees a wall of R 0,00 tiles, and its first call to action is "Create invoice", which it cannot use yet. On the customer's side, the invoice email and the public invoice page each point to the other for banking details, and the company model has no bank fields at all. So the fleet's customer cannot pay by EFT without phoning.

AI mostly lives on a chat page and in "AI" labels on rules. It should live at the point of decision (the price, the overdue invoice, the number that moved), be labelled honestly, and always show its sources. The fixes are mostly frontend and small. Two need backend work: bank details on invoices, and a pricing and cost profile in settings. Both matter commercially.

## Top 12, ranked by impact

| # | Finding | Area | Verdict | Backend? |
|---|---|---|---|---|
| 1 | **Customers cannot pay.** The invoice email prints "Bank: Available on invoice" and "Account Number: Available on invoice" (`resend_email.py:340-345`). The public invoice says "For banking details, contact {company}" (`PublicInvoice.tsx:180`). `Company` has no `bank_*` fields. | Public | REBUILD | Yes (S) |
| 2 | **The same KPI gives different numbers.** Owed to you: R 499 530,27 (18 invoices) on Overview and Capital, but R 627 151,52 (31 invoices) on Insights. Loads on the road on one Overview screen: "Active loads 8", "4 Loads In Transit", "2 still in transit" and "No truck had a load on the road in the last 28 days". Idle trucks: "9 Vehicles Idle" versus "Available now 12". | Cross-cutting | REBUILD (metric registry) | Yes (M) |
| 3 | **Nav follows the data model, not the job.** There are 9 icon-only items plus Settings, and no labels on desktop. Receivables appear in Overview, Insights (Briefing and Cash flow), Finance (Invoices header and Reports > Receivables) and Capital. P&L appears in three places, lanes in three, fleet utilisation in four. | IA | REBUILD | No |
| 4 | **The phone nav hides half the product.** The bottom bar scrolls sideways with no affordance. Capital is cut off, and Insights, Insurance, Copilot and Settings are off-screen (`plat-overflow.mjs`). CSS says "Copilot stays reachable from the tab bar" (`theme.css:1367`), but it is item 9 of 10. | Mobile | REBUILD | No |
| 5 | **First run shows zeros and the wrong first action.** A new fleet sees four R 0,00 or 0 tiles (a banned pattern). "Owed to you R 0,00 · Every sent invoice is paid" is shown when nothing has been sent. The primary button is "Create invoice", but the invoices empty state says "Invoices are generated from completed bookings". There is no guided path to a first priced quote. | First run | REBUILD | No |
| 6 | **Onboarding never asks for what a correct quote or invoice needs.** It asks company name, industry and phone, then imports. It never asks for fuel zone or live diesel, VAT number, bank details, default payment terms, cost per km or accounting and TMS connections. The hand-set diesel price that under-prices quotes (backend summary #1) is buried in Settings > Company details. | First run / Settings | REBUILD | Partly |
| 7 | **"AI" on rules, still.** Suggested price = "true cost + 25%", yet it is applied with the toast "Applied AI-recommended price" and the label "✓ AI price applied" (`QuoteBuilder.tsx:805,1829`). Every saved quote gets `confidence: "MEDIUM"` (`:1003`), which is shown as "Medium confidence" on quote cards. Signup and Billing promise "AI-powered quote optimisation" and a "Fleet intelligence dashboard". Overview says "All tracking normally" with no telematics (`views.py:4161`). | Honesty | REMOVE / RELABEL | Small |
| 8 | **Copilot is a chat island.** Its starters are overdue, pipeline, fleet status, add customer and draft quote. It has no report or pricing tools and no citations. A keyword-matched legacy action path makes "who owes me" or "billing" propose sending a reminder, and "advance" propose a Fast Pay request even though Fast Pay is not live (`agent.py:544-584`). | AI | REBUILD | Yes (M) |
| 9 | **Mobile quote builder and Settings scroll sideways.** At 390px, `main` is 559px wide on New quote and 475px on Settings. Settings keeps a fixed 220px sidebar on a phone. Quote fields truncate ("Select c", "City / ad"), and the chat button sits over the tab bar. | Mobile | REBUILD | No |
| 10 | **Settings mixes identity, pricing policy and clutter.** Company details holds the diesel R/L, a "Default toll rate (R/km)" (which contradicts plaza-accurate tolls) and SLA. "Directory" duplicates Customers and Vehicles. "Risk-scoring API" exposes the underwriting engine (about 25% hard-coded, 04-AI F6) to fleet admins. | Settings | REBUILD | Partly |
| 11 | **Dead and orphan routes.** Unreachable: `/fleet/overview` ("Fleet command") and `/capital/risk-scores`. `/invoice/view/:id` without a token always shows "link not valid". `NewQuote.tsx` (4,400 lines) is not routed. There are two vehicle-detail URLs (`/fleet/vehicles/:id` and `/:id/financial`). Viewers can open "Profile & settings" but are bounced to `/` because `/settings` is gated to finance roles. | IA | REMOVE / MERGE | No |
| 12 | **The public quote cannot capture why a customer declines** (it is one click, with no reason), which starves win/loss (R7) and the pricing model. It also omits what the price includes (fuel basis, tolls, waiting time), the sender's contact details and a PDF. | Public | REBUILD | Yes (S) |

---

## 1. Information architecture

### 1.1 Route map as built

| Route | Page | Reached from | Notes |
|---|---|---|---|
| `/` | Overview | Nav "Home" | Eight panels; see duplication below |
| `/bookings` → `/bookings/orders` | LoadsList | Nav "Bookings" | The nav lands on Orders, but the product starts at quotes |
| `/bookings/quotes`, `/orders`, `/history` | LoadsList tabs (Quotes · Orders · History) | Section tabs | The Quotes tab is a kanban with a "Board / List" toggle. Its empty board says "Load 10 more (0 left)" |
| `/bookings/quotes/new`, `/:id/edit`, `/:id` | QuoteBuilder, QuoteDetail | | |
| `/bookings/:id` | Bookings (load detail) | | |
| `/fleet/vehicles`, `/fleet/drivers` (+ `/:id`, `/:driverId`, `/financial`) | Vehicles, Drivers, profiles | Nav "Fleet" | FLEET_TABS has only Vehicles and Drivers |
| `/fleet/heatmap` | FleetHeatmap | A secondary button on Vehicles | TMS territory. Its top route is "TBD → TBD" |
| `/fleet/overview` | FleetDashboard "Fleet command" | **Nothing** | Orphan |
| `/fleet/vehicles/:id/financial` | VehicleFinancialProfile | Tab on vehicle | Finance-role gated, while `/fleet/vehicles/:id` is not gated and renders the same component |
| `/customers`, `/customers/new`, `/customers/:id` | Customers | Nav "Customers" | |
| `/customers/:id/risk` | CustomerRisk | Customer detail, Capital | "AI risk" rules score (04-AI F7) |
| `/finance/invoices`, `/new`, `/:id` | Invoices | Nav "Finance" (icon $) | |
| `/finance/expenses` | Expenses | Tab | |
| `/finance/reports` | FinanceReports (Profit and loss · Cash flow · Receivables · Customers · Lanes · Fast Pay) | Tab | |
| `/capital`, `/capital/request`, `/capital/advances/:id` | Capital (Fast Pay, not live) | Nav "Capital" | The page is mostly a debtors ageing: a third copy |
| `/capital/risk-scores` | RiskScoreView | **Nothing** | Orphan |
| `/insights` | Insights (Briefing · Margin engine · Cash flow · Fleet · Lanes) | Nav | The strategy spec kills four of these five tabs |
| `/insurance` | "Not live yet" page | Nav | A top-level nav slot for a page that says nothing is offered |
| `/copilot` | Copilot | Nav, header omnibox | The omnibox is hidden under 640px |
| `/settings/:section` + 3 sub-pages | Settings | Nav gear, profile menu | Gated to finance roles, but the profile menu offers it to everyone |
| `/admin/:section` | AdminDashboard | Settings > Platform | Superuser check inside the page |
| Public: `/quotes/view/:id/:token`, `/invoice/view/:id/:token`, `/invoice/view/:id` | Client documents | Email links | The token-less route always errors |
| Legacy redirects (11) | `/quotes`, `/cash`, `/control`, `/expenses`, `/loads/:id`… | | Fine; keep for old links |
| Dead file | `pages/NewQuote.tsx` (≈4,400 lines, still says "AI QUOTE ANALYSIS") | Not routed | Delete |

### 1.2 What repeats (the owner's "screens repeat information")

| Figure | Where it appears today | Should live |
|---|---|---|
| Owed / overdue / ageing | Overview tile, Overview attention list, Insights Briefing "Receivables", Insights Cash flow tab, Invoices header, Reports > Receivables, Capital (full ageing, "who it is waiting on") | **Get paid > Debtors** (report R8). Overview shows one tile that links there. Capital cites it. |
| Revenue vs cost by month | Overview chart, Insights Margin engine, Reports > P&L | **Reports > Management P&L** |
| Lanes | Insights Lanes, Reports > Lanes, Fleet heatmap "routes you run most" | **Reports > Lane profitability**; Insights cites findings only |
| Fleet utilisation and status | Overview "Is the fleet working?", Fleet command (orphan), Heatmap, Insights Fleet | **Fleet > Vehicles** list columns only. TruckWys is not a TMS: remove the utilisation panels |
| Customers list | Customers page, Settings > Directory > Customers, Reports > Customers | Customers (list), Reports (profitability). **Remove the Settings copy** |
| Vehicles list | Fleet > Vehicles, Settings > Directory > Vehicles | Fleet. **Remove the Settings copy** |
| Recent activity | Overview "What changed recently" (five "New quote created" rows, 76 days old) | Remove. The notification bell already does this |

### 1.3 Findings

1. **The nav order has no story.** Home, Bookings, Fleet, Customers, Finance, Capital, Insights, Insurance, Copilot. Fleet (a TMS concern) sits second. "Know your numbers" is split across Finance > Reports and Insights, eight positions apart. Verdict: REBUILD.
2. **An icon-only 60px rail hides labels on desktop.** Seven of the nine icons are generic (calendar, layers, shield, robot). Finance is a "$" icon but routes to `/invoices`. Linear, Notion and Stripe all use a labelled sidebar at this item count. Verdict: REBUILD as a labelled, collapsible 220px sidebar.
3. **"Bookings" lands on Orders.** The first thing a fleet does in TruckWys is price a load, so the section should be named for the job and open on quotes.
4. **Insurance and Capital take primary slots while not live.** The principles say pre-launch features must say so plainly. They do not say such features earn a nav slot. Verdict: demote both to one "Coming soon" group at the bottom, or into Get paid (Capital) and Settings or Vehicles (Insurance).
5. **Two surfaces answer "know your numbers": Insights and Finance > Reports.** The strategy spec's split (Reports: what happened; Insights: what to change) is right, but the IA must make it visible. Put both under one "Numbers" section.
6. **Role gating disagrees with the nav.**
   - VIEWER and DRIVER see "Profile & settings" in the profile menu (`OSLayout.tsx:388`), but `/settings/*` is FINANCE_ROLES-only (`App.tsx:312`), so they bounce to `/`. They cannot reach their own profile or password.
   - Split the gate: My account for everyone, Workspace for admins.
7. **Orphans and duplicates** are listed in 1.1. Verdict: REMOVE `/fleet/overview`, `/capital/risk-scores` and `/invoice/view/:id` (token-less), plus `NewQuote.tsx`. MERGE `/fleet/vehicles/:id` and `/financial` into one vehicle page with a Money tab. Also MERGE the Directory items away.

### 1.4 Recommended navigation

Principle: **four jobs, in the order money moves**, then the tools that serve all of them. Labels are verbs or plain nouns a fleet owner uses. Everything is one click from the rail.

```
DESKTOP (labelled sidebar, 220px, collapsible to 60px icons)
┌──────────────────────────┬───────────────────────────────────────────────────┐
│ TruckWys  [Fleet name ▾] │  [ Ask about your business…        ⌘K ]  🔔  (DZ) │
│                          ├───────────────────────────────────────────────────┤
│ Today                    │                                                   │
│                          │                                                   │
│ Quote                    │   Quotes · Loads · Rate cards (later)             │
│ Get paid                 │   Invoices · Debtors · Expenses                   │
│ Numbers                  │   For you (insights) · Reports                    │
│                          │                                                   │
│ Customers                │                                                   │
│ Fleet                    │   Vehicles (with costs) · Drivers                 │
│                          │                                                   │
│ ── Coming soon ──        │                                                   │
│ Fast Pay                 │   (shows "Not live" chip; hidden once a fleet     │
│                          │    opts out; becomes "Capital" at launch)         │
│                          │                                                   │
│ Settings                 │                                                   │
│ Help and what's new      │                                                   │
└──────────────────────────┴───────────────────────────────────────────────────┘
```

| New item | Contains (tabs) | Replaces |
|---|---|---|
| **Today** | The first-run checklist until done, then the action queue (see 3.3). At most four KPIs, each a link | Overview |
| **Quote** | Quotes (default, list first, board as a view option) · Loads (active and delivered, one list with a status filter) | Bookings (Quotes, Orders, History) |
| **Get paid** | Invoices · Debtors (ageing, as-at date, reminders, promised dates) · Expenses | Finance Invoices and Expenses, Reports > Receivables, Insights Cash flow, the Capital ageing |
| **Numbers** | For you (the insight feed with value delivered) · Reports (library: P&L, Load ledger, Lanes, Customers, Trucks, Cash forecast, VAT) | Insights (5 tabs), Finance > Reports (6 tabs) |
| **Customers** | List · detail with statement, profitability and payment behaviour | Customers, Settings Directory copy |
| **Fleet** | Vehicles (cost profile per truck) · Drivers | Fleet; heatmap and command removed |
| **Fast Pay** (Coming soon group) | The pre-launch explainer, citing Debtors rather than re-rendering it | Capital |
| Insurance | Fold into Vehicles (per-truck insurance cost as a cost-profile line) and "Coming soon" copy there | Insurance page |
| Copilot | **Not a nav item.** A ⌘K command bar in the header plus a right-side panel, available on every page (see 2.4). The full-page history view stays reachable at `/copilot` from the panel | Copilot nav item |

```
PHONE (390px): five fixed tabs, no horizontal scroll
┌────────────────────────────────────┐
│ TruckWys            🔍 Ask   🔔 (DZ)│  ← Ask opens the Copilot sheet
├────────────────────────────────────┤
│                                    │
│   page                             │
│                                    │
│                   [ + New quote ]  │  ← one FAB on Today and Quote only
├──────┬──────┬──────┬──────┬────────┤
│Today │Quote │Get   │Num-  │ More   │
│      │      │paid  │bers  │        │
└──────┴──────┴──────┴──────┴────────┘
More sheet: Customers · Fleet · Fast Pay (not live) · Settings · Help · Sign out
```

Rules:
- Every section's first tab is its URL: `/quote` → quotes, `/get-paid` → invoices, `/numbers` → for you. Old URLs redirect, following the existing `SectionRedirect` pattern.
- The rail badge shows counts only when they need action: Get paid (overdue count) and Quote (quotes awaiting a reply). There is no 25-unread bell badge competing with it.

---

## 2. Copilot and "AI intuitive"

### 2.1 What exists

- **Copilot page** (`pages/Copilot.tsx`). It has a history sidebar, starters ("What's overdue?", "Quotes pipeline", "Fleet status", "Add a customer", "Draft a quote"), markdown replies with a fake typewriter, and an "AI available / Rules engine only" chip. The chip appears only after the first reply.
  - It has two action systems:
    - Server proposals (`ProposalCard`, confirm-first, audited). These are good.
    - A legacy `proposed_action` whose endpoint and body the client POSTs verbatim (`runAction`, `Copilot.tsx:208`). The backend fills it by keyword match (`agent.py:544-584`): any message containing "owed", "billing" or "collect" gets a "Send payment reminder" card, and "advance" or "get cash" gets "Request advance" with a net payout and tier. That second one happens even though `CAPITAL_LAUNCHED` hides the Fast Pay starter.
  - Tools: `query_records` plus generic propose create, update, delete and email (`copilot_tools.py`), available only when the provider is OpenAI (04-AI).
  - There is no tool that opens a report with filters, explains a metric, or prices a load.
- **Header omnibox** "Ask Copilot anything…". Enter navigates to `/copilot?q=…` and auto-sends. That puts free text, often customer names, in the URL and browser history. It is hidden under 640px, and there is no ⌘K shortcut.
- **Quote builder.** It has a floating "AI assistant" chat (`AIChatPanel`) for natural-language fill. Its FAB overlaps the tab bar on phones. It also has a recommendation card: "Personal AI / Platform AI" chip, "Suggested price / true cost + 25%", Margin, Win probability, "Apply" (toast "Applied AI-recommended price"), and "✓ AI price applied".
- **Insights Briefing.** It is honestly labelled ("AI summary" chip, or "Written from your records by fixed rules, not by AI"). This is the one good pattern to copy.

### 2.2 Findings (ranked)

1. **AI sits in a separate room.** The questions a fleet owner has come up while looking at something: "Is R18,500 enough for this load?", "Why did margin drop?", "Who should I phone?". Today they have to leave the page, retype the context into a chat and get prose back. Verdict: REBUILD around inline moments; keep chat as the fallback.
2. **Labels are dishonest at the moment of decision.**
   - Cost + 25% is a rule, but it is applied as "AI-recommended".
   - "Platform AI" is a pooled cross-tenant model that has never trained here (04-AI F1, F2).
   - Win probability and margin are shown in green "profit" on costs that have no cost model (backend summary #2).
   - Fix: every number carries its basis ("Rule: your cost + 25%", "Model: trained on 212 of your quotes, Brier 0.18") or it is not shown.
3. **The keyword actions are a gimmick with risk.** A reminder card appearing for "who owes me?" teaches users that Copilot guesses. An advance request card for a product that is not live contradicts the principles ("show nothing that implies money is available"). Verdict: REMOVE `_propose_action` and `runAction`; use server proposals only.
4. **There are no sources.** Answers do not say which report, filter or records they came from, so the owner cannot check them, and the POPIA and injection exposure (04-AI F9, F10) is invisible. Verdict: every answer ends with source chips that open the report pre-filtered.
5. **The starters point at the TMS** ("Fleet status: active, idle and in maintenance") rather than money. Verdict: replace them with money questions (2.4).
6. **The typewriter animation is theatre.** It slows the reading of a number and was not real streaming. Verdict: REMOVE; stream real tokens or render at once.

### 2.3 Where AI should appear (and how it is labelled)

The rule, from the strategy spec: **deterministic code produces every number. A model may rank, draft, extract or explain, and says so.** There are three labels, used everywhere:

| Label | Means | Example |
|---|---|---|
| **Calculated** (or no label) | Arithmetic on recorded data | Fuel at R 29,11/L × 520 L; tolls from 6 SANRAL plazas |
| **Estimate · rule** | A fixed formula or default | Suggested price = your cost + 25% margin floor |
| **Model** / **Drafted by AI** | Trained model or LLM output, with n, date and "check before sending" | Win likelihood 40 to 55% (model, 212 of your quotes) · Reminder email drafted by AI |

| Moment | What appears | Type | Priority |
|---|---|---|---|
| **Quote: is this price enough?** | A price check strip under the total: floor price from the cost profile, margin at this price, the lane's last 5 prices from your own history, and the market band only when k≥5 operators. A model win likelihood appears only when a model qualifies. | Calculated + rule; model when qualified | P0 |
| **Quote: type or say the load** | "Describe the load" fills the form. Every field it filled is marked "Filled from your text" with an undo, and it says when the regex fallback was used ("Filled by basic matching, check weights"). | LLM extraction | P0 (exists; label it) |
| **Quote: diesel moved** | On open or sent quotes: "Diesel is up 40c since this was priced. R 620 less margin. Reprice?" | Calculated | P1 (backend: official price feed, 03-FUEL) |
| **Invoice: who to chase** | On an overdue invoice: "Tiger Brands usually pays 18 days late; this one is 115 days late. Last reminder: never." Then a reminder drafted in the chosen tone, previewed, edited and sent by the user. | Calculated + drafted by AI | P0 |
| **Invoice: delivered, not invoiced** | Get paid list: "3 loads delivered with no invoice, R 61 200. Create invoices" (bulk, reviewed). | Calculated | P0 |
| **Any number: explain** | Hover or tap a KPI: "How this is worked out" shows the formula, the basis and the included records, plus "Ask why it changed". That opens the panel with the metric as context and answers from the registry only. | Calculated + LLM paraphrase | P1 |
| **Expense capture** | Photo of a fuel slip fills litres, VAT, site and vehicle. Each field is marked and editable. | Model/LLM extraction | P1 (backend: OCR) |
| **Numbers > For you** | "This week" three-line summary of the top open insights, with numbers as tokens that link to the insight (the spec's 5.4). | LLM paraphrase, labelled | P1 |
| **Customer rate review** | "Draft a rate review letter" from customer profitability, edited before sending. | Drafted by AI | P2 |

### 2.4 Copilot, rebuilt as a panel with tools, not a page

- **Entry.** The header bar opens on ⌘K or a click, on every page and on phones (the "Ask" icon opens a bottom sheet). It is prefilled with context chips from the current page ("On: INV-20260421-1022" or "On: Quote QT-…-5305"). The query never goes in the URL: POST it and keep the conversation id in state.
- **Three kinds of answer:**
  1. **Navigate.** "Show Sasol loads last quarter under 10% margin" opens Reports > Load ledger with filters applied. This is the most useful and least risky kind.
  2. **Answer from a report.** A short answer plus source chips ("Debtors as at 28 Sep · 18 invoices"). If no report defines the number, it says "TruckWys doesn't report that yet" rather than computing it.
  3. **Draft.** Quote, customer, reminder email or expense. It always appears as a review card showing every field, and the Send or Save button is the user's.
- **Starters (money only):** "Who should I chase this week?", "Is my Durban run making money?", "Price 28 t JHB to Durban on Tuesday", "What did diesel cost me last month?", "Which customer pays slowest?".
- **Status is always visible:** "AI on" or "AI off: answers limited to saved reports". Show it before the first message, not after.
- **Backend needs:**
  - tools `open_report(report_id, filters)`, `explain_metric(metric_id, period)` and `price_load(args)` (calling the same pricing service as the builder)
  - data framing and PII minimisation per 04-AI F9 and F10
  - removal of `_propose_action`
  - tools on both providers

### 2.5 Wireframe: the inline AI moment on a quote

```
┌─ New quote · QT-draft ─────────────────────────────────────────────────────────┐
│ Describe the load  [ 28t steel coils, City Deep to Durban, tautliner, Tue     ] │
│                    Filled 6 fields from your text · Undo                        │
│                                                                                 │
│ Client  AVI Limited     Vehicle  Tautliner (GP 222 BBB)     Tue 6 Oct           │
│ City Deep → Durban · 568 km · one way                                            │
├─ What this load costs you ─────────────────────────────────────────────────────┤
│ Fuel      213 L × R 29,11 (official, inland, Oct)           R  6 200            │
│ Tolls     5 plazas, class 4 (SANRAL 2026)                   R  2 870            │
│ Driver    2 days × R 1 100 (your cost profile)              R  2 200            │
│ Truck     fixed cost, 2 days (instalment, insurance)        R  3 900            │
│ Tyres and maintenance  568 km × R 1,10                      R    625            │
│                                                   Cost      R 15 795            │
│ Estimated: driver and truck costs come from your cost profile. Edit profile     │
├─ Is your price enough? ────────────────────────────────────────────────────────┤
│ Your price   [ R 18 500 ]      Margin R 2 705 · 14.6%                           │
│                                                                                 │
│ ▲ Below your 18% margin floor. Floor price R 19 270.        [Use R 19 270]      │
│   Rule: cost + your margin floor (Settings > Pricing)                           │
│                                                                                 │
│ Your last 5 on this lane   R 17 900 to R 21 400 · 3 won, 2 lost                 │
│ Market band                Not enough operators on this lane yet                │
│ Win likelihood             Not shown: needs 40 decided quotes (you have 9)      │
├─────────────────────────────────────────────────────────────────────────────────┤
│ [ Save draft ]                                   [ Send to client → ]           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

What makes it useful rather than a gimmick:
- **One question per panel.** The panels are "What it costs" and "Is the price enough".
- **Rand, not percentages alone.**
- **The basis is written next to each number.**
- **The action is a single button that sets a number the user can see.**
- **Missing intelligence says exactly what unlocks it**, rather than showing a heuristic.

And on an overdue invoice:

```
┌─ INV-20260421-1022 · Tiger Brands Ltd · R 20 505,65 · 115 days overdue ─────────┐
│ Tiger Brands usually pays 18 days after due (7 paid invoices).                  │
│ This one is well outside that. No reminder sent. No promised date.              │
│                                                                                 │
│ [ Draft reminder ▾ firm ]   [ Log a promise to pay ]   [ Call: 011 … ]          │
│                                                                                 │
│ ┌ Reminder, drafted by AI · check before sending ─────────────────────────────┐ │
│ │ Subject: Invoice INV-20260421-1022, R 20 505,65, 115 days overdue           │ │
│ │ Hi Thandi, our records show … Banking details: FNB 62xxxxxxx, ref INV-…     │ │
│ └─────────────────────────────────────────────────── [Edit] [Send reminder] ──┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. First run and empty states

### 3.1 The current path to value

It takes seven steps, with a paywall before any value:

1. Signup. Step 3 of the signup explainer is "Add a card & pay R4 499/month… your fleet goes live the moment it clears".
2. Verify email.
3. Card.
4. Onboarding step 1: company name, industry, phone.
5. Onboarding step 2: import customers.
6. Onboarding step 3: import vehicles.
7. "You're all set!", then "Go to dashboard" (the primary) or "+ Create a quote" (secondary).

The dashboard then shows R 0,00 tiles, and "Create invoice" as the primary button.

Problems, ranked:
1. **The inputs that make the first quote correct are never collected.** These are fuel zone and live diesel (the stale R23.50 default under-prices a JHB to CPT run by about R3 000), vehicle type, fuel use, cost per km and margin floor. So the first quote a fleet sends is its least trustworthy.
2. **The first invoice cannot be paid.** There are no bank details, no VAT number prompt, and no default terms.
3. **The card comes before the first quote.** Whether to trial is a commercial decision, but the fastest proof of value is "price a real load in 3 minutes". Recommend at least a 14-day trial, or a free first N quotes, gated at *Send* rather than at signup. The subscription statuses already support `trialing`.
4. **"Industry" is asked but unused.** Swap it for "What do you run?" (vehicle types), which feeds pricing.
5. **"Go to dashboard" is the primary button.** The primary should be "Price your first load".
6. **Mobile signup goes to `/open-app`** (native app hand-off), so the web onboarding is skipped. Make sure the native app runs the same checklist.

### 3.2 Fastest path to value (target: first priced quote in under 5 minutes)

```
1. Account (name, email, password)              → verify email
2. "What do you run?"   [Tautliner ×4] [Superlink ×2] [+ type]   (sets fuel L/100km, toll class)
3. "Where do you fill up?"  [Inland ▾]  → uses the official diesel price, shown with date
4. Price a load now  (the quote builder, with an example prefilled: "34t, City Deep → Durban")
      → sees cost lines, floor price, sends to themselves or a real client
5. Checklist on Today (non-blocking, each one unlocks something named):
      ☐ Add banking details and VAT number     → your invoices can be paid
      ☐ Set payment terms default (30 days)     → due dates and reminders
      ☐ Add your truck costs (instalment, insurance, driver)  → real margin, not "estimated"
      ☐ Import customers / vehicles             → faster quoting
      ☐ Connect Xero or Sage                    → invoices post to your books
      ☐ Connect Cartrack / MiX / your TMS       → actual km and trips
      ☐ Invite your bookkeeper                  → they get the monthly pack
```

### 3.3 Wireframe: first-run Today for a new fleet

```
┌─ Today ────────────────────────────────────────────────────────────────────────┐
│ Good morning, Thabo. Let's price your first load.                               │
│                                                                                 │
│ ┌─ Price a load ────────────────────────────────────────────────────────────┐   │
│ │ [ Describe it: "30t maize, Bethlehem to Durban, Thursday"          ] [→] │   │
│ │ or  Start a blank quote                                                    │   │
│ │ Uses official diesel for Inland (R 29,11/L, 7 Oct) and SANRAL 2026 tolls.  │   │
│ └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│ Get set up to be paid                                      2 of 7 done          │
│ ✓ Company details                                                               │
│ ✓ Vehicle types                                                                 │
│ ○ Banking details and VAT number   Your customers need these to pay you  [Add] │
│ ○ Default payment terms            Sets due dates and reminders          [Set] │
│ ○ Truck costs                      Turns "estimated margin" into real   [Add]  │
│ ○ Connect accounting               Xero · Sage · QuickBooks           [Connect]│
│ ○ Connect your TMS or tracking     Cartrack · MiX · CtrlFleet         [Connect]│
│                                                                                 │
│ What you'll see here once you're running                                        │
│ Quotes waiting on a reply · Loads to invoice · Money to chase · Margin by lane  │
│ (plain text, no zero tiles)                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Once data exists, Today becomes the action queue from the spec. It has at most four KPIs (Owed to you, Collected this month, Margin this month (excl VAT, stated basis), Quotes awaiting reply), each linking to its owning report. Below them is a single "Needs you" list ordered by rand: overdue to chase, delivered not invoiced, quotes expiring, and insights. Remove "Is the fleet working?", "What changed recently", "Latest bookings" and the quote funnel from Today; the funnel belongs in Reports > Win/loss.

### 3.4 Empty states, page by page (what a new fleet sees today, and what it should say)

| Page | Today (from `plat-empty-desktop_*`) | Should say and offer |
|---|---|---|
| Overview | 4 tiles: R 0,00 · "—" · R 0,00 "Every sent invoice is paid" · 0. "No monthly figures yet." "No quotes yet." "No vehicles added yet." | The first-run layout in 3.3. No tiles until there is a first invoice. |
| Quotes | A kanban with 4 empty columns, "Drag a card here", and "Load 10 more (0 left)" | "Price your first load. We work out fuel, tolls and your costs, then you send a link your client can accept." [Price a load] [Import rate sheet]. Show the list view by default. |
| Orders / Loads | (list) "No bookings" | "Loads appear when a client accepts a quote, or when your TMS sends them." [Connect TMS] [Add a load manually] |
| Invoices | A "Nothing invoiced in September" hero, "Overdue balance R 0,00", then "Invoices are generated from completed bookings", which contradicts the "New invoice" button | "Invoice a delivered load in one click, or bill a one-off charge." [New invoice]. If bank details are missing: "Add banking details first so customers can pay you." [Add] |
| Expenses | (not captured; same pattern) | "Snap a fuel slip or toll receipt. We read the litres, VAT and site." [Add expense] [Import from bank CSV] |
| Reports | 3 tiles of R 0,00 and 0.0% | The report library with every report listed, each showing "Needs: 1 paid invoice" and similar. No zero tiles. |
| Insights | "Outstanding R 0,00 · Across 0 invoices" | "Insights start after about 10 delivered loads. You have 0. Here's what you'll get:" then 3 example cards, clearly marked as examples. |
| Customers | Good: "Already have them in a spreadsheet? Paste the list straight in." | Keep. Add "or they're created when you quote". |
| Vehicles | Good (paste import) but the table header shows a "Health score" column | Keep the import. Hide the columns until there is data. Ask for the cost profile on the first vehicle. |
| Copilot | Starters that query empty data | "Ask once you've priced a load. Meanwhile try: 'Price 30t Bethlehem to Durban on Thursday'." |

---

## 4. Settings and admin

### 4.1 As built

- **My account:** Profile, Notifications, Security.
- **Workspace:** Company details, Users & permissions, Billing, Integrations.
- **Directory:** Customers, Vehicles, Vehicle types.
- **Developers:** Risk-scoring API.
- **Platform:** Admin dashboard (superusers).

Findings:
1. **Pricing policy is hidden in "Company details".** Diesel, petrol, electric and hybrid prices per litre, the fuel zone, a default base rate, a "Default toll rate (R/km)", SLA and border crossings per year all sit below logo and address. These are the inputs that decide whether every quote makes money. Verdict: MOVE to a new **Pricing and costs** section.
2. **The hand-set diesel price must become "Official price (DMPR) for your zone" by default**, with an optional override that says "you are overriding the official price by −R 5,61/L". The backend has the feed (03-FUEL). Verdict: REBUILD. Backend needed.
3. **Remove "Default toll rate (R/km)"** as a pricing input. Tolls are priced per plaza. Keep it only as the fallback for unmapped routes, labelled that way.
4. **Missing for a real fleet:**
   - **Banking details** (bank, branch code, account, account type) for invoices and emails. *Backend: Company fields and the public-invoice serializer.*
   - **VAT:** registered yes or no, VAT number (exists), and prices entered excl or incl. The public invoice hard-codes "VAT (15%)".
   - **Invoice defaults:** payment terms default (only per customer today), numbering prefix, footer text, and "Tax invoice" wording when VAT-registered.
   - **Cost profile per vehicle or vehicle type:** fixed monthly costs (instalment, insurance, licence, tracking, driver salary), variable R/km (tyres, maintenance), and the margin floor. Vehicle types hold only base rate, L/100km and fuel sensitivity. *Backend: `CostProfile` (spec 4.2).*
   - **Cash settings:** opening bank balance and date, and a cash floor, for the 13-week forecast.
   - **Reminders:** automatic reminder schedule and tone. *Backend: `run_dunning` is not in beat (04-AI #10).* Also "send from" name and reply-to address.
   - **Integrations status page:** last sync, errors, record counts and a re-sync button per connection. Today there are only Connect buttons and API keys.
   - **Accountant access:** an invite as a read-only "Bookkeeper" role with a monthly pack.
5. **Clutter to remove:**
   - **Directory > Customers and Vehicles** duplicate top-level pages. REMOVE. Keep Vehicle types, but inside Pricing and costs.
   - **Developers > Risk-scoring API** exposes the 7-pillar engine (about 25% constants, 04-AI F6) to every fleet admin as a product. REMOVE from fleet settings; it belongs in the partner portal, after the engine is fixed.
   - **Notifications:**
     - "Fleet alerts: maintenance due", "Driver status updates" and "New bookings" are TMS pushes.
     - "SMS: coming soon" is a dead control.
     - Keep money events only: quote accepted or declined, invoice viewed, payment received, invoice overdue, weekly summary.
6. **Viewer and Driver cannot reach their own profile.** See 1.3.6.
7. **On phones the settings sidebar stays at 220px** and the page scrolls sideways (475px wide at 390). Use a list-then-detail pattern on phones.

### 4.2 Recommended structure

```
Settings
  You                 Profile · Security · Notifications (money events only)
  Business            Company details · Banking and VAT · Invoices and reminders
  Pricing and costs   Fuel basis · Vehicle types and fuel use · Truck costs · Margin floor · Tolls fallback
  Team                People and roles (incl. Bookkeeper, read-only)
  Connections         Accounting (Xero/Sage/QuickBooks) · TMS and tracking · API keys · Webhooks  (each with status)
  Plan                Billing and history
```

Admin (superuser) stays a separate app area; that is fine as is.

---

## 5. Public pages, notifications and email

### 5.1 Public invoice (`/invoice/view/:id/:token`)

It is well built visually: amount and due date first, calm, and on-brand for the fleet (their logo and name, "Sent with TruckWys" in the footer). Findings:
1. **No way to pay.** "How to pay: Pay by EFT… For banking details, contact {company}." Show the bank, branch code, account and reference, with a copy button for each. Longer term, add a "Pay now" link (Ozow or Paystack EFT) and "I've paid" with remittance upload, which creates a pending payment to confirm. *Backend.*
2. **Not a valid SA tax invoice on screen.** The PDF says "TAX INVOICE" with both VAT numbers (`pdf_generator.py:186,148,223`). The web view says "Invoice", shows no supplier or customer VAT number, and hard-codes "VAT (15%)". Match the PDF, and add a "Download PDF" button.
3. **The discount is listed after VAT.** Subtotal, VAT, Discount, Total. Verify the order of calculation. If the discount is applied before VAT, show it before VAT.
4. **The token-less route `/invoice/view/:id` always errors.** Seeded invoices have an empty `view_token`, so the email link `/invoice/view/{id}/` lands on "This invoice link is not valid". Make token generation mandatory on send, and remove the route.
5. Add "Questions about this invoice?", which messages the fleet and logs a dispute. That feeds the "disputes" input the risk score claims to use.

### 5.2 Public quote (`/quotes/view/:id/:token`)

It is clean and trustworthy (see `plat-public-desktop-quote.png`). Findings:
1. **Decline is one click with no reason.** Add an optional reason (price, timing, went with another carrier, not needed) and "What price would work?". This is the single best source of win/loss truth. *Backend: store it on `QuoteOutcome`.*
2. **No "what's included".** Freight quotes need their terms: the fuel basis ("based on diesel at R 29,11/L, adjusted if the official price moves more than X"), tolls included, waiting time charged after N hours at R/h, and loading or offloading responsibility. Add a terms block from Settings > Pricing.
3. Show **VAT-inclusive total** alongside "Excluding VAT", the sender's phone and email, and a PDF download.
4. **Accept should capture the name of the person accepting and a PO number.** That turns the acceptance into a record the fleet can invoice against.

### 5.3 Email

- **Invoice email** (`resend_email.py:309`):
  - The banking block is always "Available on invoice".
  - Table headers are in Title Case ("Invoice Number", "Issue Date").
  - The subject uses an em dash ("Invoice X from Y — R …"), which is banned.
  - The header is TruckWys-branded rather than the fleet's logo. The customer should see the fleet's brand, with "Sent with TruckWys" in the footer, as on the public page.
- **Sender:** the default `EMAIL_FROM` is `TruckWys <noreply@mail.baselinq.ai>` (`settings.py:314`), a different product's domain. There is no reply-to, so customer replies to an invoice go nowhere. Set From to "{Fleet name} via TruckWys" and Reply-To to the fleet's billing email. *Backend (S).*
- **Two parallel email modules** (`email_service.py` and `resend_email.py`) both define password reset and invite. Consolidate them, with one template matching the brand.
- **Reminder "final" tone** says "to avoid further action". Keep it, but let the fleet edit the wording and preview the email in the app first.

### 5.4 In-app notifications and toasts

- The bell showed **25 unread** on the seeded account. Mixing activity ("New quote created") with action items trains people to ignore it. Split them: the bell is for things that need you (quote accepted, payment received, invoice overdue, sync failed). Activity is a feed on the record.
- Two toast systems are mounted: shadcn `<Toaster />` and react-toastify (via `ui/sonner.tsx` and `lib/toast.ts`). `LiveEvents` toasts every company event to every open browser. Keep one system, and toast only the outcome of the user's own action or a money event.
- Toast copy to fix: "Applied AI-recommended price" (a rule), and "Reverted to actual price" (implies the suggestion was not actual).

---

## 6. Cross-cutting

### 6.1 Consistency issues still visible after design v2

| Issue | Where | Fix |
|---|---|---|
| Two number formats on one screen: "R 182 052,68" versus "R 20,505.65" | Overview tiles versus attention list (server-composed strings) | Format on the client from numbers. The backend returns values, not sentences |
| Two date formats: "28 Sep 2026" versus "Due 2026-06-05" | Overview attention list | Same fix |
| Title Case from the backend: "Invoice Overdue", "9 Vehicles Idle", "Loads In Transit" | Overview attention | Sentence case at source |
| Em dashes in user copy | `subscriptionStatus.ts` ("won't renew — you keep"), email subjects | Replace |
| "Online" status badge means *subscription status* and shows green for the Free plan (`subscriptionStatusLabel` default) | Header | Show a plan chip only when it needs action (Trial ends in N days, Payment failed) |
| Headings name the panel, not the question ("Fleet command", "Margin engine", "Briefing") | Fleet overview, Insights | Rename, or remove with the IA change |
| Contradicting counts (see Top 12 #2) | Overview, Insights, Capital | A metric registry (spec 3.1) and one API per metric |
| "Intelligence" eyebrow on Insights, "Fast Pay" page under the "Capital" nav item | Insights, Capital | Use one name per thing |
| Quote cards show "Medium confidence" on every quote | QuotesList, QuoteDetail | Delete the field until a model sets it |

### 6.2 Invented numbers and dishonest labels still present

1. "Suggested price… true cost + 25%" is labelled as AI when applied ("Applied AI-recommended price", "✓ AI price applied"). The "true cost" is fuel, tolls and base rate, with no fixed costs. → "Rule: cost + 25%" and "Estimated cost".
2. `confidence: "MEDIUM"` is hard-coded on save (`QuoteBuilder.tsx:1003`) and shown in the list and detail.
3. "Platform AI" chip: a pooled cross-tenant model, contrary to the website's promise (04-AI F1).
4. "All tracking normally" (`views.py:4161`), with no tracking integration connected.
5. "AI risk" column on Capital (`Capital.tsx:214`) and the "Open AI risk profile" title.
6. Plan features on Signup and Billing: "AI-powered quote optimisation", "Fleet intelligence dashboard", "Advanced analytics & reporting". Replace them with what ships: "Quotes priced on official diesel and SANRAL tolls", "Invoices and reminders", "Reports and a monthly pack".
7. The Login, EmailVerification and PasswordReset side panels also say "AI-powered quote optimisation".
8. The Risk-scoring API docs present the "same 7-pillar underwriting engine your Capital product uses" as a product.
9. Copilot legacy action: "Request advance… Net payout R… · tier" for a product that is not live.
10. Net margin "all time" on Overview is computed on VAT-inclusive cash received against approved expenses (spec §3.2). It is labelled "Net margin" without its basis.

### 6.3 Mobile at 390px

Evidence: `plat-mobile_*-fold.png` and `plat-overflow.mjs`.
- **Bottom bar:** 5 of 10 destinations are off-screen, and Capital is cut in half. Fix with 5 fixed tabs plus More (1.4).
- **The Copilot omnibox is hidden under 640px** and Copilot is off-screen in the bar. **On phones, AI is unreachable** without a sideways swipe nobody will discover.
- **New quote:**
  - `main` is 559px wide, so the page scrolls sideways.
  - The desktop 4-column form squeezes into 390px ("Select c", "City / ad", "Vehicle+ type New").
  - The map and cost breakdown sit side by side and clip.
  - The chat FAB covers the Capital tab.
  - This is the core flow. Rebuild it as a single-column stepper: describe → route → vehicle → price check → send.
- **Settings:** 475px wide, with the sidebar fixed at 220px. Use list then detail.
- **Overview:**
  - The primary button is "Create invoice" at full width, above everything.
  - It takes three screen-heights to reach "What needs your attention", the only actionable panel.
  - On phones, Today should open on the action list.
- **Copilot page on phone:** the history list sits above the chat, so the input is two scrolls down. Use the panel and sheet (2.4) instead.

---

## 7. Prioritised build order

B marks backend work. S, M and L are effort sizes.

### Wave 1: trust and getting paid (1 to 2 weeks)

| # | Item | FE | B |
|---|---|---|---|
| 1 | Banking details on Company. Show them on the public invoice, the invoice email and the PDF, with a copy button. Add "Add banking details" as a blocking warning before the first invoice send | S | **S** (fields, serializer, email) |
| 2 | Email From as "{Fleet} via TruckWys" with Reply-To the fleet billing email. Remove the baselinq default. Fleet-branded header, sentence case, no em dashes | — | **S** |
| 3 | Always mint `view_token` on send. Remove the `/invoice/view/:id` route. Public invoice gets "Tax invoice", both VAT numbers and a PDF download | S | **S** |
| 4 | Honest labels: remove "AI" from the cost + 25% rule and its toasts; stop saving `confidence: "MEDIUM"`; remove "All tracking normally"; rename "AI risk"; fix plan feature lists on Signup, Billing and the auth panels | S | S (tracking string, `/suggest` fields per 04-AI F2) |
| 5 | Remove the Copilot keyword actions (`_propose_action`, `runAction`); proposals only | S | **S** |
| 6 | Stop the Overview contradictions now: one "loads on the road" definition, and hide "Is the fleet working?" and "What changed recently". Format numbers and dates on the client | S | S (return numbers, not sentences) |
| 7 | Mobile shell: 5 tabs plus More; an Ask icon in the phone header | S | — |

### Wave 2: navigation and first run (2 to 3 weeks)

| # | Item | FE | B |
|---|---|---|---|
| 8 | New IA: labelled sidebar; Today, Quote, Get paid, Numbers, Customers, Fleet; Coming soon group; redirects from old URLs; delete orphans and `NewQuote.tsx`; one vehicle page | M | — |
| 9 | Merge receivables into Get paid > Debtors. The Capital page cites it instead of re-rendering it. Insights loses the Cash flow, Fleet, Margin engine and Lanes tabs (per spec) | M | S |
| 10 | Onboarding: vehicle types, then fuel zone (official price), then "Price your first load". Today shows the setup checklist. Empty states as in 3.4 (no zero tiles) | M | S (onboarding flags per checklist item) |
| 11 | Settings restructure: Pricing and costs section; remove Directory and Risk API; split the role gate so all users reach You | M | — |
| 12 | Mobile quote builder as a one-column stepper; settings list then detail | M | — |
| 13 | Public quote: decline reason, terms block, VAT-incl total, sender contact, PDF, accept with name and PO | S | **S** (`QuoteOutcome.reason`, terms fields) |

### Wave 3: real numbers make AI worth having (3 to 6 weeks, depends on backend summary waves)

| # | Item | FE | B |
|---|---|---|---|
| 14 | Pricing default = official DMPR price for the zone, with a visible override | S | **M** (03-FUEL) |
| 15 | Cost profile per vehicle or type, margin floor, payment terms default, cash opening balance | M | **M** (`CostProfile`, spec 4.2) |
| 16 | Quote "Is your price enough?" panel (2.5), using the cost profile and your own lane history; model likelihood only when a model qualifies | M | **M** (pricing service returns lines with basis) |
| 17 | Metric registry and "How this is worked out" on every KPI | S | **M** (spec 3.1) |
| 18 | Get paid: delivered-not-invoiced queue, promised dates, reminder drafted by AI with preview, automatic schedule in Settings | M | **M** (dunning in beat, idempotency per audit #24/#25) |
| 19 | Integrations status page (last sync, errors, counts) | S | **S** |
| 20 | One toast system; bell for actions only; notifications limited to money events | S | S |

### Wave 4: Copilot as a panel (after wave 3, because it needs reports to cite)

| # | Item | FE | B |
|---|---|---|---|
| 21 | ⌘K and phone sheet with page-context chips; no query in the URL; status shown up front; real streaming, no typewriter | M | S |
| 22 | Tools: `open_report(filters)`, `explain_metric`, `price_load`; source chips on every answer; tools on both providers | S | **M** |
| 23 | Data framing, PII minimisation and an injection eval suite (04-AI F9, F10) before wider rollout | — | **M** |
| 24 | Expense photo capture (litres, VAT, site) with per-field provenance | M | **M** (OCR) |
| 25 | "This week" LLM summary in Numbers > For you, with numbers as tokens linked to insights | S | **M** (insight objects, spec §5) |

**Decision for the owner (not a build item):** should card-before-value at signup become a trial, or free until the first N quotes are sent? It is the largest lever on time to first value. The code already supports a `trialing` status.

---

## Appendix: file references

- Routes: `src/App.tsx:248-325`
- Nav: `src/components/os/OSLayout.tsx:105-199` (NAV_ACCESS, items, NAV_TARGET)
- Phone bar: `src/styles/theme.css:1300-1370`
- Section tabs: `src/components/layout/SectionHeader.tsx` (FINANCE_TABS, FLEET_TABS); `LoadsList.tsx:52` (BOOKINGS_TABS); `Insights.tsx:203`; `FinanceReports.tsx:77`
- Settings nav: `src/pages/settings/SettingsShell.tsx:15-47`
- Pricing inputs in company details: `CompanySettings.tsx:408-680`
- Onboarding: `src/pages/Onboarding.tsx`; trigger in `src/lib/postLogin.ts:39-50`
- Copilot: `src/pages/Copilot.tsx` (legacy runAction around l.208; omnibox handoff l.196). Backend: `core/services/agent.py:544-584`, `copilot_tools.py`
- Quote AI labels: `src/pages/QuoteBuilder.tsx:748-830, 1003, 1780-1830`
- Public: `src/pages/PublicInvoice.tsx:176-182`, `ClientQuoteView.tsx`
- Email: `core/services/resend_email.py:309-423`, `config/settings.py:314`
- Tracking claim: `core/views.py:4161`
