import { likelihoodLabel } from "@/lib/pricing";

/**
 * Pricing analysis: the typed contract for POST /api/v1/quotes/pricing-analysis/
 * (backend core/services/pricing_analysis.py) and one adapter that turns
 * whatever the server sends into these shapes. Every screen reads the
 * adapted shape only, so a key rename on the server is a one-line change in
 * `adaptAnalysis`, never a hunt through the components.
 *
 * The endpoint is deterministic (no LLM, no web) and consumes the builder's
 * own computed costs; nothing here recomputes a route, fuel or toll figure.
 */

export type SourceKind = "official" | "calculated" | "company_actuals" | "estimate" | "user";
export type FloorLineKey = "fuel" | "tolls" | "driver_allowance" | "border" | "fixed_cost" | "return_leg" | string;
export type ChoiceKey = "safe" | "balanced" | "stretch";
export type Band = "likely" | "even" | "less_likely";
export type MarketTier = "platform" | "company" | "estimate";
export type Position = "below" | "within" | "above";

export interface LineSource { kind: SourceKind; label: string; url: string | null; asOf: string | null }
export interface FloorLine {
  key: FloorLineKey; label: string; amount: number;
  source: LineSource; basis: string | null; editable: boolean;
  details: { label: string; value: string }[];
  /** driver_allowance only: approved rate × nights, to prefill the Driver input. */
  suggested: number | null;
  /** driver_allowance only: nights away, and whether the user still has to give a figure. */
  nights: number | null;
  /** A figure the floor still needs (driver allowance, or border costs on an international trip). */
  needsInput: boolean;
  /** A figure worth checking: R0 tolls (none found for the route, which may be missing data). */
  check: boolean;
}
export interface CostFloor {
  total: number; perKm: number | null; includeReturn: boolean;
  /** Server label for perKm ("per km driven": total ÷ the km actually driven,
   *  both legs when the empty return or a round trip is in the floor). */
  perKmLabel: string | null;
  /** Km the floor is spread over (both legs when the return is in it). */
  kmDriven: number | null; distanceKm: number | null;
  /** The empty run home (one-way trips): its cost, and the floor including it. */
  returnLegAmount: number | null; floorWithReturn: number | null;
  /** Whether the empty-return toggle means anything for this trip. */
  returnAvailable: boolean;
  lines: FloorLine[];
  fixedCostPerKm: { value: number; source: "company_actuals" | "vehicle_default"; trips: number | null; window: string | null } | null;
}
export interface Market {
  available: boolean; p25: number | null; median: number | null; p75: number | null; n: number;
  tier: MarketTier | null; tierLabel: string | null; isEstimate: boolean; yourPosition: Position | null;
  /** Round trip priced from one-way quotes ×2 (`legs_scaled` / `basis: "one_way_x2"`). */
  oneWayX2: boolean;
  /** Short server label for the basis, e.g. "one-way quotes ×2". */
  basisLabel: string | null;
  /** The sample was narrowed to the vehicle type; its name when known. */
  vehicleSpecific: boolean; vehicleName: string | null;
}
export type Likelihood =
  | { level: "model"; pct: number }
  /** band null: not enough data to judge. */
  | { level: "rules"; band: Band | null; label: string; outsideModelRange: boolean };
