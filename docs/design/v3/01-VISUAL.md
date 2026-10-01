# TruckWys v3: visual critique (read-only)

Reviewer lens: Dribbble/Awwwards product-UI judge (dashboards, type, colour, dark mode).
Date: 28 Sep 2026. Build: `http://localhost:3815`, branch `truckwys/design-v3`, mid-rebuild.
Method: Playwright at 1440x900 in dark and light, with the theme switched through the app's own toggle so JS-driven colours update. Key pages were also shot at 390x844. Every visible text node was probed for its computed colour against the composited background (WCAG ratio), plus input borders (non-text 3:1), font size/weight histograms, radii, button fills, rails, em dashes and word counts. Raw data is in `v3/critique/data-*.json`, screenshots are in `v3/critique/shots/`, and all paths below are relative to `v3/critique/`.

**Mid-rebuild caveat.** The shell was replaced while this ran. Group A–F shots from about 14:50 show the OLD shell: a 60px icon rail, top bar with "Ask Copilot" and an "Online" pill. Shots prefixed `now-`, plus later ones (settings, admin, 404, heatmap, risk-scores), show the NEW shell: a 232px labelled grouped sidebar, workspace switcher, ⌘K search and user menu. Overview, Insights, vehicle detail and driver detail were re-shot on the new build (`now-*`). Scores for those four pages are for the `now-` state. A few pages were throttled by the 60 req/min limit, which other agents were also using. Where that changed what rendered, it is noted.

---

## 0. Verdict in one paragraph

It does not look babyish because it is cute. It looks junior for three reasons:

1. **It has no conviction.** Every number is the same timid 22px, every card has a two-line paragraph under its title, and every filter is a boxed 40px button.
2. **It spends its one accent on the wrong things.** Bright pastel blue fills the "All" filter, the period chip, every primary button, the floating chat bubble and a saturated royal-blue KPI tile, all on the same screen.
3. **Two design systems are live at once.** The new v3 pages (Overview, Insights, detail pages, new shell) and about 35 legacy pages use different title sizes, tokens, radii and active states.

The rebuilt Overview and Insights are already much closer to the references (Vantage KPI row, hatched cost bars, ranked findings). The job is to finish the system and make every legacy page obey it. It is not a redesign from zero.

---

## 1. Scorecard (1–10, D / L = dark / light at 1440)

Criteria: **Ty** typography · **Col** colour & accent restraint · **Con** contrast (measured) · **Sur** surfaces & depth · **Spa** spacing & density · **Ico** iconography · **Mat** maturity (10 = not babyish at all) · **Avg**.
Reference bar: Haulsight / Vantage ≈ 9 across the board.

