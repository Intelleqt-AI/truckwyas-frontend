import { useEffect, useRef, useState } from "react";
import { postData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";
import { Loader } from "@/components/Loader";
import { Sparkles, AlertTriangle, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";

// ---- API contract (must match compute_pricing() in
// backend/core/services/quote_ai_pricing.py exactly). Every price, margin
// and win probability here is computed by the backend in Python; the LLM
// only extracts cited market figures, and each one is checked on its source
// page before it is used. ----
export type ItemKey = "fuel" | "tolls" | "driver_allowance" | "base_rate";
export type Choice = "ai" | "mine";
export type Verdict = "accurate" | "needs_adjustment" | "could_not_verify";
export interface AIPriceReviewReference { title: string; url: string; }
export interface AIPriceReviewItem {
  verdict: Verdict;
  // Only adjusted items can be switched between your price and the AI price.
  toggleable: boolean;
  current_value_zar: number;
  ai_value_zar: number;
  reason: string;
  verification: "verified" | "not_verified";
  verification_note: string;
  sources: AIPriceReviewReference[];
  detail: any;
}
export interface AIPriceCombination {
  choices: Record<ItemKey, Choice>;
  values: Record<ItemKey, number>;
  base_rate_per_km: number;
  pass_through_zar: number;
  price_zar: number;
  margin_zar: number;
  margin_pct: number;
  win_probability: number | null;
}
export interface AIWinModel {
  available: boolean;
  scope: "user" | "global" | null;
  training_samples: number;
  reason: string | null;
}
export interface AIPriceReviewResponse {
  success: boolean;
  usage_log_id?: number;
  verification_status?: "verified" | "partially_verified" | "unverified";
  confidence?: "high" | "medium" | "low";
  price_reasoning?: string | null;
  honesty_note?: string | null;
  distance_km?: number;
  legs?: number;
  cross_border_zar?: number;
  cost_breakdown?: Record<ItemKey, AIPriceReviewItem>;
  toggleable_items?: ItemKey[];
  // Every AI/yours combination, keyed by choiceKey(): the price is always
  // the sum of the chosen lines, so switching an item is a lookup, not a
  // client-side recalculation.
  combinations?: Record<string, AIPriceCombination>;
  default_choice_key?: string;
  references?: AIPriceReviewReference[];
  win_model?: AIWinModel;
  // One-way trips: the empty run home at market figures (display only).
  return_leg?: { fuel_zar: number; tolls_zar: number; driver_zar: number; total_zar: number; fuel_basis: string } | null;
  message?: string;
  error?: string;
}

const TOPICS: ItemKey[] = ["fuel", "tolls", "driver_allowance", "base_rate"];
// Same format as choice_key() in quote_ai_pricing.py.
export const choiceKey = (c: Partial<Record<ItemKey, Choice>>) => TOPICS.map((t) => `${t}=${c[t] ?? "mine"}`).join("|");
const ALL_MINE_KEY = choiceKey({});

const ITEM_LABELS: Record<string, string> = {
  fuel: "Fuel", tolls: "Tolls", driver_allowance: "Driver allowance", base_rate: "Base rate", cross_border: "Cross-border",
};
const rateText = (n?: number | null) => (n == null ? "—" : `R ${Number(n).toFixed(2)}/km`);
const perLitre = (n?: number | null) => (n == null ? "—" : `R ${Number(n).toFixed(2)}/L`);
const num = (n?: number | null) => (n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 }));

// What the panel says when there's no win probability to show.
const WIN_REASON_COPY: Record<string, string> = {
  not_enough_history: "Not enough closed quotes yet",
  no_market_rate: "No market rate for this lane yet",
  outside_training_range: "Model hasn't seen quotes like this yet",
  prediction_failed: "Couldn't score this quote",
};

