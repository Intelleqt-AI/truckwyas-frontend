import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { formatDate, formatMoneyWhole, formatNumber } from "@/lib/formatters";
import { StatusChip, type StatusTone } from "@/components/ui/StatusChip";
import { InfoTip } from "@/components/ui/InfoTip";
import { MarketRange } from "./MarketRange";
import { LikelihoodCurve } from "./LikelihoodCurve";
import { readPrice, rowLikelihoods } from "./evaluate";
import type { PricingState } from "./usePricingAnalysis";
import { BAND_LABEL, type Band, type Choice, type ChoiceKey, type Likelihood, type PricingAnalysis } from "./types";
import { likelihoodShort as sharedShort, MARKET_RANGE_LABEL } from "@/lib/pricing";
import "./pricing-panel.css";

export type PricingPhase = "blocked" | "needs" | "route" | "route_error" | "ready";

export interface PricingPanelProps {
  state: PricingState;
  phase: PricingPhase;
  blockedReason?: string | null;
  /** Inputs the builder still needs before anything can be priced. */
  needs: string[];
  customerName: string | null;
  /** The settled price in the bar, excl. VAT (not each keystroke). */
  price: number;
  onApplyPrice: (price: number, key: ChoiceKey) => void;
  driver: { value: string; edited: boolean; onChange: (v: string) => void; onReset: () => void };
  /** The driver allowance in the build-up (R), and a one-tap way to set it to the floor's figure. */
  buildUpDriver?: number;
  onAddDriverToBuildUp?: (amount: number) => void;
  includeReturn: boolean | null;
  onIncludeReturn: (v: boolean) => void;
  /** One-way trips only: a round trip already prices the way home. */
  returnApplicable: boolean;
  /** For the analysing steps: what is already known. */
  distanceKm?: number;
  buildUp?: number;
  /** Where "Set yours" (operating cost per km) goes. */
  settingsHref?: string;
  /** The reveal plays once per input key (origin, destination, vehicle, trip type, customer), never on resize. */
  revealKey?: string;
  /** The bar shows the build-up (its own "Use Balanced" is the next step there). */
  atBuildUp?: boolean;
  /** A block warning is open in the builder: the result is dimmed, nothing moves. */
  paused?: boolean;
}

const OUTCOME: Record<string, { tone: StatusTone; label: string }> = {
  accepted: { tone: "success", label: "Accepted" },
  rejected: { tone: "danger", label: "Declined" },
  open: { tone: "info", label: "Open" },
  expired: { tone: "neutral", label: "Expired" },
  draft: { tone: "neutral", label: "Draft" },
};
const RISK_TONE: Record<string, StatusTone> = { low: "success", medium: "warning", high: "danger", unknown: "neutral" };
const MINUS = "−";
const NBSP = " ";

/** Whole-number percent with a true minus sign; half away from zero. */
export const signedPct = (n: number) => `${n < 0 && Math.round(Math.abs(n)) !== 0 ? MINUS : ""}${Math.round(Math.abs(n))}%`;
/** Dot shade only (the words carry the meaning): a model % shades like its band. */
export const lkTone = (l: { level: "model"; pct: number } | { level: "rules"; band: string | null }) =>
  l.level === "model" ? (l.pct >= 60 ? "likely" : l.pct >= 35 ? "even" : "less_likely") : (l.band ?? "none");
/** One vocabulary: "chance to win", short form "72% to win". */
export const likelihoodShort = (l: { level: "model"; pct: number } | { level: "rules"; label: string } | null) =>
  !l ? null : l.level === "model" ? sharedShort("model", l.pct) : l.label;
/** Money never splits across lines: NBSP inside figures. Nothing else is rewritten. */
const tidy = (t: string) => t
  .replace(/R (?=\d)/g, `R${NBSP}`)
  .replace(/(\d) (?=\d{3}\b)/g, `$1${NBSP}`);
