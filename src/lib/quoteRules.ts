// THE quote costing rules (QUOTE-RULES.md §1, §3–7, §10), mirrored from the
// backend's core/services/quote_costing.py::compute(). Pure: no React, no
// fetch, no "@/" imports, so node runs it over the backend's golden vectors
// (scripts/test-quote-golden.mjs) and it must match them to the cent.
//
// Arithmetic contract (JS and Python agree to the cent): IEEE doubles, the
// operations in the order written below, and cents(x) = floor(x*100 + 0.5)/100
// applied ONLY to each line total, the floor, the margin and the target price.
// Litres and burn are never rounded.

import type { QuoteWarning } from "./dieselPrice.ts";

export const VERSION = "qc-1";
const LOADED_BASE = 0.7;
const LOADED_SLOPE = 0.3;
const EMPTY_FACTOR = 0.7;
const OWN_OFF_THRESHOLD = 0.03;
const KG_CAPACITY_THRESHOLD = 100;
const SUSPECT_BURN_MIN = 20.0;
const SUSPECT_BURN_MIN_CAPACITY_T = 8.0;
const SUSPECT_CAPACITY_MAX_T = 40.0;
export const DEFAULT_HOURS_PER_DAY = 9.0;
export const DEFAULT_EMPTY_RETURN_MIN_KM = 300.0;

export const LINE_LABELS: Record<string, string> = {
  fuel: "Fuel",
  operating: "Operating costs",
  tolls: "Tolls",
  driver: "Driver nights out",
  border: "Border fees",
  fuel_return: "Fuel, empty return",
  operating_return: "Operating costs, empty return",
  tolls_return: "Tolls, empty return",
  driver_return: "Driver nights, empty return",
  border_return: "Border fees, empty return",
};

