import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate, formatMoney, formatMoneyWhole, formatNumber } from "@/lib/formatters";
import { StatusChip, type StatusTone } from "@/components/ui/StatusChip";
import { InfoTip } from "@/components/ui/InfoTip";
import { MarketRange } from "./MarketRange";
import { LikelihoodCurve } from "./LikelihoodCurve";
import { readPrice } from "./evaluate";
import type { PricingState } from "./usePricingAnalysis";
import { BAND_LABEL, type Choice, type ChoiceKey, type FloorLine, type Likelihood, type PricingAnalysis, type SourceKind } from "./types";
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
  /** The price in the bar, excl. VAT. */
  price: number;
  onApplyPrice: (price: number, key: ChoiceKey) => void;
  driver: { value: string; edited: boolean; onChange: (v: string) => void; onReset: () => void };
  includeReturn: boolean | null;
  onIncludeReturn: (v: boolean) => void;
  /** One-way trips only: a round trip already prices the way home. */
  returnApplicable: boolean;
  /** For the analysing steps: what is already known. */
  distanceKm?: number;
  buildUp?: number;
  /** Where "Set yours" (operating cost per km) goes. */
  settingsHref?: string;
}

const SOURCE_CHIP: Record<SourceKind, { tone: StatusTone; label: string }> = {
  official: { tone: "success", label: "Official" },
  calculated: { tone: "neutral", label: "Calculated" },
  company_actuals: { tone: "info", label: "Your actuals" },
  estimate: { tone: "warning", label: "Estimate" },
  user: { tone: "neutral", label: "You" },
};
const OUTCOME: Record<string, { tone: StatusTone; label: string }> = {
  accepted: { tone: "success", label: "Accepted" },
  rejected: { tone: "danger", label: "Declined" },
  open: { tone: "info", label: "Open" },
  expired: { tone: "neutral", label: "Expired" },
  draft: { tone: "neutral", label: "Draft" },
};
const RISK_TONE: Record<string, StatusTone> = { low: "success", medium: "warning", high: "danger", unknown: "neutral" };
const MINUS = "−";

/** Whole-number percent with a true minus sign. */
export const signedPct = (n: number) => `${n < 0 ? MINUS : ""}${Math.abs(Math.round(n))}%`;
/** Dot shade only (the words carry the meaning): a model % shades like its band. */
export const lkTone = (l: { level: "model"; pct: number } | { level: "rules"; band: string | null }) =>
  l.level === "model" ? (l.pct >= 60 ? "likely" : l.pct >= 35 ? "even" : "less_likely") : (l.band ?? "none");
/** One vocabulary: "chance to win", short form "72% to win". */
export const likelihoodShort = (l: { level: "model"; pct: number } | { level: "rules"; label: string } | null) =>
  !l ? null : l.level === "model" ? sharedShort("model", l.pct) : l.label;
/** House style for server sentences: median not "middle", whole rand per km,
 *  and money never splits across lines (NBSP in figures). */
const tidy = (t: string) => t
  .replace(/\bmiddle\b/g, "median")
  .replace(/R\s?(\d+)[.,](\d{2})\/km/g, (_m, r, c) => `R\u00a0${Math.round(Number(`${r}.${c}`))}/km`)
  .replace(/R (?=\d)/g, "R\u00a0")
  .replace(/(\d)[ ,](?=\d{3}\b)/g, "$1\u00a0");
/** "12 of 40" out of a reason like "Not enough closed quotes yet: 12 of 40". */
const closedCount = (reason: string | null | undefined) => reason?.match(/(\d+)\s+of\s+(\d+)/)?.slice(1, 3).join(" of ") ?? null;
/** "R 21k" for axis-style labels. */
export const randK = (v: number) => `R ${formatNumber(Math.round(v / 1000))}k`;

/** Steps the analysis builds, in order (also the empty-state explainer). */
const STEPS = [
  { key: "route", title: "Route and costs", text: "Fuel, tolls, driver and your running costs." },
  { key: "floor", title: "Cost floor", text: "What the job costs you to run." },
  { key: "market", title: "Market range", text: "What this lane has been paid." },
  { key: "choices", title: "Three prices", text: "Each with margin and chance to win." },
];