export interface Choice {
  key: ChoiceKey; label: string; price: number; margin: number; marginPct: number;
  recommended: boolean; summary: string | null; likelihood: Likelihood | null;
  /** Margin % if the truck comes back empty (when the floor excludes the return). */
  marginPctIfEmptyReturn: number | null;
}
export interface CurvePoint { price: number; pct: number; expectedProfit: number | null }
export interface LikelihoodInfo {
  level: "model" | "rules";
  model: { version: string; scope: string | null; nClosed: number; basisLabel: string; range: [number, number]; curve: CurvePoint[];
    /** The curve's peak expected profit (server). */
    best: { price: number; pct: number | null; expectedProfit: number | null } | null } | null;
  rules: { likelyMax: number | null; evenMax: number | null; basis: string[] } | null;
  reason: string | null;
  /** One-line, server-worded description of the level ("Chance to win as bands · 16 of 40 closed quotes"). */
  short: string | null;
  /** R5 (K-1): the display-ready panel subtitle, rendered as received. */
  headline: string | null;
}
export interface LaneQuote { id: number | null; number: string | null; date: string | null; price: number; outcome: "accepted" | "rejected" | "open" | "expired" | string }
export interface CustomerEvidence {
  id: number | null; name: string | null;
  acceptance: { won: number; decided: number; ratePct: number | null; scope: "lane" | "all" } | null;
  /** This customer on this lane only (null when they have no decided quotes here). */
  laneAcceptance: { won: number; decided: number; ratePct: number | null } | null;
  recentLaneQuotes: LaneQuote[];
  paymentRisk: { band: "low" | "medium" | "high" | "unknown"; label: string; basis: string | null; attention: boolean } | null;
}
export interface PricingAnalysis {
  version: string;
  computedMs: number | null;
  missing: string[];
  targetMarginPct: number | null;
  costFloor: CostFloor | null;
  market: Market | null;
  choices: Choice[];
  likelihood: LikelihoodInfo | null;
  customer: CustomerEvidence | null;
  reasoning: string[];
  /** R5 (K-3): reasons with a code, so the panel can pick which to show. Empty from an older server. */
  reasoningItems: { code: string; text: string }[];
  warnings: { code: string; message: string }[];
  /** Decision-changing notices for the top of the panel (payment risk, lane under cost …). */
  attention: { code: string; level: string; message: string }[];
  /** Why the recommended choice is recommended (server sentence). */
  recommendation: { key: string | null; reason: string | null; short: string | null } | null;
  /** The server's own reading of the price that was sent (authoritative at that price). */
  yourPrice: { price: number; margin: number | null; marginPct: number | null; belowFloor: boolean; likelihood: Likelihood | null } | null;
  /** True when the server sends the round-5 display strings (headline …). */
  r5: boolean;
  /** Progress to a real win model: won/lost closed quotes and what is needed. */
  modelProgress: { won: number | null; lost: number | null; wonNeeded: number; lostNeeded: number } | null;
  /** Where the target margin comes from (company setting / default). */
  targetMarginSource: string | null;
  /** Floor including the empty return, when the floor itself excludes it. */
  floorWithReturn: number | null;
}

/** What the builder sends. Field names follow the brief; the backend's
 *  CONTRACT.md is the source of truth and `buildRequest` is the one place
 *  that maps the builder's values onto it. */
export interface PricingInputs {
  quoteId: number | null;
  customerId: number | null;
  origin: string; destination: string;
  originLabel: string; destinationLabel: string;
  distanceKm: number; oneWayDistanceKm: number; legs: number; tripType: string;
  /** One-way driving minutes. */
  durationMinutes: number | null;
  vehicleTypeId: number | null; vehicleType: string | null;
  weightKg: number | null;
  fuelType: string | null; fuelZone: string | null;
  fuelCost: number; fuelLitres: number | null; fuelPricePerL: number | null; fuelConsumption: number | null;
  /** §9 where the R/L came from: own | official | override. */
  fuelPriceSource?: string | null;
  /** §5 the empty return the builder includes (one-way ≥ min km), or null. */
  emptyReturnCost?: number | null;
  /** quote_costing.build_inputs flags (tolls_unknown, distance_estimated, …), sent as is. */
  costingFlags?: Record<string, unknown>;
  tollCost: number; routePlazas: { plaza: string; route?: string; tariff: number }[];
  countryCodes: string[] | null;
  crossBorderCost: number; isInternational: boolean;
  pickupDate: string | null;
  /** Only when the user typed one; otherwise the approved figure applies. */
  driverAllowance: number | null;
  includeReturn: boolean | null;
  yourPrice: number | null;
}

