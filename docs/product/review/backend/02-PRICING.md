# 02 · Quote pricing engine: accuracy review

**Scope:** truckwys-backend `main @ 45039ee` plus the live quote page in truckwyas-frontend (`src/pages/QuoteBuilder.tsx`, routed at `/bookings/quotes/new` by `App.tsx:271-272`). I included the frontend because **the recommended price is put together in the browser, not the backend**: the backend supplies distance, tolls and cross-border fees, and QuoteBuilder adds the rest.
**Method:** read-only. I read the code, ran SELECTs and pure functions on synthetic polylines in `manage.py shell`, ran the existing test modules (these use a separate test DB), and did web research. Nothing in either repo was changed. `git status --porcelain` is empty.
**Not re-reported:** the known issues in `docs/audit/BACKEND-AUDIT-2026-09-23.md` §4 (#32–#42). Where a finding builds on one of them, it says which.
**Scratch evidence:** `worked_routes.py/.out` (tolls and cross-border), `quote_math.py/.out` (quote totals), `tolls2026.txt` (the 2026 tariff table), `gg54229.txt` (the 2026 C-BRTA fee gazette), all in this folder.

---

## Verdict

**A 60-truck fleet owner would not trust these quotes against their own spreadsheet, and they would be right not to.**

Two parts of the engine are now genuinely good:

- **SANRAL mainline tolls.** All 31 seeded plazas match the 1 March 2026 tariffs exactly, in all 4 classes. The point-to-polyline matcher charges the right plazas on N3, N1 and N4 test routes.
- **Cross-border fee plumbing.** It uses per-corridor fees, permits spread over the fleet's own crossing count, and measured km per country.

Everything else is not a costing model. The price is:

> opaque "base rate" in R/km × km + fuel + tolls + a manual driver allowance (default R0)

A few things follow from that:

- **The base rate carries no cost.** The one number that should hold driver, finance, insurance, maintenance, tyres, overheads, empty running and profit has no breakdown and no source. Its defaults are hardcoded, from R8.50 to R35 per km, and depending on which default applies they either price roughly 40–50% above a sourced reference cost or below cost.
- **Fuel is priced from a stale setting, not the live price.** Fuel is costed at the company's stored `fuel_price_per_litre`. That is still the R23.50 default for every company in the dev DB, against a live wholesale price of R29.11. Separately, the fuel snapshot that feeds fuel alerts records a different number from the one actually used.
- **Four different definitions of "cost" and "margin".** The quote screen, Revenue Guard, the AI optimiser and the lane-margin report each use their own. When cost is above the market, the optimiser recommends a 45% markup at a 2% win probability.
- **Tolls are VAT-inclusive inside a VAT-exclusive price.** The customer is then charged VAT on VAT.
- **Quotes cannot be re-priced.** The inputs are not snapshotted and there is no tariff versioning, so a quote cannot be reproduced later.

The fix is not a patch. It needs a server-side, fleet-configured, time-plus-distance cost model (spec in §5) with the price formed on top of it and every input snapshotted.

---

## 1. Findings (ranked)

Severity: **C** critical · **H** high · **M** medium · **L** low. Effort: **S** ≤2 days · **M** ≤1–2 weeks · **L** larger. Rand impacts marked *est.* are estimates, with their assumptions stated.

### C1 · There is no cost model. The price is an unsourced R/km "base rate" plus fuel and tolls. Effort L

**Evidence.**

- The live formula is in `QuoteBuilder.tsx:586-587`:
  ```ts
  const baseCost = Math.round(chargeDistance * Number(baseRatePerKm));
  const total = baseCost + fuelCost + tollCost + crossBorderCost + driverAllowance + serviceCharge;
  ```
- Where `baseRatePerKm` comes from:
  - `VehicleType.base_rate`, hardcoded in migration `0109_consolidate_vehicle_type_defaults.py:23-97`: LDV R8.50, Box R15, Rigid R18, Tautliner R24, Semi R30, Interlink R35 per km. No source is cited anywhere.
  - Or `Company.default_base_rate_per_km`, default R10.00 (`core/models/company.py:66-69`), used when no vehicle type is picked. Picking a type is optional (`QuoteBuilder.tsx:535-540`).
- **Driver:** `driver_allowance` is a free-text input that defaults to "0" (`QuoteBuilder.tsx:296,559`). No wage, subsistence or night-out cost is derived from the TomTom duration the backend already returns (`views.py:3553`).
- **Not priced anywhere:** finance or depreciation, insurance, licensing, tracking, overheads, empty return for one-way loads, loading and offloading time, waiting or detention, multi-drop time, and GIT or cargo insurance. All of it is assumed to sit inside the base rate.
- **Missing from QuoteBuilder:** a weight surcharge. The legacy `NewQuote.tsx` had one (15% of fuel above 5 t), but that page is no longer routed.
- **Parallel "true cost" model:** `core/services/margin_calculator.py:28-49` has a separate one with its own hardcoded constants:

  | Constant | Value |
  |---|---|
  | Fuel economy | 2.8 km/L |
  | Driver | R3.50/km |
  | Tyres | R0.45/km |
  | Maintenance | R0.65/km |
  | Deadhead factor | ×1.3 |
  | Fallback diesel | R21.18 |

  It is used only by the lane-margin report (`services/reports.py:53-57`). It is never used for quoting, is always called with `'articulated'`, and never includes tolls.

**Worked impact** (§2, `quote_math.out`, interlink carrying 30 t, reference = sourced cost + 15% margin):

| Lane | Engine (VT default R35/km, R23.50 diesel) | Reference price | Gap |
|---|---|---|---|
| JHB→DBN | R27,073 | R19,853 | **+36%** |
| JHB→CPT | R64,614 | R44,438 | **+45%** |
| PTA→Maputo | R29,739 | R27,529 | +8% |

- **No vehicle type picked (company R10/km):** JHB→DBN comes to R12,873 against a reference *cost* of R16,875, which is **≈R4,000 below cost**. JHB→CPT is **≈R8,100 below cost** (*est.*).
- **Cross-check:** the reference JHB→CPT price of R44,438 sits next to the platform's own market estimate for that lane, R43,800 (`lane_benchmark.py:338`).

**Recommendation.** Replace the base rate with the cost model in §5. Keep "base R/km" only as an explicit, labelled *rate-card* override.

### C2 · Fuel is priced at a stale company setting, not the live price, and the snapshot records a different number. Effort S

**Evidence.**

- QuoteBuilder deliberately prices fuel from `companyProfile.fuel_price_per_litre`, not from the live feed (`QuoteBuilder.tsx:358-362`, with a comment saying so).
- That field defaults to **R23.50** (`company.py:48-51`). **All 13 companies in the dev DB are still on R23.50** and all are `INLAND`.
- The current price is **R29.11/L** inland wholesale (50 ppm), effective 2 Sep 2026. It is the latest `FuelPrice` row in the dev DB (FIASA, 2026-09-01) and is confirmed by public reporting ([NOW in SA](https://nowinsa.co.za/2026/september-fuel-price-petrol-diesel-increase/), [Kweli diesel trend](https://www.kweli.co.za/blog/diesel-price-south-africa-trend/)). That puts the stored price **19% low**.
- `QuoteViewSet.perform_create` snapshots the **live inland** price into `fuel_price_at_creation` (`views.py:2679-2687`), not the R23.50 that was actually used. Fuel-delta alerts therefore compare live against live and can never see this gap.
- **How this differs from known #33:** #33 is about a stale feed. Here the feed is fresh and simply not used.

**Impact.**

- **Per load (interlink, 30 t, 44.3 L/100 km):**
  - JHB→DBN: −R1,413
  - JHB→CPT: −R3,477
  - PTA→Maputo: −R1,456
- **Fleet level (*est.*):** 60 trucks × 11,000 km/month × 0.443 L/km × R5.61/L ≈ **R1.64 M a month of fuel cost not recovered**, if the fleet never updates the setting.

**Recommendation.**

- Price fuel from a server-side "fleet diesel price" that resolves in this order: depot or bulk price if set, else fuel-card price if set, else the live gazetted price for the zone.
- Show where the price came from and how old it is (building on #33).
- Refuse to quote, or show a warning, when the company price is more than 5% below the gazetted price.
- Snapshot the price that was actually used.

### C3 · Four contradictory cost/margin definitions, and a broken market anchor, make the AI recommendation untrustworthy. Effort M

**Evidence.**

| Surface | "Cost" used | Result |
|---|---|---|
| Quote tiles | `directCost = total - serviceCharge`, which includes the base rate (`QuoteBuilder.tsx:593`) | `marginPct = serviceCharge/total` (:594). It is **0% unless the AI markup was applied**; 7 of 25 dev quotes have `margin_percentage=0`. |
| Revenue Guard | `guardTrueCost = fuel + toll + crossBorder + driver` (:604) | JHB→DBN: cost R7,193 against a price of R27,073, so a 73% "margin" and always **SAFE**, because driver, finance, insurance and maintenance are all ignored. |
| Analyze / optimiser | `cost_basis = direct_cost`, including the base rate (and the profit inside it), plus a 5–45% markup on top (`quote_analysis.py:444`, `margin_optimizer.py`) | Double margin. |
| Lane-margin report | `margin_calculator` (×1.3 deadhead, R3.50/km driver, zero tolls, "articulated") (`reports.py:53`) | JHB→DBN true cost R11,074, i.e. **"59.8% margin"** on the same R27,561 quote. |

- **Optimiser with cost above market:** `optimize_price(total_cost=27561, market_rate=17000, …)` returns **R39,963 (45% markup) at a 2% win probability** with `constraints_relaxed=True`. The live screen shows that as "the AI-recommended price" (`QuoteBuilder.tsx:793-795`).
- **Wrong market for interlinks:** `lookup_sa_estimate` keys on `(o,d,vt)`, then `'truck'`, then `'interlink'` (`lane_benchmark.py:374`). The real type name `"Interlink (34 tonnes)"` never equals `'interlink'`, so interlinks are benchmarked against the **rigid-truck R15,000** figure, not the interlink R17,000.
- **Market averages ignore context:** platform and company benchmarks average `total_amount` per 3-letter lane code, whatever the trip type, distance, pickup suburb or vehicle size (`lane_benchmark.py:65-87, 431-452`). A round-trip total and a one-way total land in the same median.
- **Stale estimate table:** `SA_MARKET_ESTIMATES` (`:337-343`) covers 5 lanes, is undated, and predates diesel's 49.7% year-on-year rise.
- **Hardcoded multipliers** are scattered across `views_ai_quote.py:217,228,230-231,270-271` (×1.25, ×1.18, ×1.05, ×1.45, ×0.90, ×1.10) and `quote_analysis.py:40` (R19.80 fallback cost per km), `:274,292,519` (×1.25, ×1.15).

**Recommendation.**

- One server-side `CostBreakdown` (§5) used by the quote, the guard, the optimiser and the reports.
- One margin definition: margin on price, excl. VAT.
- Optimiser: when cost is at or above market, return "below-cost market: floor = cost/(1-min_margin)" and a flag, never the top of the band.
- Market benchmarks: normalise to R/km or R/tonne-km by vehicle class and one-way equivalent. Match vehicle classes on a class field, not a name.

### H1 · Tolls: tariffs are correct, but 5 mainline and about 34 ramp plazas are missing. Effort S (data)

**Evidence.**

- The 2026 table (SANRAL poster, [NRA PDF](https://www.nra.co.za/uploads/17/SANRAL%20Toll%20Tariff%202026%20A3%20Poster%20v2.pdf); full table [Foresight 2026](https://www.foresightpublications.co.za/TollFees2026.pdf); [IOL](https://iol.co.za/motoring/industry-news/2026-03-11-heres-how-much-youll-pay-in-toll-fees-on-south-africas-major-routes-after-sanrals-2026-increase/)) matches all 31 seeded rows exactly, classes 1–4.
- **Missing mainline plazas:**
  - Bakwena N4 West: **Swartruggens R368, Marikana R96, Brits R90** (class 4)
  - N4 Magaliesberg: **Pelindaba R27, Quagga R21**
- **Missing ramp plazas** (class 4 in brackets):

  | Road | Ramp plazas |
  |---|---|
  | N1 North | Sebetiela (77), Nyl ramp (69), Kranskop ramp (81), Maubane (112), Hammanskraal (150), Murrayhill (52), Wallmansthal (26), Zambesi (53), Stormvoël (44) |
  | N1 South | Grasmere S/N (63 each) |
  | N3TC | Tugela East (211), Bergville (100), Treverton (97), Mooi S (227) and N (97) |
  | N4 West | Kroondal (64), Buffelspoort (64), K99 (70) |
  | N4 East (TRAC) | Donkerhoek (66), Cullinan (86), Valtaki (183), Ekandustria (130) |
  | N2 North | Mtunzini S (172) and N (45), Dokodweni (84), Mandini (31), Othongathi S/N (31), King Shaka (34) |
  | N2 South | Umtentweni (69), Oribi S (73) and N (100), Izotsha (54) |
  | N2 Tsitsikamma | ramp (619) |
  | N17 | Gosforth W (33) and E (42), Denne (46), Leandra ramp (152) |

- **Mislabelled row:** Doornpoort is seeded as `N4 "Pretoria → Maputo" km 10`. It is actually a Bakwena N4 West / Platinum plaza. The tariff is right; the metadata is wrong.
- `ROUTE_CHOICES` lists N14, which has no toll plazas. That is harmless.

**Impact.** PTA/JHB→Gaborone (via Skilpadshek) at class 4: the published mainline total is R624 and the engine charges only Doornpoort's R70, so it **under-charges by R554 per leg**. Rustenburg platinum lanes miss R186 per leg. Loads that start or end near a ramp miss R26–R227 each.

**Recommendation.** Seed every plaza from the 2026 table, with **direction** (ramp plazas are often one-way) and **plaza type** (mainline or ramp).

### H2 · The vehicle-to-SANRAL-class mapping uses name keywords and the wrong class definitions. Effort M

**Evidence.**

- **SANRAL's classes** (2026 table): Class 2 = 2-axle heavy; **Class 3 = 3 & 4-axle heavy**; **Class 4 = more than 4 axles**.
- **The code's classes** (`toll_calculator.py:30-44`, `toll_plaza.py:13-16`): Class 3 = "3-axle single unit"; Class 4 = "4+/combination".
- The class is picked from words in the vehicle name (`toll_calculator.py:47-79`), and `VehicleType` has **no axle count field**.
- **Results** (`worked_routes.out`):
  - `"Rigid Truck"`, which its own description calls a *2-axle* rigid, maps to Class 3: **+R280 on JHB→DBN**.
  - Any rigid body named Flatbed, Tautliner, Reefer or Tanker maps to Class 4. An 8 t 2-axle rigid flatbed pays R1,274 instead of R632 on the N3: **+R642**.
  - A 4-axle combination (4×2 horse + tandem) is really Class 3, but the engine prices it as Class 4.
- **Inconsistent defaults:** when no type is picked, the backend defaults the route call to `"Flatbed"`, which is Class 4 (`QuoteBuilder.tsx:617`). Fuel, meanwhile, is estimated from the *lightest capable* type. So one quote mixes rigid fuel with interlink tolls.

**Recommendation.** Add `axles_total` to `VehicleType`/`Vehicle`. Derive the SANRAL class from axles (≤2 → 2, 3–4 → 3, ≥5 → 4). Fall back to name keywords only with a warning.

### H3 · When TomTom fails, tolls silently become R0 but are still labelled "geofence". Effort S (extends #34, different cause)

**Evidence.**

- On a TomTom failure, the estimated route is set to haversine × 1.3 with a **2-point straight-line geometry** (`views.py:3380-3395`).
- `_toll_for_route` sees non-empty geometry and runs the geofence over that straight chord (`:3480-3485`). The keyword fallback is never reached.
- The response still says `toll_source: 'geofence'` (`:3552`).
- In the worked examples the straight chord gives **R0 on all three routes**, against R1,115 / R1,274 / R1,719.

**Recommendation.** For `source == 'estimated'`, use `calculate_tolls` (corridor keywords) or refuse to price. Set `toll_source: 'estimated'` and add a warning.

### H4 · VAT-inclusive tolls are passed through a VAT-exclusive price, so the customer pays VAT twice. Effort S

**Evidence.**

- SANRAL tariffs include VAT (`seed_toll_data.py:33`).
- The quote is presented as **"Excl. VAT"** (`ClientQuoteView.tsx:338-350`), and invoices add 15% on the subtotal (`views_finance.py:297`).
- A VAT-registered carrier reclaims the input VAT on tolls, so its toll *cost* is tariff ÷ 1.15.
- Diesel is zero-rated (VAT Act s11(1)(h)), so there is correctly no VAT adjustment for fuel.
- The quote itself has no VAT field and no VAT logic.

**Impact.** JHB→DBN: the toll line is R166 too high, and the customer then pays R191 VAT on R1,274 of tolls that already contain VAT. Fleet level *est.* (60 trucks, ~R1.20/km average tolls): about R100k/month over-quoted, which makes the fleet **less competitive** rather than more profitable.

**Recommendation.** Store tariffs excl. VAT, or divide by 1.15 when costing. Add `vat_rate`, `subtotal_excl_vat`, `vat_amount` and `total_incl_vat` to `Quote`, with a snapshotted rate, and handle zero-rated exports: international transport of goods is zero-rated under s11(2)(a).

### H5 · Toll tariffs have no versioning and no annual update path. Effort M

**Evidence.**

- Migration `0070_seed_toll_plazas.py` imports `_PLAZA_DATA` *from the management command* and uses `get_or_create`. That has two consequences:
  - Existing rows are **never updated**.
  - The migration's result changes whenever the command is edited.
- `tariff_year` is displayed in admin but never read by pricing, and there is no `effective_from`/`effective_to`.
- The March 2027 increase (announced around February; +3.12% in 2026) will need a hand-run `seed_toll_data --force` on every environment.
- Old quotes cannot be re-priced at the tariffs in force when they were issued.
- **Current state is correct:** tariffs are 2026/27 in the dev DB.

**Recommendation.** Add a `TollTariff(plaza, sanral_class, amount_excl_vat, amount_incl_vat, effective_from, source_url)` table. Load each year from a versioned data file through a new migration. Price by `pickup_date`. Monitor for "no tariff effective on date X".

### H6 · Quotes cannot be reproduced: inputs are not snapshotted and totals are not validated. Effort M

**Evidence.**

- `Quote` stores only rand components (`quote.py:78-85`) plus `fuel_price_at_creation`, which is the wrong price (C2).
- **Not stored:**
  - L/100 km used, diesel price used and where it came from
  - toll plazas, class and tariff year
  - base R/km and where it came from
  - market rate and its source
  - FX rates
  - C-BRTA crossings per year
  - TomTom route id and departure time
- The serializer accepts the client's `total_amount` without checking it (`serializers.py:403-426`). **5 of 25 dev quotes** have `total_amount` different from the sum of components by more than R1.
- **Semantic clash on `base_rate`:** copilot-created quotes set `base_rate = total` (`copilot_entities.py:122-128`), while QuoteBuilder uses km × R/km. On reload, `base_rate/distance` then gives a nonsense R/km (`QuoteBuilder.tsx:884-888`).

**Recommendation.** Add a `pricing_snapshot` JSON (schema-versioned) holding every input and intermediate. Recompute and validate the total server-side, rejecting anything over R1 out.

### M1 · Fuel consumption: 5 divergent tables, poor load scaling, and fleet actuals ignored. Effort M

**Evidence.** Five tables disagree:

| Location | Units | Values |
|---|---|---|
| `views.py:3304-3315` | L/km | 0.30–0.40 (fallback 0.35) |
| `margin_calculator.py:28,35-45` | km/L | 2.4–4.5 |
| migration 0109 | L/100 km | 10–48 |
| `QuoteBuilder.tsx:35-37` | L/100 km | 28–38 (default 32) |
| `NewQuote.tsx:29-37` | L/100 km | 25–42 (default 36) |

- **Load scaling** is exponential around rated capacity: `ref × 1.02^(load_t − capacity_t)` (`QuoteBuilder.tsx:485-490`). An empty interlink extrapolates to **24.5 L/100 km**, and 10 t to 29.8. Empty 7-axle interlinks typically burn about 30–35 L/100 km (*est.*).
- **Round trips drive the return leg at laden burn:** `legs = 2` multiplies everything (`:550-558`). *Est.* over-charge when the return is empty: 568 × (44.3 − 33)/100 × R29.11 ≈ **R1,870** on a JHB↔DBN round trip.
- **One-way loads carry no repositioning cost at all.**
- **Fleet actuals are ignored:** `Vehicle.fuel_consumption_l_per_100km`, `Vehicle.cost_per_km` (from real fuel and maintenance, `tasks.py:237-274`) and Cartrack telemetry all exist and are not used.
- **Terrain is ignored:** `_infer_terrain` (`views.py:3826`) detects the N3 escarpment, Karoo and so on, but the result never affects cost.

**Recommendation.** One server-side consumption function per vehicle: fleet actual (rolling 90 days) first, then the type default. Make it linear in gross combination mass (`L/100 = a + b·GCM`), with separate laden and empty legs and an optional terrain factor.

### M2 · Route-calc fuel looks up `VehicleType` across all tenants and disagrees with the quote. Effort S

**Evidence.**

- `VehicleTypeModel.objects.filter(name=vehicle_type).first()` (`views.py:3413`) has **no company scope**. There are no duplicate names in dev today, but any tenant creating a same-named type can change another tenant's route fuel.
- Route calc uses live inland diesel, while the builder uses the company price. Two different fuel figures exist per route.

**Recommendation.** Scope with `visible_vehicle_types_queryset(company)`, as `views.py:3509` already does. Remove the route-calc fuel figure or make it the single source.

### M3 · TomTom truck routing gets the wrong weight and no dimensions or hazmat. Effort S

**Evidence.**

- `vehicleWeight` is sent the **cargo** weight (`views.py:3335` → `_route` params). TomTom expects the vehicle's total weight, e.g. 56,000 kg for an interlink.
- Axle count, length, height and `vehicleLoadType` are never sent, so **"Danger Load" loads can be routed through the Huguenot tunnel**. Dangerous goods must use Du Toitskloof. *Verify* against the tunnel's operator rules.
- Changing the weight does not trigger a re-route (the dependency list at `QuoteBuilder.tsx:651-657` has no weight).

**Recommendation.** Send GCM = tare + load, `vehicleAxleWeight`, `vehicleNumberOfAxles`, `vehicleLength` and `vehicleLoadType` (from the cargo class), plus `vehicleCommercial=true`.

### M4 · Diesel zone and purchase channel are not modelled. Effort S–M

**Evidence.**

- `fuel_zone` (`company.py:34-47`) only chooses which gazetted price the Settings "fetch" button writes. Pricing never picks coastal or inland by route or depot. A Durban-based fleet refuelling at the port pays about R0.87/L less than inland: R29.11 vs R28.24 in the dev DB.
- The gazetted figure is the **wholesale** list price. Fleets buying at the pump pay a retail margin on top (*est.* R1–2.50/L). Fleets with bulk depots often pay below wholesale (*est.* 20–60 c/L).
- None of this is configurable.

**Recommendation.** Company fuel profile: channel (bulk, card or pump), discount or premium in c/L against the gazetted price, and zone by refuelling point.

### M5 · Cross-border: permit class by payload, stale Class 1 fee, 5-year permits ignored, FX frozen. Effort M

**Evidence** (building on the verified 0110–0121 values).

- **Permit class by payload.** The C-BRTA class is decided by the vehicle's **GVM** (Class 1 ≤ 20,000 kg, [C-BRTA permits](https://www.cbrta.co.za/permits)). The code bands on payload capacity or load weight (`cross_border.py:66-73, 369-371`). A 14 t-payload 6×4 rigid (GVM about 26 t) is therefore priced as Class 1.
- **Stale Class 1 fee.** The 2026 gazette ([GG 54229](https://www.gov.za/sites/default/files/gcis_document/202603/54229gem3807.pdf)) gives Class 1 at R823 application + R6,160 = **R6,983/yr**. The code still has R6,767 from 2025 (`cross_border.py:66`). Class 2 at R9,041 = R823 + R8,218 is correct.
- **5-year permits ignored.** The same gazette offers 5-year permits: Class 2 at R11,497 plus R1,962/yr compliance, about R4,000/yr all-in (*est.*). Large fleets use these. Amortising the 12-month R9,041 over-charges about **R210 per crossing** at 24 crossings/yr.
- **FX frozen in rand constants.**
  - Zimbabwe: $221 at R16.04 (`BorderCrossingFee` row 1 notes); Botswana P975; Namibia N$ (at par); Mozambique MZN.
  - There is no FX table and no quote-date rate. Each R1 move in USD/ZAR shifts the Beitbridge fee by R221.
- **CountryTransitRate is empty in dev.** The table has **0 rows**, so the `filter().update()` data migrations 0112–0118 did nothing there and the hardcoded fallbacks are the real source. Check whether production has rows.
- **Leftover cents on corridor fees:** 1173.29, 650.29, 450.29, 4463.29 against the published P975, M650, E450, N$4,463. They look like leftovers from subtracting the old R376.71 permit.
- **Mozambique flat toll** (R598.78) is Class 4 for every vehicle class. The Moamba plaza alone was 1,800 MZN for class 4 in 2023 ([Club of Mozambique](https://clubofmozambique.com/news/mozambique-toll-fees-go-up-in-the-moamba-toll-plaza-on-n4-maputo-province/)); the 2026 TRAC Mozambique tariff is unverified.
- **Not modelled:**
  - border dwell time (Beitbridge is often 1–3 days of truck and driver time)
  - clearing agents on corridors other than Zimbabwe
  - transit bonds, COMESA yellow card, GIT
- ZINARA per-km rates (R0.90/km) and the multi-hop fees (ZW-ZM R900, and so on) are still unverified estimates, as the code itself admits.

**Recommendation.**

- Add `gvm_kg` on vehicle types and use it for C-BRTA banding.
- `CbrtaFee(effective_from, class, duration, amount)` rows, plus a company setting for permit type (12-month or 5-year).
- `FxRate(date, ccy)` with fees stored in the *native* currency.
- Border dwell hours per corridor, charged at the time rate in §5.

### M6 · Seeded plaza coordinates are unverified and sit on a hard 300 m cliff. Effort S

**Evidence.**

- The seed says coordinates are *"best-estimate… ±500 m"* (`seed_toll_data.py:39-41`), and `radius_meters` defaults to 500.
- But `TOLL_MATCH_BUFFER_M = 300` caps it (`toll_calculator.py:367`).
- In the worked runs, shifting the polylines 310 m dropped Mariannhill (N3 → R1,217) and all four N4 plazas (→ R0). At 400 m, JHB→CPT fell to R401.
- I could not verify against OSM: Overpass returned 406/504.

**Recommendation.** Verify each plaza against OSM `barrier=toll_booth` or TomTom `TOLL` sections. Store both carriageway gantry points. Add a regression test per plaza using a recorded TomTom polyline. Reconcile with TomTom toll sections (#34).

### M7 · The pricing path is barely tested and the suite is red. Effort S–M

**Evidence.**

- **Zero** tests for `RouteCalculatorView`, `calculate_tolls_by_geometry`, `resolve_toll_truck_type` or `country_distances_km`, the functions that actually price live quotes.
- `test_toll_calculator.py` exercises only the legacy keyword path, with fictional 2024 tariffs ("Van Reenen" is not a plaza, `:27,33`).
- **13 of its 30 tests error** with `UNIQUE constraint failed: toll_plazas.name, toll_plazas.route`: migration 0070 now seeds the same names.
- **3 fuel tests fail** (`test_fuel_price.py:100` etc. get 29.1111), because a new FIASA source is not patched.
- Pricing modules overall: **166 tests, 16 red.**
- The frontend has **no tests at all**, and the frontend is where the price is formed.

**Recommendation.** See §4 (critical cases to add).

### L1 · Rounding and number handling. Effort S

- QuoteBuilder rounds each component to whole rands in JS floats before summing (`:552-587`), so the total differs from the sum of the unrounded parts by up to about R2.
- `marginPct` is an integer.
- The backend uses floats (#40).
- The spec needs Decimal end to end, one rounding step at the end, and a defined rounding rule (e.g. to R10 for the customer-facing total).

### L2 · Multi-drop, waiting and detention are not priced. Effort S

- Stops change the route geometry (tolls and distance are right), but there is no per-drop fee, dwell time or detention rate.

---

## 2. Worked route examples

### Setup

- **Tolls:** synthetic polylines through the seeded plaza coordinates, densified to 0.5 km, run through the real `calculate_tolls_by_geometry` against the dev DB (read-only). Full output: `worked_routes.out`.
- **Quote totals:** QuoteBuilder's formula replicated in Python (`quote_math.py`) for an **Interlink (34 tonnes)** carrying 30 t, which gives 44.34 L/100 km from `48 × 1.02^(30−34)`, and the R35/km base.
- **Distances** are typical road km (TomTom not called): JHB–DBN 568, JHB–CPT 1,398, PTA–Maputo 585.

**Reference model inputs** (illustrative only; from a secondary 2026 guide, [Kweli](https://www.kweli.co.za/blog/how-to-calculate-freight-rates-south-africa/), since the [RFA Vehicle Cost Index](https://rfa.co.za/SA/vehicle-cost-schedule/) is members-only):

| Input | Value |
|---|---|
| Fixed cost | R65,950/month (finance 35k, insurance 12k, driver 18k, tracker, licence), spread over 22 days |
| Tyres | R0.90/km |
| Maintenance | R2.00/km |
| Overhead | R0.42/km |
| Empty repositioning | 30% at 33 L/100 km |
| Allowances | R450 per trip-day |
| Tolls | excl. VAT |
| Margin | 15% on price |

### A. JHB → DBN (N3), class 4

| Plaza | Engine (2026 seed) | Published 2026 |
|---|---|---|
| De Hoek | 230 | 230 |
| Wilge | 304 | 304 |
| Tugela | 359 | 359 |
| Mooi | 324 | 324 |
| Mariannhill | 57 | 57 |
| **Total** | **R1,274** | **R1,274** (N3TC mainline 1,217 + Mariannhill 57) ✔ |

- **Other classes:** heavy/Class 3 R912 · medium/Class 2 R632 · light R347.50, all ✔ against the table.
- **"Rigid Truck" (2-axle):** charged R912, should be R632 (H2).
- **Offset sensitivity:** unchanged at ≤290 m; loses Mariannhill at 310 m; R893 at 600 m.
- **TomTom-down path** (2-point line): **R0** (H3).

| Quote | Base | Fuel | Tolls | Total | R/km |
|---|---|---|---|---|---|
| Engine @ R23.50 (co. default) | 19,880 | 5,919 | 1,274 | **27,073** | 47.66 |
| Engine @ R29.11 (live) | 19,880 | 7,332 | 1,274 | 28,486 | 50.15 |
| Reference (cost 16,875) | — | 8,969 | 1,108 exVAT | **19,853** | 34.95 |
| Platform market estimate, interlink / what the engine actually uses | | | | 17,000 / **15,000 ("truck")** | |

The AI optimiser on cost R27,561 against market R17,000 recommends **R39,963 at 2% win probability**.

### B. JHB → CPT (N1), class 4

| Plaza | Engine | Published 2026 |
|---|---|---|
| Grasmere | 126 | 126 |
| Vaal | 275 | 275 |
| Verkeerdevlei | 331 | 331 |
| Huguenot | 383 | 383 |
| **Total** | **R1,115** | **R1,115** ✔ ([IOL](https://iol.co.za/motoring/industry-news/2026-03-11-heres-how-much-youll-pay-in-toll-fees-on-south-africas-major-routes-after-sanrals-2026-increase/)) |

- **Class 3:** R775 · **Class 2:** R562 ✔
- **Offset sensitivity:** 400 m leaves R401 (2 plazas).
- **Hazmat caveat:** a dangerous-goods load should avoid the Huguenot tunnel. It would then take Du Toitskloof (−R383 toll, +km and time), and the engine cannot model that (M3).

| Quote | Base | Fuel | Tolls | Total | R/km |
|---|---|---|---|---|---|
| Engine @ R23.50 | 48,930 | 14,569 | 1,115 | **64,614** | 46.22 |
| Engine @ R29.11 | 48,930 | 18,046 | 1,115 | 68,091 | 48.71 |
| Reference (cost 37,773) | — | 22,075 | 970 exVAT | **44,438** | 31.79 |
| Platform estimate (interlink) | | | | 43,800 | |

### C. PTA → Maputo (N4 + Lebombo), class 4, interlink (34 t capacity), 24 crossings/yr

| Item | Engine | Reference / published |
|---|---|---|
| Diamond Hill / Middelburg / Machado / Nkomazi | 220 / 365 / 729 / 405 = **R1,719** | R1,719 TRAC mainline total ✔ |
| Donkerhoek / Cullinan / Valtaki / Ekandustria ramps | not seeded | 66 / 86 / 183 / 130 (only if the route uses them) |
| SA→MZ corridor fee | 473.29 | SORCA amortised + inspection (migration notes) |
| C-BRTA Class 2 permit, amortised | 376.71 (R9,041 ÷ 24) | 12-month ✔; 5-year option ≈ R4,000/yr → ~R167/crossing |
| MZ tolls (flat) | 598.78 | Moamba alone 1,800 MZN (2023); 2026 unverified |
| **Cross-border total** | **R1,448.78** (R1,117.27 at 200 crossings/yr) | |
| 8 t rigid instead | R1,354.03, labelled "priced for an interlink" and Class 1 permit at the stale R6,767 | should be Class 1 R6,983, *if* GVM ≤ 20 t |

| Quote | Base | Fuel | Tolls + xb | Total | R/km |
|---|---|---|---|---|---|
| Engine @ R23.50 | 20,475 | 6,096 | 3,168 | **29,739** | 50.84 |
| Reference (cost 23,400; 2 days of fixed time incl. border dwell) | — | 9,237 | 1,495 exVAT + 1,449 | **27,529** | 47.06 |

The cross-border margin closes because the engine prices border dwell at zero while its inflated base rate happens to cover it. **The price is right for the wrong reason.**

---

## 3. Every hardcoded pricing number

| Value | Where | Used by |
|---|---|---|
| L/km 0.30–0.40 (Flatbed .32 … Tanker .40), fallback 0.35 | `core/views.py:3304,3308-3315` | route-calc fuel |
| R0.95/km toll fallback (constant unused in the view) | `views.py:3305`; FE `QuoteBuilder.tsx:553` | no-route toll |
| diesel R21.70 fallback | `views.py:3406,3408`; FE `QuoteBuilder.tsx:362` | fuel |
| haversine × **1.3**, 80 km/h | `views.py:3382-3383` | TomTom down |
| weight default 20,000 kg | `views.py:3335`; FE `:617` | routing, border band |
| 2.8 km/L, **R3.50/km driver**, R0.45 tyres, R0.65 maint, **×1.3 deadhead**, R21.18 diesel | `margin_calculator.py:28-32,49` | lane-margin report |
| km/L per type 2.4–4.5 | `margin_calculator.py:35-45` | report |
| base_rate R8.50–R35/km, L/100 10–48, sensitivity 2–3%/t | `migrations/0109…:23-97` | **quote price** |
| company base **R10/km**, diesel **R23.50**, toll R0.50/km, margin thresholds 5/12/10%, optimiser 5% / 15% win | `core/models/company.py:48-51,66-69,94-120,125-128` | quote, guard, AI |
| FE fuel fallbacks 28–38 L/100 (default 32) | `QuoteBuilder.tsx:35-37,485` | quote |
| AI fallback price = cost × 1.25 | `QuoteBuilder.tsx:794` | quote |
| ×1.25 market, ×1.18 anchor, ×1.05/×1.45 band, ±10% LLM clamp | `views_ai_quote.py:217,228,230-231,270-271` | suggest |
| fleet CPK fallback R19.80; ×1.25; ×1.15 fallbacks | `quote_analysis.py:40,274,292,519` | guard, analyze |
| market band 0.75–1.35, min/max margin 5%/45% | `margin_optimizer.py:34-35,143-144` | optimiser |
| 5 lane estimates (JHB-CPT 43.8k / 38.9k, JHB-DBN 17k / 15k, CPT-DBN 52k) | `lane_benchmark.py:337-343` | market anchor |
| C-BRTA R6,767 (stale) / R9,041, 20,000 kg, 24 crossings | `cross_border.py:66-69` | cross-border |
| border / weighbridge / transit fallbacks; ZW $→R16.04 | `cross_border.py:95-160`; `BorderCrossingFee` rows | cross-border |
| 300 m match buffer (500 m documented) | `toll_calculator.py:367`; `toll_plaza.py:63-66` | tolls |

---

## 4. Test coverage of the pricing path

**Covered today:**

- `test_margin_calculator` (21), `test_price_analysis` (47), `test_lane_benchmark` (24), `test_cross_border_permit` (28): all green.
- The legacy keyword toll path, with 13 of 30 erroring.
- `test_fuel_price`, with 3 of 16 failing.

**Critical cases not tested (add these first):**

1. **`calculate_tolls_by_geometry` golden routes.** Recorded TomTom polylines for JHB→DBN, JHB→CPT and PTA→Maputo, asserting the plaza list and 2026 totals per class. Plus parallel-road negatives (N1/N4 Pumulani vs Doornpoort, 2.1 km apart).
2. **`resolve_toll_truck_type`** for every `VehicleType` default: Rigid Truck must be Class 2.
3. **`RouteCalculatorView` with TomTom mocked:**
   - success
   - failure, which must not give R0 labelled as geofence
   - stops
   - cross-border blocked
   - company-scoped vehicle type
4. **Server-side quote total == sum of components**, with the snapshot persisted.
5. **Fuel price resolution:** company price vs live feed vs zone, and the snapshot equalling the price used.
6. **Optimiser with cost ≥ market:** must never return the ceiling at a win probability below 15%.
7. **Market benchmark** normalises one-way vs round trip, and matches interlinks against interlinks.
8. **VAT:** toll cost excl. VAT; quote totals excl./incl.
9. **Tariff effective-date selection** across 1 March.
10. **Fix the fixture collision** (use unique names or clear the seeded rows in `setUp`) and patch the FIASA source.

---

## 5. Target cost model (spec)

**Principle:** one server-side `price_quote(inputs) -> PricingResult`, fully in Decimal, deterministic for a given `pricing_snapshot`, and used by QuoteBuilder, copilot, the guard, the optimiser and the reports alike.

**Inputs, snapshotted:**

- Route: TomTom route id, departure time, per-leg km and hours, stops, country km, TOLL sections.
- Vehicle: class, axles, GVM/GCM, tare, capacity.
- Load: mass, cargo class (hazmat), trip type, return plan (loaded or empty, with km).
- Company cost profile (versioned).
- Fuel price record, toll tariff records, FX records, market benchmark (value, n, source).

**Cost blocks (all excl. VAT):**

| Block | Formula | Source (priority order) |
|---|---|---|
| Fuel, laden | km_laden × (a + b·GCM_laden)/100 × diesel_price | vehicle 90-day actual L/100, then type default. Diesel: depot/bulk, then card discount, then gazetted zone price |
| Fuel, empty / repositioning | km_empty × (a + b·tare)/100 × diesel_price | one-way: `company.empty_running_pct` × km, or an explicit return leg |
| Tolls | Σ plaza tariff[class(axles), effective(pickup_date)] ÷ (1+VAT) | TollTariff table (all plazas, ramps, direction) reconciled with TomTom TOLL sections |
| Time-based fixed cost | (trip_hours + load/offload + border dwell + waiting) ÷ productive_hours_per_month × monthly_fixed | monthly_fixed = finance/depreciation + insurance (vehicle + GIT) + licence + tracking + driver salary & benefits (CTC) |
| Distance-based variable | km_total × (tyres + maintenance + oil/AdBlue) | fleet actuals (expenses per km, 12 months), then RFA-style defaults |
| Driver trip costs | nights_out × subsistence + meal allowance | company schedule (bargaining-council rates) |
| Overheads | % of cost or R/km | company |
| Cross-border | corridor fees (native ccy × FX on quote date) + C-BRTA (GVM class, permit type, crossings/yr) + foreign tolls + agent + bond/insurance + dwell hours (in time cost) | versioned rows |
| Accessorials | per-drop fee, detention R/h after free time, weight/abnormal surcharges, hazmat premium | company rate card |

**Price formation:**

1. `cost_total = Σ blocks`
2. `floor = cost_total / (1 − min_margin)`
3. `target = cost_total / (1 − target_margin)`
4. The market anchor (normalised R/km by class and one-way equivalent, with n and provenance) only *adjusts* between floor and a ceiling. It never goes below the floor without an explicit override and reason.
5. Round the customer total once (e.g. up to R10).
6. `vat = total × vat_rate` (0 for zero-rated international legs).
7. **Margin is always margin on price, excl. VAT**, the same everywhere.

**Outputs:** the line items above, price excl./incl. VAT, margin R and %, a warnings list (stale fuel, estimated route, unpriced toll sections, unverified cross-border rows, fallback consumption), and a `pricing_snapshot` (schema version plus all inputs and source ids).

---

## 6. Phased plan

**Phase 0: stop the bleeding (≈1 week, all S)**

1. Fuel: default QuoteBuilder to the live gazetted zone price unless the company has set a fuel-card or bulk price. Add a stale-setting warning. Snapshot the price actually used (C2).
2. Estimated route: use keyword tolls plus `toll_source: 'estimated'` and a warning (H3).
3. Tolls ÷ 1.15 in costing, and state VAT explicitly on the quote (H4).
4. Optimiser guard for cost ≥ market. Fix the interlink market key (C3, part).
5. Company-scope the route-calc `VehicleType` lookup (M2). Send GCM and hazmat to TomTom (M3).
6. Fix the red tests. Add golden geofence and class-mapping tests (M7).

**Phase 1: data correctness (≈2 weeks)**

7. Seed all 2026 plazas: 5 mainline and ~34 ramps with direction. Fix Doornpoort's metadata. Add a `TollTariff` table with `effective_from`, loaded by a versioned migration from a data file (H1, H5).
8. Add `axles`, `gvm_kg` and `tare_kg` to `VehicleType`/`Vehicle`. Derive the SANRAL class from axles and the C-BRTA class from GVM. Update the Class 1 fee to R6,983 and add the 5-year permit option (H2, M5).
9. Verify plaza coordinates against OSM or TomTom and reconcile with TomTom TOLL sections (M6, #34).
10. FX table plus native-currency border fees; dwell hours per corridor (M5).

**Phase 2: the cost model (≈3–5 weeks, L)**

11. Company cost profile UI and model (fixed monthly per vehicle class, driver CTC and allowances, overhead, empty-running %, fuel channel). Seed from RFA-style defaults, clearly labelled as defaults.
12. A server-side `price_quote()` per §5, used by QuoteBuilder, copilot, guard, optimiser and reports. Remove `margin_calculator`'s hardcoded constants and the frontend formula.
13. `pricing_snapshot`, server-side total validation, and a reprice/diff endpoint (H6).
14. Fleet actuals: vehicle-level L/100 km and R/km from expenses and telemetry, with a confidence score, preferred over defaults once there are enough trips (M1).

**Phase 3: market intelligence (ongoing)**

15. Normalised lane benchmarks (R/km by class, one-way equivalent, pickup date, diesel-indexed), with estimates dated and re-indexed to the diesel price.
16. Monthly fuel-surcharge clauses tied to the snapshotted diesel price (builds on #37).

---

### Sources

- SANRAL 2026 toll tariff poster: https://www.nra.co.za/uploads/17/SANRAL%20Toll%20Tariff%202026%20A3%20Poster%20v2.pdf
- Foresight Publications, Toll Road Tariffs effective 1 March 2026 (full plaza and ramp table, classes 1–4): https://www.foresightpublications.co.za/TollFees2026.pdf
- IOL, 2026 toll fees by route (11 Mar 2026): https://iol.co.za/motoring/industry-news/2026-03-11-heres-how-much-youll-pay-in-toll-fees-on-south-africas-major-routes-after-sanrals-2026-increase/
- Government Gazette 54229, C-BRTA revised fees effective 1 Apr 2026: https://www.gov.za/sites/default/files/gcis_document/202603/54229gem3807.pdf
- C-BRTA permits (class definitions): https://www.cbrta.co.za/permits
- September 2026 diesel price: https://nowinsa.co.za/2026/september-fuel-price-petrol-diesel-increase/ · https://www.kweli.co.za/blog/diesel-price-south-africa-trend/
- Kweli, How to calculate freight rates in SA (2026 guide; secondary source for the reference cost inputs): https://www.kweli.co.za/blog/how-to-calculate-freight-rates-south-africa/
- RFA Vehicle Cost Index: https://rfa.co.za/SA/vehicle-cost-schedule/
- Club of Mozambique, Moamba toll increase: https://clubofmozambique.com/news/mozambique-toll-fees-go-up-in-the-moamba-toll-plaza-on-n4-maputo-province/

**Unverified (flagged in the text):**

- Plaza GPS accuracy (Overpass was unavailable)
- 2026 TRAC Mozambique tariffs
- ZINARA per-km rates and the multi-hop border fees
- Huguenot tunnel dangerous-goods rule wording
- Empty-interlink consumption and retail/bulk diesel spreads (industry estimates)
- Production data: all company, quote and CountryTransitRate observations come from the **dev** DB
