# 03 — Fuel price automation review (TruckWys backend @ 45039ee)

Reviewed 2026-09-28. Read-only: no repo files touched, no dev-DB writes. Demonstrations ran in Django's throwaway **test** database with every HTTP call mocked, against a saved copy of the FIASA page (`scratchpad/backend-review/fiasa.html`, fetched 2026-09-28). The demo harness is `scratchpad/backend-review/fueldemo/test_fuel_demo.py`, run via `manage.py test <dir> -t <dir>`. Known issues from `docs/audit/BACKEND-AUDIT-2026-09-23.md` are not repeated below; where a finding builds on one, it says so.

---

## Verdict

"Live diesel" is not what TruckWys uses to price loads today. The quote screen (`QuoteBuilder`) prices fuel from `Company.fuel_price_per_litre`. That is a hand-set number with no date. Every company in dev still holds the R23.50 seed value, which is R5.61/L under September's Gauteng wholesale price. The FIASA scrape is the only feed that works, and it has five problems:

- It reads the **500ppm** wholesale row. Modern trucks burn 50ppm, and the model help text claims "50ppm retail".
- It ignores the effective-date column headers.
- It files every price under the 1st of the month, although prices change at 00:01 on the first Wednesday.
- A later failed scrape can overwrite a good row with the hardcoded fallback table. The nightly job does this with `force_update=True`.
- The fallback table does not hold real prices. In 2026 it is off by between −R6.83 and +R5.63 per litre.

Provenance (source, effective date, grade, zone) is dropped before a quote is saved. `fuel_price_at_creation` records the national inland reference, not the price the quote was built on. The surcharge and fuel-alert features compare two unrelated numbers.

There is no freshness alert. The only monitor checks whether the Celery task ran, not whether the price is current. The task's retry handler also sends two retry messages for every failure.

The fix is not better scraping. It is a small, effective-dated price ledger with these parts:
- Official CEF/DMPR figures as the authority.
- FIASA as a cross-check.
- A person confirming the price each month, on the Tuesday before the change.
- Freshness alerts.
- Per-fleet actual cost, from a fuel card or bulk contract, layered on top.
- Every quote freezing the exact basis it used and showing it to the user.

The backend work is about M (a sprint). Without it, every load quoted in a month with a large fuel move is mispriced by R1,500–R3,800.

---

## 1. How SA diesel pricing actually works (what "accurate" means)