| Page (route) | Ty D/L | Col D/L | Con D/L | Sur D/L | Spa D/L | Ico D/L | Mat D/L | Avg |
|---|---|---|---|---|---|---|---|---|
| **Shell: new** (sidebar, top bar) | 7/7 | 6/7 | 5/5 | 7/7 | 7/7 | 7/7 | 7/7 | 6.6 |
| Shell: old icon rail (still in older shots) | 5/5 | 5/6 | 5/5 | 5/5 | 6/6 | 4/4 | 4/4 | 4.9 |
| Today / Overview `/` (now, mid-rebuild) | 7/7 | 5/7 | 7/7 | 7/7 | 7/7 | 6/6 | 6/7 | 6.6 |
| Insights `/insights` (now, mid-rebuild) | 7/7 | 6/6 | 7/7 | 7/7 | 7/7 | 6/6 | 7/7 | 6.8 |
| Bookings: Quotes board `/bookings/quotes` | 5/5 | 6/6 | 7/7 | 5/5 | 5/5 | 5/5 | 5/5 | 5.4 |
| Bookings: Orders `/bookings/orders` | 5/5 | 5/6 | 7/7 | 6/6 | 6/6 | 5/5 | 5/5 | 5.6 |
| Bookings: History | 5/5 | 6/6 | 7/7 | 6/6 | 6/6 | 5/5 | 5/5 | 5.7 |
| New quote `/bookings/quotes/new` | 4/4 | 4/5 | 6/6 | 5/5 | 5/5 | 4/4 | 3/4 | 4.6 |
| Quote detail `/bookings/quotes/25` | 5/5 | 4/5 | 7/7 | 5/5 | 5/5 | 5/5 | 4/5 | 5.1 |
| Order detail `/bookings/28` | 5/5 | 5/6 | 7/7 | 5/5 | 5/5 | 5/5 | 5/5 | 5.3 |
| Fleet command `/fleet/overview` | 5/5 | 6/6 | 7/7 | 6/6 | 6/6 | 5/5 | 5/5 | 5.7 |
| Vehicles `/fleet/vehicles` | 5/5 | 5/6 | 6/6 | 5/5 | 5/5 | 4/4 | 4/4 | 4.9 |
| Vehicle detail `/fleet/vehicles/26` (now) | 6/6 | 7/7 | 7/7 | 7/7 | 6/6 | 6/6 | 6/6 | 6.4 |
| Drivers `/fleet/drivers` | 5/5 | 6/6 | 6/6 | 5/5 | 5/5 | 5/5 | 5/5 | 5.3 |
| Driver detail `/fleet/drivers/16` (now) | 6/6 | 7/7 | 7/7 | 7/7 | 6/6 | 6/6 | 6/6 | 6.4 |
| Activity heatmap `/fleet/heatmap` | 6/6 | 6/6 | 7/7 | 6/6 | 5/5 | 5/5 | 4/4 | 5.6 |
| Customers `/customers` | 5/5 | 6/6 | 6/6 | 5/5 | 5/5 | 4/4 | 4/4 | 5.0 |
| Customer detail `/customers/13` | 5/5 | 6/6 | 7/7 | 6/6 | 6/6 | 5/5 | 5/5 | 5.7 |
| Payment risk `/customers/13/risk` | 5/5 | 6/6 | 7/7 | 5/5 | 5/5 | 5/5 | 4/4 | 5.3 |
| Invoices `/finance/invoices` | 5/5 | 4/5 | 6/6 | 6/6 | 5/5 | 5/5 | 4/5 | 5.1 |
| New invoice `/finance/invoices/new` | 6/6 | 5/6 | 4/5 | 6/6 | 6/6 | 5/5 | 5/5 | 5.4 |
| Invoice detail `/finance/invoices/34` | 6/6 | 6/6 | 7/7 | 6/6 | 6/6 | 5/5 | 6/6 | 6.0 |
| Expenses `/finance/expenses` | 5/5 | 4/5 | 6/6 | 5/5 | 4/4 | 4/4 | 4/4 | 4.6 |
| Finance reports `/finance/reports` | 5/5 | 4/5 | 7/7 | 6/6 | 6/6 | 5/5 | 5/5 | 5.4 |
| Fast Pay `/capital` | 6/6 | 5/5 | 7/7 | 6/6 | 6/6 | 5/5 | 6/6 | 5.9 |
| Advance request `/capital/request` | 5/5 | 6/6 | 7/7 | 6/6 | 6/6 | 5/5 | 6/6 | 5.9 |
| Risk scores `/capital/risk-scores` | 6/6 | 4/4 | 7/6 | 6/6 | 6/6 | 5/5 | 5/5 | 5.6 |
| Insurance `/insurance` | 6/6 | 7/7 | 7/7 | 6/6 | 5/5 | 5/5 | 6/6 | 6.0 |
| Copilot `/copilot` | 5/5 | 5/5 | 7/7 | 5/5 | 5/5 | 4/4 | 4/4 | 5.0 |
| Settings: Profile | 5/5 | 6/6 | 4/4 | 5/5 | 5/5 | 5/5 | 5/5 | 5.0 |
| Settings: Notifications | 5/5 | 6/6 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5.1 |
| Settings: Security | 5/5 | 5/5 | 4/4 | 5/5 | 4/4 | 5/5 | 4/4 | 4.6 |
| Settings: Company | 5/5 | 6/6 | 4/4 | 5/5 | 5/5 | 5/5 | 5/5 | 5.0 |
| Settings: Users & permissions | 5/5 | 6/6 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5.1 |
| Settings: Billing | 5/5 | 4/5 | 6/6 | 5/5 | 5/5 | 5/5 | 4/4 | 4.9 |
| Settings: Billing history | 5/5 | 6/6 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5.1 |
| Settings: Integrations | 5/5 | 5/5 | 6/6 | 5/5 | 5/5 | 6/6 | 5/5 | 5.3 |
| Settings: Xero | 5/5 | 5/5 | 5/6 | 5/5 | 5/5 | 5/5 | 5/5 | 5.1 |
| Settings: Fleet import | 5/5 | 6/6 | 6/6 | 5/5 | 5/5 | 5/5 | 5/5 | 5.3 |
| Settings: Customers / Vehicles / Vehicle types dirs | 4/4 | 4/4 | 6/6 | 5/5 | 4/4 | 4/4 | 4/4 | 4.4 |
| Settings: Risk-scoring API | 5/5 | 5/5 | 6/6 | 5/5 | 5/5 | 5/5 | 5/5 | 5.1 |
| Admin: Home | 5/5 | 6/6 | 6/6 | 6/6 | 5/5 | 5/5 | 5/5 | 5.4 |
| Admin: Companies | 4/4 | 3/4 | 6/6 | 4/4 | 3/3 | 4/4 | 3/3 | 3.8 |
| Admin: Users / Search / Demo / Audit log | 5/5 | 5/5 | 6/6 | 5/5 | 5/5 | 5/5 | 5/5 | 5.1 |
| Admin: Truck types / Cross-border rates | 4/4 | 5/5 | 6/6 | 5/5 | 4/4 | 5/5 | 4/4 | 4.6 |
| Admin: Platform health | 5/5 | 5/5 | 6/6 | 4/4 | 3/3 | 5/5 | 4/4 | 4.6 |
| Login `/login` | 5/5 | 4/5 | 6/7 | 5/5 | 5/5 | 5/5 | 4/4 | 4.9 |
| Signup `/signup` | 5/5 | 4/5 | 6/7 | 5/5 | 4/4 | 4/4 | 4/4 | 4.6 |
| Forgot / reset / verify email / OTP | 5/5 | 5/5 | 6/7 | 5/5 | 5/5 | 5/5 | 5/5 | 5.2 |
| Public quote `/quotes/view/:id/:token` | 6/6 | 6/6 | 7/6 | 6/6 | 6/6 | 5/5 | 6/6 | 6.0 |
| Public invoice (invalid-link state) | 6/6 | 6/6 | 7/6 | 6/6 | 6/6 | 5/5 | 6/6 | 6.0 |
| 404 | 3/3 | 4/4 | 6/6 | 4/4 | 4/4 | 4/4 | 3/3 | 4.0 |
| **Mobile 390** (Today, Insights, Orders, Vehicles, Vehicle, Invoices, Customer, Profile) | 4/4 | 5/5 | 5/3 | 5/5 | 4/4 | 5/5 | 3/3 | 4.3 |