export function buildRequest(i: PricingInputs): Record<string, unknown> {
  return {
    quote_id: i.quoteId,
    customer_id: i.customerId,
    origin: i.origin, destination: i.destination,
    pickup_location: i.originLabel, delivery_location: i.destinationLabel,
    distance_km: round2(i.distanceKm),
    one_way_distance_km: round2(i.oneWayDistanceKm),
    legs: i.legs, trip_type: i.tripType,
    duration_minutes: i.durationMinutes != null ? Math.round(i.durationMinutes) : null,
    vehicle_type: i.vehicleType || null,
    vehicle_type_id: i.vehicleTypeId,
    weight: i.weightKg,
    fuel_cost: round2(i.fuelCost),
    fuel_usage_litres: i.fuelLitres != null ? round2(i.fuelLitres) : null,
    fuel_price_used: i.fuelPricePerL,
    fuel_consumption_l_per_100km: i.fuelConsumption != null ? round2(i.fuelConsumption) : null,
    fuel_type: i.fuelType, fuel_zone: i.fuelZone,
    ...(i.fuelPriceSource ? { fuel_price_source: i.fuelPriceSource } : {}),
    ...(i.emptyReturnCost != null ? { empty_return_cost: round2(i.emptyReturnCost) } : {}),
    toll_cost: round2(i.tollCost),
    route: { toll_breakdown: i.routePlazas, cross_border: i.isInternational, country_codes: i.countryCodes },
    cross_border_cost: round2(i.crossBorderCost),
    // Only a figure the user typed is theirs; otherwise the floor uses the
    // approved allowance × nights (and the builder prefills it from `suggested`).
    ...(i.driverAllowance != null ? { driver_cost: round2(i.driverAllowance), driver_cost_is_override: true } : {}),
    ...(i.includeReturn != null ? { include_return: i.includeReturn } : {}),
    your_price: i.yourPrice != null ? round2(i.yourPrice) : null,
    pickup_date: i.pickupDate || null,
    ...(i.costingFlags ?? {}),
  };
}

// ---------------------------------------------------------------- adapter

const round2 = (n: number) => Math.round(n * 100) / 100;
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
/** Only https links to a real host are ever rendered. */
export const safeUrl = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  try { const u = new URL(s); return u.protocol === "https:" && u.hostname ? s : null; } catch { return null; }
};
const SOURCE_KINDS: SourceKind[] = ["official", "calculated", "company_actuals", "estimate", "user"];
const BANDS: Band[] = ["likely", "even", "less_likely"];
/** Band words come from the shared helper, so the builder and quote detail say the same thing. */
export const BAND_LABEL: Record<Band, string> = {
  likely: likelihoodLabel("rules", "likely") ?? "Likely",
  even: likelihoodLabel("rules", "even") ?? "Even chance",
  less_likely: likelihoodLabel("rules", "less_likely") ?? "Less likely",
};

function adaptLikelihood(v: unknown): Likelihood | null {
  const o = obj(v);
  if (!o) return null;
  if (o.level === "model") {
    const pct = num(o.pct);
    return pct == null ? null : { level: "model", pct: Math.max(0, Math.min(100, pct)) };
  }
  if (o.level !== "rules") return null;
  const band = BANDS.includes(o.band as Band) ? (o.band as Band) : null;
  return {
    level: "rules", band,
    label: band ? BAND_LABEL[band] : "Not enough data yet",
    outsideModelRange: o.outside_model_range === true,
  };
}

