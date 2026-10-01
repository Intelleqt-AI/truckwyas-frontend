import { useEffect, useRef, useState } from "react";
import { postData } from "@/lib/Api";
import { formatCurrency, formatMoney, formatNumber, formatPercent, MISSING } from "@/lib/formatters";
import { Loader } from "@/components/Loader";
import { InfoTip } from "@/components/ui/InfoTip";
import { StatusChip } from "@/components/ui/StatusChip";
import { ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import "./ai-price-analysis.css";

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
// en-ZA figures from the shared formatters ("R 21,50/L", "1 234,5").
const rateText = (n?: number | null) => (n == null ? MISSING : `${formatMoney(Number(n))}/km`);
const perLitre = (n?: number | null) => (n == null ? MISSING : `${formatMoney(Number(n))}/L`);
const num = (n?: number | null) => (n == null ? MISSING : formatNumber(Number(n), { maximumFractionDigits: 1 }));

// What the panel says when there's no win probability to show.
const WIN_REASON_COPY: Record<string, string> = {
  not_enough_history: "Not enough closed quotes yet",
  no_market_rate: "No market rate for this lane yet",
  outside_training_range: "Model hasn't seen quotes like this yet",
  prediction_failed: "Couldn't score this quote",
};

// One source link drawn as the site's own favicon (fetched from the site
// itself, no third-party favicon service). Falls back to the site's initial
// when there is none, including one that "loads" as an empty image.
function SourceLogo({ source }: { source: AIPriceReviewReference }) {
  const [failed, setFailed] = useState(false);
  let host = "";
  try { host = new URL(source.url).hostname; } catch { /* not a URL: initial only */ }
  const name = source.title || host || source.url;
  return (
    <a className="aip-src" href={source.url} target="_blank" rel="noopener noreferrer"
      title={name} aria-label={`${name} (opens in a new tab)`}>
      {host && !failed
        ? <img src={`https://${host}/favicon.ico`} alt="" width={16} height={16} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}
            onLoad={(e) => { const i = e.currentTarget; if (!i.naturalWidth || !i.naturalHeight) setFailed(true); }} />
        : <span aria-hidden="true">{(host.replace(/^www\./, "") || name).charAt(0).toUpperCase()}</span>}
    </a>
  );
}

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
  quoteId?: number | null;
  // True while an applied AI price can still be undone ("Use actual price").
  hasAppliedAi: boolean;
  onApply: (review: AIPriceReviewResponse, key: string) => void;
  onCancelApplied: () => void;
}

