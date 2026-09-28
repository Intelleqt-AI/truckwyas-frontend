# 02 · Operations product review: Bookings, Quotes, Orders, Fleet, Customers, Insurance

Reviewed 28 September 2026, read-only, on `truckwys/design-v2` at http://localhost:3815 (light theme, 1440 px) plus code in `truckwyas-frontend/src/pages` and the backend endpoints they call. No files in either repo were changed, no data was changed (the screenshot script aborted every non-GET API call), the quote builder was reviewed from code only.

Evidence: screenshots and page text in `big-review/shots/ops_*.png|txt`; script `big-review/ops-shots.mjs`. Grounding documents: `docs/brand/DESIGN-PRINCIPLES.md`, the insights and reports strategy (personas Thabo, 5 trucks, and Nadia, 60 trucks; TMS partner section 7), and the backend review (`backend-review/00-SUMMARY.md`, `02-PRICING.md`).

---

## 1. Verdict

**The operations side is built like a light TMS with money columns bolted on. It should be a money tool that happens to know about trucks.**

- **Quotes** have the most valuable engine in the product (real SANRAL plazas, route km, cross-border fees) but the screen does not let an owner trust the number. There is no cost, so there is no real margin. Every quote says "Medium confidence" because the builder hard-codes it (`QuoteBuilder.tsx:1003`). The quote detail shows "Margin 55.00%" and "Win probability 35%" on a quote that expired two months ago, and neither number has a basis. The builder caption says "live diesel" (`:1667`) while fuel is priced from the stale company setting (pricing review C2).
- **Orders** repeat the quote (same route card, same map, a shorter cost list) and add TMS features (status stepper, assign driver, live position sync). What is missing is the only thing TruckWys uniquely knows: quoted versus actual cost for this load, and whether it can be invoiced now. The order page's own lines do not add up: Base R18,000 + Fuel R0 + Additional R0 = "Total R20,700" (order LOAD-20260616-3702; the R2,700 gap is exactly 15% of the base, so VAT is hiding in the total with no line).
- **Fleet** is five pages and ten KPI tiles answering "what status is each truck in", which is the telematics partner's question. The money questions (what does this truck cost per km, what does it earn per km, what did it make this month, what does a standing day cost) are either absent or wrong: the truck page shows "Cost per km R 7.88" and "Margin per load R 12 579" for GP 234 EFG, where R7.88 is a fallback (0.35 L/km × R22.50 settings diesel) and margin is revenue minus modelled fuel only.
- **Customers** hold no money at all. The list is a contact directory. The detail page's headline figure is "Won from accepted quotes" (quoted value, not invoiced or paid), and the only payment behaviour lives on a separate, finance-gated "Payment risk profile" page that ignores the customer's own terms. The backend already computes revenue share, DSO and average payment days per customer (`/api/v1/dashboard/customer-health/`) and no screen calls it.
- **Insurance** is an honest "Not live yet" placeholder with a real nav slot. It is fine as it is, but it should not occupy a primary nav item.

The good news: most fixes are subtraction and re-composition. Of 87 panels reviewed, I recommend keeping 26 (several only in a thinner form), merging 18, removing 18 and rebuilding 25 (table in section 3).

---

## 2. Five cross-cutting problems

1. **Lists repeating lists.** The same "On a job now / Available / In maintenance" strip appears on Fleet command, Vehicles and Activity heatmap. The same load table renders on Orders and History. The route card and map render on the builder, quote detail and order detail. Vehicle and driver detail pages each have two tabs that repeat the same cards (cost to run, service dates, revenue, recent loads, licence). Customer detail lists quotes that the Quotes board already shows. None of these repeats adds a decision.
2. **Numbers without a basis.** Four different margins (builder tile, quote detail, vehicle `margin_per_trip`, lane report). Three different "revenue" definitions for a truck (list: DELIVERED only, all time, server; detail: latest 50 loads, browser; driver: DELIVERED + INVOICED). A rule-based win percentage and a constant confidence. `cost_per_km` with an invented fallback. Every one of these violates principle 1 ("Fake data") and checklist item 5.
3. **TMS creep.** Assign driver and vehicle, a status stepper and a second status dropdown on the same order, a "Sync location" button with a CtrlFleet position, "Live, 2m ago" badges, pickup-hour heatmaps, service intervals, driver violations and accidents, an efficiency composite and a "coaching" leaderboard in the backend. Strategy section 7.6 says TruckWys must never build dispatch, tracking, rostering, driver behaviour or workshop. Each of these is a partner's feature and a reason for a partner to see TruckWys as a competitor.
4. **The money that matters is missing where decisions happen.** No cost floor on a quote. No "this customer pays 23 days late" when quoting them. No "delivered, not invoiced" blocker on the order itself. No "this truck stood 6 days this month, that cost R18k" on the truck. The strategy's insight catalogue (Q1 to Q4, M1 to M3, C1, C4, P1, P3) maps directly onto these screens and should be surfaced there, not only in an Insights tab.
5. **Hidden or orphaned pages.** `/fleet/overview` ("Fleet command") and `/fleet/heatmap` are not in the Fleet tab bar; the heatmap is reachable only from a button. Vehicles.tsx fetches `fleet/overview/` and `fleet/intelligence/` on every load and renders neither (the second is entirely hard-coded fiction: "TRK-023 likely to fail fuel injector within 7 days"). The heatmap asks for 200 loads and gets 20 because `page_size` is ignored (API C4), so it says "Based on the latest 20 of 28 loads" and its top route is "TBD → TBD".

---

## 3. Verdict table

Personas: **O** = owner-operator (5 trucks, quotes on WhatsApp, no TMS). **F** = ops/finance manager (60 trucks, has a TMS and telematics). "Helps?" asks whether the panel leads to a better quote, lower cost or faster cash.

### 3.1 Bookings: Quotes tab (`LoadsList` → `QuotesList`)