export const ACTION_LABELS: Record<string, string> = {
  use_official: "Use official price",
  update_own: "Update my price",
  retry_diesel: "Try again",
  choose_vehicle: "Choose truck",
  add_vehicle: "Add a truck",
  edit_vehicle: "Check truck",
  enter_tolls: "Enter tolls",
  confirm_no_tolls: "No tolls on this route",
  recalculate_route: "Recalculate route",
  confirm_distance: "Distance is right",
  enter_route: "Add route",
  enter_driver_cost: "Enter driver cost",
  update_allowance: "Set allowance",
  use_minimum: "Use minimum charge",
  reprice: "Re-price",
  keep_price: "Keep price",
  enter_weight: "Enter weight",
  enter_border_costs: "Enter border costs",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------------------------------------------------------------- helpers

/** Half-up to the cent on the double: floor(x * 100 + 0.5) / 100. */
export function cents(x: number): number;
export function cents(x: number | null | undefined): number | null;
export function cents(x: number | null | undefined): number | null {
  if (x === null || x === undefined) return null;
  return Math.floor(x * 100 + 0.5) / 100;
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function pos(v: unknown): number | null {
  const n = num(v);
  return n !== null && n > 0 ? n : null;
}
/** §3: values > 100 are kg. null when unknown or not positive. */
export function capacityTonnes(raw: unknown): number | null {
  const v = pos(raw);
  if (v === null) return null;
  return v > KG_CAPACITY_THRESHOLD ? v / 1000 : v;
}
/** Nights slept away for `hours` of driving (null when unknown). */
export function nightsAway(hours: number | null | undefined, hoursPerDay = DEFAULT_HOURS_PER_DAY): number | null {
  if (hours === null || hours === undefined || hours <= 0) return hours === null || hours === undefined ? null : 0;
  return Math.max(Math.ceil(hours / hoursPerDay) - 1, 0);
}
function parseDt(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  let text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += "T00:00:00Z";
  else if (!/(Z|[+-]\d{2}:?\d{2})$/.test(text)) text += "Z"; // naive = UTC
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}
/** ISO 8601 in SAST with its offset ("2026-10-07T00:01:00+02:00"). */
function iso(value: unknown): string | null {
  const d = parseDt(value);
  if (!d) return null;
  const s = new Date(Math.floor(d.getTime() / 1000) * 1000 + 2 * 3600 * 1000).toISOString();
  return `${s.slice(0, 19)}+02:00`;
}
/** "7 Oct 2026" in SAST (UTC+2). */
export function saDate(value: unknown): string | null {
  const d = parseDt(value);
  if (!d) return null;
  const s = new Date(d.getTime() + 2 * 3600 * 1000);
  return `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
}
/** ROUND_HALF_UP on the shortest decimal form of the double (1,005 → 1,01). */
function halfUp(v: number, dp: number): number {
  return Number(`${Math.round(Number(`${Math.abs(v)}e${dp}`))}e-${dp}`);
}
/** SA style: space thousands, comma decimals ("1 050", "32,80"), half up. */
export function fmtNum(v: number, dp = 0): string {
  const fixed = halfUp(v, dp).toFixed(dp);
  const [int, dec] = fixed.split(".");
  const txt = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (dec ? `,${dec}` : "");
  return (v < 0 && /[1-9]/.test(txt) ? "−" : "") + txt;
}
/** "R 32,80" / "R 1 050" (whole rand half-up when dp = 0). */
/** Offered prices in whole amounts: UP to the next R 50 below R 20 000, else
 *  the next R 100 (never below the price it was built from). */
export function roundPriceUp(price: number): number {
  const p = Number(price) || 0;
  const unit = p < 20000 ? 50 : 100;
  return Math.ceil(p / unit - 1e-9) * unit;
}

export function fmtRand(v: number, dp = 0): string {
  const shown = halfUp(v, dp);
  const sign = v < 0 && shown !== 0 ? "−" : "";
  return `${sign}R ${fmtNum(Math.abs(v), dp)}`;
}
function warning(code: string, severity: "block" | "warn", title: string, detail: string,
  impact_zar: number | null = null, actions: string[] = [], extra: Record<string, unknown> = {}): QuoteWarning {
  return { code, severity, title, detail, impact_zar, actions: actions.map((a) => ({ id: a, label: ACTION_LABELS[a] })), ...extra };
}

// ---------------------------------------------------------------- inputs

export interface DieselInput {
  zone?: string | null; mode?: string | null;
  own_price?: number | null; own_set_at?: string | null;
  official_price?: number | null; official_effective_from?: string | null; official_stale?: boolean;
  use_official?: boolean; override_price?: number | null; fuel_type?: string | null;
  /** Petrol only: the official grade priced on ('95' | '93'). */
  grade?: string | null;
}
export interface CostingInputs {
  trip_type?: string | null;
  distance_km?: number | null;
  distance_estimated?: boolean;
  distance_confirmed?: boolean;
  duration_minutes?: number | null;
  load_kg?: number | null;
  vehicle?: { id?: number | string | null; name?: string | null; capacity?: unknown; rated_burn_l_per_100km?: unknown } | null;
  diesel?: DieselInput | null;
  operating_cost_per_km?: number | null;
  operating_cost_source?: string | null;
  tolls?: { one_way?: number | null; empty_return?: number | null; lookup_failed?: boolean; confirmed_none?: boolean } | null;
  driver?: { allowance_per_night?: number | null; nights?: number | null; amount?: number | null } | null;
  hours_per_day?: number | null;
  border_cost?: number | null;
  /** Cross-border trip: no border cost → incomplete floor (block). */
  international?: boolean;
  /** Parts of the route with no border figures on file (the route's
   *  border_costs_unknown, countries as names): unless the border figure is
   *  the user's own, the border lines are null and the quote blocks. */
  border_costs_unknown?: { countries?: (string | null)[] | null; crossings?: (string | null)[] | null; known?: { label?: string | null; amount?: number | string | null }[] | null } | null;
  /** The border figure is the user's own (covers every crossing). */
  border_cost_is_override?: boolean;
  include_empty_return?: boolean | null;
  settings?: { include_empty_return_default?: boolean | null; empty_return_min_km?: number | null } | null;
  minimum_charge?: number | null;
  target_margin_pct?: number | null;
  /** Optional default price per km (a price, not a cost). */
  default_price_per_km?: number | null;
  price?: number | null;
}

export interface ResolvedDiesel {
  zone: string; mode: string; own_price: number | null; own_set_at: string | null; fuel_type: string;
  official_price: number | null; official_effective_from: string | null; official_stale: boolean;
  price: number | null; source: "own" | "official" | "override" | "missing";
  /** Echoed only when the input carried one (petrol). */
  grade?: string;
}

export function resolveDiesel(d: DieselInput | null | undefined): ResolvedDiesel {
  d = d || {};
  let zone = String(d.zone || "INLAND").toUpperCase();
  zone = zone === "INLAND" || zone === "COASTAL" ? zone : "INLAND";
  let mode = String(d.mode || "LIVE").toUpperCase();
  const own = pos(d.own_price);
  if (mode !== "OWN" || own === null) mode = own === null ? "LIVE" : mode;
  const official = pos(d.official_price);
  const override = pos(d.override_price);
  const base = {
    zone, mode, own_price: own, own_set_at: iso(d.own_set_at), fuel_type: d.fuel_type || "Diesel",
    official_price: official, official_effective_from: iso(d.official_effective_from),
    official_stale: official !== null ? !!d.official_stale : false,
    ...(d.grade ? { grade: String(d.grade) } : {}),
  };
  if (override !== null) return { ...base, price: override, source: "override" };
  if (mode === "OWN" && !d.use_official) return { ...base, price: own, source: "own" };
  if (official !== null) return { ...base, price: official, source: "official" };
  return { ...base, price: null, source: "missing" };
}

/** Sum of the fuel line amounts (each to the cent) at `price`. */
function fuelLinesTotal(parts: number[], price: number): number {
  return cents(parts.reduce((s, l) => s + cents(l * price), 0));
}

export function dieselWarnings(diesel: ResolvedDiesel, litresTotal: number | null = null, litresParts: number[] | null = null): QuoteWarning[] {
  const out: QuoteWarning[] = [];
  const zoneTxt = diesel.zone === "COASTAL" ? "coastal" : "inland";
  const fuel = String(diesel.fuel_type || "Diesel").toLowerCase();
  const officialFuel = fuel === "diesel" || fuel === "petrol";   // fuels with an official FIASA price
  const grade = diesel.grade;
  const where = fuel === "petrol" && grade ? `${zoneTxt} ${grade}` : zoneTxt;
  const extra: Record<string, unknown> = fuel === "diesel" ? {} : { fuel_type: fuel };
  if (diesel.source === "missing") {
    if (officialFuel) {
      out.push(warning("diesel_missing", "block", `No ${fuel} price available`,
        "No official price on record; set your own in settings.", null, ["retry_diesel", "update_own"], extra));
    } else if (fuel === "electric") {
      out.push(warning("diesel_missing", "block", "No electricity price set",
        "Set your electricity cost per kWh in settings.", null, ["update_own"], extra));
    } else {
      out.push(warning("diesel_missing", "block", `No ${fuel} price set`,
        `Set your ${fuel} price per litre in settings.`, null, ["update_own"], extra));
    }
    return out;
  }
  if (diesel.source === "own" && diesel.official_price) {
    const own = diesel.own_price as number;
    const official = diesel.official_price;
    if (Math.abs(own - official) / official > OWN_OFF_THRESHOLD) {
      const impact = litresParts !== null ? cents(fuelLinesTotal(litresParts, own) - fuelLinesTotal(litresParts, official))
        : litresTotal !== null ? cents((own - official) * litresTotal) : null;
      out.push(warning("diesel_own_off", "warn", `Your ${fuel} price differs from official`,
        `Yours ${fmtRand(own, 2)}/L, official ${fmtRand(official, 2)}/L (${where}).`,
        impact, ["use_official", "update_own"], { own_price: own, official_price: official, ...extra }));
    }
    const setAt = parseDt(diesel.own_set_at);
    const eff = parseDt(diesel.official_effective_from);
    if (setAt && eff && setAt.getTime() < eff.getTime()) {
      out.push(warning("diesel_own_old", "warn", `Your ${fuel} price predates the latest change`,
        `Set ${saDate(setAt.toISOString())}; official price changed ${saDate(eff.toISOString())}.`, null, ["update_own", "use_official"], extra));
    }
  }
  if (diesel.source === "official" && diesel.official_stale) {
    const eff = diesel.official_effective_from;
    out.push(warning("diesel_stale", "warn", `Official ${fuel} price may be out of date`,
      eff ? `Latest on record is from ${saDate(eff)}.` : "This month's price is not loaded yet.", null, ["retry_diesel", "update_own"], extra));
  }
  return out;
}

// ---------------------------------------------------------------- compute

export interface CostLine {
  key: string; label: string; leg: "loaded" | "empty_return"; amount: number | null; basis: string;
  [extra: string]: unknown;
}
export interface Costing {
  version: string;
  trip: { type: "ONE_WAY" | "ROUND_TRIP"; legs_loaded: number; distance_km: number | null; empty_return_included: boolean;
    empty_return_default: boolean; km_loaded: number | null; km_empty: number; km_driven: number | null;
    hours_one_way: number | null; return_nights: number | null };
  vehicle: { id: unknown; name: unknown; capacity_t: number | null; load_t: number | null; load_ratio: number | null;
    rated_burn_l_per_100km: number | null; burn_loaded_l_per_100km: number | null; burn_empty_l_per_100km: number | null } | null;
  diesel: ResolvedDiesel;
  litres: { loaded: number | null; empty_return: number | null; total: number | null };
  lines: CostLine[];
  floor: number | null;
  floor_known: number;
  floor_complete: boolean;
  target_margin_pct: number | null;
  target_price: number | null;
  minimum_charge: number | null;
  default_price_per_km: number | null;
  rate_price: number | null;
  default_price: number | null;
  alternative_with_return_load: { floor: number | null; target_price: number | null; default_price: number | null } | null;
  price: number | null;
  margin: number | null;
  margin_pct: number | null;
  warnings: QuoteWarning[];
  blocking: string[];
  can_send: boolean;
}

export function compute(inputs: CostingInputs | null | undefined): Costing {
  const i = inputs || {};
  const warnings: QuoteWarning[] = [];

  // --- trip ---
  const roundTrip = String(i.trip_type || "ONE_WAY").toUpperCase() === "ROUND_TRIP";
  const legsLoaded = roundTrip ? 2 : 1;
  const distance = pos(i.distance_km);
  const settings = i.settings || {};
  const defaultOn = settings.include_empty_return_default === null || settings.include_empty_return_default === undefined
    ? true : !!settings.include_empty_return_default;
  const minKmRaw = num(settings.empty_return_min_km);
  const minKm = minKmRaw === null ? DEFAULT_EMPTY_RETURN_MIN_KM : minKmRaw;
  const requested = i.include_empty_return;
  let emptyReturn: boolean;
  if (roundTrip || distance === null) emptyReturn = false;
  else if (requested !== null && requested !== undefined) emptyReturn = !!requested;
  else emptyReturn = defaultOn && distance >= minKm;
  const kmLoaded = distance !== null ? distance * legsLoaded : null;
  const kmEmpty = emptyReturn ? (distance as number) : 0.0;

  if (distance === null) {
    warnings.push(warning("distance_missing", "block", "Route distance is missing",
      "Add collection and delivery to work out the route.", null, ["enter_route"]));
  } else if (i.distance_estimated && !i.distance_confirmed) {
    warnings.push(warning("distance_estimated", "block", "Distance is a straight-line estimate",
      `${fmtNum(distance)} km was estimated; recalculate or confirm it.`, null, ["recalculate_route", "confirm_distance"]));
  }

  // --- truck (§3) ---
  const vehicle = i.vehicle || null;
  let capT: number | null = null, loadT: number | null = null, ratio: number | null = null, rated: number | null = null;
  let burnLoaded: number | null = null, burnEmpty: number | null = null;
  const loadKg = num(i.load_kg);
  if (vehicle === null) {
    warnings.push(warning("no_vehicle", "block", "Choose a truck for this quote",
      "Every quote is priced on one of your vehicle types.", null, ["choose_vehicle", "add_vehicle"]));
  } else {
    capT = capacityTonnes(vehicle.capacity);
    rated = pos(vehicle.rated_burn_l_per_100km);
    loadT = loadKg !== null && loadKg >= 0 ? loadKg / 1000 : null;
    ratio = capT !== null && loadT !== null ? Math.min(loadT / capT, 1) : 1;
    if (loadT === null) {
      warnings.push(warning("load_missing", "warn", "Load weight is missing",
        "Fuel is priced as a full load until you enter it.", null, ["enter_weight"]));
    }
    if (rated !== null) {
      burnLoaded = rated * (LOADED_BASE + LOADED_SLOPE * ratio);
      burnEmpty = rated * EMPTY_FACTOR;
    } else {
      warnings.push(warning("truck_burn_missing", "block", "Truck fuel use is missing",
        `Set litres per 100 km for ${vehicle.name || "this truck"}.`, null, ["edit_vehicle"]));
    }
    if (capT !== null && loadT !== null && loadT > capT) {
      warnings.push(warning("overload", "block", "Load is heavier than the truck",
        `${fmtNum(loadT, 1)} t on a ${fmtNum(capT, 1)} t truck.`, null, ["choose_vehicle"]));
    }
    if (capT !== null && ((rated !== null && rated < SUSPECT_BURN_MIN && capT >= SUSPECT_BURN_MIN_CAPACITY_T) || capT > SUSPECT_CAPACITY_MAX_T)) {
      const what = capT > SUSPECT_CAPACITY_MAX_T ? `A ${fmtNum(capT)} t payload looks like the GVM`
        : `${fmtNum(rated as number)} L/100 km is low for a ${fmtNum(capT)} t truck`;
      warnings.push(warning("truck_burn_suspect", "warn", "Check this truck's fuel or capacity", `${what}.`, null, ["edit_vehicle"]));
    }
  }

  const litresLoaded = kmLoaded !== null && burnLoaded !== null ? kmLoaded * burnLoaded / 100 : null;
  const litresEmpty = emptyReturn && burnEmpty !== null ? kmEmpty * burnEmpty / 100 : (!emptyReturn ? 0.0 : null);
  const litresTotal = litresLoaded !== null && litresEmpty !== null ? litresLoaded + litresEmpty : null;

  // --- diesel (§1) ---
  const diesel = resolveDiesel(i.diesel);
  const parts = litresLoaded !== null && litresEmpty !== null ? [litresLoaded, ...(emptyReturn ? [litresEmpty] : [])] : null;
  warnings.push(...dieselWarnings(diesel, litresTotal, parts));
  const priceL = diesel.price;

  const lines: CostLine[] = [];
  let complete = true;
  const add = (key: string, leg: "loaded" | "empty_return", amount: number | null, basis: string, extra: Record<string, unknown> = {}, required = true) => {
    if (amount === null && required) complete = false;
    lines.push({ key, label: LINE_LABELS[key], leg, amount, basis, ...extra });
  };

  // --- fuel (§4) ---
  const fuelAmt = litresLoaded !== null && priceL !== null ? cents(litresLoaded * priceL) : null;
  add("fuel", "loaded", fuelAmt,
    `${fmtNum(kmLoaded || 0)} km at ${burnLoaded ? fmtNum(burnLoaded, 1) : "?"} L/100km` + (priceL ? ` × ${fmtRand(priceL, 2)}/L` : ""),
    { litres: litresLoaded, burn_l_per_100km: burnLoaded, price_per_litre: priceL, km: kmLoaded });

  // --- operating cost (§6) ---
  const op = num(i.operating_cost_per_km);
  const opAmt = kmLoaded !== null && op !== null ? cents(kmLoaded * op) : null;
  add("operating", "loaded", opAmt, `${fmtNum(kmLoaded || 0)} km × ${op !== null ? fmtRand(op, 2) : "?"}/km`,
    { rate_per_km: op, km: kmLoaded, source: i.operating_cost_source ?? null });

  // --- tolls (§6) ---
  const tolls = i.tolls || {};
  let tollOneWay = num(tolls.one_way);
  let tollsUnknown = tollOneWay === null || !!tolls.lookup_failed;
  if (tollsUnknown && tolls.confirmed_none) { tollOneWay = 0.0; tollsUnknown = false; }
  if (tollsUnknown) {
    tollOneWay = null;
    warnings.push(warning("tolls_unknown", "block", "Tolls could not be worked out",
      "Enter the tolls, or confirm there are none on this route.", null, ["enter_tolls", "confirm_no_tolls"]));
  }
  // R 0 from a toll lookup that worked is a known R 0: the route has no
  // plazas (owner rule: we know every toll; no "check / add your own").
  const tollAmt = tollOneWay !== null ? cents(tollOneWay * legsLoaded) : null;
  add("tolls", "loaded", tollAmt,
    tollAmt === null ? "Unknown" : tollOneWay === 0 ? "No toll plazas on this route" : roundTrip ? `${fmtRand(tollOneWay as number, 2)} × 2 legs` : `${fmtRand(tollOneWay as number, 2)} one way`,
    { one_way: tollOneWay, legs: legsLoaded });

  // --- driver nights (§6) ---
  const driver = i.driver || {};
  const hpd = pos(i.hours_per_day) || DEFAULT_HOURS_PER_DAY;
  const minutes = pos(i.duration_minutes);
  const hours = minutes !== null ? minutes / 60 : null;
  const rate = pos(driver.allowance_per_night);
  const nightsOne = nightsAway(hours, hpd);
  const nightsTwo = hours !== null ? nightsAway(hours * 2, hpd) : null;
  const suggestedNights = roundTrip ? nightsTwo : nightsOne;
  const nightsOverride = num(driver.nights);
  const nights = nightsOverride !== null && nightsOverride >= 0 ? Math.trunc(nightsOverride) : suggestedNights;
  const userAmount = num(driver.amount);
  const suggested = nights !== null && rate !== null ? cents(nights * rate) : (nights === 0 ? 0.0 : null);
  let drvAmt: number | null; let drvSource: string;
  if (userAmount !== null && userAmount >= 0) { drvAmt = cents(userAmount); drvSource = "user"; }
  else if (suggested === null && nights) {
    // Nights away but no allowance rate anywhere: priced at R 0 and said so (warn).
    drvAmt = 0.0; drvSource = "missing";
    warnings.push(warning("driver_allowance_missing", "warn", "No driver allowance rate set",
      `${nights} night${nights !== 1 ? "s" : ""} away priced at R 0; enter the driver cost or set a rate.`, null, ["enter_driver_cost", "update_allowance"]));
  } else { drvAmt = suggested; drvSource = "suggested"; }
  if (drvAmt === null) {
    warnings.push(warning("driver_nights_unknown", "block", "Driving time is unknown",
      "Enter the driver cost, or recalculate the route.", null, ["enter_driver_cost", "recalculate_route"]));
  }
  add("driver", "loaded", drvAmt,
    drvSource === "user" ? "Your figure"
      : drvSource === "missing" ? `${nights} night${nights !== 1 ? "s" : ""} at R 0: no allowance rate set`
      : rate !== null && nights ? `${nights} night${nights !== 1 ? "s" : ""} × ${fmtRand(rate, 2)}`
      : nights === 0 ? "No night away" : "Unknown",
    { nights, suggested_nights: suggestedNights, rate_per_night: rate, suggested, source: drvSource });

  // --- border ---
  const border = num(i.border_cost);
  const bu = i.border_costs_unknown || {};
  const unknownNames = (bu.countries || []).filter((c) => c).map(String);
  const unknownCrossings = (bu.crossings || []).filter((c) => c).map(String);
  const borderUnknown = (unknownNames.length > 0 || unknownCrossings.length > 0) && !i.border_cost_is_override;
  if (borderUnknown) {
    // Part of the route has no border figures on file (e.g. Namibia -> Angola):
    // the floor is incomplete until the user enters the border costs.
    const names = unknownNames.length ? unknownNames : unknownCrossings.map((c) => c.split("→").pop() as string);
    const known = (bu.known || []).filter((k) => k && typeof k === "object" && num(k.amount) !== null);
    const missing = (unknownCrossings.length ? unknownCrossings : names).join(", ");
    const detail = known.length
      ? "Known: " + known.map((k) => `${k.label} ${fmtRand(Number(k.amount), 2)}`).join(" + ") + `; missing: ${missing}`
      : `Missing: ${missing}`;
    add("border", "loaded", null, `Not known for ${names.join(" and ")}`, { status: "needs_input" });
    warnings.push(warning("border_costs_missing", "block", `Border costs for ${names.join(" and ")} not known`, detail, null, ["enter_border_costs"]));
  } else if (border !== null && border > 0) add("border", "loaded", cents(border), "Border, permit and non-SA toll costs");
  else if (i.international) {
    // An international trip always has border costs: without them the floor is incomplete.
    add("border", "loaded", null, "Not worked out yet", { status: "needs_input" });
    warnings.push(warning("border_costs_missing", "block", "Border costs not worked out yet",
      "Add the border, permit and non-SA toll costs for this trip.", null, ["enter_border_costs"]));
  }

  // --- empty return (§5) ---
  let returnNights: number | null = null;
  if (emptyReturn) {
    const frAmt = litresEmpty !== null && priceL !== null ? cents(litresEmpty * priceL) : null;
    add("fuel_return", "empty_return", frAmt,
      `${fmtNum(kmEmpty)} km empty at ${burnEmpty ? fmtNum(burnEmpty, 1) : "?"} L/100km` + (priceL ? ` × ${fmtRand(priceL, 2)}/L` : ""),
      { litres: litresEmpty, burn_l_per_100km: burnEmpty, price_per_litre: priceL, km: kmEmpty });
    add("operating_return", "empty_return", op !== null ? cents(kmEmpty * op) : null,
      `${fmtNum(kmEmpty)} km × ${op !== null ? fmtRand(op, 2) : "?"}/km`, { rate_per_km: op, km: kmEmpty, source: i.operating_cost_source ?? null });
    let retToll = num(tolls.empty_return);
    if (retToll === null) retToll = tollOneWay;
    add("tolls_return", "empty_return", retToll !== null ? cents(retToll) : null,
      retToll === null ? "Unknown" : `${fmtRand(retToll, 2)} home empty`, { one_way: retToll });
    returnNights = nightsOne !== null ? (nightsTwo as number) - nightsOne : null;
    const drAmt = returnNights !== null && rate !== null ? cents(returnNights * rate) : (returnNights !== null ? 0.0 : null);
    if (returnNights && rate === null && !warnings.some((w) => w.code === "driver_allowance_missing")) {
      warnings.push(warning("driver_allowance_missing", "warn", "No driver allowance rate set",
        `${returnNights} extra night${returnNights !== 1 ? "s" : ""} coming home priced at R 0; set a rate per night.`, null, ["update_allowance"]));
    }
    add("driver_return", "empty_return", drAmt,
      rate !== null && returnNights ? `${returnNights} extra night${returnNights !== 1 ? "s" : ""} × ${fmtRand(rate, 2)}`
        : returnNights ? `${returnNights} extra night${returnNights !== 1 ? "s" : ""} at R 0: no allowance rate set`
        : returnNights === 0 ? "No extra night" : "Unknown",
      { nights: returnNights, rate_per_night: rate });
    if (drAmt === null && !warnings.some((w) => w.code === "driver_nights_unknown")) {
      // Without the driving time the return nights are unknown: a null line blocks.
      warnings.push(warning("driver_nights_unknown", "block", "Driving time is unknown",
        "Enter the driver cost, or recalculate the route.", null, ["enter_driver_cost", "recalculate_route"]));
    }
    if (i.international && borderUnknown) {
      add("border_return", "empty_return", null, "Not known crossing back", { status: "needs_input" });
    } else if (i.international && border !== null && border > 0) {
      // The empty truck crosses the border(s) back: the same costs per crossing.
      add("border_return", "empty_return", cents(border), "Border costs crossing back, empty");
    }
  }

  if (op === null && distance !== null) complete = false;
  const known = lines.map((l) => l.amount).filter((a): a is number => a !== null);
  // Python sum(): left to right from 0.
  const floorKnown = known.length ? cents(known.reduce((s, a) => s + a, 0)) : 0.0;
  const floor = complete ? floorKnown : null;

  // --- price and margin (§7) ---
  const target = num(i.target_margin_pct);
  const minimum = pos(i.minimum_charge);
  let targetPrice: number | null = null;
  if (floor !== null && target !== null && target < 100) {
    targetPrice = cents(floor / (1 - target / 100));
    if (minimum !== null && minimum > targetPrice) targetPrice = minimum;
  }
  const price = pos(i.price);
  let margin: number | null = null, marginPct: number | null = null;
  if (price !== null && floor !== null) {
    margin = cents(price - floor);
    marginPct = (price - floor) / price * 100;
    if (price < floor) {
      warnings.push(warning("below_floor", "warn", "Price is below your costs",
        `This trip loses ${fmtRand(floor - price)}.`, cents(price - floor)));
    }
  }
  if (price !== null && minimum !== null && price < minimum) {
    warnings.push(warning("below_minimum_charge", "block", "Price is below your minimum charge",
      `${fmtRand(minimum - price)} below your ${fmtRand(minimum)} minimum.`, cents(minimum - price), ["use_minimum"]));
  }

  // Default price (coordinator round 3): max(rate price, target price),
  // rounded UP to the whole rand; the rate price only when a default price
  // per km > 0 is set, on the billable (loaded) km. No floor → none.
  const ratePerKm = pos(i.default_price_per_km);
  const ratePrice = ratePerKm !== null && kmLoaded !== null ? cents(ratePerKm * kmLoaded) : null;
  // The same rounding as the pricing analysis' choices: with no market the
  // suggested price IS the Safe choice.
  const defaultPrice = targetPrice !== null ? roundPriceUp(Math.max(ratePrice ?? 0, targetPrice)) : null;
  // The same quote with a return load booked (one-way, empty return included).
  let alternative: { floor: number | null; target_price: number | null; default_price: number | null } | null = null;
  if (emptyReturn && requested !== false) {
    const alt = compute({ ...i, include_empty_return: false });
    alternative = { floor: alt.floor, target_price: alt.target_price, default_price: alt.default_price };
  }

  const blocking = warnings.filter((w) => w.severity === "block").map((w) => w.code);
  return {
    version: VERSION,
    trip: {
      type: roundTrip ? "ROUND_TRIP" : "ONE_WAY", legs_loaded: legsLoaded, distance_km: distance,
      empty_return_included: emptyReturn,
      empty_return_default: !roundTrip && distance !== null && defaultOn && distance >= minKm,
      km_loaded: kmLoaded, km_empty: kmEmpty, km_driven: kmLoaded !== null ? kmLoaded + kmEmpty : null,
      hours_one_way: hours, return_nights: returnNights,
    },
    vehicle: vehicle === null ? null : {
      id: vehicle.id ?? null, name: vehicle.name ?? null, capacity_t: capT, load_t: loadT, load_ratio: ratio,
      rated_burn_l_per_100km: rated, burn_loaded_l_per_100km: burnLoaded, burn_empty_l_per_100km: burnEmpty,
    },
    diesel,
    litres: { loaded: litresLoaded, empty_return: litresEmpty, total: litresTotal },
    lines,
    floor,
    floor_known: floorKnown,
    floor_complete: floor !== null,
    target_margin_pct: target,
    target_price: targetPrice,
    minimum_charge: minimum,
    default_price_per_km: ratePerKm,
    rate_price: ratePrice,
    default_price: defaultPrice,
    alternative_with_return_load: alternative,
    price,
    margin,
    margin_pct: marginPct,
    warnings,
    blocking,
    can_send: blocking.length === 0,
  };
}

// ---------------------------------------------------------------- builder helpers

export interface TruckLike { id?: number | string | null; name?: string; capacity?: unknown; fuel_consumption_l_per_100km?: unknown }

/** §3 default truck: smallest capacity ≥ load; tie → lowest rated burn
 *  (types without a capacity or burn are skipped). null when none fits. */
export function suggestTruck<T extends TruckLike>(types: T[], loadT: number): T | null {
  let best: { cap: number; burn: number; id: number; vt: T } | null = null;
  for (const vt of types) {
    const cap = capacityTonnes(vt.capacity);
    const burn = pos(vt.fuel_consumption_l_per_100km);
    if (cap === null || burn === null || cap < loadT) continue;
    const id = Number(vt.id) || 0;
    if (!best || cap < best.cap || (cap === best.cap && (burn < best.burn || (burn === best.burn && id < best.id)))) best = { cap, burn, id, vt };
  }
  return best ? best.vt : null;
}

/** Class defaults, R/km (pricing_analysis.OPERATING_COST_CLASSES totals). */
export const CLASS_OPERATING_DEFAULTS: Record<string, number> = {
  light: 8.0, rigid: 11.0, tri_axle: 14.5, reefer: 17.0, superlink: 16.0,
};
export const DEFAULT_OPERATING_CLASS = "tri_axle";
/** pricing_analysis.vehicle_class: keywords in the name, then capacity. */
export function vehicleClass(name: string | null | undefined, capacity: unknown): string {
  const text = (name || "").toLowerCase();
  const kw: [string, string[]][] = [
    ["superlink", ["superlink", "interlink"]],
    ["reefer", ["reefer", "refrig", "fridge"]],
    ["light", ["bakkie", "1-ton", "1 ton", "4-ton", "4 ton", "light", "van"]],
    ["rigid", ["rigid", "box truck", "8-ton", "8 ton", "6x4", "tipper", "dropside"]],
    ["tri_axle", ["tautliner", "flatbed", "tri-axle", "triaxle", "semi", "tanker", "side tipper"]],
  ];
  for (const [k, words] of kw) if (words.some((w) => text.includes(w))) return k;
  let cap = Number(capacity) || 0;
  if (cap > 999) cap /= 1000;
  if (cap <= 0) return DEFAULT_OPERATING_CLASS;
  return cap <= 8 ? "light" : cap <= 18 ? "rigid" : cap <= 34 ? "tri_axle" : "superlink";
}

/** Margin as a share of price (§7), unrounded. */
export const marginPct = (price: number, floor: number) => (price > 0 ? (price - floor) / price * 100 : null);

// ---------------------------------------------------------------- reopen (§11)

export interface ChangesSincePriced {
  priced_at: string | null; price: number | null; floor_then: number | null; floor_now: number | null;
  delta_zar: number | null; margin_then: number | null; margin_now: number | null;
  repriced_price_keep_margin: number | null; changed: boolean; notice: string | null;
  actions: { id: string; label: string }[];
}

/** quote_costing.changes_since_priced: the reopen notice ("Costs up R 1 050
 *  since 2 Sep. Margin 14% → 9%.") and the Re-price figure (keeps margin). */
export function changesSincePriced(price: unknown, floorThen: unknown, floorNow: unknown, pricedAt: unknown = null): ChangesSincePriced {
  const p = pos(price), ft = num(floorThen), fn = num(floorNow);
  const delta = ft !== null && fn !== null ? cents(fn - ft) : null;
  const mThen = p && ft !== null ? (p - ft) / p * 100 : null;
  const mNow = p && fn !== null ? (p - fn) / p * 100 : null;
  const keep = mThen !== null && fn !== null && mThen < 100 ? cents(fn / (1 - mThen / 100)) : null;
  const changed = delta !== null && Math.abs(delta) >= 1;
  let notice: string | null = null;
  if (changed) {
    const when = saDate(pricedAt);
    notice = `Costs ${(delta as number) > 0 ? "up" : "down"} ${fmtRand(Math.abs(delta as number))}`
      + (when ? ` since ${when.slice(0, when.lastIndexOf(" "))}` : "") + "."
      + (mThen !== null && mNow !== null ? ` Margin ${Math.floor(mThen + 0.5)}% → ${Math.floor(mNow + 0.5)}%.` : "");
  }
  return {
    priced_at: iso(pricedAt), price: p, floor_then: ft, floor_now: fn, delta_zar: delta, margin_then: mThen, margin_now: mNow,
    repriced_price_keep_margin: keep, changed, notice,
    actions: changed ? ["keep_price", "reprice"].map((a) => ({ id: a, label: ACTION_LABELS[a] })) : [],
  };
}