Product-wide average: **about 5.3/10**. The rebuilt v3 surfaces average **6.5**. Legacy list, form, settings and admin pages average **about 5.0** and are the long tail that makes the product feel unfinished.

### Measured contrast (text: WCAG 1.4.3; non-text: 1.4.11)
Body text passes almost everywhere. The text tokens are good: light `#646B76` on `#FFF` = 4.92, dark `#8B919C` on `#131519` ≈ 5.9. Every failure found:

| Where | Element | fg / bg | Ratio | Need |
|---|---|---|---|---|
| All pages, both themes | Notification badge "25" 10px/700 | `#FFFFFF` / `#FF4949` (D) | **3.33** | 4.5 |
| | | `#FFFFFF` / `#EF4444` (L) | **3.76** | 4.5 |
| New shell workspace switcher | "T" monogram 12px/700 | `#111827` / `#2563EB` (L) | **3.43** | 4.5 |
| | | `#EDEDED` / `#4D9EFF` (D) | **2.34** | 4.5 |
| Old Overview, public quote footer | Date / "Sent with TruckWys" 13–14px | `#6B7280` / `#F3F4F6` | **4.39–4.43** | 4.5 |
| Risk scores (light) | "Soon" chip text 11px on dark chip | `#646B76` / `#0F1216` | **3.49** | 4.5 |
| New invoice (dark) | Disabled "Create invoice" | ≈`#5B7BA8` / `#1A3A6B` | **≈2.6** | readable but reads as broken (disabled is exempt) |
| Any `#F59E0B` warning **text** in light | e.g. amber labels | `#F59E0B` / `#FFFFFF` | **2.15** | 4.5 |
| Any `#EF4444` danger **text** in light | e.g. "74 days late" | `#EF4444` / `#FFFFFF` | **3.76** | 4.5 |
| **Every input, every form** | 1px input border | `#E6E8EC` / `#FFFFFF` (L) | **1.23** | 3.0 |
| | | `#E5E7EB` / `#F3F4F6` (L page) | **1.13** | 3.0 |
| | | `#22262D` / `#131519` (D) | **1.20** | 3.0 |
| | | `#2A2E34` / `#060709` (D legacy) | **1.48** | 3.0 |
| Card borders (decorative, informational only) | | `#E6E8EC`/`#F4F5F7` 1.12; `#22262D`/`#0A0B0D` 1.30 | fine for cards, not for controls | – |

Housekeeping counts: no coloured side rails and no border-plus-shadow combinations were found anywhere (good). Em dashes in user copy were found only in Admin → Truck types (12) and Cross-border rates (6). Text below 12px appears on every new-shell page (sidebar group labels 11px plus the badge at 10px).

---

## 2. The 15 most damaging visual problems (ranked)

**1. Two design systems are live at once.**
Shots: `shots/now-overview-light.png` vs `shots/settings_security-dark.png` vs `shots/admin_companies-light.png`.
- H1 is 28px/700/−0.7px on v3 pages, 22px/600/0 on all settings and admin pages, and 22px in legacy page heads.
- Tokens drift between the legacy dark set (page `#060709`, card `#101215`, border `#2A2E34`) and the new set (`#0A0B0D` / `#131519` / `#22262D`). Light drifts between `#F3F4F6`/`#E5E7EB` and `#F4F5F7`/`#E6E8EC`.
- Radii measured across the app: 8, 6, 10, 50%, 12, 999, 16, 3, 7, 2 and 4px, which is 11 distinct values. `theme.css` sets `--card-radius: 16px` while DESIGN-PRINCIPLES says 12.
- **Fix:** one token file, one `PageHeader`, one `Card`, one `KpiTile`, one `DataTable`, one `Segmented`. Delete the legacy token aliases and lint for raw hex values and for radii outside {6, 8, 12, 16, 9999}.

**2. KPI figures are timid and every one has a sentence underneath.**
Shots: `shots/fleet_vehicles-light.png`, `shots/bookings_orders-dark.png`, `shots/fleet_overview-dark.png`, `shots/bookings_28-light.png`.
- Legacy KPI strips use 22px/600 figures in a 3-up strip at 116px, with a full sentence below ("Vehicles with status In use.", "Planned route distance.").
- The references use 36–44px figures with at most two short lines.
- **Fix:** hero tile figure 40/44 600 −0.03em tabular. Standard tile 32/36 600 −0.025em. Label 13/500 text-2 above. One line below, 12/500, that is a delta or unit only ("+8.2% vs Aug", "of 20"). Sentences move into the info-icon tooltip.