| Page | Panel | Job it serves | Repeated / TMS? | Helps quote, cost, cash? | Verdict | Reason |
|---|---|---|---|---|---|---|
| Quotes | Header, tabs, New quote | Entry to quoting | No | Quote | KEEP | Correct entry point. |
| Quotes | Search + Board/List toggle | Find a quote | No | Weakly | MERGE | Two views of the same 25 rows. Keep one view: a list sorted by "needs you" (see 5.4), with the board as an optional layout. |
| Quotes | Kanban columns Draft / Sent / Accepted / Declined, with column totals | See pipeline, change status by drag | Status also changeable on quote detail (dropdown) and via Mark outcome. Won/Lost chips contradict columns (a "Lost" card sits in Sent) | Weakly | REBUILD | Column totals sum drafts (R515,273 of "Draft", most are 11 near-identical AVI JHB→CPT drafts) which is not pipeline. Expired quotes stay in Sent. Replace with outcome-oriented stages: To send, Awaiting reply (with age and expiry), Won, Lost/expired. Drafts older than 14 days auto-archive. Status changes via explicit actions, not drag (drag is a mis-drop risk on money records). |
| Quotes | Card: number, customer, route, amount, "Medium confidence", fuel icon | Identify a quote | Confidence is a constant (`QuoteBuilder.tsx:1003`) | No | REBUILD | Remove confidence. Show what decides the next action: margin vs floor (once real), days until expiry, customer payment flag, diesel moved since quoting. |
| Quotes | List view table + status chips | Scan quotes | Duplicates board | Weakly | MERGE | Becomes the single default view with the columns above. |
| Quotes | Convert to booking button on card/row | Turn a win into an order | Also on quote detail | Cash (starts the invoice clock) | KEEP | Keep, but drop the driver and vehicle pickers from the convert modal for fleets with a TMS (assignment happens there). |
| Quotes | "Quoting is blocked" notice | Billing state | No | n/a | KEEP | Necessary. |

### 3.2 Bookings: Orders and History tabs

| Page | Panel | Job | Repeated / TMS? | Helps? | Verdict | Reason |
|---|---|---|---|---|---|---|
| Orders | Tile "Waiting for a vehicle" (pending count) | Dispatch prompt | TMS (allocation) | No | REMOVE | Allocation is the TMS's job. For a no-TMS owner, a filter chip is enough. |
| Orders | Tile "On the road" | Status count | TMS / telematics | No | REMOVE | Same. |
| Orders | Tile "Value of active orders" | Revenue in flight | No | Cash, weakly | MERGE | Fold into a single "Work in progress, not yet invoiceable: R x" line on the Bookings header. |
| Orders | Filter chips Pending / Assigned / Loading / In transit | Find orders by operational state | TMS states | No | MERGE | Collapse to one "In progress" state for TruckWys; keep the TMS's sub-state as a read-only text column when synced. |
| Orders | Load table: Load #, Customer, Route, Driver, Vehicle, Status, Amount | List orders | Same table as History; Driver/Vehicle are dispatch columns | Weakly | MERGE | One Orders list with a single money column set: Amount, Est. margin, Invoice state. Driver/vehicle only as secondary text. |
| History | Tile "Delivered, not invoiced" (7) | Invoice what is done | Also belongs on Overview action queue | **Cash** | KEEP | The best tile on these pages. Make it the primary action: a queue with blocker reason (no POD, no rate, no email), strategy M2. |
| History | Tile "Invoiced" (count) | Count | Finance > Invoices owns this | No | REMOVE | Repeats Invoices. |
| History | Tile "Revenue from completed loads" (all time) | Vanity total | Finance reports own revenue | No | REMOVE | All-time totals belong in reports with a period and VAT basis. |
| History | History table + Create invoice action | Find past loads, invoice | Same table as Orders; conflicts with Bookings.tsx comment that invoicing is automatic on delivery | Cash (the action) | MERGE | Merge Orders and History into one "Orders" list with a Delivered-not-invoiced queue on top. Resolve auto vs manual invoicing into one rule (auto on POD, manual override). |

### 3.3 Quote detail (`/bookings/quotes/:id`)

| Panel | Job | Repeated / TMS? | Helps? | Verdict | Reason |
|---|---|---|---|---|---|
| Header: number, status, customer, total | Identify | No | n/a | KEEP | Add "excl. VAT" and validity next to the total. |
| Fuel price alert banner ("Diesel up R4.61/L … ~R2593 more") | Re-price when diesel moves | Also an icon on the board | **Quote** | REBUILD | Right idea (strategy Q1), wrong basis: it compares against a snapshot that is not the price used (pricing C2). Rebuild on the snapshotted used price, show rand exposure and one action: "Re-price with current diesel". Hide on expired or delivered quotes. |
| Customer card (name, company, email, phone, city) | Contact | Repeats the customer record; occupies the top-left prime slot | No | MERGE | Replace with a one-line customer strip that carries commercial facts: terms, average days late, outstanding, credit headroom, share of revenue. Link to customer. |
| Route card + map | See route | Same on builder and order detail | Quote (plaza evidence) | MERGE | Keep the map collapsed by default; the evidence that matters is the toll plaza list and km, which belong in the cost panel. |
| Cargo details | Load facts | Partly repeats order | Quote | KEEP | Needed on the PDF; move under cost as "Priced for". |
| Cost breakdown (Fuel surcharge, Toll charges, Driver allowance, Additional, Base rate, Total) | Explain price | Different line sets on builder, detail and order | **Quote** | REBUILD | Labels mislead: fuel cost is called "Fuel surcharge", margin hides inside "Base rate" and "Additional charges". Rebuild as the same cost panel as the builder (section 5.2), frozen at the snapshot, with a "What would it cost today" diff. Move it to the top of the page. |
| Notes | Context | No | Weakly | KEEP | |
| Quote info: status dropdown, Confidence, Margin, Valid until, Created | Admin | Status also on the board; Confidence is a constant; Margin is `serviceCharge/total` | No | REBUILD | Remove Confidence. Replace Margin with "Margin over cost, R and %" from the real cost model, or "Not calculated: no cost profile" until it exists. Status only through explicit actions. Expired sent quotes must show as Expired, not Sent. |
| Win probability (35%, bar) | Predict acceptance | Rule curve saved on every quote (backend AI 2) | Would help, if real | REMOVE (until evidenced) | Show only when the win model is trained with the thresholds in strategy Q5 (≥200 labelled outcomes, calibration shown). Until then, show evidence instead: "You won 3 of 9 JHB→CPT quotes to AVI in 90 days; accepted median R/km 19.70". |
| Mark outcome (accepted/rejected with reason) | Record outcome | Overlaps status dropdown | **Quote** (trains pricing) | KEEP | The loss reason is gold for pricing. Make it the only way to close a quote. |
| Actions: send, share link, WhatsApp, edit, PDF, delete | Send quote | Send also in builder | Cash (speed to quote) | KEEP | WhatsApp share is right for SA owner-operators. |

### 3.4 Quote builder (`/bookings/quotes/new`, reviewed from code)