export function adaptAnalysis(raw: unknown): PricingAnalysis | null {
  const r = obj(raw);
  if (!r || r.success === false) return null;

  const cf = obj(r.cost_floor);
  const fx = obj(cf?.fixed_cost_per_km);
  const costFloor: CostFloor | null = cf && num(cf.total) != null ? {
    total: num(cf.total)!,
    perKm: num(cf.per_km),
    includeReturn: cf.include_return === true,
    perKmLabel: str(cf.per_km_label),
    kmDriven: num(cf.km_driven), distanceKm: num(cf.distance_km),
    returnLegAmount: num(cf.return_leg_amount),
    floorWithReturn: num(cf.floor_with_return),
    returnAvailable: cf.return_available !== false,
    lines: arr(cf.lines).map(obj).filter(Boolean).map((l) => {
      const s = obj(l!.source) || {};
      return {
        key: String(l!.key ?? ""),
        label: str(l!.label) || String(l!.key ?? ""),
        amount: num(l!.amount) ?? 0,
        source: {
          kind: SOURCE_KINDS.includes(s.kind as SourceKind) ? (s.kind as SourceKind) : "estimate",
          label: str(s.label) || "",
          url: safeUrl(s.url),
          asOf: str(s.as_of),
        },
        basis: str(l!.basis),
        editable: l!.editable === true,
        details: arr(l!.details).map(obj).filter(Boolean).map((d) => ({ label: String(d!.label ?? ""), value: String(d!.value ?? "") })),
        suggested: num(l!.suggested),
        nights: num(l!.nights),
        // Backend flag when it lands; until then: nights away, no approved rate, nothing typed.
        needsInput: l!.status === "needs_input"
          || (l!.key === "driver_allowance" && (num(l!.nights) ?? 0) >= 1 && num(l!.suggested) == null && (obj(l!.source)?.kind !== "user")),
        check: l!.status === "check",
      };
    }),
    fixedCostPerKm: fx && num(fx.value) != null ? {
      value: num(fx.value)!,
      source: fx.source === "company_actuals" ? "company_actuals" : "vehicle_default",
      trips: num(fx.trips),
      window: str(fx.window),
    } : null,
  } : null;

  const m = obj(r.market);
  const tier = (["platform", "company", "estimate"] as const).find((t) => t === m?.tier) ?? null;
  const market: Market | null = m ? {
    available: m.available === true && m.tier !== "none" && num(m.median) != null,
    p25: num(m.p25), median: num(m.median), p75: num(m.p75),
    n: num(m.n) ?? 0,
    tier,
    tierLabel: str(m.tier_label),
    // Belt and braces: an estimate tier is always an estimate, whatever the flag says.
    isEstimate: m.is_estimate === true || tier === "estimate",
    yourPosition: (["below", "within", "above"] as const).find((p) => p === m.your_position) ?? null,
    oneWayX2: m.legs_scaled === true || m.basis === "one_way_x2",
    basisLabel: str(m.basis_label) ?? str(m.basis_short),
    vehicleSpecific: m.vehicle_specific === true,
    vehicleName: str(m.vehicle_type) ?? str(m.vehicle_type_name) ?? (str(m.tier_label)?.match(/·\s*([^·]+?)\s+only\b/)?.[1] ?? null),
  } : null;

  const choices: Choice[] = arr(r.choices).map(obj).filter(Boolean).map((c) => ({
    key: c!.key as ChoiceKey,
    label: str(c!.label) || String(c!.key),
    price: num(c!.price) ?? 0,
    margin: num(c!.margin) ?? 0,
    marginPct: num(c!.margin_pct) ?? 0,
    // No evidence → the server sends recommendation null: then nothing is "Recommended".
    recommended: c!.recommended === true && !(obj(r.recommendation) === null && "recommendation" in r) && !(obj(r.recommendation) && obj(r.recommendation)!.key === null),
    summary: str(c!.summary),
    likelihood: adaptLikelihood(c!.likelihood),
    marginPctIfEmptyReturn: num(c!.margin_pct_if_empty_return),
  })).filter((c) => ["safe", "balanced", "stretch"].includes(c.key) && c.price > 0);

  const lk = obj(r.likelihood);
  const lm = obj(lk?.model);
  const lr = obj(lk?.rules);
  const th = obj(lr?.thresholds);
  const range = arr(lm?.range).map(num);
  const curve = arr(lm?.curve).map(obj).filter(Boolean)
    .map((p) => ({ price: num(p!.price), pct: num(p!.pct), expectedProfit: num(p!.expected_profit) }))
    .filter((p): p is CurvePoint => p.price != null && p.pct != null)
    .sort((a, b) => a.price - b.price);
  const model = lm && curve.length >= 2 ? {
    version: str(lm.version) || "",
    scope: str(lm.scope),
    nClosed: num(lm.n_closed) ?? 0,
    basisLabel: str(lm.basis_label) || "",
    range: (range.length === 2 && range[0] != null && range[1] != null ? [range[0], range[1]] : [curve[0].price, curve[curve.length - 1].price]) as [number, number],
    curve,
    best: obj(lm.best) && num(obj(lm.best)!.price) != null
      ? { price: num(obj(lm.best)!.price)!, pct: num(obj(lm.best)!.pct), expectedProfit: num(obj(lm.best)!.expected_profit) } : null,
  } : null;
  const likelihood: LikelihoodInfo | null = lk ? {
    // Model level only counts when there really is a curve to read.
    level: lk.level === "model" && model ? "model" : "rules",
    model,
    rules: lr ? {
      likelyMax: num(th?.likely_max),
      evenMax: num(th?.even_max),
      basis: arr(lr.basis).map(str).filter((s): s is string => !!s),
    } : null,
    reason: str(lk.reason),
    short: str(lk.short),
    headline: str(lk.headline),
  } : null;

  const cu = obj(r.customer);
  const acc = obj(cu?.acceptance);
  const pr = obj(cu?.payment_risk);
  const customer: CustomerEvidence | null = cu ? {
    id: num(cu.id), name: str(cu.name),
    acceptance: acc && num(acc.decided) != null ? {
      won: num(acc.won) ?? 0, decided: num(acc.decided) ?? 0, ratePct: num(acc.rate_pct),
      scope: acc.scope === "lane" ? "lane" : "all",
    } : null,
    laneAcceptance: obj(cu.lane_acceptance) && (num(obj(cu.lane_acceptance)!.decided) ?? 0) > 0 ? {
      won: num(obj(cu.lane_acceptance)!.won) ?? 0, decided: num(obj(cu.lane_acceptance)!.decided) ?? 0, ratePct: num(obj(cu.lane_acceptance)!.rate_pct),
    } : null,
    recentLaneQuotes: arr(cu.recent_lane_quotes).map(obj).filter(Boolean).map((q) => ({
      id: num(q!.id), number: str(q!.number), date: str(q!.date), price: num(q!.price) ?? 0, outcome: String(q!.outcome ?? "open"),
    })).slice(0, 5),
    paymentRisk: pr ? {
      band: (["low", "medium", "high", "unknown"] as const).find((b) => b === pr.band) ?? "unknown",
      label: str(pr.label) || "No payment history yet",
      basis: str(pr.basis),
      attention: pr.attention === true || pr.band === "medium" || pr.band === "high",
    } : null,
  } : null;

  return {
    version: str(r.version) || "pa-1",
    computedMs: num(r.computed_ms),
    missing: arr(r.missing).map(str).filter((s): s is string => !!s),
    targetMarginPct: num(r.target_margin_pct),
    costFloor,
    market,
    choices,
    likelihood,
    customer,
    reasoning: arr(r.reasoning).map(str).filter((s): s is string => !!s),
    reasoningItems: arr(r.reasoning_items).map(obj).filter(Boolean)
      .map((i) => ({ code: String(i!.code ?? ""), text: str(i!.text) || "" })).filter((i) => i.text),
    yourPrice: (() => {
      const y = obj(r.your_price);
      if (!y || num(y.price) == null) return null;
      return { price: num(y.price)!, margin: num(y.margin), marginPct: num(y.margin_pct), belowFloor: y.below_floor === true, likelihood: adaptLikelihood(y.likelihood) };
    })(),
    r5: !!str(lk?.headline),
    modelProgress: (() => {
      // Tolerant of the shapes the server may send (top level or under likelihood).
      const mp = obj(r.model_progress) ?? obj(lk?.model_progress);
      if (!mp) return null;
      const tier = obj(mp.company) ?? obj(mp.user) ?? mp;
      const won = num(tier.accepted ?? tier.won);
      const lost = num(tier.rejected ?? tier.lost);
      return { won, lost, wonNeeded: num(tier.accepted_needed ?? tier.won_needed ?? tier.needed) ?? 200, lostNeeded: num(tier.rejected_needed ?? tier.lost_needed ?? tier.needed) ?? 200 };
    })(),
    targetMarginSource: str(r.target_margin_source) ?? str(obj(r.target_margin)?.source),
    floorWithReturn: num(cf?.floor_with_return ?? r.floor_with_return),
    attention: arr(r.attention).map(obj).filter(Boolean).map((a) => ({ code: String(a!.code ?? ""), level: String(a!.level ?? "medium"), message: str(a!.message) || "" })).filter((a) => a.message),
    recommendation: obj(r.recommendation) ? { key: str(obj(r.recommendation)!.key), reason: str(obj(r.recommendation)!.reason), short: str(obj(r.recommendation)!.short) } : null,
    warnings: arr(r.warnings).map(obj).filter(Boolean).map((w) => ({ code: String(w!.code ?? ""), message: str(w!.message) || "" })).filter((w) => w.message),
  };
}