**3. The accent is spent on everything, and it is bright pastel in dark.**
Shots: `shots/finance_invoices-dark.png`, `shots/finance_reports-dark.png`, `shots/bookings_quotes_new-dark.png`, `shots/insights-dark.png`.
- Solid blue fills appear on the "All" filter, the "Profit and loss" sub-tab, "This month", "One way", "New chat", the chat FAB, primary buttons and the Overview emphasis tile, often four or more on one screen.
- Dark primary uses two different blues: `#4D9EFF` (r8) and `#5B9BFF` (r10), both with black text. Light uses `#2563EB` with white text.
- **Fix:** the primary button is ink: light `#0E1116` with white text, dark `#F2F4F7` with `#0B0C0E` text. That matches the Close/Revenue references and Vantage's white CTA. Blue is kept for data series, links, focus and at most one emphasis tile per page. Selected filters and segments use a neutral raised surface, never an accent fill.

**4. Filters are rows of separate 40px outlined boxes, not segmented controls.**
Shots: `shots/finance_expenses-dark.png` (4 native `<select>`s plus 4 boxed chips), `shots/bookings_orders-light.png`, `shots/fleet_vehicles-light.png`, `shots/insights-dark.png` (6 boxed period chips).
- This is the single most "template" pattern in the app. The vehicle-detail status control is already a proper segmented control, so the pattern exists.
- **Fix:** Segmented control is 32px tall with a 3px inset, container `surface-2` radius 8, selected segment `surface` radius 6 with a hairline border, 13/500. Up to 5 options. Anything more goes in a dropdown. Replace native `<select>` with the app's own Select (styled trigger and custom chevron).

**5. Semantic colour is broken at the token level.**
- `--status-success` is **blue** (`#4D9EFF` D / `#2563EB` L), so "Active" renders blue (`shots/settings_vehicle-types-dark.png`), while "Available" and "Approved" chips render green elsewhere.
- Warning text `#F59E0B` on white is 2.15:1. Danger `#EF4444` on white is 3.76:1.
- Risk tiers use 5 hues in one card (`shots/capital_risk-scores-dark.png`: green, blue, yellow, red, grey chips).
- **Fix:** success, warning and danger use the triplets in §3.2. Tiers use one neutral chip plus a single danger colour for "High" and "Ineligible". Ordinal data never gets a rainbow.

**6. Dark mode is inverted, not designed.**
Shots: `shots/now-overview-dark.png`, `shots/finance_invoices_new-dark.png`, `shots/login-dark.png`.
- The accent flips from dark-on-light to black-on-pastel.
- The emphasis tile is saturated `#1D4ED8`, which glows on near-black.
- Disabled primary is navy `#1A3A6B`.
- The active nav in dark is a faint `#252A32` pill while light is a solid `#0F1216` pill, so emphasis is not equivalent.
- The auth split screen has a lighter left pane than right, which reads back to front.
- The chart palette uses muddy `#2C5AA0`-like bars (`shots/finance_reports-dark.png`).
- **Fix:** design dark as its own ramp (§3.2). Surfaces step up in lightness (bg `#0B0C0E` → surface `#121418` → raised `#181B20`). The accent is lighter and less saturated (`#6AA6FF`). The emphasis tile is `#1E40AF` (white text 8.7:1). Active nav is `#F2F4F7` text on `#23272E`, plus a 500 weight.

**7. Inputs have no visible boundary (WCAG 1.4.11 failure on every form).**
Shots: `shots/settings_security-dark.png`, `shots/settings_profile-light.png`, `shots/finance_invoices_new-light.png`.
- Input borders measure 1.12–1.48:1.
- **Fix:** give inputs their own border token: light `#858C96` (3.39 on white, 3.14 on page), dark `#636A76` (3.38 on `#121418`). Keep card borders subtle. Inputs are 40px tall, radius 8, with a 2px focus ring in accent at 30% alpha.

**8. Monospace is used for every identifier.**
- All over (`shots/bookings_orders-dark.png`, `shots/finance_invoices-dark.png`, `shots/fleet_vehicles-dark.png`, `shots/admin_health-light.png`). LOAD-, QT- and INV- numbers, plates, VINs and cron names render in `ui-monospace` at 13px, which reads as a dev console.
- **Fix:** IDs use the sans at 13/500 with `font-variant-numeric: tabular-nums` and letter-spacing 0.01em. Mono only on the Risk-scoring API page and in code blocks.

**9. Too many words.**
- Word counts: Overview (old) 589, Settings → Security 1,170, Admin cross-border 580, Vehicles 453–483, Expenses 406, Capital 383.
- Card subtitles are 2-line methodology paragraphs (`shots/overview-dark.png` "Each month shows revenue (invoices paid in the month)…").
- Tables carry footnotes (`shots/finance_invoices-dark.png` "This list holds the 20 most recent of 34 invoices…").
- **Fix:** subtitles at most 8 words, methodology behind an ⓘ, and footnotes become a "20 of 34" meta label next to the count.