| Panel | Job | Repeated / TMS? | Helps? | Verdict | Reason |
|---|---|---|---|---|---|
| Natural-language / voice fill bar | Fast entry from a WhatsApp message | No | Quote (speed) | KEEP | Genuine LLM use. Keep; show what was filled so the user can check. |
| Section 1: client, weight, collection, delivery | Inputs | No | Quote | KEEP | Add the customer strip (terms, days late, outstanding) the moment a client is picked. |
| Cross-border warning | Compliance | No | Quote | KEEP | |
| Details: vehicle type ("Not decided yet"), dates, valid until, cargo, one way/round | Inputs | No | Quote | REBUILD | "Not decided yet" silently prices at company R10/km (below cost by ~R4,000 on JHB→DBN, pricing C1) and mixes rigid fuel with interlink tolls (H2). Require a vehicle class, or price at the most expensive plausible class with a warning. Round trip must ask "return loaded or empty?" (M1). |
| "Suggested for this load" vehicle types with "why" popover | Choose truck class | No | Quote | KEEP | Useful; tie to the fleet's own vehicle classes. |
| Map panel: pick targets, stops editor, route alternatives with per-route cost tooltips | Route and stops | Routing is TMS territory, but here it only prices | Quote | KEEP (thin) | Allowed under 7.6 ("route only to price tolls and fuel"). Keep alternatives but show cost difference as the headline ("N3 via Harrismith: R640 cheaper in tolls, 22 km longer"). |
| Cost breakdown: fuel (L/100, R/L, zone), tolls (plaza popover), cross-border, driver allowance, base rate (R/km), total, caption "live diesel" | Build the price | Different lines on detail and order | **Quote** | REBUILD | The heart of the product and the weakest screen honesty-wise. Base rate carries all cost and all profit with no breakdown; driver allowance defaults to R0; caption claims live diesel. Replace with the cost panel in 5.2. |
| Overrides: tolls, driver, R/km with "Where this rate comes from" | Adjust | No | Quote | REBUILD | Overrides should apply to cost lines (e.g. "our depot diesel R27.90") and to the margin, not to an opaque R/km. Keep "rate card R/km" as an explicit, labelled alternative mode. |
| AI quote card: "Still learning" banner, Recommended price ("Personal AI"/"Platform AI", or "true cost + 25%"), Margin tile, Win probability tile | Choose the price | Win % and margin repeat on detail | Would help | REBUILD | "True cost + 25%" is labelled AI; the optimiser returns R39,963 at 2% win when cost exceeds market (pricing C3). Replace with a price ladder: floor, target, market band (with n and date), your last similar prices. Only say AI/model when the trained model is live. |
| Revenue Guard (only when not SAFE) | Warn on low margin | Guard cost = fuel + tolls + border + driver, so it is always SAFE (C3) | Would help | MERGE | Fold into the margin-floor line of the cost panel. One definition of margin. |
| Benchmark text "R x avg · recommendation" | Market check | No | Quote | REBUILD | Interlinks are benchmarked against the rigid R15,000 figure (C3). Show normalised R/km by class with sample size and date, or nothing. |
| Actions: apply recommended, send, save draft | Commit | Send also on detail | Quote/cash | KEEP | |
| Auto-save to browser, resume banner | Don't lose work | No | Speed | KEEP | |
| Notes | Context | No | Weakly | KEEP | |

### 3.5 Order detail (`/bookings/:id`)

| Panel | Job | Repeated / TMS? | Helps? | Verdict | Reason |
|---|---|---|---|---|---|
| Header: load number, status, customer, total | Identify | No | n/a | KEEP | Show "excl./incl. VAT" explicitly. |
| Status stepper (Pending → Assigned → In transit → Delivered → Invoiced) + Status dropdown | Move the load along | Two controls for one action on one page; states are TMS states | No (except Delivered and Invoiced) | REBUILD | TruckWys needs three money states: Booked, Delivered (POD), Invoiced/Paid. Operational sub-states are read-only when a TMS syncs them. For no-TMS fleets keep one "Mark delivered" action with POD. |
| Assign driver and vehicle modal, Assignment card with Edit | Dispatch | **TMS** | Cost attribution needs vehicle, nothing else | REBUILD | Keep a single "Vehicle for costing" field (needed to attribute cost to a truck). Remove driver assignment as a workflow; show driver as synced text. |
| Job figures strip: Distance, Base rate per km, Cargo weight | Load facts | Base R/km repeats builder | Weakly | REMOVE | "Base rate per km" is a meaningless number (it contains profit). Replace with Revenue per km and Margin per km, which are meaningful. |
| Route card + map + CtrlFleet live position + "Sync location" | Where is the truck | **Tracking, TMS/telematics** | No | REMOVE | Replace with a deep link: "Open in CtrlFleet / Cartrack". Keep the static route (km, plazas) inside the economics panel. |
| Financials (Base, Fuel surcharge, Additional, Total) | Price of the load | Shorter version of the quote breakdown; does not add up | Cash | REBUILD | Replace with **Load economics**: quoted cost vs actual cost per line (fuel, tolls, border, driver, other), margin quoted vs actual, coverage ("2 of 5 cost lines have actuals"). This is the load ledger row from the strategy and the one panel no TMS has. |
| Actions: View invoice, Upload POD, View POD | Get paid | POD capture is a fallback for no-TMS fleets | **Cash** | KEEP | Make "Invoice now" the primary action when delivered and POD present; show blocker reason otherwise. |

### 3.6 Fleet