/** "R 21k" for axis-style labels. */
export const randK = (v: number) => `R${NBSP}${formatNumber(Math.round(v / 1000))}k`;
const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;
/** "a, b and c" */
const listAnd = (xs: string[]) => xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/** Steps the analysis builds, in order (also the empty-state explainer). */
const STEPS = [
  { key: "route", title: "Route and costs", text: "Fuel, tolls, driver and your running costs." },
  { key: "floor", title: "Cost floor", text: "What the job costs you to run." },
  { key: "market", title: "Market", text: "What this lane has been paid." },
  { key: "choices", title: "Three prices", text: "Each with margin and chance to win." },
];

const BANDS_WORDS = "Chance to win as Likely, Even chance or Less likely";
/**
 * The panel subtitle. The server sends it ready to show (`likelihood.headline`);
 * an older server gets the same sentences built from its structured fields.
 */
function headlineOf(d: PricingAnalysis): string {
  const lk = d.likelihood;
  if (lk?.headline) return lk.headline;
  if (!lk) return "Cost floor, market and three prices";
  if (lk.level === "model" && lk.model) return `Chance to win from ${lk.model.basisLabel || plural(lk.model.nClosed, "closed quote")}.`;
  const noThresholds = !lk.rules || lk.rules.likelyMax == null || lk.rules.evenMax == null;
  if (noThresholds) return "No chance to win yet: no real quotes on this lane.";
  const s = `${lk.short ?? ""} ${lk.reason ?? ""}`;
  if (/outside|only seen prices/i.test(s)) return `${BANDS_WORDS}: these prices are outside what your model has learned from.`;
  if (/trains tonight/i.test(s)) return `${BANDS_WORDS} until your model trains tonight.`;
  const cnt = (lk.short ?? "").match(/(\d+)\s+of\s+(\d+)/) ?? (lk.reason ?? "").match(/needs (\d+)[^;]*; you have (\d+)/);
  if (cnt) {
    const [have, need] = /needs/.test(cnt[0]) ? [cnt[2], cnt[1]] : [cnt[1], cnt[2]];
    return `${BANDS_WORDS}. A % needs ${need} closed quotes (you have ${have}).`;
  }
  return `${BANDS_WORDS}.`;
}

/** Plays once per input key, per page load: a resize or a re-render never replays it. */
const REVEALED = new Set<string>();

export function PricingPanel(p: PricingPanelProps) {
  const { state, phase } = p;
  const data = state.data;
  const loading = state.status === "loading";
  const refreshing = state.status === "refreshing";
  const titleId = useId();
  const key = p.revealKey ?? "";
  const [, force] = useState(0);
  const revealed = REVEALED.has(key);
  const onRevealed = useCallback(() => { REVEALED.add(key); force((n) => n + 1); }, [key]);

  // One polite live region: a fresh result, and crossing below the floor.
  // Never per keystroke.
  const [announce, setAnnounce] = useState("");
  const lastAnnounced = useRef<string | null>(null);
  useEffect(() => {
    if (state.status !== "ready" || !data) return;
    const rec = data.choices.find((c) => c.recommended);
    const msg = rec ? `Pricing analysis updated. Recommended ${formatMoneyWhole(rec.price)}.` : "Pricing analysis updated.";
    if (msg !== lastAnnounced.current) { lastAnnounced.current = msg; setAnnounce(msg); }
  }, [state.status, data]);
  const floor = data?.costFloor?.total ?? null;
  const belowFloor = floor != null && p.price > 0 && p.price < floor - 0.005;
  const wasBelow = useRef(false);
  useEffect(() => {
    if (belowFloor === wasBelow.current) return;
    wasBelow.current = belowFloor;
    setAnnounce(belowFloor ? "Price is below your cost floor." : "Price is above your cost floor again.");
  }, [belowFloor]);

  const showResult = phase === "ready" && !!data && revealed;
  // The result speaks for itself; the model's basis is under "Why these prices".
  const sub = showResult ? null : "Floor, market and three prices";
  const busy = loading || refreshing || phase === "route";

  return (
    <section className="pa" aria-labelledby={titleId} aria-busy={busy || undefined}>
      <header className="pa__head">
        <h2 id={titleId} className="pa__title">Pricing analysis</h2>
        {/* Out of the flow: appearing never moves or re-wraps anything. */}
        <span className={`pa__status${busy ? "" : " is-idle"}`} aria-hidden={!busy}>
          {busy ? <><i className="pa-pulse" aria-hidden="true" />{loading || phase === "route" ? "Analysing" : "Updating"}</> : null}
        </span>
        {sub && <p className="pa__sub">{sub}</p>}
      </header>
      <div className="pa-sr" aria-live="polite" role="status">{announce}</div>
      <Body {...p} belowFloor={belowFloor} revealed={revealed} onRevealed={onRevealed} />
    </section>
  );
}

