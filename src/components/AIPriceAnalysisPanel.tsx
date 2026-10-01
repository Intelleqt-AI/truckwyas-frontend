import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchData, postData } from "@/lib/Api";
import { formatDate, formatMoney, formatMoneyWhole, formatNumber, formatPercent, MISSING } from "@/lib/formatters";
import { InfoTip } from "@/components/ui/InfoTip";
import { StatusChip, type StatusTone } from "@/components/ui/StatusChip";
import { ChevronDown, ChevronUp } from "lucide-react";
import "./ai-price-analysis.css";

// ---- API contract (compute_pricing() in backend
// core/services/quote_ai_pricing.py). Every price and win chance here is
// calculated by the backend in Python. A check compares the quote with stored
// figures: the official FIASA fuel price, the lane benchmark from real quotes,
// and toll tariffs and the driver allowance that a monthly job finds on their
// published source pages and an admin approves (Admin > Rate updates). Older
// backends searched the web per check; both shapes are handled. ----
export type ItemKey = "fuel" | "tolls" | "driver_allowance" | "base_rate";
export type Choice = "ai" | "mine";
export type Verdict = "accurate" | "needs_adjustment" | "could_not_verify";
// Where a market figure really comes from (backend #113 follow-up). Inferred
// from the item when an older backend doesn't send it.
export type VerificationKind = "official" | "benchmark" | "source" | "unverified";
export interface AIPriceReviewReference { title: string; url: string; }
export interface TollPlazaCheck {
  plaza: string; your_tariff_zar?: number | null; market_tariff_zar?: number | null; verified?: boolean; note?: string | null;
  // Stored-figure backend: which road the plaza is on and the schedule it belongs to.
  route?: string | null; effective_from?: string | null; verified_at?: string | null;
  source_url?: string | null; source_name?: string | null;
  published_tariff_incl_vat_zar?: number | null; matches_yours?: boolean | null;
}
// One loose shape for the four items' `detail` (each item fills its own part).
export interface AIPriceItemDetail {
  // fuel
  litres?: number; your_price_per_litre?: number | null; market_price_per_litre?: number | null;
  effective_date?: string | null; zone?: string | null; source?: string | null; other_zone_price_per_litre?: number | null;
  current?: boolean;
  // tolls
  legs?: number; toll_class?: string | null; plazas?: TollPlazaCheck[]; other_plazas_mentioned?: string[];
  your_one_way_zar?: number | null; market_one_way_zar?: number | null; vat_basis?: string | null;
  sanral_class?: number | null; schedule_from?: string | null;
  // driver allowance (rate_per_day_zar is the older name of rate_per_night_zar)
  rate_per_night_zar?: number | null; rate_per_day_zar?: number | null; allowance_label?: string | null; days?: number | null; hours_per_day?: number | null;
  nights?: number | null; allowance_basis?: string | null;
  // base rate
  distance_km?: number; your_rate_per_km?: number | null; ai_rate_per_km?: number | null;
  market_low_per_km?: number | null; market_high_per_km?: number | null;
  benchmark_zar?: number | null; benchmark_label?: string | null;
}
export interface AIPriceReviewItem {
  verdict: Verdict;
  // Only adjusted items can be switched between your figure and the market one.
  toggleable: boolean;
  current_value_zar: number;
  ai_value_zar: number;
  reason: string;
  verification: "verified" | "not_verified";
  verification_kind?: VerificationKind;
  // Stored-figure backends: where and when the figure was last checked.
  verified_at?: string | null;
  source_url?: string | null;
  source_name?: string | null;
  verification_note: string;
  sources: AIPriceReviewReference[];
  detail: AIPriceItemDetail | null;
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
  distance_km?: number;
  legs?: number;
  cross_border_zar?: number;
  cost_breakdown?: Record<ItemKey, AIPriceReviewItem>;
  toggleable_items?: ItemKey[];
  // Every market/yours combination, keyed by choiceKey(): switching an item
  // is a lookup, never a client-side recalculation.
  combinations?: Record<string, AIPriceCombination>;
  default_choice_key?: string;
  references?: AIPriceReviewReference[];
  win_model?: AIWinModel;
  // One-way trips: the empty run home at market figures (display only).
  return_leg?: { fuel_zar: number; tolls_zar: number; driver_zar: number; total_zar: number; fuel_basis: string } | null;
  // Failures (never shown as-is: see FAILURE_COPY).
  code?: string;
  error?: string;
  retry_after_seconds?: number;
}

const TOPICS: ItemKey[] = ["fuel", "tolls", "driver_allowance", "base_rate"];
// Same format as choice_key() in quote_ai_pricing.py.
const choiceKey = (c: Partial<Record<ItemKey, Choice>>) => TOPICS.map((t) => `${t}=${c[t] ?? "mine"}`).join("|");

const ITEM_LABELS: Record<ItemKey, string> = {
  fuel: "Fuel", tolls: "Tolls", driver_allowance: "Driver allowance", base_rate: "Base rate",
};
const ITEM_WORDS: Record<ItemKey, string> = {
  fuel: "fuel", tolls: "tolls", driver_allowance: "driver", base_rate: "base rate",
};