| Page | Panel | Job | Repeated / TMS? | Helps? | Verdict | Reason |
|---|---|---|---|---|---|---|
| Fleet command (`/fleet/overview`) | Whole page: status strip + vehicles table + drivers table | Status board | Subset of Vehicles and Drivers; not in tab bar; status board is telematics | No | REMOVE | Nothing here is not on Vehicles or Drivers. Redirect to Vehicles. |
| Activity heatmap (`/fleet/heatmap`) | Status strip | Status | Third copy | No | REMOVE | |
| Activity heatmap | Pickups by weekday and hour | Planning | Dispatch/planning (TMS); built on 20 loads | No | REMOVE | Not a money decision. |
| Activity heatmap | "Which routes do you run most?" | Lane volume | Lane profitability report (R3) owns lanes | Could, if margin | MERGE | Move into Finance reports R3 "Which lanes earn the most per km", ranked by margin, with sample size. |
| Vehicles | Header: Activity heatmap button, Import, Add vehicle | Manage list | Heatmap link goes | n/a | KEEP (minus heatmap) | |
| Vehicles | Tile "Available now 12 of 20" | Status | Telematics/TMS | No | REMOVE | Replace strip with money: fleet cost per km (last 30 days, with coverage), trucks below break-even, standing days this month and their fixed cost. |
| Vehicles | Tile "Delivered revenue" (all time) | Vanity total | Reports own revenue | No | REMOVE | All-time, DELIVERED-only; disagrees with the detail page. |
| Vehicles | Tile "Not earning yet 11 of 20" | Idle trucks | Close to strategy C4 | **Cost** | REBUILD | Right question, wrong measure ("never had a load"). Rebuild as "Standing days this month" with fixed cost per day from the cost profile (C4). |
| Vehicles | Table: Registration (+ "Live, Xm ago"), make/model, type, driver, status, delivered revenue, delivered loads, health score | Find a truck | Live badge is telematics; health score is a rule composite named `ai_health_score` | Partly | REBUILD | Columns should be the truck P&L: revenue/km, cost/km, margin this month, loaded km share, standing days, with a coverage marker. Status as small text. Drop health score and live badge. |
| Vehicle detail | Status button group (Available / In use / Maintenance / Out of service) | Set status | Telematics/TMS state | No | MERGE | Keep only "Active / Sold / Out of service" (affects cost allocation). |
| Vehicle detail | Overview tab and Financial tab | Two views of one truck | Cost card, service card, revenue tile repeat on both tabs | n/a | MERGE | One page: Truck economics (5.3). |
| Vehicle detail | Tiles Delivered revenue / Health score / Odometer | Summary | Health score repeats list; odometer belongs to telematics | Partly | REBUILD | Replace with Margin this month, Cost per km vs fleet median, Revenue per km, Standing days. |
| Vehicle detail | Specifications (VIN, reg, type, capacity, fuel, year, driver) | Reference | No | Quote (class, axles, GVM feed pricing) | REBUILD | Keep, but add the fields pricing needs: axles, GVM, tare, SANRAL class (pricing H2, M5). Move to a collapsible "Pricing profile" section. |
| Vehicle detail | "What does it cost to run?" (cost/km R7.88, margin per load, L/km) | Unit cost | Duplicated on both tabs; values are fallbacks | **Cost** | REBUILD | Right question, invented answers. Rebuild from expenses + cost profile + telematics km (5.3). Show "Not enough data" rather than R7.88. |
| Vehicle detail | "When is it due?" / "Compliance and maintenance" (service interval, km until service, reg expiry) | Workshop planning | **Workshop/telematics**; duplicated on both tabs | No | REMOVE | Keep one line: "Licence disc expires 12 Mar 2027" as a reminder in the Overview action queue; deep link to the partner for service. |
| Vehicle detail | "How healthy is it?" score bars (health, uptime, fuel, maintenance) | Condition | Rule composite; neutral 50 when no data | No | REMOVE | Replace fuel efficiency with actual L/100 km vs the truck's own baseline (C3) inside economics, only with data. |
| Vehicle detail | Earnings strip (revenue, per load, per km) | Earnings | Repeats overview tile | Yes | MERGE | Into Truck economics. |
| Vehicle detail | Recent loads | Evidence | Shown twice | Yes | KEEP (once) | As "Loads this month" with margin per load. |
| Drivers | Tiles: Active drivers, Completed loads (all time), Next licence renewal | HR and status | Rostering/HR | No | REMOVE | Licence expiry becomes an Overview reminder only when within 30 days. |
| Drivers | Table: name, licence, licence expires, status, completed loads (+ revenue, efficiency when present) | Staff directory | HR; efficiency falls back to on-time rate | No | REBUILD | TruckWys needs drivers only for cost (wage CTC, allowances) and attribution. Keep a slim directory; money columns only if the fleet enters wage costs. |
| Drivers | Add driver drawer | Create driver login | Hard-codes password a shared hard-coded password for every new driver (`Drivers.tsx:560`) | n/a | REBUILD | Security finding: invite by link, never a shared default password. Flag for immediate fix. |
| Driver detail | Revenue tiles, Details, Performance (efficiency, on-time, rating, trips), Recent loads | Profile | Revenue repeated three times across two tabs; rating is never populated | Partly | MERGE | One page: cost per trip-day, allowances paid, loads, revenue per trip-day. |
| Driver detail | "What is on their record?" (violations, accidents, on-time) | Driver behaviour | **Telematics/HR** | No | REMOVE | Driver safety belongs to the telematics partner. It is also personal data sent to the Copilot provider (backend AI 10). |
| Driver detail | "How much did they carry each month?" | Trend | Counts loads by created date, includes cancelled | Weakly | REMOVE | |

### 3.7 Customers and Insurance

| Page | Panel | Job | Repeated / TMS? | Helps? | Verdict | Reason |
|---|---|---|---|---|---|---|
| Customers | Header, Import, Add customer | Manage | No | n/a | KEEP | |
| Customers | Search + sort (name, city, date) | Find | No | No | REBUILD | Sort by what matters: outstanding, days late, margin, revenue share. Add filters: overdue, over credit limit, quiet. |
| Customers | Table: name, company, email, phone, city, terms, status | Contact directory | Contacts are on detail | No | REBUILD | Columns: Customer, Revenue 90d, Share of revenue, Margin % (with coverage), Outstanding, Avg days late vs terms, Last load. Contacts move to detail. |
| Customers | Add/Edit drawer (terms Net 30/60/90, credit limit) | Set terms | Duplicated code on detail; backend allows Net 7/14/30/45/60/90 | **Cash** | KEEP | Offer all six terms (seed data already uses Net 14 and 45, which the form cannot set). Add contact person. |
| Customer detail | Header: name, status, "Payment risk profile", Edit | Identify | No | n/a | KEEP | |
| Customer detail | "Customer value": Won from accepted quotes, Quotes accepted, Credit limit | Relationship value | Quote value is not revenue; credit limit repeated in Account details | Weakly | REBUILD | Replace with invoiced revenue (period, excl. VAT), margin, outstanding and days late vs terms (5.4). |
| Customer detail | Contact details | Contact | No | No | KEEP (demoted) | Move to a side column. |
| Customer detail | Account details (terms, limit, status, since) | Terms | Repeats strip | Cash | MERGE | Into a "Terms and credit" block with headroom. |
| Customer detail | Quotes table (15 of N) | History | Same rows as Quotes board filtered | Quote | REBUILD | Replace with "Rates by lane": per lane, loads, last rate, R/km, trend, win rate. That is the rate history a rate review needs. Raw quotes live in Bookings. Also fix legacy status display ("It"). |
| Customer risk | Header + explanation | Payment behaviour | Finance-gated; separate page | **Cash** | MERGE | Into customer detail "How they pay". Anyone who quotes should see it. Error state goes "Back to Capital", which is wrong from here. |
| Customer risk | Tiles: late-payment risk % (fixed 25% for new), avg time to pay, paid by due date, owed > 30 days late | Payment behaviour | 30-day threshold ignores the customer's terms | **Cash** | REBUILD | Measure against their terms: "Pays 23 days after due on Net 45". Drop the fixed 25% starting estimate. |
| Customer risk | "What does this mean for …" summary (LLM or template) | Narrative | Template literally says "AI risk score" in the backend | No | REMOVE | Replace with one plain sentence computed from the numbers. |
| Customer risk | "How late does … pay?" bar chart per invoice + stacked bar | Pattern | No | Cash | KEEP | Good chart; move into customer detail. |
| Customer risk | "Which invoices drive the score?" | Evidence | Repeats Invoices filtered | Cash | MERGE | Becomes "Open invoices" (unpaid only) with a link to the customer statement. |
| Insurance | "Not live yet" card explaining future use | Placeholder | No | Not yet | MERGE | Honest and compliant. Move out of primary nav; add "Insurance per truck (R/month)" as a line in the cost profile now, because insurance is a real quote cost today. |