export function AIPriceAnalysisPanel(props: AIPriceAnalysisPanelProps) {
  const {
    active, routeReady, routeError, onOpenFuelSettings, routeData, route, total, chargeDistance, oneWayDistance, legs, tripType, durationMinutes,
    origin, destination, vehicleType, weightKg, customerId, fuelCost, fuelLitres, fuelConsumption, fuelPricePerL,
    fuelType, fuelZone, tollCost, driverAllowance, crossBorderCost, baseRatePerKm, pickupDate,
    benchmark, guard, billingBlocked, quoteId, hasAppliedAi,
    onApply, onCancelApplied,
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
            : "The AI price check is unavailable. Try again shortly." };
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
  // Label + one note under the headline price (no sentence restating it).
  const headlineLabel = anyAiChosen ? "Recommended price" : "Your price";
  const headlineNote = !ok ? "" : anyAiChosen
    ? "With the AI figures you picked"
    : toggleable.length > 0
      ? "AI changes switched off"
      : review?.verification_status === "unverified"
        ? "Market figures couldn't be verified"
        : "No market changes needed";

  const toggle = (t: ItemKey) => setChoices((c) => ({ ...c, [t]: c[t] === "ai" ? "mine" : "ai" }));

  // Sources as their site logos; the name is the tooltip and the label.
  const sourceLinks = (sources: AIPriceReviewReference[], lead?: string) => sources.length > 0 && (
    <div className="aip-sources">
      {lead && <span>{lead}</span>}
      {sources.map((s) => <SourceLogo key={s.url} source={s} />)}
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
    if (item.verdict === "could_not_verify") return "Your figure kept";
    if (t === "fuel") return `Official ${d.zone ? `${String(d.zone).toLowerCase()} ` : ""}${perLitre(d.market_price_per_litre)} × ${num(d.litres)} L`;
    if (t === "tolls") return `Published ${formatCurrency(d.market_one_way_zar ?? 0)} one way${(d.legs ?? 1) > 1 ? ` × ${d.legs}` : ""}`;
    if (t === "driver_allowance") {
      return `${formatMoney(Number(d.rate_per_day_zar))}/day × ${d.days} day${d.days === 1 ? "" : "s"} (about ${num(d.hours_per_day)} driving h a day)`;
    }
    if (t === "base_rate") {
      const band = `Benchmark ${rateText(d.market_low_per_km)} to ${rateText(d.market_high_per_km)}`;
      return item.toggleable ? `${rateText(d.ai_rate_per_km)} × ${num(d.distance_km)} km · ${band}` : band;
    }
    return null;
  };
  const verificationLine = (item: AIPriceReviewItem) => item.verification === "verified"
    ? <div className="aip-check"><StatusChip tone="success" size="sm" label="Verified on source" /></div>
    : (
      <div className="aip-check">
        <StatusChip tone="warning" size="sm" label="Not verified" />
        {item.verification_note && <span className="aip-sub" style={{ marginTop: 0 }}>{item.verification_note}</span>}
      </div>
    );

  const amount = (value: number, tone: "chosen" | "plain" | "muted" = "plain") => (
    <div className={`aip-amt${tone === "chosen" ? " is-chosen" : tone === "muted" ? " is-muted" : ""}`}>{formatCurrency(value)}</div>
  );

  // Base rate -> price -> margin, holding the chosen fuel/tolls/driver fixed.
  const scenarioRows = (() => {
    if (!ok || !combo) return [];
    const d = breakdown.base_rate?.detail || {};
    const candidates: { rate: number; label: string }[] = [
      { rate: d.market_low_per_km, label: "Market low" },
      { rate: d.market_high_per_km, label: "Market high" },
      { rate: d.your_rate_per_km, label: "Yours" },
      { rate: combo.base_rate_per_km, label: "Selected" },
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
      return { ...r, price, margin: price > 0 ? (base / price) * 100 : 0, selected: r.labels.includes("Selected") };
    });
  })();
  const showScenarios = scenarioRows.length > 1;

  const winModel = review?.win_model;
  // Scored for the client / pickup date / weight at check time: a change
  // there never leaves the old probability looking current.
  // Only matters when there is a probability to go stale.
  const winStale = reviewWinSig !== null && reviewWinSig !== winSig
    && !!winModel?.available && combo?.win_probability != null;
  const winP = winStale ? null : combo?.win_probability;
  const winCaption = winStale
    ? "Client, date or weight changed. Re-check to update."
    : winModel?.available && winP != null
      ? `${winModel.scope === "user" ? "From your quotes" : "From platform quotes"} · ${formatNumber(winModel.training_samples, { maximumFractionDigits: 0 })} closed`
      : WIN_REASON_COPY[winModel?.reason || ""] || WIN_REASON_COPY.not_enough_history;
  const fuelDetail = breakdown.fuel?.detail || {};
  const fuelSettingStale = ok && breakdown.fuel?.verdict === "needs_adjustment"
    && Number(fuelDetail.market_price_per_litre) >= Number(fuelDetail.your_price_per_litre) * 1.05;
  const crossBorder = review?.cross_border_zar ?? 0;
  const yourTotal = combos[ALL_MINE_KEY]?.price_zar;

  // One chip for how much of the review was checked on its source pages.
  const verifyChip = !ok || isStale ? null
    : review?.verification_status === "verified" ? <StatusChip tone="success" label="Verified" />
    : review?.verification_status === "partially_verified" ? <StatusChip tone="warning" label="Partly verified" />
    : <StatusChip tone="neutral" label="Not verified" />;
  const busy = loading && isRecheck;
  const guardLine = guard ? [(guard.explanations || guard.warnings || [])[0], guard.suggestions?.[0]].filter(Boolean).join(". ") : "";
  const showFoot = needsApply || hasAppliedAi;

  if (!active) return null;

  return (
    <section className="tw-card tw-card--flush aip" aria-labelledby="aip-title">
      <div className="aip__head">
        <div className="tw-card__titles">
          <h2 id="aip-title" className="tw-card__title">
            AI price check
            <InfoTip label="How the AI price check works">
              Checks today's official fuel price, this lane's benchmark, current toll tariffs and the driver allowance. Each figure is checked on its source page. Prices, margins and win chance are calculated by TruckWys, not the AI.
            </InfoTip>
          </h2>
          <p className="tw-card__sub">Fuel, tolls, driver and rate against the market</p>
        </div>
        {hasRunOnce && (
          <div className="aip__tools">
            {verifyChip}
            <button type="button" className="tw-btn tw-btn--sm" onClick={() => runReview(true)}
              disabled={loading || billingBlocked || !routeReady}
              title={routeReady ? undefined : "Waiting for the route for these inputs"}>
              {loading ? "Checking…" : routeReady ? "Re-check" : "Waiting for route…"}
            </button>
          </div>
        )}
      </div>

      <div className={`aip__body${busy ? " is-busy" : ""}`}>
        {!hasRunOnce && loading && !isRecheck ? (
          <div className="aip-msg" aria-live="polite">
            <Loader size={20} />
            <div>
              <p className="aip-msg__title">Checking market prices</p>
              <p className="aip-msg__text">Fuel, tolls and driver allowance, each on its source page. <span className="aip-msg__time">{elapsedSec} s</span></p>
            </div>
          </div>
        ) : !hasRunOnce ? (
          <p className={`aip-note${routeError ? " aip-note--warn" : " aip-note--muted"}`}>
            {routeError
              ? "The route couldn't be calculated. Change an address or the truck to retry."
              : "Preparing the price check…"}
          </p>
        ) : !ok ? (
          <div className="aip-msg">
            <div>
              <p className="aip-msg__title">Price check unavailable</p>
              <p className="aip-msg__text">{review?.message || "You can still save or send this quote."}</p>
            </div>
          </div>
        ) : isStale ? (
          // Never show an old AI price as if it were current.
          <div className="aip-msg">
            <div>
              <p className="aip-msg__title">Quote changed after the check</p>
              <p className="aip-msg__text">Re-check for a price that matches this route and these figures.</p>
            </div>
          </div>
        ) : combo && (
          <>
            {benchmark?.market_avg_rate ? (
              <p className="aip-note aip-note--muted" style={{ marginBottom: 12 }}>
                Market benchmark <span className="aip-note__num">{formatCurrency(benchmark.market_avg_rate)}</span> average
                {benchmark.recommendation ? ` · ${benchmark.recommendation}` : ""}
              </p>
            ) : null}

            <div className="aip-figs">
              <div className="aip-fig">
                <div className="aip-fig__label">{headlineLabel}</div>
                <div className="aip-fig__value">{formatCurrency(combo.price_zar)}</div>
                <div className="aip-fig__note">{headlineNote}</div>
              </div>
              <div className="aip-fig">
                <div className="aip-fig__label">Margin</div>
                <div className="aip-fig__value">{formatPercent(combo.margin_pct)}</div>
                <div className="aip-fig__note">{formatCurrency(combo.margin_zar)} after fuel, tolls and driver</div>
              </div>
              <div className="aip-fig">
                <div className="aip-fig__label">Win chance</div>
                <div className="aip-fig__value">{winModel?.available && winP != null ? formatPercent(winP * 100, 0) : MISSING}</div>
                <div className={`aip-fig__note${winStale ? " is-warn" : ""}`}>{winCaption}</div>
              </div>
            </div>

            {(review!.price_reasoning || review!.honesty_note || fuelSettingStale) && (
              <div className="aip-notes">
                {review!.price_reasoning && <p className="aip-note">{review!.price_reasoning}</p>}
                {review!.honesty_note && <p className="aip-note aip-note--warn">{review!.honesty_note}</p>}
                {fuelSettingStale && (
                  <p className="aip-note aip-note--warn">
                    Your fuel price ({perLitre(fuelDetail.your_price_per_litre)}) is below today's official {perLitre(fuelDetail.market_price_per_litre)}, so every quote is under-priced on fuel.
                    {onOpenFuelSettings && <>{" "}<button type="button" className="aip-link" onClick={onOpenFuelSettings}>Update it in settings</button></>}
                  </p>
                )}
              </div>
            )}

            {/* base rate -> price -> margin */}
            {showScenarios && (
              <div className="aip-scroll">
                <table className="aip-table aip-table--scen">
                  <thead>
                    <tr><th>Base rate</th><th className="is-end">Price</th><th className="is-end">Margin</th><th /></tr>
                  </thead>
                  <tbody>
                    {scenarioRows.map((s) => (
                      <tr key={s.rate} className={s.selected ? "is-selected" : undefined}>
                        <td className="is-num">{rateText(s.rate)}</td>
                        <td className="is-num is-end">{formatCurrency(s.price)}</td>
                        <td className="is-num is-end">{formatPercent(s.margin)}</td>
                        <td className="is-muted" style={{ fontWeight: 400 }}>{s.labels.join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button type="button" className="aip-toggle" onClick={() => setDetailsOpen((v) => !v)} aria-expanded={detailsOpen}>
              {detailsOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
              {detailsOpen ? "Hide breakdown" : "Show breakdown"}
            </button>

            {/* in-depth: your figure vs the AI's, per item, with citations */}
            {detailsOpen && (
              <>
                <div className="aip-scroll" style={{ marginTop: 12 }}>
                  <table className="aip-table aip-table--items">
                    <thead>
                      <tr><th>Item</th><th>Your price</th><th>AI price</th><th className="is-end" /></tr>
                    </thead>
                    <tbody>
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
                        const yourSub = yourSubLine(t, d);
                        const aiSub = aiSubLine(t, item);
                        const hasMore = (t === "tolls" && Array.isArray(d.plazas) && d.plazas.length > 0) || !!item.reason || (item.sources || []).length > 0;
                        return [
                          <tr key={t}>
                            <td>
                              <button type="button" className="aip-item" onClick={toggleOpen} aria-expanded={open} disabled={!hasMore}
                                style={hasMore ? undefined : { cursor: "default" }}
                                title={hasMore ? (open ? "Hide details" : "Show how this was checked") : undefined}>
                                {hasMore && (open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />)}
                                {ITEM_LABELS[t]}
                              </button>
                            </td>
                            <td>
                              {amount(item.current_value_zar, item.toggleable && choice === "mine" ? "chosen" : "plain")}
                              {yourSub && <div className="aip-sub">{yourSub}</div>}
                            </td>
                            <td>
                              {amount(item.ai_value_zar, item.toggleable ? (choice === "ai" ? "chosen" : "muted") : "plain")}
                              {aiSub && <div className="aip-sub">{aiSub}</div>}
                              {verificationLine(item)}
                            </td>
                            <td className="is-end">
                              {item.toggleable && (
                                <button type="button" className="tw-btn tw-btn--sm" onClick={() => toggle(t)}>
                                  {choice === "ai" ? "Use mine" : "Use AI"}
                                </button>
                              )}
                            </td>
                          </tr>,
                          open && hasMore && (
                            <tr key={`${t}-more`} className="aip-more">
                              <td colSpan={4}>
                                <div className="aip-more__body">
                                  {t === "tolls" && Array.isArray(d.plazas) && d.plazas.length > 0 && (
                                    <>
                                      {d.toll_class && <div className="aip-plaza">{d.toll_class}, one way</div>}
                                      {d.plazas.map((p: any) => (
                                        <div key={p.plaza} className="aip-plaza">
                                          {p.plaza}: yours {p.your_tariff_zar != null ? formatCurrency(p.your_tariff_zar) : MISSING} · published{" "}
                                          {p.market_tariff_zar != null ? formatCurrency(p.market_tariff_zar) : MISSING}
                                          {" · "}
                                          <span style={{ color: p.verified ? "var(--status-success-text)" : "var(--status-warning-text)" }}>
                                            {p.verified ? "confirmed on source" : p.note}
                                          </span>
                                        </div>
                                      ))}
                                      {Array.isArray(d.other_plazas_mentioned) && d.other_plazas_mentioned.length > 0 && (
                                        <div className="aip-plaza">Also mentioned, not on this route (not priced): {d.other_plazas_mentioned.join(", ")}</div>
                                      )}
                                    </>
                                  )}
                                  {item.reason && <p className="aip-note">{item.reason}</p>}
                                  {sourceLinks(item.sources || [], "Sources")}
                                </div>
                              </td>
                            </tr>
                          ),
                        ];
                      })}
                      {crossBorder > 0 && (
                        <tr>
                          <td style={{ fontWeight: 500 }}>{ITEM_LABELS.cross_border}</td>
                          <td>{amount(crossBorder)}</td>
                          <td>{amount(crossBorder)}<div className="aip-sub">Not checked by AI</div></td>
                          <td />
                        </tr>
                      )}
                      <tr className="is-total">
                        <td>Total</td>
                        <td>{amount(yourTotal ?? 0)}<div className="aip-sub" style={{ fontWeight: 400 }}>Your figures</div></td>
                        <td>{amount(combo.price_zar, "chosen")}<div className="aip-sub" style={{ fontWeight: 400 }}>{anyAiChosen ? "Recommended price" : "Your price"}</div></td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="aip-notes">
                  {review!.return_leg && (
                    <p className="aip-note">
                      One-way trip: an empty run home costs about{" "}
                      <span className="aip-note__num">{formatCurrency(review!.return_leg.total_zar)}</span>{" "}
                      (fuel {formatCurrency(review!.return_leg.fuel_zar)} · tolls {formatCurrency(review!.return_leg.tolls_zar)} · driver {formatCurrency(review!.return_leg.driver_zar)}). It isn't in the price, so the base rate has to cover it.
                    </p>
                  )}
                  {sourceLinks(references, "Sources")}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* revenue guard */}
      {guard && guard.risk_level && guard.risk_level !== "SAFE" && (
        <div className={`aip-banner aip-banner--${guard.risk_level === "AT_RISK" ? "danger" : "warning"}`}>
          <span className="aip-banner__label">{guard.risk_level === "AT_RISK" ? "At risk" : "Caution"}</span>
          {guardLine && ` · ${guardLine}`}
        </div>
      )}

      {notice && <div className="aip-notice" role="status">{notice}</div>}

      {/* Save and Send live in the price bar below, next to the one price. */}
      {showFoot && (
        <div className="aip__foot">
          {needsApply && (
            <button type="button" className="tw-btn" onClick={() => onApply(review!, currentKey)}>Apply recommended</button>
          )}
          {hasAppliedAi && ok && !isStale && !needsApply && <StatusChip tone="success" label="AI price applied" />}
          {hasAppliedAi && (
            <button type="button" className="tw-btn tw-btn--ghost" onClick={onCancelApplied}>Use actual price</button>
          )}
        </div>
      )}
    </section>
  );
}