| Fact | Consequence for TruckWys |
|---|---|
| Petrol has a regulated **retail** price. Diesel has only a **wholesale list price**. Each forecourt sets its own diesel pump price ([FIASA – how prices are set](https://fuelsindustry.org.za/consumer-information/how-fuel-prices-are-set/); [FIASA price table notes: "Retail Price for Petrol", "Wholesale List Price for Diesel & IP"](https://fuelsindustry.org.za/consumer-information/fuel-prices-current-past/)) | No official "retail diesel price" exists. The model's help text ("retail") is wrong. The gazetted number is a **reference**. A fleet's real cost is that reference plus the forecourt margin, or minus its fuel-card or bulk discount. |
| Two grades: **0.05% S (500ppm)** and **0.005% S (50ppm)**. They move by different amounts: in June 2026 the decreases were 324.96 c/l vs 261.96 c/l ([gov.za, 3 June 2026 statement](https://www.gov.za/news/media-statements/mineral-and-petroleum-resources-announces-adjustment-fuel-prices-effective-0)) | The gap between grades changes every month. In 2026 it ran from 3.4c to 83.4c per litre (FIASA table). One grade cannot stand in for the other. Euro-5-class trucks need 50ppm. |
| Prices are published for **Gauteng** (inland reference) and **Coast**. They differ across **54 Magisterial District Zones** because of transport tariffs ([CEF press release, 27 Mar 2026](https://cefgroup.co.za/wp-content/uploads/2026/03/Press-Release-27-March-26-Change-01-April-2026.pdf); [MDZ zone list](https://www.dmre.gov.za/Portals/0/Energy_Website/files/esources/petroleum/July%202011/MDZ%20zones%2010052011.pdf)) | "Inland" is not one price. Gauteng is the cheapest inland zone. Polokwane, Upington and other remote zones are higher. |
| Adjustments take effect on the **first Wednesday** of the month at 00:01. They are announced a few days earlier by the DMPR (formerly DMRE), and the CEF releases them on the department's behalf. The MDZ schedules are published the day before the change ([CEF release, 27 Mar 2026: "to be effected on Wednesday 01 April 2026"](https://cefgroup.co.za/wp-content/uploads/2026/03/Press-Release-27-March-26-Change-01-April-2026.pdf); [gov.za: schedule "published June 2"](https://www.gov.za/news/media-statements/mineral-and-petroleum-resources-announces-adjustment-fuel-prices-effective-0)) | 2026 effective dates were 1 Jan, 4 Feb, 4 Mar, 1 Apr, 6 May, 3 Jun, 1 Jul, 5 Aug, 2 Sep and 7 Oct (FIASA column headers). A price "month" runs from Wednesday to Wednesday, not from the 1st. |
| The price includes the **slate levy**, which is applied when the slate is more than R500m negative. It was 157.74 c/l in June 2026 and 0 in April. Temporary **fuel-levy relief** in 2026 (R3/L off from 1 Apr to 5 May, then 93c) caused step changes ([CEF release](https://cefgroup.co.za/wp-content/uploads/2026/03/Press-Release-27-March-26-Change-01-April-2026.pdf); [gov.za June](https://www.gov.za/news/media-statements/mineral-and-petroleum-resources-announces-adjustment-fuel-prices-effective-0)) | Monthly moves of 5–30% are normal in 2026. Gauteng 500ppm went from R18.54 in March to R25.91 in April to R31.18 in May. The ">5% alert" fires almost every month. |
| **Official figures get corrected.** On 4 May 2026 the DMPR announced +R6.19/L, based on a levy cut captured as 0.93c instead of 93c. It corrected this to +R5.27/L on 5 May, one day before the change took effect ([Daily Maverick](https://www.dailymaverick.co.za/article/2026-05-05-department-of-mineral-and-petroleum-resources-reduces-diesel-price-hike-after-significant-miscalculation/)) | The pipeline must allow a price to be revised before it takes effect, and must keep version history. |
| The CEF publishes the **daily Basic Fuel Price and the running over/under-recovery** ([CEF daily BFP](https://cefgroup.co.za/daily-basic-fuel-price/); [CEF monthly releases](https://cefgroup.co.za/monthly-press-release/)). Media turn this into forecasts: October 2026 is projected at about R31.7/L for 500ppm wholesale ([AutoTrader](https://www.autotrader.co.za/cars/news-and-advice/automotive-news/updated-october-fuel-price-south-africa-2026/17719); [Joburg ETC](https://www.joburgetc.com/motoring/petrol-diesel-record-highs-october-cef/)) | A quote valid for 30 days that crosses a first Wednesday can show a **forecast next-month basis** (flagged as a forecast), not only today's price. |

**What is an accurate reference for a fleet quoting a load?** Use the **50ppm wholesale list price for the fleet's home-depot MDZ** (Gauteng or Coast as the minimum), as in force at the planned loading date. Then apply the fleet's own adjustment:
- For fleets with fuel cards or bulk supply: a negotiated discount below wholesale.
- For forecourt buyers: a retail margin above wholesale.

The best option is the fleet's own trailing fuel-card cost per litre.

**Data sources**

| Source | Type | Cost | Machine-readable | Role |
|---|---|---|---|---|
| CEF monthly press release (PDF, issued on behalf of the DMPR) | Official c/l **changes**, Gauteng and Coast, both grades, dates | Free | PDF text is extractable (`pdftotext -layout` works cleanly) | **Authority for the change and the effective date** |
| DMPR / gov.za media statement | Official statement, same content | Free | HTML | Authority, human confirmation |
| DMPR MDZ price schedules ([dmpr.gov.za Fuel Prices](https://www.dmpr.gov.za/Branches/Petroleum-Resources/Fuel-Prices)) | Absolute prices per zone | Free | PDF/XLS, unreliable site | Zone prices (phase 3) |
| FIASA current & past table | **Absolute** Gauteng/Coast prices, both grades, dated columns | Free | HTML table | **Primary absolute feed and history backfill** |
| CEF daily BFP / slate | Daily over/under-recovery | Free | Web | Forecast for the next month |
| AA SA | Announcements | Free | The old URL is dead (confirmed in code comments) | Cross-check only |
| Fuel-card providers (WesBank Fleet, FNB Fleet, Standard Bank Fleet) and telematics fuel-card integrations ([Cartrack](https://www.cartrack.co.za/blog/fleet-fuel-card-integration-empower-your-fleet-with-efficiency-and-security); [WesBank Fleet Solutions](https://www.fleetsolutions.co.za/site/login); [FNB Fleet](https://www.fnb.co.za/business-banking/fleetAutoServices/index.html)) | Actual litres × price per transaction | Paid, per fleet | Exports or partner APIs | **Per-fleet actual cost** |
| Bulk supplier contracts | Delivered price, usually a discount off wholesale list | Per fleet | Manual | Per-fleet actual cost |
| globalpetrolprices.com | Third-party aggregate | Free or paid | Scraped | **Do not use for pricing** |

---

## 2. Current pipeline map

### Writers (to the `fuel_prices` table, `date` is unique)

| # | Writer | Trigger | Source and parse | Date stored | Can overwrite? |
|---|---|---|---|---|---|
| W1 | `fetch_fuel_prices()` `core/services/fuel_price.py:303` | Celery beat `refresh-fuel-price` daily 06:00 SAST (`config/settings.py:467`) → `core/tasks.py:463`, always `force_update=True` | FIASA table (`:191`) → AA / SAPIA / DMRE regex (`:113`, all dead) → `_FALLBACK_PRICES` (`:38`) | `date.today().replace(day=1)` (`:321-323`), not the effective Wednesday | Yes, every run, whatever the existing row's source (`:395-400`) |
| W2 | Same function, lazily | Any **read** path below. It writes when the current month's row is missing or is a fallback (hourly retry gate `:332-337`) | Same | 1st of month | Yes |
| W3 | `GET /api/v1/fuel-prices/current/?force=true` `core/views_ai_quote.py:70` | Any **authenticated** user (not staff-only) | Same, `force_update=True` | 1st of month | Yes |
| W4 | `POST /api/v1/fuel-prices/current/` `core/views_ai_quote.py:130-153` | Staff "admin override" | Typed value. Coastal defaults to the inland value | 1st of month, `source='MANUAL'`. `fetched_at` is not updated on an update | Overwritten by W1 at the next 06:00 run (D3b) |
| W5 | `fetch_fuel_price_daily` command → `fuel_price_live.fetch_and_store_daily_price` (`fuel_price_live.py:165`) | Only manual/cron. Not in beat. `HANDOVER.md:170` tells ops to run it | Regex guesses (known issue). `time.sleep(300)` ×2 on failure | **Today's date** | Yes |
| W6 | `fetch_fuel_prices --backfill [--force]` | Manual | **Live FIASA first**, then the table (see F3) | Each historical 1st | With `--force`, every row |
| W7 | Django admin `FuelPriceAdmin` `core/admin.py:160` | Staff | Free edit, no audit | Any | Yes |
| W8 | `seed_test_data` | Manual | Random 22–25 | — | — |

### Readers (what each consumer uses)

| Reader | Value used | Zone/grade awareness | Staleness/provenance surfaced? |
|---|---|---|---|
| **QuoteBuilder (live quote UI)**: `truckwyas-frontend/src/pages/QuoteBuilder.tsx:362,552,675,1509,1560` | `Company.fuel_price_per_litre`, else **21.7** | Label only (" · inland/coastal") | No date and no source. Shows "Diesel price R23.50/L inland" |
| Settings "Fetch live prices" `CompanySettings.tsx:60-92` | `/fuel-prices/current/` by zone → written into `fuel_price_per_litre` **only if still exactly 23.50** or the user forces it | Yes (zone) | A "Live national price" hint appears in Settings only |
| Route calc `POST /route/calculate/` `core/views.py:3398-3419, 3584` | `fetch_fuel_prices().diesel_inland` (known issue: 21.7 path) | **Always inland**, even for `fuel_zone=COASTAL` | Response contains **no** diesel price, source or date. `fuel_cost_zar` on each route card uses it |
| Quote create snapshot `core/views.py:2679-2687` | `fetch_fuel_prices().diesel_inland` → `Quote.fuel_price_at_creation` | Always inland | No source or date stored |
| Copilot quote create `core/services/copilot_entities.py:170` | Imports `current_fuel_price`, **which does not exist**. The ImportError is swallowed | — | Copilot quotes never get a snapshot |
| Quote analysis `core/services/quote_analysis.py:194-210` | Inland reference vs the client-sent `fuel_price_used` | Inland only | "Stale" once `today − 1st > 7` days |
| Surcharge check / fuel-alert `views_ai_quote.py:1196-1300` | Current inland vs `fuel_price_at_creation` (known issue: 20.0 fabrication) | Inland | — |
| Margin calculator `margin_calculator.py:162-175` | Newest row by `date` (known issue: provenance-blind) | Inland | — |
| Vehicle/driver scoring `core/tasks.py:75-81` | `settings.FUEL_PRICE_ZAR = 22.50` constant | — | — |
| Finance trip cost `views_finance.py:628`, intelligence `intelligence.py:130,356` | `Company.fuel_price_per_litre` (else 23.50) | — | — |
| Risk engine `risk_engine.py:155` | Constant 24.0 | — | — |
| ML features `quote_outcome_capture.py:190`, `retrain_quote_model.py:108` | Snapshot, else **20.0** | — | — |
| `fuel_price_live.get_current_price()` / `_last_known_zone_gap()` | Newest row by `date` | — | — |

**What a quote actually uses today:**
- The quote's fuel line comes from the company's static default (R23.50 in dev).
- The route cards next to it show fuel cost at the FIASA 500ppm Gauteng price (R29.11). The same screen therefore shows two different diesel prices.
- The saved quote stores `fuel_surcharge` computed at R23.50 and `fuel_price_at_creation = 29.1111`.
- Neither value records its source, grade, zone or effective date.

**Dev-DB state (read-only SELECT):** three rows.

| Date | Price (inland) | Source | Note |
|---|---|---|---|
| 2026-06-01 | 21.18 | FALLBACK_LATEST | Real Gauteng 500ppm was **27.93** |
| 2026-07-01 | 24.50 | FALLBACK | Real 24.79 |
| 2026-09-01 | 29.1111 | FIASA | — |

- **August is missing.**
- Past-month fallback rows are never corrected: the retry path only touches the current month.
- 17 quotes have a 24.50 snapshot and 5 have 21.18. Those five would show a **+37% "fuel rose" surcharge** against today's price, all of it an artefact.
- `GET /fuel-prices/current/` returns `is_stale:false` and `last_checked_at 2026-09-24`, four days without a check. That points to beat not running in dev, and nothing reported it.

---

## 3. Findings (ranked)

Impact figures assume a typical load: JHB→CPT, about 1,400 km at about 40 L/100 km, so **about 560 L**.

| # | Sev | Finding | Evidence | Commercial impact | Recommended change | Effort |
|---|---|---|---|---|---|---|
| F1 | **Critical** | **Quotes are priced from a static per-company number, not live diesel.** `fuel_price_per_litre` defaults to 23.50, has no date, and the "live" nudge only overwrites it if it is still exactly 23.50. A fleet that typed R24 in March is still on R24. Builds on the known "route calc ignores fp.source" issue: the route calc price does not even reach the quote line. | `QuoteBuilder.tsx:362,552`; `CompanySettings.tsx:80-81`; `company.py:48`; dev: every company 23.5000 | Sep 2026: R29.11 − R23.50 = **R5.61/L under → about R3,140 under-quoted per load**. The error grows silently every month. | One server-side resolver, `resolve_fuel_basis(company, vehicle_type, load_date)`. It returns price, grade, zone, source, effective date and adjustment. Both the route calc and the quote UI use it. The company field becomes an *adjustment* (fuel-card discount or premium, or a fixed contract price with an expiry date), not a frozen absolute. | M |
| F2 | **Critical** | **A good row is overwritten by the fallback when one scrape fails.** The nightly task always passes `force_update=True`. When FIASA times out it falls through to the table and `setattr`s over the existing FIASA or MANUAL row. The current endpoint then returns nulls, and the route calc and snapshot use the table value. | `fuel_price.py:346-377, 395-400`; `tasks.py:471`. **Demo D3:** 29.1111 FIASA → **24.5000 FALLBACK_LATEST** after one timeout | −R4.61/L → **about R2,580 under per load** until a later run succeeds. Up to 18h+ with the retry cadence. | Never downgrade: a fallback or lower-trust source must not replace a higher-trust row. Better: append-only versions (target design). | S |
| F3 | **Critical** | **Any `target_date` gets *today's* live price.** `fetch_fuel_prices(target_date=X)` calls FIASA, which always returns the newest column, and stores it under X. `--backfill --force` would stamp September's price on all 31 historical months. It is also the root cause of the 3 failing tests (§4). | `fuel_price.py:346`; `fetch_fuel_prices.py:54-58`. **Demo D2:** `target_date=2024-03-01` → **29.1111 FIASA** | Corrupts history, the ML features, and every "price at quote time" comparison | Parse the FIASA column headers and select the column whose effective date ≤ target. Store one row per effective date. | S |
| F4 | **High** | **Wrong grade: stores 500ppm (0.05%), labelled as 50ppm retail.** The FIASA page has both rows. The code matches `'diesel 0.05%'`, which never matches `'diesel 0.005%'`. | `fuel_price.py:176`; `fuel_price.py` model help text `models/fuel_price.py:11,15`; **Demo D1**: inland 29.1111 while 50ppm is 29.5551 | 44c/L in Sep (**about R250 per load**). **83c/L in Jun (about R470 per load)**. Always under-priced for modern trucks. | Store both grades. Add `Company.diesel_grade` (default 50ppm). Fix the help text: *wholesale list*, not retail. | S |
| F5 | **High** | **Effective-dating is wrong.** Rows are keyed to the 1st, but prices change on the first Wednesday at 00:01 SAST. The FIASA column header, which is the effective date, is thrown away. The parser takes "the last non-empty cell". So: (a) from the 1st until FIASA updates, the new month's row holds the old price (1–6 Oct 2026 carries September's price under "2026-10-01"); (b) if FIASA fills the next column early, the current month's row is overwritten **before** the price takes effect; (c) the refresh at 06:00 misses the 00:01 change by 6h, and by days if FIASA posts late. | `fuel_price.py:156-171, 321-323`; `tasks.py:461`. **Demo D4:** simulated early October column → **September row becomes 32.87** on 30 Sep | In a R3–R7/L swing month, every quote in that window is off by the full swing (R1,700–R3,900 per load). Snapshots taken in the window are also wrong. | Add `effective_from` (Wednesday) and `effective_to`. Parse headers. Capture "announced" prices as `status=scheduled`, which becomes active at 00:01 SAST on `effective_from`. | M |
| F6 | **High** | **The fallback table is not real data.** 2026 values are off by −R6.83 to +R5.63/L (Jan +4.68, Feb +5.63, Mar +5.26, Apr −1.81, May −6.83, Jun −3.73, Jul −0.29). Builds on the known "table ends 2026-07" issue: even inside its range it is wrong. The 2024–2025 rows also do not match the FIASA history (Jan-2025: table 20.44 vs FIASA 19.29). | `fuel_price.py:38-70`. **Demo D9** against FIASA Gauteng 0.05% | Any fallback event misprices by up to about R3,800 per load, and it is labelled "FALLBACK", not "wrong" | Delete the table. Backfill real history once from the FIASA 2025/2026 tables and CEF PDFs into the ledger. The fallback becomes "last *confirmed* price, flagged stale", never an invented one. | S |
| F7 | **High** | **The manual admin override lasts less than 24h.** POST writes `source='MANUAL'` for the month, and the next 06:00 run overwrites it with FIASA or the fallback. `fetched_at` is not updated, so the UI's "last checked" is wrong. Coastal silently equals inland if omitted. No audit trail of who changed it. | `views_ai_quote.py:142-152`; **Demo D3b:** MANUAL 29.90 → **29.1111 FIASA** next run | The one human safety valve does not hold, so it cannot be used to fix things during an incident or a correction like May's. | Human-confirmed rows get the highest trust and are never overwritten by automation, only superseded by a new confirmed version. Require both zones and grades. Record the user and the reason. | S |
| F8 | **High** | **Snapshot ≠ the basis the quote used.** `fuel_price_at_creation` = national inland reference, but the quote used the company price. No source, grade, zone or date is kept. Copilot quotes get no snapshot at all: `current_fuel_price` does not exist and the ImportError is swallowed. | `views.py:2679-2687`; `copilot_entities.py:169-174`; dev: 5 quotes snapshotted at 21.18 (fallback) | Surcharge and fuel-alert advice are computed against the wrong baseline. The five 21.18 quotes would trigger a spurious +37% surcharge recommendation. The ML trains on the reference, not the cost actually quoted. | A `QuoteFuelBasis` snapshot (see target design) written from the same resolver the UI used. The surcharge compares like with like (same grade, zone and fleet adjustment). | M |
| F9 | **High** | **Coastal fleets priced on inland everywhere except Settings.** The route calc and snapshot ignore `Company.fuel_zone`. The analyzer compares the coastal price used against *inland* "live". | `views.py:3401`; `quote_analysis.py:196,205` | +R0.87/L on route cards for coastal fleets (about R490 per load). Every coastal quote gets a false "price used is lower than live — fuel cost may be off" (3% > 2% threshold). | The resolver takes zone from the company or depot. All comparisons use the same zone and grade. | S |
| F10 | **Medium** | **Retry fan-out.** `raise self.retry()` sits inside `try:`. The `Retry` exception is caught by `except Exception`, logged with a traceback as "unexpected error", and `self.retry(exc=exc)` is called again. | `tasks.py:467-487`. **Demo D8b:** one failed run → **2 retry messages** | Up to 2+4+8 = 14 runs over 18h. Each is a forced overwrite (amplifies F2) and a burst of scrapes that can get the source to block us. Log noise hides real errors. | `except Retry: raise` before the generic handler, or use `autoretry_for`. Keep one retry chain. | S |
| F11 | **Medium** | **No freshness alerting. Staleness is defined four different ways.** Task health only checks "ran within 36h". A run that stored an old column, a fallback or a 500ppm figure counts as success. Staleness rules: >35 days since the 1st (current view), >7 days since the 1st (analysis, so a false "stale" every month from the 9th), `is_stale` column (written only by W5 and never read), `fetched_at` never shown. | `task_run.py:31`; `views_ai_quote.py:73-76`; `quote_analysis.py:198-201`; `fuel_price_live.py:135-162` | Nobody is told when the price is wrong. Users learn to ignore the stale badges. | One definition: stale if (a) there is no confirmed version for the price window in force now, or (b) a first Wednesday has passed without a new version, or (c) the last successful source check is more than 26h old. Page ops by email or Slack. Tie "success" to that definition. | S |
| F12 | **Medium** | **Brittle FIASA parser; wrong results pass silently.** (a) Inland and coastal are identified by DOM id, not by the "Gauteng"/"Coastal" heading, so reordered tabs swap them (**D6:** inland 28.24, coastal 29.11). (b) A reformatted newest cell ("2 911,11", footnote) is skipped and the **previous month's** price returned (**D5:** 26.1721). (c) At the year rollover (Jan 2027 table) the new table may be empty or re-numbered. (d) There are no sanity checks: inland > coastal, 50ppm vs 500ppm gap, plausible band, change vs announced delta. | `fuel_price.py:156-233` | Wrong numbers stored as `FIASA` with full trust | Anchor on heading text and column dates. Reject on any sanity failure and alert rather than store. Reconcile against the CEF release's announced c/l change: the absolute price must equal the previous price plus the delta, to the cent. | M |
| F13 | **Medium** | **Two competing "current" prices from dual schemas.** W5 rows (dated today) beat monthly rows in `order_by('-date')` readers (margin calculator, `_last_known_zone_gap`, `get_current_price`), while `fetch_fuel_prices` reads the 1st-of-month row. Builds on the known regex-scraper issue: even when correct, it forks the source of truth. | **Demo D7:** margin calculator → **22.50** (regex row) while quotes see **29.1111** | Margin analysis and quoting disagree by R6.61/L | Delete W5 and `fuel_price_live.py` (and the `HANDOVER.md:170` instruction). One ledger, one reader. | S |
| F14 | **Low** | Any authenticated user can force a live scrape and DB write (`?force=true`). A synchronous 8s scrape runs on request paths (route calc, quote create) when the month row is missing. `date.today()` uses host time (UTC on Railway) around the midnight month boundary. | `views_ai_quote.py:69-70`; `fuel_price.py:322, 346` | Latency spikes, source throttling, small boundary errors | Reads never scrape: only the scheduled job writes. Force is staff-only and queues a job. Use `timezone.localdate()` in SAST. | S |
| F15 | **Low** | Four more hardcoded diesel constants: 22.50 (`settings.FUEL_PRICE_ZAR`, vehicle and driver scoring), 23.50 (finance trip cost), 24.0 (risk engine), 20.0 (ML retrain default) | `tasks.py:75-81`; `views_finance.py:628`; `risk_engine.py:155`; `retrain_quote_model.py:108` | Scoring and margin KPIs drift from reality | All go through the resolver (reference or fleet actual) | S |

---

## 4. Test health

**Why 3 tests fail on main** (`manage.py test core.tests.test_fuel_price`: 16 run, 3 fail, all with `29.1111 != expected`):

- Commit `4b398c4` put `_fetch_from_fiasa()` first in the chain (`fuel_price.py:346`).
- The tests only patch `_fetch_from_aa_sa`, `_fetch_from_sapia` and `_fetch_from_dmre`. `test_creates_new_record_from_fallback` patches nothing.
- So the tests make **real HTTP requests to fuelsindustry.org.za**, and FIASA returns today's price for whatever `target_date` they ask for.

The failures are a real bug (F3) showing through a leaky test, not just a stale fixture. The tests also depend on the network and are non-deterministic: offline they would pass, which hides F3.

**Fix:**
- Patch HTTP at the `requests.get` boundary in every test. Use recorded FIASA HTML fixtures, for example the snapshot saved here.
- Assert `target_date` semantics: a historical date must never take the newest column.

**Coverage that does not exist:**
- FIASA parser against real fixtures: both grades, heading-based zone detection, empty trailing columns, reformatted cells, a year-rollover page.
- The "never downgrade" rule (F2) and preservation of MANUAL overrides (F7).
- Effective-date transitions: Tuesday 23:59 vs Wednesday 00:01 SAST; the 1st through the first Wednesday.
- `refresh_fuel_price` retry behaviour (F10) and a TaskRunLog failure state on fallback.
- `FuelPriceCurrentView` GET/POST: fallback nulling, staff gate, both zones required.
- Route calc zone selection. The quote snapshot contents. The Copilot snapshot (it would have caught the missing `current_fuel_price` import).
- The surcharge baseline comparing like with like.
- A frontend and backend contract test that the quote's fuel line and the route card use the same basis.

---

## 5. Target design

### 5.1 Data model

```
FuelPriceVersion            (append-only; replaces FuelPrice as source of truth)
  id
  effective_from      timestamptz   -- first-Wednesday 00:01 Africa/Johannesburg
  effective_to        timestamptz null  -- set when the next version activates
  zone                enum  GAUTENG | COASTAL | MDZ:<code> (phase 3)
  grade               enum  D50PPM | D500PPM | P95 | P93
  price_basis         enum  WHOLESALE_LIST | RETAIL_REGULATED
  cents_per_litre     int/decimal(10,2)   -- store in c/l exactly as published
  announced_delta_cpl decimal null        -- from CEF release, for reconciliation
  source              enum  CEF_RELEASE | DMPR_STATEMENT | FIASA | MANUAL
  source_url, source_document_hash, fetched_at
  status              enum  SCHEDULED | ACTIVE | SUPERSEDED | REJECTED
  confidence          enum  CONFIRMED (human) | CORROBORATED (2 sources agree) | SINGLE_SOURCE
  confirmed_by, confirmed_at, supersedes_id, note
  UNIQUE(zone, grade, effective_from, supersedes_id)

FleetFuelCost               (per company)
  company, mode enum  REFERENCE_PLUS_ADJ | FIXED_CONTRACT | TRAILING_ACTUAL
  adjustment_cpl (± vs reference, e.g. -45 fuel card discount / +150 forecourt)
  fixed_cpl + valid_until (bulk contract)
  zone, grade (default D50PPM)
  trailing actual computed from FuelTransaction (card import / receipts / Cartrack fuel events)

FuelTransaction             (phase 3) company, vehicle, datetime, litres, amount, site, source(card/receipt/telematics)
```

The existing `FuelPrice` table becomes a read-only compatibility view, or is migrated.

### 5.2 Ingestion and precedence

- **Scheduled jobs (SAST):**
  - Daily 06:00 **and** 00:05 on first-Wednesday dates, to flip SCHEDULED to ACTIVE.
  - Hourly from the last Thursday of the month until the effective Wednesday, watching for the CEF release and corrections.
- **Authority order:**
  1. CONFIRMED (human)
  2. CEF release / DMPR statement
  3. FIASA
  4. Nothing, never a synthetic value
- **CORROBORATED** means the FIASA absolute price equals the previous ACTIVE price plus the CEF `announced_delta` to the cent. Otherwise the version is stored as SINGLE_SOURCE and ops are alerted.
- **Corrections** (like May 2026): a new version with `supersedes_id`. Quotes already snapshotted keep their version id.
- **Never overwrite, never downgrade.** A failed scrape writes nothing and only raises an alert.
- **Human monthly confirmation:**
  - When the CEF release lands (typically Thu–Mon before the change), an admin task is created with the parsed figures side by side with FIASA.
  - One click confirms. Entering a figure by hand requires both grades, both zones and a note.
  - If the release is not confirmed by Tuesday 18:00 before the change, page ops.
- **Admin override** is itself a CONFIRMED version with an effective timestamp. It stays until it is superseded.

### 5.3 Freshness and alerting

A single function, `fuel_reference_health()`, reports **RED** if any of these hold:

- There is no ACTIVE version covering *now* for (GAUTENG, D50PPM) or (COASTAL, D50PPM).
- It is past the first Wednesday 00:05 and still on last month's version.
- The last successful source check is more than 26h old.
- The active version is SINGLE_SOURCE for more than 24h.

Where RED shows up:

- It feeds Job Health.
- It emails or Slacks ops.
- It sets `basis.stale=true` in every quote response.
- `refresh_fuel_price` returns failure when the health is RED, so TaskRunLog stops reporting green.

### 5.4 Resolving and snapshotting a quote's fuel basis

`resolve_fuel_basis(company, vehicle_type, load_date)` is the only function any quote path may call. It works as follows:

1. Pick the reference version active at `load_date`, or now if the load date is unknown.
2. If `load_date` falls after the next first Wednesday and a SCHEDULED version exists, use it. Otherwise use the active version plus an optional CEF forecast, flagged `forecast=true`.
3. Apply the `FleetFuelCost` mode.
4. Return:
   `{price_cpl, reference_cpl, reference_version_id, grade, zone, basis: REFERENCE|CONTRACT|ACTUAL, adjustment_cpl, effective_from, confidence, stale, forecast}`

On quote save, `QuoteFuelBasis` (a 1:1 with Quote) stores that object, plus litres and fuel line ZAR. `fuel_price_at_creation` is populated from `price_cpl` for backward compatibility.

**Surcharge and fuel-alert** compare `reference_cpl(now, same zone/grade) − reference_cpl(snapshot)`, then scale the quote's fuel line. They never compare across grade, zone or fleet adjustment. With no confirmed reference, they return "cannot assess", never 20.0.

**Display** (quote builder, PDF, customer view):

> Diesel R29.56/L — 50ppm wholesale, Gauteng, effective 2 Sep 2026 (DMPR/CEF, confirmed) · your fuel-card rate −R0.45 → R29.11/L

- An amber state shows "Next adjustment 7 Oct: +R2.5/L forecast" when validity crosses a first Wednesday.
- A red state shows "Reference unconfirmed / stale since …" and blocks "Send" unless the user overrides with a reason.
- The customer PDF prints the fuel basis and effective date, which is the contractual anchor for a fuel-escalation clause.

---

## 6. Phased plan

| Phase | Scope | Fixes | Effort |
|---|---|---|---|
| **0 — Stop the bleeding (1–2 days)** | Never-downgrade guard. Stop forcing overwrites of CONFIRMED/MANUAL rows. Fix the retry double-schedule. Choose the FIASA column by effective-date header and store the **50ppm** row (keep 500ppm too). Remove `fuel_price_live` / W5 and the HANDOVER instruction. Fix the Copilot import. Staff-gate `?force`. Mock HTTP in tests and add FIASA fixtures. One-off *reviewed* correction of the dev/prod June (21.18→27.93), July (24.50→24.79) and missing August rows from the FIASA history. | F2, F3, F4 (partial), F7, F10, F13, F14, the 3 failing tests | S |
| **1 — Ledger and effective dating (about 1 week)** | `FuelPriceVersion` model with SCHEDULED/ACTIVE at 00:01 SAST. CEF PDF parser plus FIASA reconciliation. Admin confirm workflow. `fuel_reference_health()` with alerts. Delete `_FALLBACK_PRICES`. Backfill 2024–2026 from FIASA/CEF. | F5, F6, F11, F12 | M |
| **2 — One resolver, honest quotes (about 1 week, backend and frontend)** | `resolve_fuel_basis` used by route calc, QuoteBuilder, analysis, margin calculator, scoring and finance. `FleetFuelCost` (reference + adjustment / fixed contract with expiry). `QuoteFuelBasis` snapshot. Surcharge on like-for-like basis. UI basis line, stale/forecast states, PDF basis. Company "fuel price" becomes "fuel-card adjustment". | F1, F8, F9, F15, known issues (route calc 21.7, margin provenance, surcharge 20.0) | M |
| **3 — Actual cost** | Fuel-card CSV/API import (WesBank/FNB/Standard Bank fleet), receipt capture, Cartrack fuel events → `FuelTransaction`. Trailing 30/90-day actual cents per litre per fleet with quote-vs-actual variance reporting. Optional MDZ zone schedules per depot. CEF daily over/under-recovery → next-month forecast. | Accuracy beyond the reference | L |

---

## Demonstrations (all mocked, test DB only)

| ID | What | Result |
|---|---|---|
| D1 | Parse the saved FIASA page | inland 29.1111, coastal 28.2391 = **Diesel 0.05% (500ppm)**. 50ppm Gauteng on the same page = 29.5551 |
| D2 | `fetch_fuel_prices(target_date=2024-03-01)` with FIASA up | Stored **2024-03-01 = 29.1111, source FIASA** |
| D3 | Good FIASA row, then one FIASA timeout on the nightly forced refresh | Row becomes **24.5000 FALLBACK_LATEST** (−R4.61) |
| D3b | MANUAL 29.90 row, then the nightly refresh | Becomes **29.1111 FIASA** |
| D4 | FIASA fills the 7-Oct column early; refresh on 30 Sep | **September row becomes 32.8720** |
| D5 | Newest cell reformatted to "2 911,11" | Parser returns **26.1721 (August)**, stored as current |
| D6 | tab-1 and tab-2 swapped | inland 28.2391 / coastal 29.1111 (swapped silently) |
| D7 | `fetch_and_store_daily_price` (regex) next to a FIASA monthly row | Margin calculator uses **22.50**, quote path uses **29.1111** |
| D8b | `refresh_fuel_price.run()` with live sources down, worker mode | **2 retry messages** scheduled for one failure |
| D9 | `_FALLBACK_PRICES` 2026 vs FIASA Gauteng 0.05% | Errors +4.68, +5.63, +5.26, −1.81, −6.83, −3.73, −0.29 R/L |

The existing suite, `manage.py test core.tests.test_fuel_price`, runs 16 tests with 3 failures, all `29.1111 != expected`, because live FIASA is not mocked.

---

## Sources

- FIASA — current and past fuel prices (2025/2026 tables, dated columns, "Wholesale List Price for Diesel"): https://fuelsindustry.org.za/consumer-information/fuel-prices-current-past/
- FIASA — how fuel prices are set: https://fuelsindustry.org.za/consumer-information/how-fuel-prices-are-set/
- CEF press release for 1 April 2026 (Gauteng/Coast deltas for both diesel grades, MDZ note, slate levy, levy relief, adjustment mechanism): https://cefgroup.co.za/wp-content/uploads/2026/03/Press-Release-27-March-26-Change-01-April-2026.pdf
- CEF monthly press releases: https://cefgroup.co.za/monthly-press-release/ · CEF daily BFP: https://cefgroup.co.za/daily-basic-fuel-price/
- gov.za — DMPR adjustment effective 3 June 2026 (500ppm vs 50ppm deltas, slate levy 157.74 c/l, MDZ schedules published 2 June): https://www.gov.za/news/media-statements/mineral-and-petroleum-resources-announces-adjustment-fuel-prices-effective-0
- gov.za — adjustment effective 1 July 2026: https://www.gov.za/news/media-statements/minister-gwede-mantashe-announces-adjustment-fuel-prices-effective-1-july
- Daily Maverick — May 2026 diesel miscalculation corrected the day before it took effect: https://www.dailymaverick.co.za/article/2026-05-05-department-of-mineral-and-petroleum-resources-reduces-diesel-price-hike-after-significant-miscalculation/
- DMPR — fuel prices / price structure: https://www.dmpr.gov.za/Branches/Petroleum-Resources/Fuel-Prices · https://www.dmpr.gov.za/Services/Petroleum-Resources/Fuel-Price-Structure
- DMRE Magisterial District Zone list: https://www.dmre.gov.za/Portals/0/Energy_Website/files/esources/petroleum/July%202011/MDZ%20zones%2010052011.pdf
- October 2026 outlook (CEF-based projections): https://www.autotrader.co.za/cars/news-and-advice/automotive-news/updated-october-fuel-price-south-africa-2026/17719 · https://www.joburgetc.com/motoring/petrol-diesel-record-highs-october-cef/
- Fuel-card / fleet data: https://www.cartrack.co.za/blog/fleet-fuel-card-integration-empower-your-fleet-with-efficiency-and-security · https://www.fleetsolutions.co.za/site/login · https://www.fnb.co.za/business-banking/fleetAutoServices/index.html