**10. Table rows are cluttered with actions.**
- "Edit" and "Delete" text buttons sit on every row (`shots/fleet_vehicles-light.png`, `shots/customers-dark.png`, `shots/settings_vehicle-types-dark.png`).
- Admin Companies stacks an underlined blue link, an outlined "Suspend" and a red outlined "Delete" per row, making rows about 130px tall (`shots/admin_companies-light.png`).
- A checkbox column is always visible.
- **Fix:** 44px rows. One trailing `⋯` icon button (32px, 44px touch target) opens a menu. Checkboxes appear only on hover or once selection starts. Destructive actions live only in the menu, with red text, never as a red outlined button in the row.

**11. Navigation chrome is double and inconsistent.**
- Settings and Admin show the app sidebar (232px) plus a section nav (about 210px), so about 450px of chrome before content (`shots/settings_profile-light.png`, `shots/admin_home-dark.png`).
- The two navs use different active treatments (solid black pill vs grey pill).
- Admin Health overflows horizontally at 1440: the Integrations card is clipped at the right edge (`shots/admin_health-light.png`).
- **Fix:** when inside Settings or Admin, swap the app sidebar's content for the section nav (Linear/Vercel pattern) or collapse the app sidebar to icons. Use one active style everywhere. Put a min-width guard on grids.

**12. Zero, empty and error states are shown as big tiles.**
- Vehicle detail shows three KPI slots saying "No delivered loads" (`shots/now-fleet_vehicles_26-dark.png`).
- Driver shows "0 of 1".
- Heatmap shows "0 of 0 / 0 / 0" when the API was **throttled**, so an error rendered as real zeros (`shots/fleet_heatmap-dark.png`).
- Customer risk shows "25%" and "Nothing" tiles for a customer with no invoices (`shots/customers_13_risk-light.png`).
- Invoices spends a double-width tile on "Nothing invoiced in September yet".
- **Fix:** when every KPI is empty, collapse the strip into one 48px inline notice with one action. Errors render an error row with Retry, never zeros.

**13. Chart craft is below the references.**
- `shots/finance_reports-dark.png`: flat desaturated bars with no hatch, no hover, "R0" next to "R 0", and a legend in 8px squares.
- The old Overview dumbbell chart is illegible.
- KPI "sparklines" on the new Overview are 20px stubby grey blocks that look like a loading skeleton (`shots/now-overview-dark.png`).
- **Fix:** Vantage spec: dotted 1px grid (`chart-grid` at 60%), revenue solid accent, costs 45° hatched neutral, current period at full opacity and others at 70%, rich tooltip (surface, 12px radius, shadow-pop, label + 2 values + delta). Micro bar-sparkline 64×24, 3px bars with 2px gaps, the last bar in accent.

**14. Copy casing and number formats are mixed.**
- Backend strings arrive in Title Case ("Invoice Overdue: INV-…", "9 Vehicles Idle", "Page Not Found").
- They also carry en-US numbers and ISO dates ("R 20,505.65. Due 2026-06-05") next to SA-formatted figures ("R 20 505,65") on the same screen (`shots/now-overview-dark.png`, Needs you).
- **Fix:** format client-side, sentence case only, one `formatZAR`, and dates as "5 Jun".

**15. Mobile at 390 breaks the illusion.**
- The Today KPI tiles render as unstyled stacked text with black block bars (mid-rebuild, `shots/m-overview-crop.png`).
- **The white wordmark is invisible on the white light-mode header** (`shots/m-overview-crop.png`, left).
- Insights period chips wrap to 2 rows. The Fleet header stacks 3 buttons ("+ Add vehicle" with a literal "+").
- Filter chips overflow.
- **Fix:** swap the logo per theme. KPIs become a 2-column grid of 20px/600 figures. Period uses a scrollable segmented control. The header shows one primary action and moves the rest to a `⋯` menu.

Honourable mentions that each add "junior" points:
- Blue floating chat FAB on the quote builder.
- The login headline with a blue-highlighted phrase ("you left it") plus a checkmark feature grid plus a pricing reminder on a sign-in screen.
- The 404 uses a 60px "404", Title Case, "Truckwys" misspelt, and two full-width buttons.
- The "Fuel price alert" callout is an amber wash box (`shots/bookings_quotes_25-dark.png`).
- The OSM map tiles are saturated, with a bright green collection chip.
- The old shell's "Online" pill.

---

## 3. v3 visual spec proposal (aligned to Haulsight, Close, Vantage, Revenue)

### 3.1 Typography
- **Family:** Inter (or Geist) via Google Fonts, `font-feature-settings: "cv11","ss01","tnum"` on numeric contexts. The system stack currently gives SF on Mac and Segoe UI on Windows, which are different products. **Mono:** JetBrains Mono, used only on the API page and in code.
- **Weights:** 400, 500 and 600 only. 700 is removed; Inter 600 at display sizes reads as confident without shouting.

| Token | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 28 / 34 | 600 | −0.022em | Page title (one per page) |
| `figure-hero` | 40 / 44 | 600 | −0.03em, tnum | The one emphasised KPI |
| `figure` | 32 / 36 | 600 | −0.025em, tnum | KPI tiles |
| `figure-sm` | 20 / 28 | 600 | −0.015em, tnum | In-card figures, detail totals |
| `title` | 15 / 22 | 600 | −0.01em | Card title |
| `body` | 14 / 20 | 400 | 0 | Default |
| `table` | 13 / 20 | 400 (500 for primary column) | 0, tnum | Table cells, IDs |
| `label` | 13 / 18 | 500 | 0 | KPI labels, field labels |
| `meta` | 12 / 16 | 500 | 0 | Deltas, axis, chip text, subtitles |
| `group` | 11 / 16 | 600 | +0.06em uppercase | Sidebar group labels ONLY |