---

## 4. The TMS boundary line

**TruckWys owns the money for every load: price, cost, invoice, payment, margin. The partner owns the truck: where it is, who drives it, when it moves, and whether it is healthy.** If a feature needs a truck's live state to function, it belongs to the partner; TruckWys consumes the result.

| Capability | TruckWys owns | Integrate from TMS / telematics | TruckWys must not build |
|---|---|---|---|
| Quote price | Cost model, diesel basis, SANRAL plazas and class, border fees, margin floor, market band, rate history, win evidence | Planned route and stops (optional), vehicle class from the TMS fleet list | Load boards, freight matching |
| Route | Route used to price tolls, fuel and km; alternatives compared on cost | Actual route driven, actual km | Turn-by-turn, route optimisation, multi-drop sequencing |
| Order lifecycle | Booked, Delivered (POD), Invoiced, Paid | Pending/assigned/loading/in-transit sub-states, ETA | Dispatch board, allocation, status stepper |
| Assignment | "Vehicle for costing" on a load | Driver and vehicle assignment | Assign-driver workflows, rosters |
| Proof of delivery | Receive POD, attach to invoice; fallback upload for no-TMS fleets | POD event with signer, time, document | A full driver app |
| Truck | Cost per km, revenue per km, margin per month, standing-day cost, fuel cost per km | Odometer, trip km, loaded/empty legs, litres (CAN or fuel card), idle minutes, geofence dwell | Live map, speed, ignition, temperatures, doors |
| Maintenance | Maintenance cost per km (from expenses) | Service due, fault codes | Job cards, service scheduling, parts |
| Driver | Wage and allowance cost, cost per trip-day | Hours, behaviour, violations | Hours of service, safety scores, coaching leaderboards |
| Waiting / detention | Detention charge on the invoice, detention clause in rate review | Dwell times at pickup and delivery | Yard management |
| Customer | Terms, credit, payment behaviour, profitability, rate history | Customer/site master (optional) | CRM beyond what billing needs |

Things in today's build that cross the line and should go: CtrlFleet live position and "Sync location" on the order page, the "Live, Xm ago" badge, Fleet command status board, the pickup-hour heatmap, status button groups on trucks and drivers, driver violations/accidents/efficiency and the backend coaching leaderboard, service interval and km-until-service, and the order status stepper for fleets with a TMS. Each should become a deep link to the partner.