interface AIPriceAnalysisPanelProps {
  // False while the form isn't ready — the panel stays mounted (keeping its
  // review, choices and auto-run flag) but renders nothing.
  active: boolean;
  // True only when `route` was calculated for the current inputs.
  routeReady: boolean;
  // The last route calculation failed (nothing to check against).
  routeError?: boolean;
  // Where the user fixes the company fuel price (a stale one is the usual
  // reason the AI adjusts fuel).
  onOpenFuelSettings?: () => void;
  routeData: any | null;
  route: any | null;
  total: number;
  chargeDistance: number;
  oneWayDistance: number;
  legs: number;
  tripType: string;
  durationMinutes: number | null;
  origin: string;
  destination: string;
  vehicleType: string;
  weightKg: number;
  customerId?: string | null;
  fuelCost: number;
  fuelLitres: number;
  fuelConsumption: number;
  fuelPricePerL: number;
  fuelType: string;
  fuelZone: string | null;
  tollCost: number;
  driverAllowance: number;
  crossBorderCost: number;
  baseRatePerKm: string;
  pickupDate?: string | null;
  benchmark: any;
  guard: any;
  billingBlocked: boolean;
  saving: boolean;
  quoteId?: number | null;
  // True while an applied AI price can still be undone ("Use actual price").
  hasAppliedAi: boolean;
  onApply: (review: AIPriceReviewResponse, key: string) => void;
  onCancelApplied: () => void;
  onSend: () => void;
  onSaveDraft: () => void;
}