Rules:
- No text under 12px except `group`.
- Subtitles use `meta` in text-2, one line.
- The page subtitle is 14/20 text-2, one line of at most 8 words.

### 3.2 Palette
Philosophy: neutral ink UI, **one** brand accent (TruckWys blue) used for data and one emphasis per page, semantic colours only for state, and ink for primary actions.

**Light**
| Token | Hex | Contrast |
|---|---|---|
| `bg` (page) | `#F5F6F8` | – |
| `surface` (card, sidebar) | `#FFFFFF` | – |
| `surface-2` (segmented track, hover, raised) | `#F0F2F5` | – |
| `border` (cards, dividers) | `#E3E6EA` | 1.25 on white (decorative) |
| `border-input` | `#858C96` | 3.39 on white, 3.14 on bg ✓ 1.4.11 |
| `text-1` | `#0E1116` | 18.9 on white, 17.5 on bg |
| `text-2` | `#4A515C` | 8.0 / 7.4 |
| `text-3` | `#6A717C` | 4.92 / 4.55 ✓ |
| `ink` (primary button, active nav) | `#0E1116` + white text | 18.9 |
| `accent` | `#2563EB` | 5.17 on white (text/links OK) |
| `accent-soft` (selected row tint) | `#2563EB` at 8% | – |
| `success` text / chip bg | `#15803D` / `#ECFDF3` | 5.02 / 4.76 |
| `warning` text / chip bg | `#B45309` / `#FFF7E6` | 5.02 / 4.71 |
| `danger` text / chip bg | `#C81E1E` / `#FEF2F2` | 5.74 / 5.24 |
| Notification badge | white on `#C81E1E`, 11/600 min | 5.74 |

**Dark** (designed, not inverted)
| Token | Hex | Contrast |
|---|---|---|
| `bg` (page and sidebar, separated by border) | `#0B0C0E` | – |
| `surface` (card) | `#121418` | – |
| `surface-2` (raised, hover, segmented track) | `#181B20` | – |
| `border` | `#23272E` | 1.23 (decorative) |
| `border-input` | `#636A76` | 3.38 on surface, 3.59 on bg ✓ |
| `text-1` | `#F2F4F7` | 16.7 on surface, 17.8 on bg |
| `text-2` | `#A7ADB7` | 8.2 |
| `text-3` | `#858C97` | 5.4 / 5.8 |
| `ink` (primary button) | `#F2F4F7` bg + `#0B0C0E` text | 17.8 |
| Active nav | bg `#23272E`, text `#F2F4F7`, weight 500 | – |
| `accent` (data, links, focus) | `#6AA6FF` | 7.5 on surface |
| Emphasis KPI tile | `#1E40AF` + white | 8.72 (sub-text `#DCE4FB` ≥ 6) |
| `success` / `warning` / `danger` text | `#4ADE80` / `#FBBF24` / `#F87171` | 10.6 / 11.0 / 6.7 |
| Chip bg (dark) | the state colour at 12% over surface | – |
| Notification badge | white on `#DC2626` | 4.83 |

Chart colours (both themes): primary series = `accent`; comparison = `text-3` at 55% with a 45° hatch; grid = `border` dotted; negative = `danger` only when meaningful.

Accent budget, enforced in review: at most 1 filled accent element per viewport (the emphasis tile **or** a chart series highlight). Buttons are ink. Selected filters are neutral.

### 3.3 Radius, border, shadow
- Radius: **12** cards · **8** controls (buttons, inputs, segmented track, menus) · **6** chips, badges, segmented thumb · **16** dialogs and sheets · **9999** only for avatars and status dots. Nothing else; lint for it.
- Cards: 1px `border`, no shadow. Floating layers (menus, popovers, tooltips, dialogs): `shadow-pop` plus a 1px border. They are not cards.
- Light pop shadow: `0 12px 32px rgba(15,18,22,.12), 0 2px 6px rgba(15,18,22,.06)`. Dark: `0 12px 32px rgba(0,0,0,.55)` + border `#2C3139`.
- Hover: `surface-2` tint only; the border never changes. Focus: `0 0 0 3px` accent at 30%.

### 3.4 Spacing and layout
- 4pt scale: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Page gutter 32 (desktop), 16 (phone). Page header: title, then 4px, then subtitle, then 24px to content. Section gap 24. Card gap 16. Card padding 24 (KPI tile 20).
- Table rows 44 (48 on touch). Header row 36, `meta` 12/500 text-3, not uppercase.
- Max content width 1440 with a 12-column grid. KPI row is max 4 tiles; hero tile spans 4 columns, others 8/3.
- Sidebar 240px: groups (WORK, NUMBERS, RECORDS, …) with a 16px gap between groups and 32px items with radius 8.

