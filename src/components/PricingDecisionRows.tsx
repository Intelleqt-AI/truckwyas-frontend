import { Fragment } from 'react';
import { InfoTip } from '@/components/ui/InfoTip';
import { formatMoneyWhole } from '@/lib/formatters';
import { MARKET_RANGE_LABEL } from '@/lib/pricing';
import type { DecisionView } from '@/lib/pricingDecision';

// "R 34–46k": a rough estimate is shown as roughly as it is known.
const roughRange = (low: number, high: number) => `R ${Math.round(low / 1000)}–${Math.round(high / 1000)}k`;
// "TruckWys platform, 16 accepted quotes, last 180 days" -> "TruckWys platform · 16 accepted quotes · 180 days".
const round100 = (v: number) => Math.round(v / 100) * 100;
// The line breaks only between parts: each part is its own span and the
// " · " separator is a sibling text node, so it can wrap after any part.
const sourceParts = (s: string) => s.split(/\s*[,·]\s*/).filter(Boolean);
const sourceLine = (s: string) => sourceParts(s).map((p, i, all) => (
  <Fragment key={i}><span className="qd-decision__part">{p}</span>{i < all.length - 1 ? ' · ' : ''}</Fragment>
));

/**
 * The price card's "How it was priced" block: the cost floor and its parts
 * (each cost appears once on the card, here), price less floor = margin, the
 * market at the time and the chance to win, as stored with the quote.
 * The margin and chance to win appear once per card: when the card's header
 * shows them, this block shows only how they were reached.
 * Money is whole rand here.
 */
export default function PricingDecisionRows({ decision, marginInHeader = false, likelihoodInHeader = false }: {
  decision: DecisionView;
  /** The card's header already shows the margin / chance to win: each figure once per card. */
  marginInHeader?: boolean;
  likelihoodInHeader?: boolean;
}) {
  const d = decision;
  const money = formatMoneyWhole;
  const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
  // "Your price · Balanced was recommended": it wraps after the "·", never inside a part.
  const nw = (t: string) => <span style={{ whiteSpace: 'nowrap' }}>{t}</span>;
  const pickedText = d.picked
    ? d.recommended && d.recommended !== d.picked
      ? <>{nw(d.picked)} · {nw(`${d.recommended} was recommended`)}</>
      : d.recommended === d.picked ? `${d.picked} (recommended)` : d.picked
    : null;
  return (
    <div className="qd-price-rows qd-decision" aria-labelledby="qd-decision-title">
      <div className="qd-decision__head" id="qd-decision-title">How it was priced</div>
      {d.stale && (
        <p className="qd-decision__stale">
          Priced at {money(d.finalPrice)} excl. VAT; the total has changed since. These figures are for that price.
        </p>
      )}
      {pickedText && (
        <div className="bk-kv qd-decision__picked"><span className="bk-kv__label">Price picked</span><span className="bk-kv__value">{pickedText}</span></div>
      )}
      {d.floor !== null && (
        <>
          <div className="bk-kv">
            <span className="bk-kv__label">Cost floor <InfoTip label="About the cost floor">The full cost of the trip when it was priced: fuel, tolls, driver allowance, border fees and operating costs per km.{d.floorLinesDerived ? ' Operating costs here are the floor less the other lines.' : ''}</InfoTip></span>
            <span className="bk-kv__value">{money(d.floor)}</span>
          </div>
          {d.floorLines && (
            <ul className="qd-decision__parts" aria-label="Cost floor parts">
              {d.floorLines.map((l) => (
                <li key={l.label} className={l.missing ? 'is-missing' : undefined}>
                  <span>{l.label}{l.source && /estimate/i.test(l.source) && <span className="qd-decision__kind">Estimate</span>}</span>
                  {/* A cost with no figure on record reads "Not set" (the floor leaves it out), never "R 0". */}
                  <span>{l.missing ? 'Not set' : l.note || money(l.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {d.margin && !marginInHeader && (
        <>
          <div className="bk-kv">
            <span className="bk-kv__label">{d.stale ? `Margin at ${money(d.finalPrice)}` : 'Margin'}</span>
            <span className={d.belowFloor ? 'bk-kv__value qd-decision__neg' : 'bk-kv__value'}>
              {money(d.margin.amount)}{d.margin.pct !== null ? ` · ${d.margin.pct}%` : ''}
            </span>
          </div>
        </>
      )}
      {d.market && (
        d.market.estimate ? (
          // Never called the market when it is an estimate (rule 7, M2).
          <>
            <div className="bk-kv">
              <span className="bk-kv__label">Rough SA estimate</span>
              <span className="bk-kv__value">{roughRange(d.market.low, d.market.high)}</span>
            </div>
            <p className="qd-decision__src">Not used.</p>
          </>
        ) : (
          <>
            <div className="bk-kv">
              <span className="bk-kv__label" title={MARKET_RANGE_LABEL}>Market</span>
              {/* Market figures to the nearest R 100, as in the builder. */}
              <span className="bk-kv__value">{money(round100(d.market.low))} to {money(round100(d.market.high))}</span>
            </div>
            {d.market.label && <p className="qd-decision__src" title={d.market.label}>{sourceLine(sourceParts(d.market.label).slice(0, 2).join(' · '))}</p>}
          </>
        )
      )}
      {d.likelihood && likelihoodInHeader && d.likelihood.basis && (
        <p className="qd-decision__src qd-decision__src--solo">{d.likelihood.model ? `Chance to win ${lower(d.likelihood.basis)}` : d.likelihood.basis}</p>
      )}
      {d.likelihood && !likelihoodInHeader && (
        <>
          <div className="bk-kv">
            <span className="bk-kv__label">Chance to win when priced</span>
            <span className="bk-kv__value">{d.likelihood.text}</span>
          </div>
          {d.likelihood.basis && <p className="qd-decision__src">{d.likelihood.basis}</p>}
        </>
      )}
    </div>
  );
}