**Data that needs an integration** (from the strategy's data contract 7.3): actual km per truck and trip (cost per km, revenue per km on actuals), loaded vs empty legs (empty running, C5), litres per trip or fill (fuel cost per km, fuel drift C3), geofence dwell (detention M4, border dwell), POD events (invoice on POD, M2), toll transactions (tolls quoted vs actual). Without a partner: fuel litres and odometer can be captured on fuel expenses (small capture), everything else is modelled and labelled as such.

---

## 5. Recommendations

### 5.1 What a fleet owner needs to trust a price in 60 seconds

Thabo is on the phone with a shipper. Nadia is approving a rate for a new contract lane. Both need the same five facts, in this order:

1. **What will this load cost me?** Every cost line, each with its basis (diesel R29.11/L, gazetted inland 50 ppm, effective 2 Sep 2026; 5 N3 plazas at class 4, 2026 tariffs, excl. VAT; 1.3 truck-days at your fixed cost).
2. **What is my floor?** Cost ÷ (1 − minimum margin). Below it the screen says so in words and the send button asks for a reason.
3. **What did I charge last time?** Your last 3 to 5 loads on this lane and class, R/km, date and outcome, diesel-adjusted. This is the single most trusted number an owner has, and TruckWys already holds it.
4. **What does the market pay?** Only with sample size and date, normalised to R/km by class and one-way equivalent. Otherwise "No reliable market data for this lane".
5. **Should I worry about this customer?** Terms, how late they actually pay, what they owe now, credit headroom.

Win likelihood appears only when the model is trained to the strategy's Q5 bar (≥200 labelled outcomes, calibration shown). Until then the builder shows the evidence a person would use: "You won 3 of 9 on this lane at a median R19.70/km; your two losses were above R22/km".

**Everything this requires from the pricing review:** live dated diesel with source (C2), a server-side cost model with fleet cost profile (C1, section 5 of 02-PRICING), one margin definition, margin on price excl. VAT (C3), tolls excl. VAT (H4), axle-based SANRAL class (H2), round-trip return loaded or empty (M1), a `pricing_snapshot` per quote (H6), and a normalised market benchmark (C3). The builder must not be redesigned as a paint job on the current formula; the panel below only works on the new engine.

### 5.2 Quote builder: what to show at each step

The builder stays one page, but it reads left to right as "load, cost, price".

| Step | Inputs | What the right-hand panel shows at this moment |
|---|---|---|
| 1. Who and what | Client, cargo, weight, collection, delivery, dates, trip type (one way / round, return loaded or empty) | Customer strip (terms, days late, owed, headroom). Warnings if over credit limit or a slow payer. |
| 2. Which truck | Vehicle class (required; suggested classes with reasons); optionally a specific truck | Class facts that drive price: SANRAL class from axles, L/100 km source (truck's 90-day actual or class default), GVM for C-BRTA. |
| 3. Route | Map, stops, alternatives | Km laden, km empty, hours, plazas. Alternatives compared by cost, not by km. |
| 4. Cost | Nothing to type unless overriding | The cost panel (wireframe A), each line with basis and an override. |
| 5. Price | Choose price on the ladder or type one | Floor, target, last similar loads, market band, margin at the chosen price. |
| 6. Send | Validity, notes, send by email/WhatsApp | PDF preview shows price excl. and incl. VAT and a diesel clause ("based on R29.11/L; adjusts monthly by the DMRE change"), strategy Q1. |

**Wireframe A: quote builder cost and price panel** (illustrative figures: the pricing review's reference JHB → DBN interlink, 30 t, one way, 568 km laden + 170 km empty repositioning; fixed cost R65,950/month over 22 days; 8% minimum and 15% target margin. Not live data.)

```
┌─ What this load costs you ─────────────────────────────── excl. VAT ─┐
│ Interlink (7 axles, SANRAL class 4) · JHB → DBN via N3 · one way      │
│ 568 km laden · 170 km empty return (30%, your setting) · 1.3 truck-days│
│                                                                        │
│ Fuel, laden        568 km × 44.3 L/100 × R29.11          R 7 332       │
│   basis: gazetted inland 50ppm, eff. 2 Sep 2026 · your bulk price: none│
│   consumption: class default, laden 30 t (no 90-day actual yet)        │
│ Fuel, empty return 170 km × 33.0 L/100 × R29.11          R 1 637       │
│ Tolls              5 plazas, class 4, 2026 tariff        R 1 108       │
│   De Hoek · Wilge · Tugela · Mooi · Mariannhill  (R1 274 incl. VAT)    │
│ Truck and driver time  1.3 days × R2 998/day             R 3 897       │
│   finance, insurance, licence, tracking, driver CTC (cost profile)     │
│ Distance costs     738 km × R3.32 (tyres, maintenance, overhead)       │
│                                                          R 2 450       │
│ Driver allowances  1 trip-day × R450                     R   450       │
│ ───────────────────────────────────────────────────────────────────── │
│ Cost of this load                                        R16 874       │
│ Cost per loaded km                                       R29.71        │
│                                                                        │
│ Warnings                                                               │
│  · Fuel consumption is a class default. Log fills to use this truck's. │
└────────────────────────────────────────────────────────────────────────┘
┌─ What to charge ───────────────────────────────────────── excl. VAT ─┐
│                                                                        │
│  Floor (8% margin)        R18 342   ▏                                  │
│  Your last 4 loads, lane  R18 900 to R20 400 (R33.3 to R35.9/km)       │
│                           2 won, 2 lost above R21 000 · last 12 Aug    │
│  Target (15% margin)      R19 853   ◆                                  │
│  Market, interlink        R17 000 · n=unknown · undated                │
│                           Below your floor. Treat as a warning, not    │
│                           a target.                                    │
│                                                                        │
│  Your price  [ R 19 850 ]   Margin R2 976 · 15.0% · R5.24 per km       │
│                                                                        │
│  Customer: AVI Limited · Net 45 · pays 23 days late on average         │
│  Cost of waiting: about R290 at 11% overdraft on this load             │
│                                                                        │
│  [ Send quote ]  [ Save draft ]        Price incl. VAT: R22 828        │
└────────────────────────────────────────────────────────────────────────┘
```

Design rules for this panel: one accent only (the price you are choosing or the floor warning, never both); every line's basis in secondary text; "Not enough data" rather than a default dressed as fact; no AI label on any rule; tabular figures aligned on one right edge; overrides open inline on the line they change.

**Quote detail** becomes the same two panels, frozen at the snapshot, plus a small "If you re-priced today" diff (diesel and tariff changes only). Order: header (price excl./incl. VAT, validity), cost and price panel, customer strip, outcome actions, route (collapsed), cargo, notes.

### 5.3 Fleet: the money questions per truck and driver

The Fleet section should answer, per truck, per month:

| Question | Metric | Source today | Needs |
|---|---|---|---|
| Is this truck making money? | Margin this month (revenue − attributed cost), R and % | Revenue: loads with vehicle. Cost: partial | Expenses tagged to vehicle + cost profile (fixed costs) |
| What does it cost per km? | Cost per km, split fixed / fuel / tyres and maintenance / tolls | `cost_per_km` today is modelled fuel + VehicleLog, fallback R7.88 | Expenses by category + km (telematics or odometer capture) |
| What does it earn per km? | Revenue per loaded km and per total km | Frontend, from 50 loads, planned km | Actual km from telematics for the "total km" denominator |
| How much does standing cost? | Standing days × fixed cost per day | Nothing (no idle computation anywhere) | Load dates (today) + cost profile. Telematics confirms |
| How much runs empty? | Empty km share | Nothing | TMS/telematics legs (C5) |
| Is fuel drifting? | L/100 km, 30 days vs own 90-day baseline | Nothing real | Fuel litres (fuel card or telematics) + km (C3) |
| Which trucks are the outliers? | Cost/km vs fleet median, with sample size | Nothing | All of the above |

For a driver, the only money questions are: what does a trip-day of this driver cost (CTC plus allowances), and what revenue per trip-day do their loads bring. Everything else about drivers (behaviour, hours, violations, licences beyond a renewal reminder) belongs to the telematics partner or HR.

**Wireframe B: truck economics** (illustrative, not live data; one page replacing Overview + Financial tabs)

```
GP 234 EFG · Volvo FH16 750 · Interlink, 7 axles, class 4     [Sep 2026 ▾]
Active · last load delivered 24 Sep · Open in Cartrack ↗

┌──────────────┬──────────────┬───────────────┬────────────────┐
│ Margin, Sep  │ Cost per km  │ Revenue per km│ Standing days  │
│ R38 400      │ R24.10       │ R31.80        │ 5 days         │
│ 16.8% of rev │ fleet med.   │ loaded km     │ R14 990 fixed  │
│ +3.1 pts vs  │ R22.40 (+8%) │ R27.60 all km │ cost, no load  │
│ Aug          │              │               │                │
└──────────────┴──────────────┴───────────────┴────────────────┘
 Basis: 11 loads, 8 240 km (Cartrack odometer). Costs: 4 of 5 categories
 have actuals; driver cost from cost profile.

┌─ Where the money goes, per km ──────────────── Sep vs fleet median ─┐
│ Fuel            R12.90  ███████████████████   median R11.70  +10%   │
│   42.1 L/100 km over 14 fills · own 90-day baseline 39.6 (+6%)      │
│ Fixed (finance, insurance, licence, tracking)                        │
│                 R 5.40  ████████              median R 5.60         │
│ Driver          R 2.80  ████                  median R 2.70         │
│ Tyres, maint.   R 1.90  ███                   median R 1.60         │
│ Tolls           R 1.10  ██                    median R 1.00         │
│                                                                      │
│ The gap is fuel. Open the fill log ↗   Flag for inspection (partner) │
└──────────────────────────────────────────────────────────────────────┘

┌─ Loads this month ─────────────────────────────────────── 11 loads ─┐
│ Load          Lane         Customer   Revenue  Cost    Margin  R/km  │
│ LOAD-…9737    JHB → CPT    AVI        27 538   23 410  15.0%   19.7  │
│ LOAD-…1017    JHB → WIT    Coca-Cola   9 303    8 950   3.8%   62.0  │
│ …                                                                    │
│ Cost basis per row: actual where tagged, modelled where not (◦)      │
└──────────────────────────────────────────────────────────────────────┘

┌─ Pricing profile (used in every quote for this truck) ─── collapsed ─┐
│ Axles 7 · GVM 56 000 kg · Tare 17 500 kg · SANRAL class 4 · C-BRTA   │
│ class 2 · Fixed cost R65 950/month · 22 working days · fuel 90-day   │
│ actual 39.6 L/100 km                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

Vehicles list columns to match: Registration · Class · Margin this month · Cost/km (vs median) · Revenue/km · Standing days · Coverage. Sorted by margin ascending by default, so the truck dragging the fleet is at the top. Rows with too little data (fewer than 3 loads or no km) are muted with "Too few loads to rank" (principle 5).

### 5.4 Customers: what a fleet needs to know commercially

| Question | Metric | Available today? |
|---|---|---|
| Are they worth having? | Margin % and R over 90 days, coverage stated | Needs cost model and load ledger |
| How much do I depend on them? | Share of revenue, 90 days and 12 months; top-customer concentration | Yes: `customer-health` endpoint returns `concentration_pct`, unused |
| Do they pay on time? | Days paid after due, measured against their own terms; trend (last 5 vs prior 10, strategy P1) | Partly: risk service computes days-to-pay but against a fixed 30 days |
| What do they owe now? | Outstanding, overdue, credit headroom | Yes (invoices + `credit_limit`) |
| What does waiting cost me? | Outstanding × days late × cost-of-money rate | Needs a cost-of-money setting |
| What have I charged them? | Rates by lane: last rate, R/km, date, diesel at the time, change since | Quotes and loads exist; needs a per-customer lane aggregation |
| Are they drifting away? | Days since last load vs their usual interval (G2) | Yes, from loads |

**Wireframe C: customer detail** (illustrative, not live data)

```
AVI Limited · Active                         [New quote] [Statement] [Edit]
Net 45 · credit limit R3 500 000 · customer since Jun 2026

┌──────────────┬───────────────┬────────────────┬─────────────────┐
│ Revenue, 90d │ Margin, 90d   │ Owed now       │ Pays            │
│ R412 300     │ 12.4%         │ R186 400       │ 23 days late    │
│ 18% of your  │ R51 100 · 14  │ R62 100 overdue│ on Net 45 terms │
│ revenue      │ loads, 11 with│ headroom       │ slower: was 9   │
│              │ actual costs  │ R3.31 m        │ days late in Q2 │
└──────────────┴───────────────┴────────────────┴─────────────────┘

 ▸ Paying slower than before. At 11% overdraft, the extra 14 days cost
   about R790 a month on their current balance.   [Send statement]

┌─ How they pay ───────────────────── each invoice, days after due ─┐
│  (existing CustomerRisk bar chart, measured against Net 45)        │
│  On time 6 · up to 30 days late 5 · more than 30 days late 3       │
└────────────────────────────────────────────────────────────────────┘

┌─ Rates by lane ────────────────────────────────────── last 12 mths ┐
│ Lane         Class      Loads  Last rate  R/km   Margin  Won/quoted│
│ JHB → CPT    Interlink    9    R27 538    19.70   6.1%    3 of 12  │
│ JHB → DBN    Interlink    4    R20 700    36.44  15.8%    4 of 5   │
│ Last rate change: 16 Jun 2026 · diesel since then +R4.61/L         │
│ [Prepare rate review]  (PDF: loads, diesel and toll movement,      │
│                          proposed rate; strategy M1)               │
└────────────────────────────────────────────────────────────────────┘

┌─ Open invoices ─────────────────┐  ┌─ Contact ───────────────────┐
│ INV-…  due 12 Sep  R62 100  16d │  │ accounts@avilimited.co.za   │
│ INV-…  due 30 Sep  R124 300     │  │ +27 41 401 1392 · JHB       │
│ [All invoices ↗]                │  │ Billing: 693 Industrial Pk  │
└─────────────────────────────────┘  └─────────────────────────────┘
```

Customer list columns to match: Customer · Revenue 90d · Share · Margin % · Owed · Pays (days vs terms) · Last load. Default sort by owed, descending. Concentration warning above the table when one customer exceeds 30% of revenue or debtors (P3).

### 5.5 Insights inline, where the decision is made

The Insights feed stays the place to review and track findings (strategy section 3). But each finding should also appear, as one sentence with one action, on the operations screen where the user is about to act. Same insight object, same number, rendered in two places, computed once (metric registry).

| Screen and moment | Inline insight | Strategy type | Data |
|---|---|---|---|
| Builder, client picked | "Pays 23 days late on Net 45. Owes R186k, R62k overdue." / "Over credit limit by R40k." | P1, P3 | Today |
| Builder, price typed | "Below your floor by R1 480." / "Above your last 4 prices on this lane; 2 lost above R21k." | Q2, Q5 evidence | Needs cost model; lane history today |
| Builder, route computed | "2 toll sections on this route are not priced." / "Round trip priced with loaded return; is the return empty?" | Q4, M1 | After H3, M1 fixes |
| Builder, diesel line | "Your diesel setting R23.50 is 19% below the gazetted R29.11." | C2 pricing | Today |
| Quote detail / board card | "Diesel up R0.62/L since sent. Re-price 4 open quotes, R3 100 exposure." | Q1 | After snapshot fix |
| Quotes board | "11 drafts to AVI on JHB→CPT; archive duplicates?" | hygiene | Today |
| Order detail, delivered | "Delivered 3 days ago, not invoiced: POD missing. Request from CtrlFleet." | M2 | Today (POD via TMS later) |
| Order detail, invoiced | "Invoice is R2 344 below the accepted quote (additional charges missing)." | M3 | Today |
| Order detail, economics | "Actual fuel 18% above quoted on this lane for 3 of the last 5 loads." | Q3 | Needs cost tagging |
| Vehicles list / truck | "Stood 5 days this month: R14 990 fixed cost. 3 lost quotes on its usual lanes." | C4 → G1 | Today + cost profile |
| Truck | "Cost per km 15% above fleet median, driven by fuel." | C1, C3 | Needs km and litres |
| Customer detail / list | "Paying slower than before", "One customer holds 34% of debtors", "Regular customer has gone quiet" | P1, P3, G2 | Today |
| Customer detail, rates | "Rate unchanged since June; diesel +R4.61/L. Prepare rate review." | M1, Q1 | Today (rand margin needs cost model) |

Rule: an inline insight appears only when it would change the action on that screen, carries its rand impact and basis, and links to the full insight. No inline insight on a thin sample.

---

## 6. Prioritised build order

**FE** = frontend only. **BE** = needs backend work (reference to backend review where it exists). **TMS** = needs a partner integration.

### Now: stop wrong numbers and remove repetition (about 1 to 2 weeks, mostly FE)

| # | Change | Work |
|---|---|---|
| 1 | Replace the hard-coded driver password a shared hard-coded password (`Drivers.tsx:560`) with an invite link | FE + BE (invite endpoint may exist for users) · security |
| 2 | Remove "Confidence" everywhere; stop saving `confidence: "MEDIUM"` | FE |
| 3 | Hide win probability on board, detail and builder until the model meets the Q5 bar; show lane history evidence instead | FE (+ BE Wave 0: stop saving rule win %) |
| 4 | Show margin as "Not calculated: no cost profile" instead of `serviceCharge/total`; stop Revenue Guard claiming SAFE | FE |
| 5 | Fix builder caption "live diesel" to state the actual source and date; warn when the setting is >5% below gazetted | FE now; BE Wave 0 for live price |
| 6 | Order Financials: show VAT line so it adds up; show tolls and driver lines | FE |
| 7 | Expired sent quotes display as Expired; hide fuel alert and win % on expired quotes; one status control per page | FE |
| 8 | Remove Fleet command and Activity heatmap (redirect to Vehicles); remove triple status strips | FE |
| 9 | Merge vehicle Overview/Financial tabs and driver tabs into one page each; drop health score, service interval, record, "Live" badge | FE |
| 10 | Stop fetching `fleet/overview/` and `fleet/intelligence/` on Vehicles; hide `cost_per_km` fallback (show "Not enough data") | FE (+ BE: delete intelligence fiction, API C1) |
| 11 | Customer detail: add Owed now, overdue, revenue share, days late (from `customer-health` and invoices), merge "How they pay" chart from the risk page, drop the AI summary | FE (endpoint exists) |
| 12 | Customer list: money columns from `customer-health`; all six payment terms; contact person | FE |
| 13 | Merge Orders and History into one list with "Delivered, not invoiced" queue and blocker reason on top | FE (blocker reasons partly BE) |
| 14 | Remove order live position and "Sync location"; add "Open in CtrlFleet/Cartrack" deep link | FE |
| 15 | Move Insurance out of primary nav | FE |

### Next: the pricing engine the new screens need (about 4 to 6 weeks, BE-led)

| # | Change | Work |
|---|---|---|
| 16 | Live dated diesel resolution with fleet channel (bulk/card/pump) and snapshot of price used | BE (pricing C2, M4; Wave 0) |
| 17 | Vehicle pricing profile: axles, GVM, tare → SANRAL and C-BRTA class | BE + FE (H2, M5) |
| 18 | Company cost profile (fixed per class, driver CTC, allowances, overhead, empty-running %, min/target margin, cost-of-money rate) | BE + FE Settings (Wave 2) |
| 19 | Server `price_quote()` with cost blocks, floor/target, `pricing_snapshot`, VAT fields | BE (C1, C3, H4, H6; Wave 2) |
| 20 | Builder cost and price panel (wireframe A) and quote detail frozen snapshot + re-price diff | FE on 19 |
| 21 | "Your last similar loads" endpoint: same customer or lane, same class, one-way equivalent, diesel-adjusted | BE (new) + FE |
| 22 | Normalised market band with n and date, or hidden | BE (C3, Phase 3) |
| 23 | Customer strip in builder and quote detail (terms, days late, owed, headroom) | FE on 11 |
| 24 | Rates by lane per customer + Prepare rate review PDF | BE aggregation + FE (M1) |

### Then: the load ledger and truck economics (about 4 weeks, BE + FE)

| # | Change | Work |
|---|---|---|
| 25 | Load ledger row: quoted vs actual cost per line, coverage | BE (strategy move 2) |
| 26 | Order detail "Load economics" panel replacing Financials | FE on 25 |
| 27 | Truck economics (wireframe B): margin/month, cost/km split vs median, revenue/km, standing days × fixed cost/day | BE (vehicle economics from expenses + cost profile; idle days, which nothing computes today) + FE |
| 28 | Vehicles list as truck P&L with coverage and "too few loads" muting | FE on 27 |
| 29 | Customer margin (90 days, coverage) on list and detail | BE on 25 |
| 30 | Inline insights on builder, order, truck and customer from the insight service | BE insight service + FE |

### Later: partner data (TMS)

| # | Change | Work |
|---|---|---|
| 31 | Trip km, loaded/empty legs, odometer → actual cost/km, revenue/km, empty running (C5) | TMS (Cartrack Fleet API first) |
| 32 | Fuel litres (CAN or fuel card) → fuel drift (C3), fuel premium (C2) | TMS / fuel card |
| 33 | Geofence dwell → detention on invoice (M4), border dwell into cross-border cost | TMS |
| 34 | POD events → invoice on POD, order sub-states read-only | TMS (CtrlFleet first) |
| 35 | Embedded price endpoint for partners (`POST /v1/price`) reusing `price_quote()` | BE partner API (Wave "Later") |

---

## 7. Other findings noticed in passing

- **Security:** every driver created in the app gets the literal password a shared hard-coded password (`src/pages/Drivers.tsx:560`). Anyone who knows it can sign in as any driver who has not changed it.
- The heatmap requests `page_size=200` and receives 20 rows (API C4), so its analysis is silently based on a fraction of loads.
- Legacy quote status `IT` is shown raw as "It" in the customer quotes table.
- JHB → CPT quote QT-20260713-3182 records 1,563 km; typical road distance is about 1,400 km (pricing review uses 1,398). Worth checking whether a stop or detour was saved.
- Truck GP 234 EFG is typed "Rigid Truck" with 26.6 t capacity (a Volvo FH16 750 is a horse for an interlink). Class and capacity feed fuel and toll pricing, so type data quality matters.
- `CustomerRisk` error state links "Back to Capital" regardless of where the user came from.
- Customer model carries invented defaults (`avg_days_to_pay=30`, `payment_consistency=0.75`, `total_invoices_paid=10`) serialised to the frontend via `fields='__all__'`; nothing renders them today, but any future screen that does would show fiction.
- Seed credit scores of 780 exceed the 0 to 100 field range.