### 3.5 Controls
- Button heights 32 (compact, in toolbars) and 40 (default). 48 on phones.
- Primary = ink. Secondary = surface + 1px `border-input` at 60%. Tertiary = text-2 with no box.
- One primary per page header, max. Remove `+` glyphs typed into labels; use a 16px Lucide `plus` icon.
- Segmented control per §2.4. Status chip: 22px tall, radius 6, 12/500, 8px x-padding, a leading 6px dot in the state colour, and **neutral** chip bg (`surface-2`) for every state except danger and warning. That is Linear/Vantage restraint: the dot carries the colour.

### 3.6 Icons
- Lucide at 1.5 stroke. Sizes: 16 in nav, buttons and inputs; 14 inline with meta; 20 for empty states only.
- Colour text-3, active text-1. No coloured icons except state (danger/warning) inside lists.
- Icon chips (Close report cards): 32px, radius 8, `surface-2`, icon text-2. Used only on library-style cards (Reports, Integrations).
- No FAB. No emoji. No decorative icons in headings. The ⓘ info icon is 14px text-3 and sits 6px after a title.

---

## 4. Per-page fix lists

**Shell (new)**
- Workspace monogram: white on `#2563EB` (L) and on `#1E40AF` (D). It currently fails at 3.43 / 2.34.
- Badge becomes a 6px red dot, or 11/600 white on `#C81E1E` with min-width 16. Drop "25" when the count is over 9 (use "9+").
- Dark active nav equivalent to light (see §3.2).
- The "Account active" footer with a green dot is noise; remove it or move it into the user menu.
- Replace the "Soon" pills with a text-3 "Soon" 12/500 label, no border.
- Logo swaps per theme on mobile (currently white on white).

**Today / Overview (mid-rebuild)**
- The emphasis tile in dark becomes `#1E40AF`; the white progress bar becomes 4px `rgba(255,255,255,.35)` track with a white fill.
- Figures to 32/600 (hero 40). Replace "No prior 30 days to compare" in the delta slot with a text-3 "–" and the reason in a tooltip.
- Sparklines to 64×24 bars with the last bar accent, or remove them.
- "Needs you" rows: sentence case, `formatZAR`, "Due 5 Jun", icon chips neutral with only the glyph coloured, row 48px.
- Mobile: restore tile styles (currently unstyled).

**Insights (mid-rebuild)**
- Tabs plus the ranked finding cards are good.
- The emphasis tile uses the same token as Overview.
- "High" and "Medium" chips go neutral with a dot.
- Buttons "Send reminders ›" are outlined blue; make them secondary ink-outline, with only the first finding's CTA as primary.
- The "Ranked by value" bar under each figure should share a column edge across cards.
- Period control becomes a segmented control; on mobile it scrolls horizontally, not wraps.

**Bookings: Quotes board**
- Column headers: drop the coloured dots (grey, amber, green, red), use counts only, and put the status colour on the card chip only.
- Card: ID as sans 12/500 text-3, customer as title, "Medium confidence" as a text-3 meta.
- Remove "Drag a card to change its status" (use a tooltip on first use).
- The Board/List toggle becomes a segmented control.

**Bookings: Orders / History**
- KPI strip: 32px figures, one short line each.
- Filter chips become a segmented control.
- IDs in sans tnum. The route arrow "→" is fine.
- The "Loading" chip in amber on dark is loud; use a neutral chip with an amber dot.

**New quote (builder)**
- Remove the blue FAB.
- "One way / Round" becomes a 32px segmented control, not two 40px full-width buttons, one of them solid blue.
- "Clear & new quote" becomes a tertiary button.
- Map: muted tile style (Carto Positron / Dark Matter) so the map is not the loudest thing.
- Collection/Delivery toggle chip: neutral instead of green.
- Required-field red dots become "Optional" labels on the optional fields instead.

**Quote detail**
- Fuel alert: from an amber-wash box to an inline notice row (warning dot + 1 line + action) inside the Pricing card.
- The status `<select>` in the side card becomes a proper status menu.
- The total 28px figure moves into a `figure-sm` summary card.
- "Round trip" chip neutral.

**Order detail**
- The stepper's blue line plus dots looks consumer. Use a 5-segment progress bar (4px, accent to the current step) with labels 12/500 below.
- Drop the "audit test" description under Cargo weight.
- "Upload POD" is a lone full-width secondary button in a card called "Actions". Put it in the page header.

**Fleet command / Vehicles / Drivers**
- Page header actions: one primary ("Add vehicle", icon plus) with "Import" and "Heatmap" in a `⋯` menu.
- KPI strip at 32px.
- Row actions become `⋯`. The checkbox column appears only when selecting.
- "Unassigned" in text-3. The health score gets a 40px micro bar or stays plain, but is right-aligned tnum.
- Status chips neutral with a dot.

**Vehicle detail / Driver detail (mid-rebuild)**
- The direction is good.
- When all KPIs are empty, collapse them to a notice ("No delivered loads yet · Assign a load").
- Remove "Default" and "Rule-based" pill chips (use a text-3 suffix).
- "Not recorded: Odometer, last maintenance…" is a paragraph; make it one "Add service details" row.
- Driver header "SA1895075" moves to sans tnum.

**Heatmap**
- Never render "0 of 0" on a fetch error; show an error row with Retry.
- The loading spinner uses the TruckWys mark in blue, which is cute. Use a skeleton.
- Legend squares at 10px with radius 2 are fine.