// en-ZA figures from the shared formatters ("R 21,50/L", "1 234,5").
const perKm = (n?: number | null) => (n == null ? MISSING : `${formatMoney(Number(n))}/km`);
const perLitre = (n?: number | null) => (n == null ? MISSING : `${formatMoney(Number(n))}/L`);
const num1 = (n?: number | null) => (n == null ? MISSING : formatNumber(Number(n), { maximumFractionDigits: 1 }));
// Backend sentences are plain rules text; keep the house style (no em dashes).
const clean = (s?: string | null) => (s || "").replace(/\s*[—–]\s*/g, ", ").trim();
const joinWords = (w: string[]) => (w.length <= 1 ? w.join("") : `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}`);

// Only https links to a real host are shown; the name is the hostname.
function httpsHost(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname ? u.hostname.replace(/^www\./, "") : null;
  } catch { return null; }
}
const safeSources = (sources?: AIPriceReviewReference[]) =>
  (sources || []).filter((s) => httpsHost(s.url) !== null);

function kindOf(t: ItemKey, item: AIPriceReviewItem): VerificationKind {
  if (item.verification_kind) return item.verification_kind;
  if (item.verdict === "could_not_verify" || item.verification !== "verified") return "unverified";
  if (t === "fuel") return "official";
  if (t === "base_rate") return "benchmark";
  return safeSources(item.sources).length > 0 ? "source" : "unverified";
}
// The page a "source" figure was checked on: the stored figure's own link
// when the backend sends one, else the first cited source.
function sourceOf(item: AIPriceReviewItem): AIPriceReviewReference | null {
  if (item.source_url && httpsHost(item.source_url)) return { url: item.source_url, title: item.source_name || "" };
  return safeSources(item.sources)[0] || null;
}
function chipFor(t: ItemKey, item: AIPriceReviewItem): { tone: StatusTone; label: string; title?: string } {
  const kind = kindOf(t, item);
  const d = item.detail || {};
  if (kind === "official") {
    const fiasa = (d.source || (t === "fuel" ? "FIASA" : "")).toUpperCase() === "FIASA";
    const eff = d.effective_date ? `${d.current === false ? "Latest official price, effective" : "Official price from"} ${formatDate(d.effective_date)}` : undefined;
    return { tone: d.current === false ? "warning" : "success", label: fiasa ? "Official price (FIASA)" : "Official price", title: eff };
  }
  if (kind === "benchmark") return { tone: "neutral", label: "Lane benchmark", title: clean(d.benchmark_label) || undefined };
  if (kind === "source") {
    const src = sourceOf(item);
    const host = src ? httpsHost(src.url) : null;
    const when = item.verified_at ? ` · ${formatDate(item.verified_at)}` : "";
    return {
      tone: "success",
      label: `Checked on ${host || "source"}${when}`,
      title: [clean(src?.title), item.verified_at ? `Last checked on its source ${formatDate(item.verified_at)}` : ""].filter(Boolean).join(". ") || undefined,
    };
  }
  return { tone: "warning", label: "Not verified", title: clean(item.verification_note) || undefined };
}

// ---- failures: our own words per code, never the server's text ----
type FailCode = "unavailable" | "cooldown" | "throttled" | "budget" | "failed";
interface Failure { code: FailCode; until: number | null; missing: boolean }
const FAIL_CODES: FailCode[] = ["unavailable", "cooldown", "throttled", "budget", "failed"];
const asCode = (v: unknown): FailCode | null => (FAIL_CODES as string[]).includes(String(v)) ? (v as FailCode) : null;
const posNum = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
interface ApiError { status?: number; data?: unknown; }
function classify(err: ApiError | null, body: AIPriceReviewResponse | null): { code: FailCode; retryAfter: number | null; missing: boolean } {
  const d = (err ? err.data : body) as Record<string, unknown> | null;
  const obj = d && typeof d === "object" ? d : {};
  const retry = posNum(obj.retry_after_seconds)
    // DRF's own throttle: "Expected available in 42 seconds." (read, never shown)
    ?? (typeof obj.detail === "string" ? posNum(/(\d+)\s*second/.exec(obj.detail)?.[1]) : null);
  const code = asCode(obj.code) ?? (obj.error === "cooldown" ? "cooldown" : null);
  if (code) return { code, retryAfter: retry, missing: false };
  const status = err?.status;
  if (status === 404) return { code: "unavailable", retryAfter: null, missing: true };
  if (status === 503) return { code: "unavailable", retryAfter: null, missing: false };
  if (status === 429) return { code: "throttled", retryAfter: retry, missing: false };
  return { code: "failed", retryAfter: null, missing: false };
}
function failureText(f: Failure, secsLeft: number | null): { title: string; text: string } {
  const wait = secsLeft != null && secsLeft > 0 ? `Try again in ${secsLeft} s.` : "Try again shortly.";
  switch (f.code) {
    case "unavailable": return f.missing
      ? { title: "Price check isn't available yet", text: "Your quote works as normal." }
      : { title: "Price check isn't available right now", text: "Your quote works as normal." };
    case "cooldown": return { title: "Checked a moment ago", text: wait };
    case "throttled": return { title: "Too many checks this minute", text: wait };
    case "budget": return { title: "Today's price checks are used up", text: "Your company has reached its daily limit. Checks start again at midnight, and your quote works as normal." };
    default: return { title: "Couldn't check market prices", text: "Your quote is unaffected. Try again in a minute." };
  }
}