type BodyProps = PricingPanelProps & { belowFloor: boolean; revealed: boolean; onRevealed: () => void };

function Body(p: BodyProps) {
  const { state, phase } = p;
  if (phase === "blocked") {
    return <div className="pa__body"><p className="pa-msg">{p.blockedReason || "Paused until the quote can be priced."}</p></div>;
  }
  if (phase === "needs") return <Explainer />;
  if (phase === "route_error") {
    return <div className="pa__body"><p className="pa-msg"><b>Route couldn't be priced.</b></p></div>;
  }
  if (phase === "route" || (state.status === "loading" && !state.data)) return <Analysing start={phase === "route" ? 0 : 1} facts={stepFacts(p)} />;
  if (state.data && !p.revealed) return <Analysing start={1} facts={stepFacts(p)} done onDone={p.onRevealed} />;
  if (!state.data) {
    if (state.status === "unavailable") {
      return <div className="pa__body"><p className="pa-msg"><b>Not available on this account.</b></p></div>;
    }
    if (state.status === "offline") {
      return <div className="pa__body"><p className="pa-msg"><b>You're offline.</b></p>
        <button type="button" className="tw-btn tw-btn--sm pa-retry" onClick={state.retry}>Try again</button></div>;
    }
    if (state.status === "error") {
      return <div className="pa__body"><p className="pa-msg"><b>Unavailable right now.</b></p>
        <button type="button" className="tw-btn tw-btn--sm pa-retry" onClick={state.retry}>Try again</button></div>;
    }
    return <Analysing start={1} facts={stepFacts(p)} />;
  }
  return <Result {...p} data={state.data} />;
}