**Customers / Customer detail / Payment risk**
- Table: remove duplicated "Company" when it equals Name, `⋯` actions, 44px rows.
- Detail: the "You have not quoted AVI Limited yet" banner becomes an inline empty row in the Quotes card.
- Risk: with fewer than 3 invoices, do not show "25%" as a hero figure. Show "Not enough history" as the tile state, and move the explainer paragraph into an ⓘ.

**Invoices**
- Replace the "Nothing invoiced in September" double tile with a KPI row (Overdue balance hero, Avg days to pay, Drafts ready) and put the empty-month note as meta.
- "All" filter neutral.
- Remove the footnote under the filters.
- Red "74 days late" uses `#C81E1E` / `#F87171` (the current light `#EF4444` is 3.76).

**New invoice**
- Input borders to `border-input`.
- Dark disabled primary becomes ink at 40% opacity, not navy.
- Remove "Suggested automatically…" helper (put it in a tooltip).
- The summary card is good; bring its total to `figure-sm`.

**Expenses**
- 3 native `<select>`s become one "Filters" popover plus a search field. The status filter becomes a segmented control.
- Remove the footnote.
- The "No expenses recorded in September" tile goes the same way as Invoices.
- Pending, Approved and Rejected chips go neutral with a dot.

**Finance reports**
- Sub-tabs as a segmented control, not blue-filled chips.
- Chart per §2.13, with "R 0" formatting.
- "Figures as at 14:54" becomes a meta label.
- Export CSV becomes secondary (it is currently the only and blue primary on a read-only page).

**Fast Pay / Advance request / Risk scores**
- Aging bar: the two blues are close (`#5B9BFF` vs `#93C5FD`). Use an ordinal ramp of one hue at 30/50/70/100% plus danger only for 90+.
- The per-customer bars are good (thin, share a column edge). Keep them.
- Risk tiers: one neutral chip plus danger for High/Ineligible.
- "Not live yet" chip: neutral, 12/500.

**Insurance**
- Fine as a quiet placeholder.
- Card width 720 on a 1440 page leaves a void; centre it at 640 or give it a two-column "what it will do / status" layout.

**Copilot**
- "New chat" becomes secondary with an icon.
- The suggestion cards are 5-across on desktop at 98px tall. Use 3 cards of 2 lines, or a single list of prompt chips under the composer.
- The conversation list "×" icons appear on hover only.
- The Send button is disabled grey on grey; use an ink icon button inside the input.

**Settings (all)**
- Collapse the double nav (§2.11).
- H1 to `display` 28/600 (currently 22/600).
- Card header rows with a full-width divider under every title become header plus body with no divider.
- Security: the "Recommended" outlined blue chip becomes neutral. "Revoke" red outlined buttons become tertiary red text.
- Billing: "Unlock the full platform" box plus 8 checkmarks is marketing inside settings; reduce it to the plan line plus one CTA.
- Directories (Customers, Vehicles, Vehicle types): em dashes out, "Platform default" pill becomes text-3 meta, "Active" blue becomes a neutral chip with a green dot, `⋯` actions.
- Xero: centred empty state with an icon, 2 paragraphs and a navy disabled button. Make it one line plus a disabled ink button and an ⓘ.

**Admin**
- Companies: rows to 44px, one `⋯` menu, no underlined links, no red outlined buttons, status "None" amber becomes neutral.
- Health: fix the horizontal overflow; the Integrations card wraps below at under 1600px. Cron names go sans.
- Truck types / Cross-border: remove 18 em dashes.
- Home: KPI grid 4-across (it currently wraps 3+1).

**Auth (login, signup, forgot, reset, verify, OTP)**
- Remove the blue-highlighted headline phrase, the checkmark grid and the pricing reminder from login (they can stay on signup, once).
- Make the brand pane the darker one in dark mode.
- Sign-in button becomes ink.
- Inputs get `border-input`.
- Card radius 16 is fine for auth.

**Public quote / invoice**
- The quality level is right. Footer text-3 on page `#F3F4F6` goes up to `#6A717C` on `#F5F6F8` (4.55).
- The quote needs the sender's logo and a clear "Accept quote" primary. The map should use muted tiles.

**404**
- "Page not found" 20/600, one line "This link does not go anywhere in TruckWys.", one ink "Go to Today" button plus a text "Back" link.
- Remove the 60px "404" (or make it 12/500 meta). Fix "Truckwys" to "TruckWys".

---

## 5. Order of work (highest leverage first)
1. Tokens (§3.2), radius lint, and input border and badge fixes. This is a one-file change that removes most contrast failures.
2. `PageHeader`, `KpiTile`, `Segmented`, `StatusChip`, `DataTable` (with a `⋯` row menu), then roll them out to Orders, Vehicles, Customers, Invoices, Expenses, Reports, Settings directories and Admin Companies.
3. Ink primary buttons, and remove all accent-filled filters and the FAB.
4. Chart kit (grid, hatch, tooltip, micro-sparkline).
5. Copy pass: subtitles to 8 words or fewer, methodology into ⓘ, sentence case and ZAR formatting of backend strings.
6. Mobile pass at 390 on the 8 key pages.
