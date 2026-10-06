import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight, ExternalLink } from "lucide-react";
import { formatDate, formatMoney, formatMoneyWhole, formatNumber } from "@/lib/formatters";
import { StatusChip, type StatusTone } from "@/components/ui/StatusChip";
import { MarketRange } from "./MarketRange";
import { LikelihoodCurve } from "./LikelihoodCurve";
import { readPrice } from "./evaluate";
import { likelihoodLabel } from "@/lib/pricing";
import type { PricingState } from "./usePricingAnalysis";
import { BAND_LABEL, type Choice, type ChoiceKey, type FloorLine, type Likelihood, type PricingAnalysis, type SourceKind } from "./types";
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
};
const RISK_TONE: Record<string, StatusTone> = { low: "success", medium: "warning", high: "danger", unknown: "neutral" };

const pct0 = (n: number) => `${Math.round(n)}%`;
/** Dot shade only (the words carry the meaning): a model % shades like its band. */
export const lkTone = (l: { level: "model"; pct: number } | { level: "rules"; band: string | null }) =>
  l.level === "model" ? (l.pct >= 60 ? "likely" : l.pct >= 35 ? "even" : "less_likely") : (l.band ?? "none");
/** Same words as quote detail (src/lib/pricing.ts). */
const likelihoodText = (l: Likelihood | null) =>
  !l ? null : l.level === "model" ? likelihoodLabel("model", l.pct) : l.label;

/** Steps the analysis builds, in order (also the empty-state explainer). */
const STEPS = [
  { key: "route", title: "Route and costs", text: "Fuel, tolls, driver allowance, border fees and your fixed cost per km." },
  { key: "floor", title: "Cost floor", text: "The least this job can go for without losing money." },
  { key: "market", title: "Market range", text: "What this lane has been quoted at, and how many quotes that is." },
  { key: "choices", title: "Three prices", text: "Safe, balanced and stretch, each with margin and chance of acceptance." },
];

export function PricingPanel(p: PricingPanelProps) {
  const { state, phase } = p;
  const data = state.data;
  const loading = state.status === "loading";
  const refreshing = state.status === "refreshing";
  const titleId = useId();

  // A short, polite announcement when a fresh result lands (not per keystroke).
  const [announce, setAnnounce] = useState("");
  const lastAnnounced = useRef<string | null>(null);
  useEffect(() => {
    if (state.status !== "ready" || !data) return;
    const rec = data.choices.find((c) => c.recommended);
    const msg = rec ? `Pricing analysis updated. Recommended ${formatMoneyWhole(rec.price)}.` : "Pricing analysis updated.";
    if (msg !== lastAnnounced.current) { lastAnnounced.current = msg; setAnnounce(msg); }
  }, [state.status, data]);

  let sub = "Cost floor, market range and three prices";
  if (data?.likelihood?.level === "model" && data.likelihood.model) sub = `Model-based · ${data.likelihood.model.basisLabel}`;
  else if (data?.likelihood) sub = "Rules-based · not enough closed quotes for a model yet";

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
      <Body {...p} />
    </section>
  );
}

function Body(p: PricingPanelProps) {
  const { state, phase } = p;
  if (phase === "blocked") {
    return <div className="pa__body"><p className="pa-msg">{p.blockedReason || "Pricing analysis is paused while this quote can't be priced."}</p></div>;
  }
  if (phase === "needs") return <Explainer needs={p.needs} />;
  if (phase === "route_error") {
    return <div className="pa__body"><p className="pa-msg"><b>The route couldn't be priced.</b> Change an address or the truck to try again. Pricing analysis starts once the route is in.</p></div>;
  }
  if (phase === "route" || (state.status === "loading" && !state.data)) return <Analysing stage={phase === "route" ? 0 : 1} />;
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
    return <Analysing stage={1} />;
  }
  return <Result {...p} data={state.data} />;
}

function Explainer({ needs }: { needs: string[] }) {
  return (
    <div className="pa__body">
      <p className="pa-intro">Once the route is priced, this works out what the job costs you, where the lane's market sits, and three prices with your chance of winning each.</p>
      <ol className="pa-steps">
        {STEPS.map((s) => (
          <li key={s.key} className="pa-step">
            <span className="pa-step__mark" aria-hidden="true" />
            <span className="pa-step__text"><b>{s.title}</b><span>{s.text}</span></span>
          </li>
        ))}
      </ol>
      {needs.length > 0 && (
        <p className="pa-needs">Still needed: <span>{needs.join(", ")}</span></p>
      )}
    </div>
  );
}