export function PricingPanel(p: PricingPanelProps) {
  const { state, phase } = p;
  const data = state.data;
  const loading = state.status === "loading";
  const refreshing = state.status === "refreshing";
  const titleId = useId();
  // The step-by-step reveal plays once, for the first result after inputs
  // become ready; later updates swap in place.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { if (phase !== "ready") setRevealed(false); }, [phase]);
  const onRevealed = useCallback(() => setRevealed(true), []);

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
  const belowFloor = floor != null && p.price > 0 && p.price < floor;
  // The builder passes the settled price (not each keystroke), so this
  // announces once per real crossing, either way.
  const wasBelow = useRef(false);
  useEffect(() => {
    if (belowFloor === wasBelow.current) return;
    wasBelow.current = belowFloor;
    setAnnounce(belowFloor ? "Price is below your cost floor." : "Price is above your cost floor again.");
  }, [belowFloor]);

  let sub = "Cost floor, market range and three prices";
  const lk = data?.likelihood;
  if (lk?.level === "model" && lk.model) sub = `Chance to win from ${lk.model.basisLabel || `${formatNumber(lk.model.nClosed)} closed quotes`}`;
  else if (lk) {
    const cnt = closedCount(lk.reason);
    const noBands = !!data && data.choices.length > 0 && data.choices.every((c) => !c.likelihood || (c.likelihood.level === "rules" && c.likelihood.band == null));
    sub = lk.short
      ?? (noBands ? (lk.reason ? lk.reason.replace(/\.$/, "") : "Chance to win needs closed quotes or market data")
        : cnt ? `Chance to win as bands · ${cnt} closed quotes for a %`
        : lk.reason ? lk.reason.replace(/\.$/, "") : "Chance to win as bands");
  }

  return (
    <section className="pa" aria-labelledby={titleId} aria-busy={loading || refreshing || undefined}>
      <header className="pa__head">
        <div className="pa__titles">
          <h2 id={titleId} className="pa__title">Pricing analysis</h2>
          <p className="pa__sub">{sub}</p>
        </div>
        {(loading || refreshing || phase === "route") && (
          <span className="pa__status"><i className="pa-pulse" aria-hidden="true" />{loading || phase === "route" ? "Analysing" : "Updating"}</span>
        )}
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
    return <div className="pa__body"><p className="pa-msg">{p.blockedReason || "Pricing analysis is paused while this quote can't be priced."}</p></div>;
  }
  if (phase === "needs") return <Explainer />;
  if (phase === "route_error") {
    return <div className="pa__body"><p className="pa-msg"><b>The route couldn't be priced.</b> Change an address or the truck to try again.</p></div>;
  }
  if (phase === "route" || (state.status === "loading" && !state.data)) return <Analysing start={phase === "route" ? 0 : 1} facts={stepFacts(p)} />;
  if (state.data && !p.revealed) return <Analysing start={1} facts={stepFacts(p)} done onDone={p.onRevealed} />;
  if (!state.data) {
    if (state.status === "unavailable") {
      return <div className="pa__body"><p className="pa-msg"><b>Pricing analysis isn't available on this account.</b> Your price build-up is still correct.</p></div>;
    }
    if (state.status === "offline") {
      return <div className="pa__body"><p className="pa-msg"><b>You're offline.</b> Your price build-up is still correct. The analysis resumes when you're back online.</p>
        <button type="button" className="tw-btn tw-btn--sm pa-retry" onClick={state.retry}>Try again</button></div>;
    }
    if (state.status === "error") {
      return <div className="pa__body"><p className="pa-msg"><b>Pricing analysis is unavailable right now.</b> Your price build-up is still correct.</p>
        <button type="button" className="tw-btn tw-btn--sm pa-retry" onClick={state.retry}>Try again</button></div>;
    }
    return <Analysing start={1} facts={stepFacts(p)} />;
  }
  return <Result {...p} data={state.data} />;
}