export function AIPriceAnalysisPanel(props: AIPriceAnalysisPanelProps) {
  const {
    active, routeReady, routeError, onOpenFuelSettings, routeData, route, total, chargeDistance, oneWayDistance, legs, tripType, durationMinutes,
    origin, destination, vehicleType, weightKg, customerId, fuelCost, fuelLitres, fuelConsumption, fuelPricePerL,
    fuelType, fuelZone, tollCost, driverAllowance, crossBorderCost, baseRatePerKm, pickupDate,
    benchmark, guard, billingBlocked, saving, quoteId, hasAppliedAi,
    onApply, onCancelApplied, onSend, onSaveDraft,
  } = props;

  const aiAutoFiredRef = useRef(false);
  const reqIdRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [review, setReview] = useState<AIPriceReviewResponse | null>(null);
  const [reviewLaneSig, setReviewLaneSig] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<ItemKey, Choice>>({ fuel: "mine", tolls: "mine", driver_allowance: "mine", base_rate: "mine" });
  const [loading, setLoading] = useState(false);
  const [isRecheck, setIsRecheck] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Which item rows have their explanation (reason, plazas, sources) open.
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  // A request the server turned away (cooldown / rate limit): the last good
  // review stays on screen and this says why nothing new came back.
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewWinSig, setReviewWinSig] = useState<string | null>(null);

  // The trip itself — anything here changing means the AI checked a
  // different job. The four priced items are compared separately below,
  // because Apply legitimately moves them.
  const laneSig = JSON.stringify([
    origin, destination, vehicleType, chargeDistance, legs, durationMinutes,
    Math.round(fuelLitres * 100) / 100, crossBorderCost, fuelType, fuelZone,
  ]);
  // Inputs only the win probability depends on (the price doesn't).
  const winSig = JSON.stringify([customerId || null, pickupDate || null, weightKg]);

  const runReview = async (recheck: boolean) => {
    // Never on a route that belongs to previous inputs (a paid run on mixed data).
    if (!active || !routeReady || !routeData || total <= 0) return;
    const reqId = ++reqIdRef.current;
    setIsRecheck(recheck);
    setLoading(true);
    setElapsedSec(0);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    const sigAtRequest = laneSig;
    const winSigAtRequest = winSig;
    try {
      const res = await postData({
        url: "api/v1/quotes/ai-price-analysis/",
        data: {
          quote_id: quoteId || null,
          trigger_type: recheck ? "manual" : "auto",
          distance_km: chargeDistance,
          one_way_distance_km: oneWayDistance,
          legs, trip_type: tripType, duration_minutes: durationMinutes,
          origin, destination, vehicle_type: vehicleType, weight: weightKg,
          // Only used to score win probability — never sent to OpenAI.
          customer_id: customerId ? Number(customerId) : null,
          fuel_cost: fuelCost, toll_cost: tollCost, driver_cost: driverAllowance,
          cross_border_cost: crossBorderCost,
          // The exact (unrounded) litres and price behind fuelCost, so the
          // backend's market fuel figure rounds the same way this page does.
          fuel_usage_litres: fuelLitres,
          fuel_price_used: fuelPricePerL,
          fuel_consumption_l_per_100km: fuelConsumption,
          fuel_type: fuelType,
          fuel_zone: fuelZone,
          base_rate_per_km: Number(baseRatePerKm) || 0,
          market_rate: benchmark?.market_avg_rate || 0,
          pickup_date: pickupDate || null,
          route: {
            road_type: route?.road_type ?? null,
            terrain: route?.terrain ?? null,
            toll_breakdown: route?.toll_breakdown ?? null,
            traffic_status: route?.traffic_status ?? null,
            congested_km: route?.congested_km ?? null,
            country_codes: route?.country_codes ?? routeData?.countries ?? null,
            cross_border: !!routeData?.cross_border,
          },
        },
        // Two parallel searches + extraction + source-page checks, held by
        // the backend to a 55s run deadline — this waits a little longer.
        config: { timeout: 70000 },
      }).catch((err) => ({ __error: err }));
      if (reqId !== reqIdRef.current) return; // superseded by a newer call
      if (res?.__error?.status === 429 && review) {
        // Turned away before any OpenAI call: keep what's on screen.
        const d = res.__error.data || {};
        setNotice(d.message || d.detail || "Please wait a few seconds before re-checking.");
        return;
      }
      const valid = res && typeof res.success === "boolean" && (!res.success || (res.combinations && res.cost_breakdown));
      const next: AIPriceReviewResponse = valid
        ? res
        : { success: false, message: res?.__error?.status === 429
            ? (res.__error.data?.message || res.__error.data?.detail || "Please wait a few seconds, then Re-check with AI.")
            : "AI price verification is temporarily unavailable — please try again shortly." };
      setNotice(null);
      setReview(next);
      setReviewLaneSig(sigAtRequest);
      setReviewWinSig(winSigAtRequest);
      if (next.success && next.combinations && next.default_choice_key) {
        setChoices({ ...next.combinations[next.default_choice_key].choices });
      }
      setDetailsOpen(false);
      setOpenItems(new Set());
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      }
    }
  };

  // Auto-run exactly once, the first time the form is ready AND the route on
  // screen was calculated for the current inputs (not a previous address,
  // not the distance-only stub an edited quote starts with). The ref
  // enforces "only once"; the parent keeps this panel mounted through
  // not-ready flickers and only remounts it (new key) for a different quote
  // or "Clear & New Quote".
  useEffect(() => {
    if (!active || !routeReady || !routeData || total <= 0) return;
    if (aiAutoFiredRef.current) return;
    aiAutoFiredRef.current = true;
    runReview(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, routeReady, routeData, total]);

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  const cardS: React.CSSProperties = {
    background: "var(--bg-surface)",
    border: "1px solid color-mix(in srgb, var(--accent-primary) 35%, var(--border-subtle))",
    borderRadius: 4, marginBottom: 14,
  };
  const labelS: React.CSSProperties = { fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase" };
  const linkS: React.CSSProperties = { color: "var(--text-tertiary)", textDecoration: "underline" };
  const smallBtnS: React.CSSProperties = { fontSize: 12, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 4, padding: "5px 9px", cursor: "pointer", whiteSpace: "nowrap" };

  const ok = review?.success === true && !!review.combinations && !!review.cost_breakdown;
  const hasRunOnce = review !== null;
  const breakdown = (review?.cost_breakdown || {}) as Record<ItemKey, AIPriceReviewItem>;
  const combos = review?.combinations || {};
  const currentKey = choiceKey(choices);
  const combo: AIPriceCombination | undefined = combos[currentKey] || (review?.default_choice_key ? combos[review.default_choice_key] : undefined);
  const references = review?.references || [];
  const toggleable = review?.toggleable_items || [];

  // Which side (yours / AI) each line of the live quote is on right now.
  // null = it matches neither, i.e. someone changed it after the check.
  const currentLine: Record<ItemKey, number> = {
    fuel: fuelCost, tolls: tollCost, driver_allowance: driverAllowance, base_rate: Number(baseRatePerKm) || 0,
  };
  const sideOf = (t: ItemKey): Choice | null => {
    const item = breakdown[t];
    if (!item) return null;
    const mine = t === "base_rate" ? Number(item.detail?.your_rate_per_km) : item.current_value_zar;
    const ai = t === "base_rate" ? Number(item.detail?.ai_rate_per_km) : item.ai_value_zar;
    const tol = t === "fuel" ? 0.5 : t === "base_rate" ? 1e-6 : 0.005;
    if (Math.abs(currentLine[t] - mine) <= tol) return "mine";
    if (Math.abs(currentLine[t] - ai) <= tol) return "ai";
    return null;
  };
  const sides = ok ? TOPICS.map(sideOf) : [];
  const isStale = ok && (reviewLaneSig !== laneSig || sides.some((s) => s === null));
  const quoteKey = ok && !isStale ? choiceKey(Object.fromEntries(TOPICS.map((t, i) => [t, sides[i]!]))) : null;
  const needsApply = ok && !isStale && !!combo && quoteKey !== currentKey;

  const anyAiChosen = TOPICS.some((t) => choices[t] === "ai");
  const headlineLabel = !ok ? "" : anyAiChosen
    ? "Recommended price"
    : toggleable.length > 0
      ? "Your price — AI changes switched off"
      : review?.verification_status === "unverified"
        ? "Your price — AI couldn't verify market figures"
        : "Your price — no market-verified changes";

  const toggle = (t: ItemKey) => setChoices((c) => ({ ...c, [t]: c[t] === "ai" ? "mine" : "ai" }));

  const sourceLinks = (sources: AIPriceReviewReference[]) => sources.length > 0 && (
    <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 4 }}>
      {sources.map((s, i) => (
        <span key={s.url}>
          <a href={s.url} target="_blank" rel="noopener noreferrer" style={linkS}>{s.title}</a>
          {i < sources.length - 1 ? " · " : ""}
        </span>
      ))}
    </div>
  );

  // How each figure was built, shown under the amount.
  const yourSubLine = (t: ItemKey, d: any) => {
    if (t === "fuel") return `${perLitre(d.your_price_per_litre)} × ${num(d.litres)} L`;
    if (t === "base_rate") return `${rateText(d.your_rate_per_km)} × ${num(d.distance_km)} km`;
    if (t === "tolls" && (d.legs ?? 1) > 1) return `${formatCurrency(d.your_one_way_zar ?? 0)} one way × ${d.legs}`;
    return null;
  };
  const aiSubLine = (t: ItemKey, item: AIPriceReviewItem) => {
    const d = item.detail || {};
    if (item.verdict === "could_not_verify") return "your figure kept";
    if (t === "fuel") return `official ${d.zone ?? ""} ${perLitre(d.market_price_per_litre)} × ${num(d.litres)} L`;
    if (t === "tolls") return `published ${formatCurrency(d.market_one_way_zar ?? 0)} one way${(d.legs ?? 1) > 1 ? ` × ${d.legs}` : ""}`;
    if (t === "driver_allowance") {
      return `R ${Number(d.rate_per_day_zar).toFixed(2)}/day × ${d.days} day${d.days === 1 ? "" : "s"} (≈${d.hours_per_day} driving h/day)`;
    }
    if (t === "base_rate") {
      const band = `benchmark band ${rateText(d.market_low_per_km)} – ${rateText(d.market_high_per_km)}`;
      return item.toggleable ? `${rateText(d.ai_rate_per_km)} × ${num(d.distance_km)} km · ${band}` : band;
    }
    return null;
  };
  const verificationLine = (item: AIPriceReviewItem) => item.verification === "verified"
    ? <span style={{ color: "var(--status-success)" }}>checked on source page</span>
    : <span style={{ color: "var(--status-warning)" }}>not verified — {item.verification_note}</span>;

  const DETAIL_GRID = "minmax(110px, 1fr) minmax(130px, 1fr) minmax(160px, 1.2fr) minmax(110px, auto)";
  const priceCell = (amount: number, sub: React.ReactNode, tone: "chosen" | "plain" | "muted", extra?: React.ReactNode) => (
    <div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: tone === "chosen" ? 600 : 400,
        color: tone === "chosen" ? "var(--accent-primary)" : tone === "muted" ? "var(--text-tertiary)" : "var(--text-primary)",
      }}>
        {formatCurrency(amount)}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{sub}</div>}
      {extra && <div style={{ fontSize: 11, marginTop: 1 }}>{extra}</div>}
    </div>
  );

  // Base rate -> price -> margin, holding the chosen fuel/tolls/driver fixed.
  const scenarioRows = (() => {
    if (!ok || !combo) return [];
    const d = breakdown.base_rate?.detail || {};
    const candidates: { rate: number; label: string }[] = [
      { rate: d.market_low_per_km, label: "market low" },
      { rate: d.market_high_per_km, label: "market high" },
      { rate: d.your_rate_per_km, label: "yours" },
      { rate: combo.base_rate_per_km, label: "selected" },
    ].filter((r) => r.rate != null && Number(r.rate) > 0);
    const byRate = new Map<string, { rate: number; labels: string[] }>();
    for (const c of candidates) {
      const k = Number(c.rate).toFixed(2);
      const row = byRate.get(k) || { rate: Number(c.rate), labels: [] };
      row.labels.push(c.label);
      byRate.set(k, row);
    }
    return [...byRate.values()].sort((a, b) => a.rate - b.rate).map((r) => {
      const base = Math.round(chargeDistance * r.rate);
      const price = combo.pass_through_zar + base;
      return { ...r, price, margin: price > 0 ? (base / price) * 100 : 0, selected: r.labels.includes("selected") };
    });
  })();
  const showScenarios = scenarioRows.length > 1;

  const winModel = review?.win_model;
  // Scored for the client / pickup date / weight at check time — a change
  // there never leaves the old probability looking current.
  // Only matters when there is a probability to go stale.
  const winStale = reviewWinSig !== null && reviewWinSig !== winSig
    && !!winModel?.available && combo?.win_probability != null;
  const winP = winStale ? null : combo?.win_probability;
  const winCaption = winStale
    ? "Client, date or weight changed — Re-check to update"
    : winModel?.available && winP != null
      ? `${winModel.scope === "user" ? "Personal AI" : "Platform AI"} · ${winModel.training_samples} closed quotes`
      : WIN_REASON_COPY[winModel?.reason || ""] || WIN_REASON_COPY.not_enough_history;
  const fuelDetail = breakdown.fuel?.detail || {};
  const fuelSettingStale = ok && breakdown.fuel?.verdict === "needs_adjustment"
    && Number(fuelDetail.market_price_per_litre) >= Number(fuelDetail.your_price_per_litre) * 1.05;
  const crossBorder = review?.cross_border_zar ?? 0;
  const yourTotal = combos[ALL_MINE_KEY]?.price_zar;

  if (!active) return null;

  return (
    <div style={cardS}>
      {/* market rate — above the AI analysis itself, per spec */}
      {benchmark?.market_avg_rate ? (
        <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border-row)", fontSize: 12.5, color: "var(--text-tertiary)" }}>
          Market benchmark: <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{formatCurrency(benchmark.market_avg_rate)}</span> avg
          {benchmark.recommendation ? ` · ${benchmark.recommendation}` : ""}
        </div>
      ) : null}

      <div style={{ padding: "16px 18px" }}>
        {!hasRunOnce && loading && !isRecheck ? (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Sparkles size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>AI is reviewing this quote…</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>
                Checking today's official fuel price and this lane's benchmark, and searching the current toll tariffs and driver allowance — each figure is checked on its source page.
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <Loader size={16} />
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>{elapsedSec}s</span>
              </div>
            </div>
          </div>
        ) : !hasRunOnce ? (
          <div style={{ fontSize: 13, color: routeError ? "var(--status-warning)" : "var(--text-tertiary)" }}>
            {routeError
              ? "The route couldn't be calculated, so the AI check can't run yet — change an address or the vehicle to retry."
              : "Preparing AI price check…"}
          </div>
        ) : !ok ? (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: loading && isRecheck ? 0.5 : 1 }}>
            <AlertTriangle size={16} color="var(--status-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>AI analysis unavailable right now</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>
                {review?.message || "Couldn't complete AI price verification — you can still send or save this quote manually."}
              </div>
            </div>
          </div>
        ) : isStale ? (
          // Never show an old AI price as if it were current.
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: loading && isRecheck ? 0.5 : 1 }}>
            <AlertTriangle size={16} color="var(--status-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Quote changed after the AI check</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>
                Re-check with AI for a price that matches this route and these figures.
              </div>
            </div>
          </div>
        ) : combo && (
          <div style={{ opacity: loading && isRecheck ? 0.5 : 1, transition: "opacity 150ms ease" }}>
            {/* headline: price (click for details) | margin | win probability — one line */}
            <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                title="Show how this price was built"
                style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
              >
                <div style={labelS}>{headlineLabel}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, color: "var(--accent-primary)" }}>
                    {formatCurrency(combo.price_zar)}
                  </span>
                  {detailsOpen ? <ChevronUp size={16} color="var(--text-tertiary)" /> : <ChevronDown size={16} color="var(--text-tertiary)" />}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>Click for the full breakdown</div>
              </button>
              <div>
                <div style={labelS}>Margin</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, marginTop: 4 }}>{combo.margin_pct}%</div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
                  {formatCurrency(combo.margin_zar)} after fuel, tolls &amp; driver
                </div>
              </div>
              <div>
                <div style={labelS}>Win probability</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, marginTop: 4 }}>
                  {winModel?.available && winP != null ? `${Math.round(winP * 100)}%` : "—"}
                </div>
                <div style={{ fontSize: 11.5, color: winStale ? "var(--status-warning)" : "var(--text-tertiary)" }}>{winCaption}</div>
              </div>
            </div>

            {review!.price_reasoning && (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 10, maxWidth: 640 }}>{review!.price_reasoning}</div>
            )}
            {review!.honesty_note && (
              <div style={{ fontSize: 12.5, color: "var(--status-warning)", marginTop: 4, maxWidth: 640 }}>{review!.honesty_note}</div>
            )}
            {fuelSettingStale && (
              <div style={{ fontSize: 12.5, color: "var(--status-warning)", marginTop: 4, maxWidth: 640 }}>
                Your company fuel price ({perLitre(fuelDetail.your_price_per_litre)}) is below today's official
                {" "}{perLitre(fuelDetail.market_price_per_litre)} — every quote is under-priced on fuel until it's updated.
                {onOpenFuelSettings && (
                  <>{" "}<button type="button" onClick={onOpenFuelSettings}
                    style={{ fontSize: 12.5, background: "transparent", border: "none", padding: 0, color: "var(--accent-primary)", textDecoration: "underline", cursor: "pointer" }}>
                    Update it in Settings
                  </button></>
                )}
              </div>
            )}

            {/* base rate -> price -> margin */}
            {showScenarios && (
              <div style={{ marginTop: 12, overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 360 }}>
                  <thead>
                    <tr>
                      {["Base rate", "Price", "Margin", ""].map((h) => (
                        <th key={h} style={{ ...labelS, textAlign: "left", padding: "4px 14px 4px 0", fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioRows.map((s) => (
                      <tr key={s.rate} style={{ fontWeight: s.selected ? 600 : 400, color: s.selected ? "var(--accent-primary)" : "var(--text-primary)" }}>
                        <td style={{ padding: "3px 14px 3px 0", fontFamily: "var(--font-mono)" }}>{rateText(s.rate)}</td>
                        <td style={{ padding: "3px 14px 3px 0", fontFamily: "var(--font-mono)" }}>{formatCurrency(s.price)}</td>
                        <td style={{ padding: "3px 14px 3px 0", fontFamily: "var(--font-mono)" }}>{s.margin.toFixed(1)}%</td>
                        <td style={{ padding: "3px 0", fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 400 }}>{s.labels.join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* in-depth: your figure vs the AI's, per item, with citations */}
            {detailsOpen && (
              <div style={{ marginTop: 12, overflowX: "auto" }}>
                <div style={{ display: "grid", gap: 6, minWidth: 560 }}>
                  <div style={{ display: "grid", gridTemplateColumns: DETAIL_GRID, gap: 12, padding: "0 12px" }}>
                    {["Item", "Your price", "AI analysis price", "Action"].map((h, i) => (
                      <span key={h} style={{ ...labelS, textAlign: i === 3 ? "right" : "left" }}>{h}</span>
                    ))}
                  </div>
                  {TOPICS.filter((t) => breakdown[t]).map((t) => {
                    const item = breakdown[t];
                    const d = item.detail || {};
                    const choice = choices[t];
                    const open = openItems.has(t);
                    const toggleOpen = () => setOpenItems((prev) => {
                      const next = new Set(prev);
                      if (next.has(t)) next.delete(t); else next.add(t);
                      return next;
                    });
                    return (
                      <div key={t} style={{ padding: "9px 12px", background: "var(--bg-surface-hover)", borderRadius: 4 }}>
                        <div style={{ display: "grid", gridTemplateColumns: DETAIL_GRID, gap: 12, alignItems: "start" }}>
                          <button type="button" onClick={toggleOpen} aria-expanded={open}
                            title={open ? "Hide details" : "Show how this was checked"}
                            style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", padding: 0,
                              cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                            {open ? <ChevronDown size={14} color="var(--text-tertiary)" /> : <ChevronRight size={14} color="var(--text-tertiary)" />}
                            {ITEM_LABELS[t]}
                          </button>
                          {priceCell(item.current_value_zar, yourSubLine(t, d), item.toggleable && choice === "mine" ? "chosen" : "plain")}
                          {priceCell(item.ai_value_zar, aiSubLine(t, item), item.toggleable ? (choice === "ai" ? "chosen" : "muted") : "plain", verificationLine(item))}
                          <div style={{ textAlign: "right" }}>
                            {item.toggleable ? (
                              <button type="button" onClick={() => toggle(t)} style={smallBtnS}>
                                {choice === "ai" ? "Use my price" : "Use AI price"}
                              </button>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>—</span>
                            )}
                          </div>
                        </div>
                        {open && (
                        <div style={{ marginTop: 8, marginLeft: 6, paddingLeft: 12, borderLeft: "2px solid var(--border-subtle)" }}>
                        {t === "tolls" && Array.isArray(d.plazas) && d.plazas.length > 0 && (
                          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", display: "grid", gap: 2 }}>
                            {d.toll_class && <div>{d.toll_class}, one way:</div>}
                            {d.plazas.map((p: any) => (
                              <div key={p.plaza} style={{ fontFamily: "var(--font-mono)" }}>
                                {p.plaza}: yours {p.your_tariff_zar != null ? formatCurrency(p.your_tariff_zar) : "—"} · published{" "}
                                {p.market_tariff_zar != null ? formatCurrency(p.market_tariff_zar) : "—"}
                                <span style={{ fontFamily: "inherit", color: p.verified ? "var(--status-success)" : "var(--status-warning)" }}>
                                  {" "}· {p.verified ? "confirmed on source" : p.note}
                                </span>
                              </div>
                            ))}
                            {Array.isArray(d.other_plazas_mentioned) && d.other_plazas_mentioned.length > 0 && (
                              <div>Also mentioned, not on this route (not priced): {d.other_plazas_mentioned.join(", ")}</div>
                            )}
                          </div>
                        )}
                        {item.reason && (
                          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 6 }}>{item.reason}</div>
                        )}
                        {sourceLinks(item.sources || [])}
                        </div>
                        )}
                      </div>
                    );
                  })}
                  {crossBorder > 0 && (
                    <div style={{ padding: "9px 12px", background: "var(--bg-surface-hover)", borderRadius: 4 }}>
                      <div style={{ display: "grid", gridTemplateColumns: DETAIL_GRID, gap: 12, alignItems: "start" }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{ITEM_LABELS.cross_border}</span>
                        {priceCell(crossBorder, null, "plain")}
                        {priceCell(crossBorder, "not AI-checked", "plain")}
                        <div style={{ textAlign: "right", fontSize: 12, color: "var(--text-tertiary)" }}>—</div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: DETAIL_GRID, gap: 12, padding: "9px 12px", borderTop: "1px solid var(--border-subtle)" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Total</span>
                    {priceCell(yourTotal ?? 0, "your figures", "plain")}
                    {priceCell(combo.price_zar, anyAiChosen ? "= recommended price" : "= your price", "chosen")}
                    <span />
                  </div>
                </div>
                {review!.return_leg && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 10, padding: "8px 12px", border: "1px dashed var(--border-subtle)", borderRadius: 4 }}>
                    One-way trip: if the truck comes back empty, the return costs about{" "}
                    <b style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(review!.return_leg.total_zar)}</b>{" "}
                    (fuel {formatCurrency(review!.return_leg.fuel_zar)} · tolls {formatCurrency(review!.return_leg.tolls_zar)} ·
                    driver {formatCurrency(review!.return_leg.driver_zar)}). It isn't in the price — the base rate has to cover it.
                  </div>
                )}
                {references.length > 0 && (
                  <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 8 }}>
                    Sources:{" "}
                    {references.map((ref, i) => (
                      <span key={ref.url}>
                        <a href={ref.url} target="_blank" rel="noopener noreferrer" style={linkS}>{ref.title}</a>
                        {i < references.length - 1 ? " · " : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* revenue guard — unchanged */}
      {guard && guard.risk_level && guard.risk_level !== "SAFE" && (
        <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border-row)", background: guard.risk_level === "AT_RISK" ? "var(--status-danger-bg)" : "var(--status-warning-bg)", fontSize: 13 }}>
          <b style={{ color: guard.risk_level === "AT_RISK" ? "var(--status-danger)" : "var(--status-warning)" }}>{guard.risk_level === "AT_RISK" ? "At risk" : "Caution"}</b>
          <span style={{ color: "var(--text-secondary)" }}> · {(guard.explanations || guard.warnings || [])[0]}{guard.suggestions?.[0] ? ` — ${guard.suggestions[0]}` : ""}</span>
        </div>
      )}

      {notice && (
        <div style={{ padding: "8px 18px", borderTop: "1px solid var(--border-row)", fontSize: 12.5, color: "var(--status-warning)" }}>{notice}</div>
      )}

      {/* actions */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "14px 18px", borderTop: "1px solid var(--border-row)", flexWrap: "wrap" }}>
        {needsApply && (
          <button onClick={() => onApply(review!, currentKey)} style={{ fontSize: 14, fontWeight: 500, background: "transparent", border: "1px solid var(--accent-primary)", color: "var(--accent-primary)", borderRadius: 4, padding: "9px 14px", cursor: "pointer" }}>Apply recommended</button>
        )}
        {hasAppliedAi && ok && !isStale && !needsApply && (
          <span style={{ fontSize: 13, color: "var(--status-success)" }}>AI price applied</span>
        )}
        {hasAppliedAi && (
          <button onClick={onCancelApplied} style={{ fontSize: 14, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 4, padding: "10px 16px", cursor: "pointer" }}>Use actual price</button>
        )}
        {hasRunOnce && !loading && (
          <button onClick={() => runReview(true)} disabled={billingBlocked || !routeReady}
            title={routeReady ? undefined : "Waiting for the route for these inputs"}
            style={{ fontSize: 13, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 4, padding: "8px 12px", cursor: routeReady ? "pointer" : "default", opacity: routeReady ? 1 : 0.6 }}>
            {routeReady ? "Re-check with AI" : "Waiting for route…"}
          </button>
        )}
        {hasRunOnce && loading && isRecheck && (
          <button disabled style={{ fontSize: 13, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-tertiary)", borderRadius: 4, padding: "8px 12px" }}>Re-checking…</button>
        )}
        <button onClick={onSend} disabled={saving} style={{ fontSize: 14, fontWeight: 500, background: "var(--accent-primary)", color: "var(--btn-action-color)", border: "none", borderRadius: 4, padding: "10px 16px", cursor: "pointer" }}>Send quote to client</button>
        <button onClick={onSaveDraft} disabled={saving} style={{ fontSize: 14, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 4, padding: "10px 16px", cursor: "pointer" }}>Save as draft</button>
      </div>
    </div>
  );
}