function Explainer() {
  return (
    <div className="pa__body">
      <ol className="pa-steps">
        {STEPS.map((s, i) => (
          <li key={s.key} className="pa-step">
            <span className="pa-step__num" aria-hidden="true">{i + 1}</span>
            <span className="pa-step__text"><b>{s.title}</b></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Steps advance while the request is in flight; once the result is in, each
 *  step says what it found (200 ms apart, ≤ 1 s in all), then the result shows. */
function Analysing({ start, facts, done, onDone }: { start: number; facts: (string | null)[]; done?: boolean; onDone?: () => void }) {
  const [stage, setStage] = useState(start);
  useEffect(() => { setStage((s) => Math.max(s, start)); }, [start]);
  useEffect(() => {
    if (start === 0 && !done) return; // waiting on the route itself
    // Until the answer is in, nothing past "Route and costs" is ticked off:
    // a step only shows done once it has a real figure to say.
    const id = setInterval(() => setStage((s) => Math.min(s + 1, done ? STEPS.length : 1)), done ? 200 : 280);
    return () => clearInterval(id);
  }, [start, done]);
  useEffect(() => {
    if (!done || stage < STEPS.length) return;
    const t = setTimeout(() => onDone?.(), 160);
    return () => clearTimeout(t);
  }, [done, stage, onDone]);
  return (
    <div className="pa__body">
      <ol className="pa-steps is-live" aria-label="Analysis progress">
        {STEPS.map((s, i) => (
          <li key={s.key} className={`pa-step${i < stage ? " is-done" : i === stage ? " is-active" : ""}`}>
            <span className="pa-step__num" aria-hidden="true">{i < stage ? <Check size={11} strokeWidth={2.5} /> : i + 1}</span>
            <span className="pa-step__text"><b>{s.title}</b>
              {i === stage || (i < stage && !facts[i]) ? <i className="pa-skel" style={{ width: "70%" }} /> : <span>{i < stage ? facts[i] : NBSP}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function stepFacts(p: PricingPanelProps): (string | null)[] {
  const d = p.state.data;
  const m = d?.market;
  const rec = d?.choices.find((c) => c.recommended);
  return [
    p.distanceKm ? `${formatNumber(Math.round(p.distanceKm))} km` : null,
    // Facts from the answer only: never the build-up standing in for the floor.
    d?.costFloor ? `${formatMoneyWhole(d.costFloor.total)} floor` : null,
    !d ? null : !m || !m.available ? "No quotes on this lane yet" : m.isEstimate ? "Rough estimate only, no real quotes"
      : `${plural(m.n, "accepted quote")} · median ${formatMoneyWhole(m.median)}`,
    !d ? null : rec ? `Recommended: ${rec.label} ${formatMoneyWhole(rec.price)}` : d.choices.length ? `${d.choices.length} prices` : "Needs the missing costs first",
  ];
}

// ------------------------------------------------------------------ result

function Result(p: BodyProps & { data: PricingAnalysis }) {
  const { data, state } = p;
  const failedRefresh = state.status === "error" || state.status === "offline" || state.status === "unavailable";
  // Said elsewhere already: the alerts, the floor row, the market section or
  // the header. Each fact is shown once.
  const includeReturn = p.includeReturn ?? data.costFloor?.includeReturn ?? false;
  return (
    <div className={`pa__result${state.status === "refreshing" || p.paused ? " is-refreshing" : ""}`}>
      {failedRefresh && (
        <div className="pa-notice" role="status">
          {state.status === "offline" ? "Offline. " : "Couldn't refresh. "}Showing the last result.
          <button type="button" className="pa-link" onClick={state.retry}>Try again</button>
        </div>
      )}
      <Alerts data={data} customerName={p.customerName} onOneWay={p.returnApplicable ? () => p.onIncludeReturn(false) : null} includeReturn={includeReturn} />
      {/* The cost floor is said once, as the builder's Costs total. */}
      {data.choices.length > 0 && <ChoicesSection data={data} price={p.price} onApply={p.onApplyPrice} includeReturn={includeReturn}
        returnApplicable={p.returnApplicable} onIncludeReturn={p.onIncludeReturn} />}
      <MarketSection data={data} price={p.price} />
      <WhySection data={data} price={p.price} />
      <EvidenceSection data={data} customerName={p.customerName} />
    </div>
  );
}

// ---- alerts: at most two, lane first, then the customer
const LANE_CODES = ["empty_return_unpaid", "market_below_floor"];
/** ≤ 8-word titles for the panel's alerts; the server's sentence is on tap. */
const ALERT_TITLE: Record<string, string> = {
  empty_return_unpaid: "Lane pays below cost with empty return",
  market_below_floor: "Market pays below your floor",
  lane_below_floor: "Market pays below your floor",
  market_below_cost: "Market pays below your floor",
  price_sensitive: "Price-sensitive client on this lane",
};
type Alert = { key: string; tone: "danger" | "warning" | "info"; message: string; action?: ReactNode };

/** "{name} accepted 2 of their last 10 quotes on this lane. Declined at R 26 600 and R 28 700."
 *  Built only for an older server that doesn't send `price_sensitive` itself (same rule as K-4). */
function derivedPriceSensitive(d: PricingAnalysis, name: string): string | null {
  const c = d.customer;
  if (!c) return null;
  const la = c.laneAcceptance;
  const decided = c.recentLaneQuotes.filter((q) => q.outcome === "accepted" || q.outcome === "rejected");
  const median = d.market?.available && !d.market.isEstimate ? d.market.median : null;
  const declinedAbove = decided.slice(0, 4).filter((q) => q.outcome === "rejected" && median != null && q.price > median).length;
  if (!((la && la.decided >= 5 && (la.ratePct ?? 100) <= 30) || declinedAbove >= 2)) return null;
  const declined = decided.filter((q) => q.outcome === "rejected").slice(0, 2).map((q) => q.price).sort((a, b) => b - a);
  const won = la?.won ?? decided.filter((q) => q.outcome === "accepted").length;
  const of = la?.decided ?? decided.length;
  return `${name} accepted ${won} of their last ${of} quotes on this lane.${declined.length ? ` Declined at ${listAnd(declined.map((x) => formatMoneyWhole(x)))}.` : ""}`;
}

function alertsFor(data: PricingAnalysis, customerName: string | null): Alert[] {
  const name = data.customer?.name || customerName || "This client";
  const lane = data.attention.find((a) => LANE_CODES.includes(a.code))
    ?? data.warnings.find((w) => w.code === "market_below_floor" || w.code === "lane_below_floor" || w.code === "market_below_cost");
  const risk = data.customer?.paymentRisk;
  const riskAtt = data.attention.find((a) => /payment/.test(a.code)) ?? data.warnings.find((w) => /payment/.test(w.code));
  const sens = data.attention.find((a) => a.code === "price_sensitive");
  const out: Alert[] = [];
  if (lane) out.push({ key: lane.code, tone: "warning", message: lane.message });
  if (riskAtt || risk?.attention) {
    const band = risk?.band ?? ((riskAtt as { level?: string })?.level === "high" ? "high" : "medium");
    const msg = riskAtt?.message || `${name} ${risk!.label.charAt(0).toLowerCase()}${risk!.label.slice(1)}: ${risk!.basis ?? ""}`.trim();
    out.push({ key: "payment_risk", tone: band === "high" ? "danger" : "warning", message: msg });
  } else if (sens) {
    out.push({ key: "price_sensitive", tone: "info", message: sens.message });
  } else if (!data.r5) {
    const m = derivedPriceSensitive(data, name);
    if (m) out.push({ key: "price_sensitive", tone: "info", message: m });
  }
  return out;
}

function Alerts({ data, customerName, onOneWay, includeReturn }: { data: PricingAnalysis; customerName: string | null; onOneWay: (() => void) | null; includeReturn: boolean }) {
  const alerts = alertsFor(data, customerName);
  if (!alerts.length) return null;
  return (
    <div className="pa-alerts pa-reveal" style={{ ["--d" as string]: "0" }}>
      {alerts.map((a) => {
        // One line: the first sentence (or the part before a colon); the rest on tap.
        const m = a.message.match(/^(.+?[.:])\s+(.+)$/s);
        const head = ALERT_TITLE[a.key] ?? (m ? m[1] : a.message).replace(/[.:]$/, "");
        return (
          <p key={a.key} className={`pa-alert pa-alert--${a.tone}`}>
            <b>{tidy(head)}</b>
            {(m || ALERT_TITLE[a.key]) && <InfoTip label="More" trigger="click">{tidy(a.message)}</InfoTip>}
          </p>
        );
      })}
    </div>
  );
}

function Section({ title, aside, children, delay, label, className }: { title: string; aside?: ReactNode; children: ReactNode; delay: number; label?: string; className?: string }) {
  return (
    <section className={`pa-sec pa-reveal${className ? ` ${className}` : ""}`} style={{ ["--d" as string]: String(delay) }} aria-label={label || title}>
      <div className="pa-sec__head">
        <h3 className="pa-sec__title">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

// ---- choices
const ORDER: ChoiceKey[] = ["safe", "balanced", "stretch"];
const sortChoices = (cs: Choice[]) => [...cs].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));

function ChoicesSection({ data, price, onApply, includeReturn, returnApplicable, onIncludeReturn }: {
  data: PricingAnalysis; price: number; onApply: PricingPanelProps["onApplyPrice"]; includeReturn: boolean; returnApplicable: boolean; onIncludeReturn: (v: boolean) => void;
}) {
  const applied = readPrice(data, price).matchedChoice;
  const choices = sortChoices(data.choices);
  const m = data.market;
  const realMarket = !!m && m.available && !m.isEstimate;
  // One format per row: all % or all bands.
  const lks = rowLikelihoods(data, choices);
  const bands = choices.map((c) => { const l = lks.get(c.key); return l && l.level === "rules" ? l.band : undefined; });
  // Every row the same band: say it once, above the rows.
  const sameBand: Band | null = bands.every((b) => b != null && b === bands[0]) ? (bands[0] as Band) : null;
  const target = data.targetMarginPct != null ? Math.round(data.targetMarginPct) : null;
  return (
    <Section title="Choose a price" delay={1} className="pa-choose"
      aside={target != null ? <span className="pa-sec__hint">Margin · target {target}%</span> : null}>
      {!realMarket && (
        <p className="pa-choices__lead">No market data: floor{target != null ? ` + ${target}%` : ""}.</p>
      )}
      {sameBand && (
        <p className="pa-choices__band">All three: <span className={`pa-lk pa-lk--${sameBand}`}>{BAND_LABEL[sameBand]}</span></p>
      )}
      <div className="pa-choices" role="group" aria-label="Price choices">
        {choices.map((c) => {
          const l = lks.get(c.key) ?? null;
          const shown = sameBand || !l || (l.level === "rules" && l.band == null) ? null : l;
          return <ChoiceRow key={c.key} c={c} lk={shown} ariaLk={l && !(l.level === "rules" && l.band == null) ? l : null}
            applied={applied === c.key} onApply={() => onApply(c.price, c.key)} />;
        })}
      </div>
    </Section>
  );
}

function ChoiceRow({ c, lk, ariaLk, applied, onApply }: { c: Choice; lk: Likelihood | null; ariaLk: Likelihood | null; applied: boolean; onApply: () => void }) {
  const chance = ariaLk ? (ariaLk.level === "model" ? `${Math.round(ariaLk.pct)}% chance to win` : `${ariaLk.label} to win`) : null;
  return (
    <button type="button" className={`pa-choice${c.recommended ? " is-rec" : ""}${applied ? " is-applied" : ""}`}
      aria-pressed={applied} onClick={onApply}
      aria-label={`${c.label}${c.recommended ? ", recommended" : ""}: ${formatMoneyWhole(c.price)}, margin ${formatMoneyWhole(c.margin)} or ${signedPct(c.marginPct)}${chance ? `, ${chance}` : ""}. ${applied ? "In your quote." : "Use this price."}`}>
      <span className="pa-choice__label">
        {applied && <Check size={12} strokeWidth={2.75} className="pa-choice__check" aria-hidden="true" />}
        {/* Never "Recommended" on a price that is less likely to win. */}
        {c.label}{c.recommended && !(ariaLk && lkTone(ariaLk) === "less_likely") && <span className="pa-choice__rec">Recommended</span>}
      </span>
      <span className="pa-choice__price">{formatMoneyWhole(c.price)}</span>
      <span className="pa-choice__margin">{formatMoneyWhole(c.margin)} · {signedPct(c.marginPct)}</span>
      {lk ? <span className={`pa-lk pa-lk--${lkTone(lk)}`}>{likelihoodShort(lk)}</span> : <span aria-hidden="true" />}
    </button>
  );
}

/** The one way out of a loss, the same in the panel and the bar: the lowest
 *  choice whose price clears the floor (normally Safe). */
export function wayOutChoice(choices: Choice[], floor: number | null): Choice | null {
  if (floor == null) return null;
  return [...choices].sort((a, b) => a.price - b.price).find((c) => c.price >= floor) ?? null;
}

/** The market source line as received; each part keeps together and the line
 *  wraps only at the " · " separators (sibling text nodes). */
function TierLine({ m }: { m: NonNullable<PricingAnalysis["market"]> }) {
  // Compact: who and how many; the server's full label on hover.
  const who = m.tier === "platform" ? "TruckWys" : m.tier === "company" ? "Your quotes" : null;
  const parts = [who, m.n > 0 ? plural(m.n, "quote") : null, m.vehicleSpecific && m.vehicleName ? m.vehicleName : null].filter(Boolean) as string[];
  if (!parts.length) return null;
  return <p className="pa-tier" title={m.tierLabel ? tidy(m.tierLabel) : undefined}>{parts.map(tidy).join(" · ")}</p>;
}

// ---- market
function MarketSection({ data, price }: { data: PricingAnalysis; price: number }) {
  const m = data.market;
  const floor = data.costFloor?.total ?? null;
  if (m?.isEstimate && m.p25 != null && m.p75 != null) {
    const range = `R${NBSP}${formatNumber(Math.round(m.p25 / 1000))}–${formatNumber(Math.round(m.p75 / 1000))}k`;
    // The server flags an estimate that sits low against the floor (K-12);
    // an older server gets the same test here.
    const low = data.warnings.some((w) => w.code === "estimate_below_floor") || (!data.r5 && floor != null && m.p75 < 1.1 * floor);
    return (
      <Section title="Market" delay={2}>
        <p className="pa-quiet">{low ? <>Estimate {range}, below your floor. Not used.</> : <>Estimate {range}. Not used.</>}</p>
      </Section>
    );
  }
  return (
    <Section title="Market" delay={2}>
      {!m || !m.available ? (
        <p className="pa-quiet">No quotes on this lane yet.</p>
      ) : (
        <>
          <TierLine m={m} />
          {m.oneWayX2 && <p className="pa-tier pa-tier--x2">One-way quotes ×2.</p>}
          <MarketRange market={m} floor={floor} price={price > 0 ? price : null} />
          <p className="pa-range-legend">
            <span title={MARKET_RANGE_LABEL}><i className="pa-key pa-key--band" aria-hidden="true" />Middle half <span className="pa-nowrap">{formatMoneyWhole(m.p25)} – {formatMoneyWhole(m.p75)}</span></span>
            <span><i className="pa-key pa-key--median" aria-hidden="true" />Median {formatMoneyWhole(m.median)}</span>
          </p>
        </>
      )}
    </Section>
  );
}

// ---- why these prices
const WHY_CODES = ["cost", "market", "margin", "recommendation"];
function whyReasons(d: PricingAnalysis): string[] {
  if (d.reasoningItems.length) return d.reasoningItems.filter((r) => WHY_CODES.includes(r.code)).map((r) => tidy(r.text)).slice(0, 4);
  // Older server: the cost, market and margin sentences (its first three),
  // in the house words, then the recommendation without the curve-peak sentence.
  const name = d.customer?.name;
  const base = d.reasoning
    .filter((r) => !(name && r.includes(name)) && !/^Last quote|likelihood|payment/i.test(r))
    .slice(0, 3)
    .map((r) => r.replace(/\(middle (R)/g, "(median $1").replace(/\bmiddle\b(?! half)/g, "median"));
  const rec = d.recommendation?.reason?.replace(/\s*The model's best expected profit[^.]*\./i, "").trim();
  return [...base, ...(rec && !/middle of what|empty run home/i.test(rec) ? [rec] : [])].map(tidy).slice(0, 4);
}

function WhySection({ data, price }: { data: PricingAnalysis; price: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const lk = data.likelihood;
  const model = lk?.level === "model" ? lk.model : null;
  const reasons = whyReasons(data);
  if (!reasons.length && !lk) return null;
  // "You" only when the bar price is not one of the three.
  const atChoice = data.choices.some((c) => Math.abs(c.price - price) < 0.005);
  const t = lk?.rules;
  const hasBands = !model && t && t.likelyMax != null && t.evenMax != null;
  return (
    <div className="pa-sec pa-reveal" style={{ ["--d" as string]: "3" }}>
      <button type="button" className="pa-why" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <ChevronRight size={14} className="pa-why__chev" aria-hidden="true" />
        Why these prices
      </button>
      {open && (
        <div id={id} className="pa-why__body">
          <p className="pa-basis">{headlineOf(data)}</p>
          {reasons.length > 0 && <ul className="pa-reasons">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
          {model && (
            <figure className="pa-fig">
              <LikelihoodCurve curve={model.curve} range={model.range} choices={data.choices} price={!atChoice && price > 0 ? price : null}
                median={data.market?.available && !data.market.isEstimate ? data.market.median : null} />
              <figcaption className="pa-fig__cap">Chance to win by price, from {model.basisLabel || plural(model.nClosed, "closed quote")}.</figcaption>
            </figure>
          )}
          {hasBands && (
            <>
              <dl className="pa-dl pa-bands">
                <div><dt><span className="pa-lk pa-lk--likely">{BAND_LABEL.likely}</span></dt><dd>up to {formatMoneyWhole(t!.likelyMax)}</dd></div>
                {t!.evenMax! > t!.likelyMax! && <div><dt><span className="pa-lk pa-lk--even">{BAND_LABEL.even}</span></dt><dd>{formatMoneyWhole(t!.likelyMax)} to {formatMoneyWhole(t!.evenMax)}</dd></div>}
                <div><dt><span className="pa-lk pa-lk--less_likely">{BAND_LABEL.less_likely}</span></dt><dd>above {formatMoneyWhole(t!.evenMax)}</dd></div>
              </dl>
              {t!.basis.length > 0 && <p className="pa-basis">From: {t!.basis.map(tidy).join(" · ")}</p>}
            </>
          )}
          {!model && !hasBands && <p className="pa-basis">Not enough data yet.</p>}
        </div>
      )}
    </div>
  );
}

// ---- customer
function EvidenceSection({ data, customerName }: { data: PricingAnalysis; customerName: string | null }) {
  const c = data.customer;
  // A return trip compares against one-way history: say so on the table.
  const oneWay = !!data.market?.oneWayX2;
  const [histOpen, setHistOpen] = useState(false);
  const histId = useId();
  if (!c) return null;
  const name = c.name || customerName || "This client";
  const acc = c.acceptance;
  const la = c.laneAcceptance;
  const quotes = c.recentLaneQuotes.filter((q) => q.outcome !== "draft").slice(0, 5);
  // Payment advice is said once, in the alert; here only the chip (and the
  // basis when there is no alert).
  const inAlert = alertsFor(data, customerName).some((a) => a.key === "payment_risk");
  return (
    <Section title={name} delay={4} label="Client history">
      <div className="pa-facts">
        <div className="pa-fact">
          <span className="pa-fact__k">Accepts</span>
          <span className="pa-fact__v">{acc && acc.decided > 0
            ? <><span className="pa-nowrap">{`${acc.won} of ${acc.decided}`}</span>{la ? <>{" · "}<span className="pa-nowrap">{`${la.won} of ${la.decided} here`}</span></> : null}</>
            : "None decided"}</span>
        </div>
        {!inAlert && <div className="pa-fact">
          <span className="pa-fact__k">Payment</span>
          <span className="pa-fact__v">{c.paymentRisk
            ? <span title={!inAlert && c.paymentRisk.basis ? tidy(c.paymentRisk.basis) : undefined}><StatusChip tone={RISK_TONE[c.paymentRisk.band]} label={c.paymentRisk.label} /></span>
            : "No history"}</span>
        </div>}
      </div>
      {/* The lane's last quotes are detail: on tap. */}
      {quotes.length > 0 ? (
        <>
          <button type="button" className="pa-why" aria-expanded={histOpen} aria-controls={histId} onClick={() => setHistOpen((v) => !v)}>
            <ChevronRight size={14} className="pa-why__chev" aria-hidden="true" />
            On this lane · {quotes.length}{oneWay ? " one-way" : ""}
          </button>
          {histOpen && (
            <table className="pa-hist" id={histId}>
              <caption className="pa-sr">Last quotes to {name} on this lane</caption>
              <thead className="pa-sr"><tr><th scope="col">Date</th><th scope="col">Price</th><th scope="col">Outcome</th></tr></thead>
              <tbody>
                {quotes.map((q, i) => {
                  const o = OUTCOME[q.outcome] || { tone: "neutral" as StatusTone, label: q.outcome };
                  return (
                    <tr key={q.id ?? i}>
                      <td>{q.date ? formatDate(q.date) : "—"}</td>
                      <td className="pa-num">{formatMoneyWhole(q.price)}</td>
                      <td><StatusChip tone={o.tone} label={o.label} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <p className="pa-quiet">No quotes on this lane yet.</p>
      )}
    </Section>
  );
}

export type { Likelihood };