function Explainer() {
  return (
    <div className="pa__body">
      <p className="pa-intro">Once the route is priced, you get your cost floor, the lane's market and three prices to pick from.</p>
      <ol className="pa-steps">
        {STEPS.map((s, i) => (
          <li key={s.key} className="pa-step">
            <span className="pa-step__num" aria-hidden="true">{i + 1}</span>
            <span className="pa-step__text"><b>{s.title}</b><span>{s.text}</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Steps advance on their own (~280 ms) while the request is in flight; once
 *  the result is in, each step says what it found, then the result shows. */
function Analysing({ start, facts, done, onDone }: { start: number; facts: (string | null)[]; done?: boolean; onDone?: () => void }) {
  const [stage, setStage] = useState(start);
  useEffect(() => { setStage((s) => Math.max(s, start)); }, [start]);
  useEffect(() => {
    if (start === 0 && !done) return; // waiting on the route itself
    const id = setInterval(() => setStage((s) => Math.min(s + 1, done ? STEPS.length : STEPS.length - 1)), done ? 160 : 280);
    return () => clearInterval(id);
  }, [start, done]);
  useEffect(() => {
    if (!done || stage < STEPS.length) return;
    const t = setTimeout(() => onDone?.(), 180);
    return () => clearTimeout(t);
  }, [done, stage, onDone]);
  return (
    <div className="pa__body">
      <ol className="pa-steps is-live" aria-label="Analysis progress">
        {STEPS.map((s, i) => (
          <li key={s.key} className={`pa-step${i < stage ? " is-done" : i === stage ? " is-active" : ""}`}>
            <span className="pa-step__num" aria-hidden="true">{i < stage ? <Check size={11} strokeWidth={2.5} /> : i + 1}</span>
            <span className="pa-step__text"><b>{s.title}</b>
              {i === stage ? <i className="pa-skel" style={{ width: "70%" }} /> : <span>{i < stage ? (facts[i] || "Done") : "\u00a0"}</span>}
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
  return [
    p.distanceKm ? `${formatNumber(Math.round(p.distanceKm))} km` : null,
    d?.costFloor ? `Floor ${formatMoneyWhole(d.costFloor.total)}` : p.buildUp ? `Build-up ${formatMoneyWhole(p.buildUp)}` : null,
    !d ? null : !m || !m.available ? "No quotes on this lane yet" : m.isEstimate ? "Rough estimate only" : `${formatNumber(m.n)} accepted quotes`,
    d ? `${d.choices.length} prices` : null,
  ];
}

// ------------------------------------------------------------------ result

function Result(p: BodyProps & { data: PricingAnalysis }) {
  const { data, state } = p;
  const failedRefresh = state.status === "error" || state.status === "offline" || state.status === "unavailable";
  const HIDDEN = [...TOP_CODES, "below_floor", "estimate_market", "estimate_fixed_cost", "no_driver_allowance", "driver_needs_input", "payment_risk", "payment_attention"];
  const notes = [...new Set(missingNotes(data.missing).concat(data.warnings.filter((w) => !HIDDEN.includes(w.code) && !w.code.startsWith("payment")).map((w) => w.message)))];
  return (
    <div className={`pa__result${state.status === "refreshing" ? " is-refreshing" : ""}`}>
      {failedRefresh && (
        <div className="pa-notice" role="status">
          {state.status === "offline" ? "You're offline. " : "Couldn't refresh. "}Showing the last analysis; your price build-up is still correct.
          <button type="button" className="pa-link" onClick={state.retry}>Try again</button>
        </div>
      )}
      <TopAlerts data={data} customerName={p.customerName} />
      {data.costFloor && <FloorSection {...p} />}
      {data.choices.length > 0 && <ChoicesSection data={data} price={p.price} onApply={p.onApplyPrice} includeReturn={p.includeReturn ?? data.costFloor?.includeReturn ?? false} returnApplicable={p.returnApplicable} />}
      <MarketSection data={data} price={p.price} />
      <WhySection data={data} price={p.price} />
      <EvidenceSection data={data} customerName={p.customerName} />
      {notes.length > 0 && (
        <div className="pa-sec pa-reveal" style={{ ["--d" as string]: "5" }}>
          {notes.map((m) => <p key={m} className="pa-note">{m}</p>)}
        </div>
      )}
    </div>
  );
}

/** Warnings that change the decision go to the top of the panel. */
const TOP_CODES = ["market_below_floor", "lane_below_floor", "market_below_cost"];
const isTopWarning = (code: string) => TOP_CODES.includes(code) || /market.*(below|under)/.test(code);

function TopAlerts({ data, customerName }: { data: PricingAnalysis; customerName: string | null }) {
  const risk = data.customer?.paymentRisk;
  const riskWarning = data.warnings.find((w) => w.code.startsWith("payment"));
  const lane = data.warnings.filter((w) => isTopWarning(w.code));
  const name = data.customer?.name || customerName || "This client";
  if (!risk?.attention && !lane.length) return null;
  return (
    <div className="pa-alerts pa-reveal" style={{ ["--d" as string]: "0" }}>
      {lane.map((w) => <p key={w.code} className="pa-risk pa-risk--medium"><b>{w.message}</b></p>)}
      {risk?.attention && (
        <p className={`pa-risk pa-risk--${risk.band}`}>
          <b>{name} {risk.label.charAt(0).toLowerCase() + risk.label.slice(1)}.</b>{" "}
          {riskWarning?.message || [risk.basis, "Consider a deposit."].filter(Boolean).join(". ").replace(/\.\./g, ".")}
        </p>
      )}
    </div>
  );
}

const MISSING_COPY: Record<string, string> = {
  vehicle: "No vehicle type picked, so running costs use fleet defaults. Pick one for a sharper floor.",
  customer: "Pick a client to see their history on this lane.",
  weight: "Add the weight for a sharper fuel and running-cost figure.",
};
const missingNotes = (m: string[]) => m.filter((k) => k !== "route").map((k) => MISSING_COPY[k]).filter((s): s is string => !!s);

function Section({ title, aside, children, delay, label, titleExtra }: { title: string; aside?: ReactNode; children: ReactNode; delay: number; label?: string; titleExtra?: ReactNode }) {
  return (
    <section className="pa-sec pa-reveal" style={{ ["--d" as string]: String(delay) }} aria-label={label || title}>
      <div className="pa-sec__head">
        <h3 className="pa-sec__title">{title}{titleExtra}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

// ---- choices
/** A short descriptor that is true of each card by construction (prices are ordered). */
const DESCRIPTOR: Record<ChoiceKey, string> = { safe: "Lowest price", balanced: "Middle price", stretch: "Highest margin" };

function ChoicesSection({ data, price, onApply, includeReturn, returnApplicable }: {
  data: PricingAnalysis; price: number; onApply: PricingPanelProps["onApplyPrice"]; includeReturn: boolean; returnApplicable: boolean;
}) {
  const applied = readPrice(data, price).matchedChoice;
  const order: ChoiceKey[] = ["safe", "balanced", "stretch"];
  const choices = [...data.choices].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const m = data.market;
  const floorBased = !m || !m.available || m.isEstimate;
  // No band anywhere: the subtitle already says why; cards don't repeat it.
  const noJudgement = choices.every((c) => !c.likelihood || (c.likelihood.level === "rules" && c.likelihood.band == null));
  const ifEmpty = !includeReturn && returnApplicable && choices.every((c) => c.marginPctIfEmptyReturn != null)
    ? choices.map((c) => signedPct(c.marginPctIfEmptyReturn!)).join(" / ") : null;
  return (
    <Section title="Choose a price" delay={1}
      aside={data.targetMarginPct != null ? <span className="pa-sec__hint">Target margin {Math.round(data.targetMarginPct)}%</span> : null}>
      {floorBased && (
        <p className="pa-choices__lead">Built from your cost floor and {data.targetMarginPct != null ? `${Math.round(data.targetMarginPct)}% ` : ""}target margin.</p>
      )}
      <div className="pa-choices" role="group" aria-label="Price choices">
        {choices.map((c) => <ChoiceCard key={c.key} c={c} applied={applied === c.key} hideLikelihood={noJudgement} onApply={() => onApply(c.price, c.key)} />)}
      </div>
      {ifEmpty && <p className="pa-note pa-ifempty">If the truck returns empty: margins {ifEmpty}</p>}
    </Section>
  );
}

function ChoiceCard({ c, applied, hideLikelihood, onApply }: { c: Choice; applied: boolean; hideLikelihood: boolean; onApply: () => void }) {
  const lk = hideLikelihood ? null : c.likelihood;
  return (
    <button type="button" className={`pa-choice${c.recommended ? " is-rec" : ""}${applied ? " is-applied" : ""}`}
      aria-pressed={applied} onClick={onApply}
      aria-label={`${c.label}${c.recommended ? ", recommended" : ""}: ${formatMoneyWhole(c.price)}, margin ${formatMoneyWhole(c.margin)} or ${signedPct(c.marginPct)}${lk ? `, ${likelihoodShort(lk)}` : ""}.${applied ? " In your quote." : " Use this price."}`}>
      <span className="pa-choice__top">
        <span className="pa-choice__label">{c.label}{c.recommended && <span className="pa-choice__rec">Recommended</span>}</span>
        <span className="pa-choice__price">{formatMoneyWhole(c.price)}</span>
      </span>
      <span className="pa-choice__meta">
        <span>Margin {formatMoneyWhole(c.margin)} · {signedPct(c.marginPct)}</span>
        {lk && <span className={`pa-lk pa-lk--${lkTone(lk)}`}>{likelihoodShort(lk)}</span>}
      </span>
      <span className="pa-choice__sum"><span className="pa-choice__desc">{DESCRIPTOR[c.key]}</span>{c.summary ? ` · ${tidy(c.summary)}` : ""}</span>
      <span className="pa-choice__state" aria-hidden="true">
        {applied ? <><Check size={12} strokeWidth={2.5} /> In your quote</> : "Use this price"}
      </span>
    </button>
  );
}

// ---- 2. cost floor: one summary row, lines inside
function FloorSection(p: BodyProps & { data: PricingAnalysis }) {
  const f = p.data.costFloor!;
  const driverLine = f.lines.find((l) => l.key === "driver_allowance");
  const driverMissing = !!driverLine?.needsInput && !p.driver.edited;
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  // Missing driver figure: open straight onto it the first time it shows.
  const openedForDriver = useRef(false);
  useEffect(() => {
    if (driverMissing && !openedForDriver.current) { openedForDriver.current = true; setOpen("driver_allowance"); }
  }, [driverMissing]);
  const includeReturn = p.includeReturn ?? f.includeReturn;
  const id = useId();
  const under = p.belowFloor ? f.total - p.price : 0;
  return (
    <section className={`pa-sec pa-reveal pa-floor${p.belowFloor ? " is-below" : ""}`} style={{ ["--d" as string]: "1" }} aria-label="Cost floor">
      <div className="pa-floor__head">
        <h3 className="pa-sec__title">
          Cost floor
          <InfoTip label="What the cost floor is">What this job costs you to run, before any profit: fuel, tolls, driver, border fees and your operating costs per km.</InfoTip>
        </h3>
        <button type="button" className="pa-floor__toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((v) => !v)}>
          <span className="pa-floor__fig">{formatMoneyWhole(f.total)}</span>
          <ChevronRight size={14} className="pa-floor__chev" aria-hidden="true" />
          <span className="pa-sr">{expanded ? "Hide the cost lines" : "Show the cost lines"}</span>
        </button>
      </div>
      {f.fixedCostPerKm?.source === "vehicle_default" && (
        <p className="pa-floor__est">
          Operating cost is an estimate ({formatMoney(f.fixedCostPerKm.value)}/km)
          {p.settingsHref && <> · <Link to={p.settingsHref} className="pa-link pa-link--inline">Set yours</Link></>}
        </p>
      )}
      {(driverMissing || p.belowFloor) && (
        <p className="pa-floor__hint">
          {p.belowFloor && <span className="pa-floor__under">{formatMoneyWhole(under)} below floor.</span>}
          {p.belowFloor && driverMissing ? " " : ""}
          {driverMissing && <span>Excludes driver allowance{driverLine?.nights ? ` for ${driverLine.nights} night${driverLine.nights === 1 ? "" : "s"}` : ""}: not set yet. <button type="button" className="pa-link pa-link--inline" onClick={() => { setExpanded(true); setOpen("driver_allowance"); }}>Add one</button></span>}
        </p>
      )}
      {expanded && (
        <div id={id} className="pa-floor__body">
          {f.perKm != null && <p className="pa-floor__perkm">{formatMoneyWhole(f.perKm)}/km all-in, incl. fuel and tolls</p>}
          <ul className="pa-lines">
            {f.lines.map((l) => (
              <FloorRow key={l.key} line={l} open={open === l.key} onToggle={() => setOpen(open === l.key ? null : l.key)}
                driver={l.key === "driver_allowance" ? p.driver : null} missing={l.key === "driver_allowance" && driverMissing}
                fixed={l.key === "fixed_cost" ? f.fixedCostPerKm : null} />
            ))}
          </ul>
          {p.returnApplicable && f.returnAvailable && (
            <button type="button" role="switch" aria-checked={includeReturn} className="pa-toggle" onClick={() => p.onIncludeReturn(!includeReturn)}>
              <span className="pa-switch" aria-hidden="true"><span className="pa-switch__knob" /></span>
              <span className="pa-toggle__text">
                <b>Include the empty return</b>
                <span>{includeReturn ? "The run home empty is in the floor." : "Leave out if a load is likely back."}</span>
              </span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function FloorRow({ line, open, onToggle, driver, fixed, missing }: {
  line: FloorLine; open: boolean; onToggle: () => void;
  driver: PricingPanelProps["driver"] | null;
  fixed: NonNullable<PricingAnalysis["costFloor"]>["fixedCostPerKm"];
  missing: boolean;
}) {
  const detailId = useId();
  const kind: SourceKind = driver?.edited ? "user" : line.source.kind;
  const isFixedEstimate = !!fixed && fixed.source === "vehicle_default";
  const chip = missing
    ? { tone: "warning" as StatusTone, label: "Not set · Add" }
    : line.key === "driver_allowance" && driver?.edited
      ? { tone: "neutral" as StatusTone, label: "Your figure" }
      : line.key === "driver_allowance" && line.amount === 0 && line.nights === 0
        ? { tone: "neutral" as StatusTone, label: "None due (same day)" }
        : line.key === "fuel" && kind === "official"
          ? { tone: "success" as StatusTone, label: "Official R/L" }
          : { ...SOURCE_CHIP[kind], label: isFixedEstimate ? "Estimate" : SOURCE_CHIP[kind].label };
  return (
    <li className={`pa-line${open ? " is-open" : ""}`}>
      <button type="button" className="pa-line__row" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
        <span className="pa-line__label">{line.label}</span>
        <StatusChip tone={chip.tone} label={chip.label} title={line.source.label || undefined} />
        <span className="pa-line__amt">{missing ? "—" : formatMoneyWhole(line.amount)}</span>
        <ChevronRight size={14} className="pa-line__chev" aria-hidden="true" />
        <span className="pa-sr">{open ? "Hide details" : "Show details"}</span>
      </button>
      {open && (
        <div id={detailId} className="pa-line__detail">
          {line.key === "fuel" && kind === "official" && <p className="pa-line__basis">Official price per litre × your truck's consumption.</p>}
          {missing
            ? <p className="pa-line__basis">{line.nights ? `${line.nights} night${line.nights === 1 ? "" : "s"} away. ` : ""}No approved allowance on record. Add the figure you pay so the floor is complete.</p>
            : line.basis && !(line.key === "driver_allowance" && driver?.edited) && <p className="pa-line__basis">{tidy(line.basis)}</p>}
          {driver && (
            <div className="pa-line__edit">
              <label className="pa-field">
                <span>Allowance for this trip (R)</span>
                <input type="number" inputMode="decimal" min={0} value={driver.value} onChange={(e) => driver.onChange(e.target.value)} />
              </label>
              {driver.edited && line.suggested != null && <button type="button" className="pa-link" onClick={driver.onReset}>Use the approved figure</button>}
            </div>
          )}
          {isFixedEstimate && (
            <p className="pa-line__basis">Estimate from defaults. Once trips with recorded costs come in, your own figure is used instead.</p>
          )}
          {fixed && !isFixedEstimate && fixed.trips != null && fixed.trips > 0 && (
            <p className="pa-line__basis">From {formatNumber(fixed.trips)} trips{fixed.window ? `, ${fixed.window}` : ""}.</p>
          )}
          {line.details.length > 0 && !missing && (
            <dl className="pa-dl">
              {line.details.map((d) => (<div key={d.label}><dt>{d.label}</dt><dd>{d.value}</dd></div>))}
            </dl>
          )}
          {(line.source.label || line.source.asOf || line.source.url) && !missing && (
            <p className="pa-line__src">
              {line.source.label}{line.source.asOf ? `${line.source.label ? " · " : ""}as of ${formatDate(line.source.asOf)}` : ""}
              {line.source.url && (
                <a href={line.source.url} target="_blank" rel="noopener noreferrer" className="pa-link">
                  Source <ExternalLink size={11} aria-hidden="true" /><span className="pa-sr"> (opens in a new tab)</span>
                </a>
              )}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** "TruckWys platform · 16 quotes · 180 days" from the structured fields. */
function tierShort(m: NonNullable<PricingAnalysis["market"]>): string | null {
  const days = m.tierLabel?.match(/(\d+)\s*days/)?.[1];
  const who = m.tier === "platform" ? "TruckWys platform" : m.tier === "company" ? "Your own quotes" : null;
  if (!who) return m.tierLabel;
  return [who, m.n > 0 ? `${formatNumber(m.n)} accepted quote${m.n === 1 ? "" : "s"}` : null, days ? `${days} days` : null].filter(Boolean).join(" · ");
}

// ---- 3. market
function MarketSection({ data, price }: { data: PricingAnalysis; price: number }) {
  const m = data.market;
  const floor = data.costFloor?.total ?? null;
  if (m?.isEstimate && m.p25 != null && m.p75 != null) {
    // An estimate is never drawn as a market band.
    return (
      <Section title="Market range" delay={2}>
        <p className="pa-quiet">Rough SA estimate R {formatNumber(Math.round(m.p25 / 1000))}–{formatNumber(Math.round(m.p75 / 1000))}k · no real quotes on this lane yet, not used for these prices.</p>
      </Section>
    );
  }
  return (
    <Section title="Market range" delay={2}>
      {!m || !m.available ? (
        <p className="pa-quiet">No quotes on this lane yet, so the prices above work from your cost floor and target margin.</p>
      ) : (
        <>
          <p className="pa-tier">{tierShort(m)}</p>
          <MarketRange market={m} floor={floor} price={price > 0 ? price : null} />
          <p className="pa-range-legend">
            <span><i className="pa-key pa-key--band" aria-hidden="true" />{MARKET_RANGE_LABEL} {formatMoneyWhole(m.p25)} to {formatMoneyWhole(m.p75)}</span>
            <span><i className="pa-key pa-key--median" aria-hidden="true" />Median {formatMoneyWhole(m.median)}</span>
          </p>
        </>
      )}
    </Section>
  );
}

// ---- 4. why
function WhySection({ data, price }: { data: PricingAnalysis; price: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const lk = data.likelihood;
  const model = lk?.level === "model" ? lk.model : null;
  if (!data.reasoning.length && !lk) return null;
  const reasons = [...new Set(data.reasoning.map(tidy))];
  const said = (t: string | null | undefined) => !!t && reasons.some((r) => r.includes(t.replace(/\.$/, "")));
  const peak = model?.curve.reduce<null | { price: number; expectedProfit: number | null }>((best, c) =>
    c.expectedProfit != null && (!best || (best.expectedProfit ?? -Infinity) < c.expectedProfit) ? c : best, null);
  return (
    <div className="pa-sec pa-reveal" style={{ ["--d" as string]: "3" }}>
      <button type="button" className="pa-why" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <ChevronRight size={14} className="pa-why__chev" aria-hidden="true" />
        Why these prices
      </button>
      {open && (
        <div id={id} className="pa-why__body">
          {reasons.length > 0 && <ul className="pa-reasons">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
          {model && (
            <figure className="pa-fig">
              <LikelihoodCurve curve={model.curve} range={model.range} choices={data.choices} price={price > 0 ? price : null} />
              <figcaption className="pa-fig__cap">
                <span><i className="pa-key pa-key--line" aria-hidden="true" />Chance to win</span>
                <span><i className="pa-key pa-key--wash" aria-hidden="true" />Expected profit</span>
                <span><i className="pa-key pa-key--you" aria-hidden="true" />Your price</span>
              </figcaption>
              {peak && peak.expectedProfit != null && (
                <p className="pa-basis">Best expected profit ≈ {formatMoneyWhole(Math.round(peak.expectedProfit / 100) * 100)}, near {formatMoneyWhole(Math.round(peak.price / 100) * 100)}.</p>
              )}
              <table className="pa-twin">
                <caption className="pa-sr">Choices on the curve</caption>
                <tbody>
                  {data.choices.map((c) => (
                    <tr key={c.key}><th scope="row">{c.label}</th><td>{formatMoneyWhole(c.price)}</td><td>{likelihoodShort(c.likelihood) ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
              {!said(model.basisLabel) && <p className="pa-basis">Based on {model.basisLabel || `${formatNumber(model.nClosed)} closed quotes`}</p>}
            </figure>
          )}
          {!model && lk?.rules && (
            <>
              {lk.rules.likelyMax != null && lk.rules.evenMax != null && (
                <dl className="pa-dl pa-bands">
                  <div><dt>{BAND_LABEL.likely}</dt><dd>up to {formatMoneyWhole(lk.rules.likelyMax)}</dd></div>
                  {lk.rules.evenMax > lk.rules.likelyMax && <div><dt>{BAND_LABEL.even}</dt><dd>{formatMoneyWhole(lk.rules.likelyMax)} to {formatMoneyWhole(lk.rules.evenMax)}</dd></div>}
                  <div><dt>{BAND_LABEL.less_likely}</dt><dd>above {formatMoneyWhole(lk.rules.evenMax)}</dd></div>
                </dl>
              )}
              {lk.rules.basis.length > 0 && (
                <>
                  <p className="pa-basis">The bands come from:</p>
                  <ul className="pa-reasons pa-reasons--small">{lk.rules.basis.map((b) => <li key={b}>{b}</li>)}</ul>
                </>
              )}
            </>
          )}
          {lk?.reason && !said(lk.reason) && <p className="pa-basis">{lk.reason}</p>}
        </div>
      )}
    </div>
  );
}

// ---- 5. customer & lane evidence
function EvidenceSection({ data, customerName }: { data: PricingAnalysis; customerName: string | null }) {
  const c = data.customer;
  if (!c) return null;
  const name = c.name || customerName || "This client";
  const acc = c.acceptance;
  const quotes = c.recentLaneQuotes.filter((q) => q.outcome !== "draft");
  return (
    <Section title={name} delay={4} label="Client history">
      <div className="pa-facts">
        <div className="pa-fact">
          <span className="pa-fact__k">Accepts{acc?.scope === "lane" ? " (this lane)" : " (all lanes)"}</span>
          <span className="pa-fact__v">{acc && acc.decided > 0 ? `${acc.won} of ${acc.decided} quotes` : "No decided quotes yet"}</span>
        </div>
        <div className="pa-fact">
          <span className="pa-fact__k">Payment</span>
          <span className="pa-fact__v">{c.paymentRisk
            ? <StatusChip tone={RISK_TONE[c.paymentRisk.band]} label={c.paymentRisk.label} />
            : "No payment history yet"}</span>
        </div>
        {c.paymentRisk?.basis && !c.paymentRisk.attention && c.paymentRisk.basis.toLowerCase() !== c.paymentRisk.label.toLowerCase()
          && !/^no invoices/i.test(c.paymentRisk.basis) && <p className="pa-fact__basis">{c.paymentRisk.basis}</p>}
      </div>
      <h4 className="pa-sub">On this lane</h4>
      {quotes.length > 0 ? (
        <table className="pa-hist">
          <caption className="pa-sr">Last quotes to {name} on this lane</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Price</th><th scope="col">Outcome</th></tr></thead>
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
      ) : (
        <p className="pa-quiet">No earlier quotes on this lane.</p>
      )}
    </Section>
  );
}

export type { Likelihood };
