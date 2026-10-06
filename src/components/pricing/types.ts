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
}
export interface CostFloor {
  total: number; perKm: number | null; includeReturn: boolean;
  /** Whether the empty-return toggle means anything for this trip. */
  returnAvailable: boolean;
  lines: FloorLine[];
  fixedCostPerKm: { value: number; source: "company_actuals" | "vehicle_default"; trips: number | null; window: string | null } | null;
}
export interface Market {
  available: boolean; p25: number | null; median: number | null; p75: number | null; n: number;
  tier: MarketTier | null; tierLabel: string | null; isEstimate: boolean; yourPosition: Position | null;
}
export type Likelihood =
  | { level: "model"; pct: number }
  /** band null: not enough data to judge. */
  | { level: "rules"; band: Band | null; label: string; outsideModelRange: boolean };
export interface Choice {
  key: ChoiceKey; label: string; price: number; margin: number; marginPct: number;
  recommended: boolean; summary: string | null; likelihood: Likelihood | null;
}
export interface CurvePoint { price: number; pct: number; expectedProfit: number | null }
export interface LikelihoodInfo {
  level: "model" | "rules";
  model: { version: string; scope: string | null; nClosed: number; basisLabel: string; range: [number, number]; curve: CurvePoint[] } | null;
  rules: { likelyMax: number | null; evenMax: number | null; basis: string[] } | null;
  reason: string | null;
}
export interface LaneQuote { id: number | null; number: string | null; date: string | null; price: number; outcome: "accepted" | "rejected" | "open" | "expired" | string }
export interface CustomerEvidence {
  id: number | null; name: string | null;
  acceptance: { won: number; decided: number; ratePct: number | null } | null;
  recentLaneQuotes: LaneQuote[];
  paymentRisk: { band: "low" | "medium" | "high" | "unknown"; label: string; basis: string | null } | null;
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
  warnings: { code: string; message: string }[];
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
    toll_cost: round2(i.tollCost),
    route: { toll_breakdown: i.routePlazas, cross_border: i.isInternational, country_codes: i.countryCodes },
    cross_border_cost: round2(i.crossBorderCost),
    // Only a figure the user typed is theirs; otherwise the floor uses the
    // approved allowance × nights (and the builder prefills it from `suggested`).
    ...(i.driverAllowance != null ? { driver_cost: round2(i.driverAllowance), driver_cost_is_override: true } : {}),
    ...(i.includeReturn != null ? { include_return: i.includeReturn } : {}),
    your_price: i.yourPrice != null ? round2(i.yourPrice) : null,
    pickup_date: i.pickupDate || null,
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
    label: band ? BAND_LABEL[band] : "Not enough data to judge",
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
  } : null;

  const choices: Choice[] = arr(r.choices).map(obj).filter(Boolean).map((c) => ({
    key: c!.key as ChoiceKey,
    label: str(c!.label) || String(c!.key),
    price: num(c!.price) ?? 0,
    margin: num(c!.margin) ?? 0,
    marginPct: num(c!.margin_pct) ?? 0,
    recommended: c!.recommended === true,
    summary: str(c!.summary),
    likelihood: adaptLikelihood(c!.likelihood),
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
  } : null;

  const cu = obj(r.customer);
  const acc = obj(cu?.acceptance);
  const pr = obj(cu?.payment_risk);
  const customer: CustomerEvidence | null = cu ? {
    id: num(cu.id), name: str(cu.name),
    acceptance: acc && num(acc.decided) != null ? {
      won: num(acc.won) ?? 0, decided: num(acc.decided) ?? 0, ratePct: num(acc.rate_pct),
    } : null,
    recentLaneQuotes: arr(cu.recent_lane_quotes).map(obj).filter(Boolean).map((q) => ({
      id: num(q!.id), number: str(q!.number), date: str(q!.date), price: num(q!.price) ?? 0, outcome: String(q!.outcome ?? "open"),
    })).slice(0, 5),
    paymentRisk: pr ? {
      band: (["low", "medium", "high", "unknown"] as const).find((b) => b === pr.band) ?? "unknown",
      label: str(pr.label) || "No payment history yet",
      basis: str(pr.basis),
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
    warnings: arr(r.warnings).map(obj).filter(Boolean).map((w) => ({ code: String(w!.code ?? ""), message: str(w!.message) || "" })).filter((w) => w.message),
  };
}