function Analysing({ stage }: { stage: number }) {
  return (
    <div className="pa__body">
      <ol className="pa-steps is-live" aria-label="Analysis progress">
        {STEPS.map((s, i) => (
          <li key={s.key} className={`pa-step${i < stage ? " is-done" : i === stage ? " is-active" : ""}`}>
            <span className="pa-step__mark" aria-hidden="true">{i < stage ? <Check size={11} strokeWidth={2.5} /> : null}</span>
            <span className="pa-step__text"><b>{s.title}</b>
              {i === stage ? <i className="pa-skel" style={{ width: "70%" }} /> : <span>{i < stage ? "Done" : "Waiting"}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ------------------------------------------------------------------ result

function Result(p: PricingPanelProps & { data: PricingAnalysis }) {
  const { data, state } = p;
  const failedRefresh = state.status === "error" || state.status === "offline" || state.status === "unavailable";
  // Reveal the sections in order the first time a result lands for this quote.
  const [revealKey] = useState(() => Date.now());
  const shownWarnings = data.warnings.filter((w) => !["below_floor", "estimate_market", "estimate_fixed_cost"].includes(w.code));
  return (
    <div className={`pa__result${state.status === "refreshing" ? " is-refreshing" : ""}`} key={revealKey}>
      {failedRefresh && (
        <div className="pa-notice" role="status">
          {state.status === "offline" ? "You're offline. " : "Couldn't refresh. "}Showing the last analysis; your price build-up is still correct.
          <button type="button" className="pa-link" onClick={state.retry}>Try again</button>
        </div>
      )}
      {data.costFloor && <FloorSection {...p} />}
      <MarketSection data={data} price={p.price} />
      {data.choices.length > 0 && <ChoicesSection data={data} price={p.price} onApply={p.onApplyPrice} />}
      <WhySection data={data} price={p.price} />
      <EvidenceSection data={data} customerName={p.customerName} />
      {(data.missing.length > 0 || shownWarnings.length > 0) && (
        <div className="pa-sec pa-reveal" style={{ ["--d" as string]: "5" }}>
          {missingNotes(data.missing).concat(shownWarnings.map((w) => w.message)).map((m) => (
            <p key={m} className="pa-note">{m}</p>
          ))}
        </div>
      )}
    </div>
  );
}

const MISSING_COPY: Record<string, string> = {
  vehicle: "No vehicle type picked, so fixed costs use fleet defaults. Pick one for a sharper floor.",
  customer: "Pick a client to see their history on this lane.",
  weight: "Add the weight for a sharper fuel and fixed-cost figure.",
};
const missingNotes = (m: string[]) => m.filter((k) => k !== "route").map((k) => MISSING_COPY[k]).filter((s): s is string => !!s);

function Section({ title, aside, children, delay, label }: { title: string; aside?: ReactNode; children: ReactNode; delay: number; label?: string }) {
  return (
    <section className="pa-sec pa-reveal" style={{ ["--d" as string]: String(delay) }} aria-label={label || title}>
      <div className="pa-sec__head">
        <h3 className="pa-sec__title">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

// ---- 1. cost floor
function FloorSection(p: PricingPanelProps & { data: PricingAnalysis }) {
  const f = p.data.costFloor!;
  const [open, setOpen] = useState<string | null>(null);
  const includeReturn = p.includeReturn ?? f.includeReturn;
  return (
    <Section title="Cost floor" delay={0}
      aside={<span className="pa-sec__fig">{formatMoneyWhole(f.total)}{f.perKm != null && <span className="pa-sec__unit"> · {formatMoney(f.perKm)}/km</span>}</span>}>
      <ul className="pa-lines">
        {f.lines.map((l) => (
          <FloorRow key={l.key} line={l} open={open === l.key} onToggle={() => setOpen(open === l.key ? null : l.key)}
            driver={l.key === "driver_allowance" ? p.driver : null}
            fixed={l.key === "fixed_cost" ? f.fixedCostPerKm : null} />
        ))}
      </ul>
      {p.returnApplicable && f.returnAvailable && (
        <div className="pa-toggle">
          <button type="button" role="switch" aria-checked={includeReturn} className="pa-switch" onClick={() => p.onIncludeReturn(!includeReturn)}>
            <span className="pa-switch__knob" aria-hidden="true" />
          </button>
          <span className="pa-toggle__text">
            <b>Include the empty return</b>
            <span>{includeReturn ? "The run home empty is in the floor." : "Leave it out when you expect a load back."}</span>
          </span>
        </div>
      )}
    </Section>
  );
}

function FloorRow({ line, open, onToggle, driver, fixed }: {
  line: FloorLine; open: boolean; onToggle: () => void;
  driver: PricingPanelProps["driver"] | null;
  fixed: NonNullable<PricingAnalysis["costFloor"]>["fixedCostPerKm"];
}) {
  const detailId = useId();
  const kind: SourceKind = driver?.edited ? "user" : line.source.kind;
  const chip = SOURCE_CHIP[kind];
  const isFixedEstimate = !!fixed && fixed.source === "vehicle_default";
  return (
    <li className={`pa-line${open ? " is-open" : ""}`}>
      <button type="button" className="pa-line__row" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
        <span className="pa-line__label">{line.label}</span>
        <StatusChip tone={chip.tone} label={isFixedEstimate ? "Estimate" : chip.label} title={line.source.label || undefined} />
        <span className="pa-line__amt">{formatMoneyWhole(line.amount)}</span>
        <ChevronRight size={14} className="pa-line__chev" aria-hidden="true" />
        <span className="pa-sr">{open ? "Hide details" : "Show details"}</span>
      </button>
      {open && (
        <div id={detailId} className="pa-line__detail">
          {line.basis && <p className="pa-line__basis">{line.basis}</p>}
          {driver && (
            <div className="pa-line__edit">
              <label className="pa-field">
                <span>Allowance for this trip (R)</span>
                <input type="number" inputMode="decimal" min={0} value={driver.value} onChange={(e) => driver.onChange(e.target.value)} />
              </label>
              {driver.edited && <button type="button" className="pa-link" onClick={driver.onReset}>Use the approved figure</button>}
            </div>
          )}
          {isFixedEstimate && (
            <p className="pa-line__basis">Estimate from your vehicle defaults. Once trips with recorded costs come in, your own actuals are used instead.</p>
          )}
          {fixed && !isFixedEstimate && fixed.trips != null && (
            <p className="pa-line__basis">From {formatNumber(fixed.trips)} trips{fixed.window ? `, ${fixed.window}` : ""}.</p>
          )}
          {line.details.length > 0 && (
            <dl className="pa-dl">
              {line.details.map((d) => (<div key={d.label}><dt>{d.label}</dt><dd>{d.value}</dd></div>))}
            </dl>
          )}
          {(line.source.label || line.source.asOf || line.source.url) && (
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

// ---- 2. market
function MarketSection({ data, price }: { data: PricingAnalysis; price: number }) {
  const m = data.market;
  const floor = data.costFloor?.total ?? null;
  const tierLine = m?.tierLabel || (m && m.n > 0 ? `${formatNumber(m.n)} quotes` : null);
  return (
    <Section title="Market range" delay={1}>
      {!m || !m.available ? (
        <p className="pa-quiet">No market figures for this lane yet. The prices below work from your cost floor and target margin.</p>
      ) : (
        <>
          <p className={`pa-tier${m.isEstimate ? " is-estimate" : ""}`}>
            {m.isEstimate ? "Estimate: no real quotes on this lane yet" : tierLine}
          </p>
          <MarketRange market={m} floor={floor} price={price > 0 ? price : null} />
          <p className="pa-range-legend">
            <span><i className={`pa-key pa-key--band${m.isEstimate ? " is-estimate" : ""}`} aria-hidden="true" />Middle half {formatMoneyWhole(m.p25)} to {formatMoneyWhole(m.p75)}</span>
            <span><i className="pa-key pa-key--median" aria-hidden="true" />Median {formatMoneyWhole(m.median)}</span>
          </p>
          {m.isEstimate && tierLine && <p className="pa-quiet">{tierLine}</p>}
        </>
      )}
    </Section>
  );
}

// ---- 3. choices
function ChoicesSection({ data, price, onApply }: { data: PricingAnalysis; price: number; onApply: PricingPanelProps["onApplyPrice"] }) {
  const applied = readPrice(data, price).matchedChoice;
  const order: ChoiceKey[] = ["safe", "balanced", "stretch"];
  const choices = [...data.choices].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return (
    <Section title="Choose a price" delay={2}
      aside={<span className="pa-sec__hint">{applied ? "One is in your quote" : "Tap to use it"}</span>}>
      <div className="pa-choices" role="group" aria-label="Price choices">
        {choices.map((c) => <ChoiceCard key={c.key} c={c} applied={applied === c.key} onApply={() => onApply(c.price, c.key)} />)}
      </div>
    </Section>
  );
}

function ChoiceCard({ c, applied, onApply }: { c: Choice; applied: boolean; onApply: () => void }) {
  const lk = c.likelihood;
  return (
    <button type="button" className={`pa-choice${c.recommended ? " is-rec" : ""}${applied ? " is-applied" : ""}`}
      aria-pressed={applied} onClick={onApply}
      aria-label={`${c.label}${c.recommended ? ", recommended" : ""}: ${formatMoneyWhole(c.price)}, margin ${formatMoneyWhole(c.margin)} or ${pct0(c.marginPct)}${lk ? `, ${likelihoodText(lk)}` : ""}.${applied ? " In your quote." : " Use this price."}`}>
      <span className="pa-choice__top">
        <span className="pa-choice__label">{c.label}{c.recommended && <span className="pa-choice__rec">Recommended</span>}</span>
        <span className="pa-choice__price">{formatMoneyWhole(c.price)}</span>
      </span>
      <span className="pa-choice__meta">
        <span>Margin {formatMoneyWhole(c.margin)} · {pct0(c.marginPct)}</span>
        {lk && <span className={`pa-lk pa-lk--${lkTone(lk)}`}>{likelihoodText(lk)}</span>}
      </span>
      {c.summary && <span className="pa-choice__sum">{c.summary}</span>}
      <span className="pa-choice__state" aria-hidden="true">
        {applied ? <><Check size={12} strokeWidth={2.5} /> In your quote</> : "Use this price"}
      </span>
    </button>
  );
}

// ---- 4. why
function WhySection({ data, price }: { data: PricingAnalysis; price: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const lk = data.likelihood;
  const model = lk?.level === "model" ? lk.model : null;
  if (!data.reasoning.length && !lk) return null;
  return (
    <div className="pa-sec pa-reveal" style={{ ["--d" as string]: "3" }}>
      <button type="button" className="pa-why" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <ChevronRight size={14} className="pa-why__chev" aria-hidden="true" />
        Why these prices
      </button>
      {open && (
        <div id={id} className="pa-why__body">
          {data.reasoning.length > 0 && (
            <ul className="pa-reasons">{data.reasoning.map((r) => <li key={r}>{r}</li>)}</ul>
          )}
          {model && (
            <figure className="pa-fig">
              <LikelihoodCurve curve={model.curve} range={model.range} choices={data.choices} price={price > 0 ? price : null} />
              <figcaption className="pa-fig__cap">
                <span><i className="pa-key pa-key--line" aria-hidden="true" />Chance of acceptance</span>
                <span><i className="pa-key pa-key--wash" aria-hidden="true" />Expected profit</span>
                <span><i className="pa-key pa-key--you" aria-hidden="true" />Your price</span>
              </figcaption>
              <table className="pa-twin">
                <caption className="pa-sr">Choices on the curve</caption>
                <tbody>
                  {data.choices.map((c) => (
                    <tr key={c.key}><th scope="row">{c.label}</th><td>{formatMoneyWhole(c.price)}</td><td>{likelihoodText(c.likelihood) ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="pa-basis">Based on {model.basisLabel || `${formatNumber(model.nClosed)} closed quotes`}</p>
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
              {lk.rules.basis.length > 0 && <p className="pa-basis">Bands from {lk.rules.basis.join(", ")}.</p>}
            </>
          )}
          {lk?.reason && <p className="pa-basis">{lk.reason}</p>}
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
  return (
    <Section title={`${name} on this lane`} delay={4} label="Client and lane history">
      <div className="pa-facts">
        <div className="pa-fact">
          <span className="pa-fact__k">Accepts</span>
          <span className="pa-fact__v">{acc && acc.decided > 0 ? `${acc.won} of ${acc.decided} quotes` : "No decided quotes yet"}</span>
        </div>
        <div className="pa-fact">
          <span className="pa-fact__k">Payment</span>
          <span className="pa-fact__v">{c.paymentRisk
            ? <StatusChip tone={RISK_TONE[c.paymentRisk.band]} label={c.paymentRisk.label} title={c.paymentRisk.basis || undefined} />
            : "No payment history yet"}</span>
        </div>
      </div>
      {c.recentLaneQuotes.length > 0 ? (
        <table className="pa-hist">
          <caption className="pa-sr">Last quotes to {name} on this lane</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Price</th><th scope="col">Outcome</th></tr></thead>
          <tbody>
            {c.recentLaneQuotes.map((q, i) => {
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
        <p className="pa-quiet">No earlier quotes to {name} on this lane.</p>
      )}
    </Section>
  );
}