// ---- results kept for this browser tab, per trip (a check costs money) ----
interface Entry { review: AIPriceReviewResponse; laneSig: string; winSig: string; at: number; choices: Record<ItemKey, Choice>; }
const CACHE_KEY = "tw-price-check-v1";
const CACHE_MAX = 12;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
function loadCache(): Record<string, Entry> {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}") as Record<string, Entry>;
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, e]) => e && now - e.at < CACHE_TTL_MS && e.review?.combinations));
  } catch { return {}; }
}
function saveCache(c: Record<string, Entry>) {
  try {
    const kept = Object.entries(c).sort((a, b) => b[1].at - a[1].at).slice(0, CACHE_MAX);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch { /* storage full or blocked: the in-memory copy still works */ }
}
// Whether this backend has the endpoint at all. A GET is free (no model call):
// 405 means it exists, 404 means the backend isn't deployed yet.
const AVAIL_KEY = "tw-price-check-available";
let availMemo: "yes" | "no" | null = null;
function readAvail(): "yes" | "no" | null {
  if (availMemo) return availMemo;
  try { const v = sessionStorage.getItem(AVAIL_KEY); return v === "yes" || v === "no" ? v : null; } catch { return null; }
}
function writeAvail(v: "yes" | "no") {
  availMemo = v;
  try { sessionStorage.setItem(AVAIL_KEY, v); } catch { /* ignore */ }
}

const checkedAgo = (at: number, now: number) => {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "Checked just now";
  if (s < 3600) return `Checked ${Math.floor(s / 60)} min ago`;
  return `Checked ${Math.floor(s / 3600)} h ago`;
};

// What the panel says when there's no win chance to show.
const WIN_REASON_COPY: Record<string, string> = {
  not_enough_history: "Needs more closed quotes",
  no_market_rate: "No lane benchmark yet",
  outside_training_range: "No similar quotes yet",
  prediction_failed: "Couldn't score this quote",
};

interface RouteLike {
  road_type?: string | null; terrain?: string[] | null; traffic_status?: string | null; congested_km?: number | null;
  country_codes?: string[] | null; toll_breakdown?: { plaza: string; tariff: number }[] | null;
}
interface RouteDataLike { countries?: string[] | null; cross_border?: boolean | null; }
interface BenchmarkLike { market_avg_rate?: number | null; recommendation?: string | null; }
interface GuardLike { risk_level?: string | null; explanations?: string[]; warnings?: string[]; suggestions?: string[]; }

interface AIPriceAnalysisPanelProps {
  // False while the form isn't ready: the panel stays mounted (keeping its
  // result and choices) but renders nothing.
  active: boolean;
  // True only when `route` was calculated for the current inputs.
  routeReady: boolean;
  // The last route calculation failed (nothing to check against).
  routeError?: boolean;
  // Where the user fixes the company fuel price.
  onOpenFuelSettings?: () => void;
  routeData: RouteDataLike | null;
  route: RouteLike | null | undefined;
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
  benchmark: BenchmarkLike | null;
  guard: GuardLike | null;
  billingBlocked: boolean;
  quoteId?: number | null;
  // The choice key of the market figures applied to this quote, if any.
  appliedKey: string | null;
  // The current result, or null. The price bar offers "Apply" next to Send
  // (in main's suggestion slot) while there is one.
  onResultChange?: (offer: PriceCheckOffer | null) => void;
}

// What the price bar needs to offer the market price.
export interface PriceCheckOffer { review: AIPriceReviewResponse; key: string; price: number; needsApply: boolean; }

export function AIPriceAnalysisPanel(props: AIPriceAnalysisPanelProps) {
  const {
    active, routeReady, routeError, onOpenFuelSettings, routeData, route, total, chargeDistance, oneWayDistance, legs, tripType, durationMinutes,
    origin, destination, vehicleType, weightKg, customerId, fuelCost, fuelLitres, fuelConsumption, fuelPricePerL,
    fuelType, fuelZone, tollCost, driverAllowance, crossBorderCost, baseRatePerKm, pickupDate,
    benchmark, guard, billingBlocked, quoteId, appliedKey, onResultChange,
  } = props;

  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [cache, setCache] = useState<Record<string, Entry>>(loadCache);
  // The trip of the last check run from this panel (for "Out of date").
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [loadingSince, setLoadingSince] = useState<number | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [avail, setAvail] = useState<"yes" | "no" | null>(readAvail);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // The trip itself: anything here changing means the check was for a
  // different job. The four priced items are compared separately below,
  // because Apply legitimately moves them.
  const laneSig = JSON.stringify([
    origin, destination, vehicleType, chargeDistance, legs, durationMinutes,
    Math.round(fuelLitres * 100) / 100, crossBorderCost, fuelType, fuelZone,
  ]);
  // Inputs only the win chance depends on (the price doesn't).
  const winSig = JSON.stringify([customerId || null, pickupDate || null, weightKg]);

  // Does this backend have the endpoint? Once per tab.
  useEffect(() => {
    if (avail !== null || !active) return;
    let cancelled = false;
    fetchData("api/v1/quotes/ai-price-analysis/")
      .then(() => { if (!cancelled) { writeAvail("yes"); setAvail("yes"); } })
      .catch((e: ApiError) => {
        if (cancelled) return;
        if (e?.status === 404) { writeAvail("no"); setAvail("no"); }
        else if (e?.status) { writeAvail("yes"); setAvail("yes"); }
        // No response at all (offline): leave unknown; a check will tell.
      });
    return () => { cancelled = true; };
  }, [avail, active]);

  // Clock for "4 s", "Try again in 18 s" and "Checked 2 min ago".
  const fast = loadingSince !== null || (failure?.until != null && failure.until > now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), fast ? 1000 : 30000);
    return () => clearInterval(id);
  }, [fast]);
  const secsLeft = failure?.until != null ? Math.ceil((failure.until - now) / 1000) : null;
  // A countdown that has run out is over: the panel goes back to normal.
  useEffect(() => {
    if (failure?.until != null && secsLeft != null && secsLeft <= 0 && (failure.code === "cooldown" || failure.code === "throttled")) setFailure(null);
  }, [failure, secsLeft]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runCheck = async () => {
    // Never on a route that belongs to previous inputs (a paid run on mixed data).
    if (!active || !routeReady || !routeData || total <= 0 || loadingSince !== null) return;
    const reqId = ++reqIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const sigAtRequest = laneSig;
    const winSigAtRequest = winSig;
    setLoadingSince(Date.now());
    setNow(Date.now());
    setFailure(null);
    let body: AIPriceReviewResponse | null = null;
    let err: ApiError | null = null;
    try {
      body = await postData({
        url: "api/v1/quotes/ai-price-analysis/",
        data: {
          quote_id: quoteId || null,
          // Every check is started by the user (there is no automatic run).
          trigger_type: "manual",
          distance_km: chargeDistance,
          one_way_distance_km: oneWayDistance,
          legs, trip_type: tripType, duration_minutes: durationMinutes,
          origin, destination, vehicle_type: vehicleType, weight: weightKg,
          // Only used to score the win chance; never sent to OpenAI.
          customer_id: customerId ? Number(customerId) : null,
          fuel_cost: fuelCost, toll_cost: tollCost, driver_cost: driverAllowance,
          cross_border_cost: crossBorderCost,
          // The exact (unrounded) litres and price behind fuelCost.
          fuel_usage_litres: fuelLitres,
          fuel_price_used: fuelPricePerL,
          fuel_consumption_l_per_100km: fuelConsumption,
          fuel_type: fuelType,
          fuel_zone: fuelZone,
          base_rate_per_km: Number(baseRatePerKm) || 0,
          // Only when the lane benchmark has loaded (0 would read as "no market").
          ...(Number(benchmark?.market_avg_rate) > 0 ? { market_rate: Number(benchmark!.market_avg_rate) } : {}),
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
        // Checks against stored figures take well under a second; an older
        // backend that still searches the web per check can take up to 55 s.
        config: { timeout: 60000, signal: controller.signal },
      });
    } catch (e) {
      err = (e as ApiError) || {};
    }
    if (reqId !== reqIdRef.current) return; // superseded or cancelled
    abortRef.current = null;
    setLoadingSince(null);
    if (controller.signal.aborted) return;

    const valid = !!body && body.success === true && !!body.combinations && !!body.cost_breakdown
      && !!body.default_choice_key && !!body.combinations[body.default_choice_key];
    if (!valid) {
      const f = classify(err, err ? null : body);
      if (f.code === "unavailable" && f.missing) { writeAvail("no"); setAvail("no"); }
      const cooldownDefault = f.code === "cooldown" ? 20 : null;
      const secs = f.retryAfter ?? cooldownDefault;
      setFailure({ code: f.code, until: secs ? Date.now() + secs * 1000 : null, missing: f.missing });
      return;
    }
    if (avail !== "yes") { writeAvail("yes"); setAvail("yes"); }
    const review = body as AIPriceReviewResponse;
    const entry: Entry = {
      review, laneSig: sigAtRequest, winSig: winSigAtRequest, at: Date.now(),
      choices: { ...review.combinations![review.default_choice_key!].choices },
    };
    setCache((c) => { const next = { ...c, [sigAtRequest]: entry }; saveCache(next); return next; });
    setLastSig(sigAtRequest);
  };

  const cancelCheck = () => {
    reqIdRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    setLoadingSince(null);
  };

  // ---- derived state ----
  const entry = cache[laneSig] || null;
  const review = entry?.review || null;
  const breakdown = (review?.cost_breakdown || {}) as Record<ItemKey, AIPriceReviewItem>;
  const combos = review?.combinations || {};
  const choices = entry?.choices;
  const currentKey = choices ? choiceKey(choices) : "";
  const combo: AIPriceCombination | undefined = entry
    ? combos[currentKey] || combos[review!.default_choice_key!] : undefined;

  // Which side (yours / market) each line of the live quote is on right now.
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
  const sides = entry ? TOPICS.map(sideOf) : [];
  const figuresChanged = !!entry && sides.some((s) => s === null);
  const hasResult = !!entry && !!combo && !figuresChanged;
  const outOfDate = (!!entry && figuresChanged) || (!entry && !!lastSig && !!cache[lastSig]);
  const quoteKey = hasResult ? choiceKey(Object.fromEntries(TOPICS.map((t, i) => [t, sides[i]!]))) : null;
  const delta = hasResult ? combo!.price_zar - total : 0;
  const needsApply = hasResult && (quoteKey !== currentKey || Math.abs(delta) >= 0.5);
  const toggleable = (review?.toggleable_items || []).filter((t) => breakdown[t]);
  const marketChosen = TOPICS.filter((t) => choices?.[t] === "ai");
  const isApplied = hasResult && !needsApply && appliedKey === currentKey && marketChosen.length > 0;

  const offerPrice = hasResult ? combo!.price_zar : null;
  useEffect(() => {
    onResultChange?.(active && hasResult && review ? { review, key: currentKey, price: offerPrice!, needsApply } : null);
  }, [active, hasResult, review, currentKey, offerPrice, needsApply, onResultChange]);

  const setChoice = (t: ItemKey, c: Choice) => {
    if (!entry) return;
    setCache((prev) => {
      const e = prev[laneSig];
      if (!e) return prev;
      const next = { ...prev, [laneSig]: { ...e, choices: { ...e.choices, [t]: c } } };
      saveCache(next);
      return next;
    });
  };

  if (!active) return null;

  const loading = loadingSince !== null;
  const elapsed = loading ? Math.max(0, Math.floor((now - loadingSince!) / 1000)) : 0;
  const unavailable = avail === "no" || failure?.code === "unavailable" || failure?.code === "budget";
  const waiting = (failure?.code === "cooldown" || failure?.code === "throttled") && secsLeft != null && secsLeft > 0;
  const canCheck = routeReady && !billingBlocked && !loading && !waiting;
  const failText = failure ? failureText(failure, secsLeft) : null;

  // ---- win chance (scored for the client / date / weight at check time) ----
  const winModel = review?.win_model;
  const winStale = !!entry && entry.winSig !== winSig && !!winModel?.available && combo?.win_probability != null;
  const winP = winModel?.available && !winStale ? combo?.win_probability ?? null : null;
  const winNote = winStale
    ? "Client, date or weight changed. Re-check to update."
    : winP != null
      ? `${winModel!.scope === "user" ? "From your quotes" : "From platform quotes"} · ${formatNumber(winModel!.training_samples, { maximumFractionDigits: 0 })} closed`
      : WIN_REASON_COPY[winModel?.reason || ""] || WIN_REASON_COPY.not_enough_history;

  // ---- headline: the one figure the reader acts on ----
  const matches = hasResult && !needsApply;
  const headLabel = matches ? "Market check"
    : marketChosen.length === toggleable.length && toggleable.length > 0 ? "Market price"
    : marketChosen.length > 0 ? "Price with your picks" : "Your figures";
  const anyUnverified = TOPICS.some((t) => breakdown[t] && kindOf(t, breakdown[t]) === "unverified");
  // Nothing could be checked: never say the quote "matches" the market.
  const noneVerified = hasResult && TOPICS.every((t) => !breakdown[t] || kindOf(t, breakdown[t]) === "unverified");
  const headNote = !hasResult ? ""
    : noneVerified && matches ? "Your figures are kept"
    : isApplied ? "Market figures in use"
    : matches ? (toggleable.length === 0
      ? (anyUnverified ? "Nothing to change in the checked figures" : "Your figures are at market")
      : "You kept your own figures")
    : marketChosen.length > 0 ? `With market ${joinWords(marketChosen.map((t) => ITEM_WORDS[t]))}`
    : "Without the market changes";

  const fuelDetail = breakdown.fuel?.detail || {};
  const fuelSettingStale = hasResult && breakdown.fuel?.verdict === "needs_adjustment"
    && Number(fuelDetail.market_price_per_litre) >= Number(fuelDetail.your_price_per_litre) * 1.05;
  const crossBorder = review?.cross_border_zar ?? 0;
  const guardLine = guard ? [(guard.explanations || guard.warnings || [])[0], guard.suggestions?.[0]].filter(Boolean).join(". ") : "";

  // ---- pieces ----
  const benchmarkLine = Number(benchmark?.market_avg_rate) > 0 ? (
    <p className="aip-bench">
      Lane benchmark <span className="aip-num">{formatMoneyWhole(Number(benchmark!.market_avg_rate))}</span> average
      {benchmark!.recommendation ? ` · ${clean(benchmark!.recommendation)}` : ""}
    </p>
  ) : null;

  const valuesCell = (t: ItemKey, item: AIPriceReviewItem) => {
    if (item.toggleable) {
      const mineOn = choices?.[t] !== "ai";
      return (
        <span className="aip-vals">
          <span className={mineOn ? "is-on" : "is-off"}>{formatMoney(item.current_value_zar)}</span>
          <span className="aip-vals__arrow" aria-hidden="true">→</span>
          <span className="aip-sr">, market </span>
          <span className={mineOn ? "is-off" : "is-on"}>{formatMoney(item.ai_value_zar)}</span>
        </span>
      );
    }
    return (
      <span className="aip-vals">
        <span className="is-on">{formatMoney(item.current_value_zar)}</span>
        <span className="aip-vals__note">{item.verdict === "accurate" ? "at market" : "yours kept"}</span>
      </span>
    );
  };

  const itemRows = (skeleton: boolean) => (
    <table className="aip-items">
      <caption className="aip-sr">Your figures against the market</caption>
      <thead className="aip-sr">
        <tr><th scope="col">Item</th><th scope="col">Yours and market</th><th scope="col">Basis</th><th scope="col">Choice</th></tr>
      </thead>
      <tbody>
        {TOPICS.map((t) => {
          const item = skeleton ? null : breakdown[t];
          if (!skeleton && !item) return null;
          const chip = item ? chipFor(t, item) : null;
          return (
            <tr key={t} className="aip-row">
              <th scope="row" className="aip-row__label">{ITEM_LABELS[t]}</th>
              <td className="aip-row__vals">{item ? valuesCell(t, item) : <i className="aip-skel" style={{ width: 150 }} />}</td>
              <td className="aip-row__chip">
                {chip ? <StatusChip tone={chip.tone} label={chip.label} title={chip.title} /> : <i className="aip-skel aip-skel--chip" />}
              </td>
              <td className="aip-row__act">
                {skeleton && <i className="aip-skel aip-skel--btn" />}
                {item?.toggleable && (
                  <button type="button" className="tw-btn tw-btn--sm aip-pick" aria-pressed={choices?.[t] === "ai"}
                    onClick={() => setChoice(t, choices?.[t] === "ai" ? "mine" : "ai")}
                    aria-label={`${ITEM_LABELS[t]}: ${choices?.[t] === "ai" ? "use my figure" : "use the market figure"}`}>
                    {choices?.[t] === "ai" ? "Use mine" : "Use market"}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
        {!skeleton && crossBorder > 0 && (
          <tr className="aip-row">
            <th scope="row" className="aip-row__label">Cross-border</th>
            <td className="aip-row__vals"><span className="aip-vals"><span className="is-on">{formatMoney(crossBorder)}</span><span className="aip-vals__note">not checked</span></span></td>
            <td className="aip-row__chip" />
            <td className="aip-row__act" />
          </tr>
        )}
      </tbody>
    </table>
  );

  const stats = (skeleton: boolean) => (
    <div className="aip-stats">
      <div className="aip-stat" title={!skeleton && combo && !matches ? formatMoney(combo.price_zar) : undefined}>
        <div className="aip-stat__label">{skeleton ? <i className="aip-skel" style={{ width: 80 }} /> : headLabel}</div>
        <div className={`aip-stat__figure${matches ? " is-text" : ""}${matches && noneVerified ? " is-muted" : ""}`}>
          {skeleton ? <i className="aip-skel aip-skel--fig" /> : matches ? (noneVerified ? "Nothing verified" : "Matches your quote") : formatMoneyWhole(combo!.price_zar)}
        </div>
        <div className="aip-stat__note">{skeleton ? <i className="aip-skel" style={{ width: 140 }} /> : headNote}</div>
      </div>
      <div className="aip-stat">
        <div className="aip-stat__label">{skeleton ? <i className="aip-skel" style={{ width: 64 }} /> : "Win chance"}</div>
        <div className={`aip-stat__figure${winP == null ? " is-text is-muted" : ""}`}>
          {skeleton ? <i className="aip-skel aip-skel--fig" style={{ width: 64 }} /> : winP != null ? formatPercent(winP * 100, 0) : "Not scored"}
        </div>
        <div className={`aip-stat__note${winStale ? " is-warn" : ""}`}>{skeleton ? <i className="aip-skel" style={{ width: 120 }} /> : winNote}</div>
      </div>
    </div>
  );

  const sourceChips = (sources: AIPriceReviewReference[]) => {
    const safe = safeSources(sources);
    if (!safe.length) return null;
    return (
      <div className="aip-srcs">
        {safe.map((s) => (
          <a key={s.url} className="aip-src" href={s.url} target="_blank" rel="noopener noreferrer"
            title={clean(s.title) || undefined} aria-label={`${clean(s.title) || httpsHost(s.url)} (opens in a new tab)`}>
            {httpsHost(s.url)}
          </a>
        ))}
      </div>
    );
  };

  const detailLines = (t: ItemKey, item: AIPriceReviewItem): string[] => {
    const d = item.detail || {};
    const lines: string[] = [];
    if (t === "fuel") {
      lines.push(`Yours: ${perLitre(d.your_price_per_litre)} × ${num1(d.litres)} L`);
      if (d.market_price_per_litre != null) {
        lines.push(`Official${d.zone ? ` ${String(d.zone).toLowerCase()}` : ""}: ${perLitre(d.market_price_per_litre)} × ${num1(d.litres)} L${d.effective_date ? `, from ${formatDate(d.effective_date)}` : ""}`);
        if (d.other_zone_price_per_litre != null && d.zone) {
          lines.push(`${String(d.zone).toLowerCase() === "inland" ? "Coastal" : "Inland"} price: ${perLitre(d.other_zone_price_per_litre)}`);
        }
      }
    } else if (t === "tolls") {
      // Round trips: the one-way figures behind the totals in the row above.
      if ((d.legs ?? 1) > 1 && d.your_one_way_zar != null) lines.push(`Yours: ${formatMoney(d.your_one_way_zar)} one way × ${d.legs}`);
      if ((d.legs ?? 1) > 1 && d.market_one_way_zar != null) lines.push(`Published: ${formatMoney(d.market_one_way_zar)} one way × ${d.legs}`);
    } else if (t === "driver_allowance") {
      const lead = d.allowance_label ? `${clean(d.allowance_label)}: ` : "";
      const perNight = d.rate_per_night_zar ?? d.rate_per_day_zar;
      if (perNight != null && d.nights != null) {
        lines.push(d.nights === 0
          ? `${lead}${formatMoney(perNight)} a night, none due: the trip fits in one driving day`
          : `${lead}${formatMoney(perNight)} a night × ${d.nights} night${d.nights === 1 ? "" : "s"} away`);
        if (d.days != null) lines.push(`${d.days} driving day${d.days === 1 ? "" : "s"}, at most ${num1(d.hours_per_day)} driving hours a day`);
      } else if (d.rate_per_night_zar != null) {
        lines.push(`${lead}${formatMoney(d.rate_per_night_zar)} a night away`);
      } else if (d.rate_per_day_zar != null && d.days != null) {
        lines.push(`${lead}${formatMoney(d.rate_per_day_zar)}/day × ${d.days} day${d.days === 1 ? "" : "s"}, about ${num1(d.hours_per_day)} driving hours a day`);
      }
    } else {
      lines.push(`Yours: ${perKm(d.your_rate_per_km)} × ${num1(d.distance_km)} km`);
      if (d.market_low_per_km != null && d.market_high_per_km != null) {
        lines.push(`Benchmark band: ${perKm(d.market_low_per_km)} to ${perKm(d.market_high_per_km)}`);
      }
    }
    return lines;
  };

  const details = hasResult && detailsOpen && (
    <div className="aip-details" id="aip-details">
      {fuelSettingStale && (
        <p className="aip-warnline">
          Your fuel price ({perLitre(fuelDetail.your_price_per_litre)}) is below the official {perLitre(fuelDetail.market_price_per_litre)}, so every quote is under-priced on fuel.
          {onOpenFuelSettings && <>{" "}<button type="button" className="aip-link" onClick={onOpenFuelSettings}>Update it in settings</button></>}
        </p>
      )}
      <div className="aip-dgrid">
        {TOPICS.filter((t) => breakdown[t]).map((t) => {
          const item = breakdown[t];
          const d = item.detail || {};
          const plazas = t === "tolls" && Array.isArray(d.plazas) ? d.plazas : [];
          return (
            <section key={t} className="aip-d" aria-label={ITEM_LABELS[t]}>
              <h3 className="aip-d__title">{ITEM_LABELS[t]}</h3>
              {detailLines(t, item).map((l) => <p key={l} className="aip-d__line">{l}</p>)}
              {plazas.length > 0 && (
                <ul className="aip-plazas">
                  {d.toll_class && <li className="aip-d__line">{clean(d.toll_class)}, one way{d.vat_basis === "excl_vat" ? ", excl. VAT" : ""}</li>}
                  {plazas.map((p) => (
                    <li key={p.plaza} className="aip-plaza">
                      <span className={`aip-dot${p.verified ? " is-ok" : " is-warn"}`} aria-hidden="true" />
                      {p.route ? `${clean(p.route)} ` : ""}{p.plaza}: yours {p.your_tariff_zar != null ? formatMoney(p.your_tariff_zar) : MISSING}, published {p.market_tariff_zar != null ? formatMoney(p.market_tariff_zar) : MISSING}
                      <span className="aip-plaza__note">
                        {p.verified
                          ? (p.effective_from ? `tariff from ${formatDate(p.effective_from)}` : "confirmed")
                          : (clean(p.note) || "not confirmed")}
                      </span>
                    </li>
                  ))}
                  {Array.isArray(d.other_plazas_mentioned) && d.other_plazas_mentioned.length > 0 && (
                    <li className="aip-d__line">Also mentioned, not on this route: {d.other_plazas_mentioned.join(", ")}</li>
                  )}
                </ul>
              )}
              {/* The backend's sentence restates the row for checked items, so it
                  is shown only where it explains why a figure wasn't verified. */}
              {kindOf(t, item) === "unverified" && (item.reason || item.verification_note) && (
                <p className="aip-d__reason">{clean(item.reason) || clean(item.verification_note)}</p>
              )}
              {sourceChips([...(item.source_url ? [{ url: item.source_url, title: item.source_name || "" }] : []), ...(item.sources || [])]
                .filter((s, i, all) => all.findIndex((x) => x.url === s.url) === i))}
            </section>
          );
        })}
      </div>
      {review!.return_leg && (
        <p className="aip-d__line aip-d__foot">
          One way: an empty run home costs about {formatMoneyWhole(review!.return_leg.total_zar)} (fuel {formatMoneyWhole(review!.return_leg.fuel_zar)}, tolls {formatMoneyWhole(review!.return_leg.tolls_zar)}, driver {formatMoneyWhole(review!.return_leg.driver_zar)}). It isn't in the price, so the base rate has to cover it.
        </p>
      )}
    </div>
  );

  // ---- head tools: one control, whose label says what it does now ----
  let tools: ReactNode = null;
  if (loading) {
    tools = (
      <>
        <span className="aip-meta" aria-live="polite">{elapsed >= 3 ? `Checking… ${elapsed} s` : "Checking…"}</span>
        <button type="button" className="tw-btn tw-btn--sm" onClick={cancelCheck}>Cancel</button>
      </>
    );
  } else if (!unavailable) {
    const label = outOfDate || entry ? "Re-check" : failure?.code === "failed" ? "Try again" : "Check price";
    tools = (
      <>
        {outOfDate ? <StatusChip tone="warning" label="Out of date" />
          : entry ? <span className="aip-meta">{checkedAgo(entry.at, now)}</span> : null}
        <button type="button" className="tw-btn tw-btn--sm" onClick={runCheck} disabled={!canCheck}
          title={!routeReady ? "Waiting for the route" : waiting ? `Try again in ${secsLeft} s` : undefined}>
          {label}
        </button>
      </>
    );
  }

  // ---- body ----
  let body: ReactNode;
  const showSkeleton = loading && !entry;
  if (showSkeleton) {
    body = (
      <div className="aip-result is-skeleton" aria-hidden="true">
        {stats(true)}
        {itemRows(true)}
      </div>
    );
  } else if (entry && combo) {
    body = figuresChanged ? (
      <p className="aip-msg"><span className="aip-msg__title">Your figures changed after the check.</span> Re-check for a price that matches them.</p>
    ) : (
      <div className={`aip-result${loading ? " is-busy" : ""}`} aria-busy={loading || undefined}>
        {stats(false)}
        {itemRows(false)}
      </div>
    );
  } else if (outOfDate) {
    body = <p className="aip-msg"><span className="aip-msg__title">The trip changed since the last check.</span> Re-check for this route and trip.</p>;
  } else if (unavailable) {
    const t = failText || failureText({ code: "unavailable", until: null, missing: true }, null);
    body = <p className="aip-msg"><span className="aip-msg__title">{t.title}.</span> {t.text}</p>;
  } else if (failText && !entry) {
    body = <p className={`aip-msg${failure?.code === "failed" ? "" : " is-quiet"}`}><span className="aip-msg__title">{failText.title}.</span> {failText.text}</p>;
  } else if (routeError) {
    body = <p className="aip-msg">The route couldn't be calculated. Change an address or the truck to retry.</p>;
  } else {
    body = null;
  }
  // A re-check that was turned away keeps the result and says why.
  const notice = entry && failText && !unavailable ? `${failText.title}. ${failText.text}` : null;

  const foot = hasResult || showSkeleton ? (
    <div className="aip__foot">
      {showSkeleton ? <i className="aip-skel" style={{ width: 96 }} /> : (
        <button type="button" className="aip-toggle" onClick={() => setDetailsOpen((v) => !v)} aria-expanded={detailsOpen} aria-controls="aip-details">
          {detailsOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          {detailsOpen ? "Hide details" : "Show details"}
        </button>
      )}
    </div>
  ) : null;

  return (
    <section className="tw-card tw-card--flush aip" aria-labelledby="aip-title">
      <div className="aip__head">
        <div className="tw-card__titles">
          <h2 id="aip-title" className="tw-card__title">
            Market price check
            <InfoTip label="How the market price check works">
              Fuel is the official FIASA price and the base rate is compared with your lane benchmark from real quotes. Toll tariffs and the driver allowance are checked each month on their published source pages and approved by TruckWys before use. TruckWys calculates the prices and win chance.
            </InfoTip>
          </h2>
          <p className="tw-card__sub">Fuel, tolls, driver and rate vs market</p>
        </div>
        {tools && <div className="aip__tools">{tools}</div>}
      </div>

      {(benchmarkLine || body) && (
        <div className="aip__body">
          {benchmarkLine}
          {body}
        </div>
      )}

      {notice && <div className="aip-notice" role="status">{notice}</div>}
      {details}
      {foot}

      {/* revenue guard */}
      {guard && guard.risk_level && guard.risk_level !== "SAFE" && (
        <div className={`aip-banner aip-banner--${guard.risk_level === "AT_RISK" ? "danger" : "warning"}`}>
          <span className="aip-banner__label">{guard.risk_level === "AT_RISK" ? "At risk" : "Caution"}</span>
          {guardLine && ` · ${clean(guardLine)}`}
        </div>
      )}
    </section>
  );
}
