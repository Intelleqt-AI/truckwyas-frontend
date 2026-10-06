import { InfoTip } from '@/components/ui/InfoTip';
import { formatMoneyWhole } from '@/lib/formatters';
import { MARKET_RANGE_LABEL } from '@/lib/pricing';
import type { DecisionView } from '@/lib/pricingDecision';

// "R 34–46k": a rough estimate is shown as roughly as it is known.
const roughRange = (low: number, high: number) => `R ${Math.round(low / 1000)}–${Math.round(high / 1000)}k`;
// "TruckWys platform, 16 accepted quotes, last 180 days" -> "TruckWys platform · 16 accepted quotes · 180 days".
const round100 = (v: number) => Math.round(v / 100) * 100;
const sourceLine = (s: string) => s.split(/,\s*/).map((p) => p.replace(/^last\s+/i, '')).join(' · ');

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
  const pickedText = d.picked
    ? d.recommended && d.recommended !== d.picked
      ? `${d.picked} · ${d.recommended} was recommended`
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
        <div className="bk-kv"><span className="bk-kv__label">Price picked</span><span className="bk-kv__value">{pickedText}</span></div>
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
                  <span>{l.label}{l.source && <span className="qd-decision__kind">{l.source}</span>}</span>
                  {/* A cost with no figure on record reads "Not set" (the floor leaves it out), never "R 0". */}
                  <span>{l.missing ? 'Not set · excluded' : l.note || money(l.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {d.margin && marginInHeader && d.floor !== null && (
        // The figure is in the card's header; here only how it is made.
        <p className="qd-decision__src">Margin = {money(d.finalPrice)} price − {money(d.floor)} floor{d.belowFloor ? ': below the cost floor' : ''}</p>
      )}
      {d.margin && !marginInHeader && (
        <>
          <div className="bk-kv">
            <span className="bk-kv__label">{d.stale ? `Margin at ${money(d.finalPrice)}` : 'Margin'}</span>
            <span className={d.belowFloor ? 'bk-kv__value qd-decision__neg' : 'bk-kv__value'}>
              {money(d.margin.amount)}{d.margin.pct !== null ? ` · ${d.margin.pct}%` : ''}
            </span>
          </div>
          {d.floor !== null && (
            <p className="qd-decision__src">
              {money(d.finalPrice)} price less {money(d.floor)} floor{d.belowFloor ? ': below the cost floor' : ''}
            </p>
          )}
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
            <p className="qd-decision__src">Not market data</p>
          </>
        ) : (
          <>
            <div className="bk-kv">
              <span className="bk-kv__label">{MARKET_RANGE_LABEL}</span>
              {/* Market figures to the nearest R 100, as in the builder. */}
              <span className="bk-kv__value">{money(round100(d.market.low))} to {money(round100(d.market.high))}</span>
            </div>
            <p className="qd-decision__src">{sourceLine(d.market.label)}</p>
          </>
        )
      )}
      {d.likelihood && likelihoodInHeader && d.likelihood.basis && (
        <p className="qd-decision__src qd-decision__src--solo">Chance to win: {lower(d.likelihood.basis)}</p>
      )}
      {d.likelihood && !likelihoodInHeader && (
        <>
          <div className="bk-kv">
            <span className="bk-kv__label">Chance to win (when priced)</span>
            <span className="bk-kv__value">{d.likelihood.text}</span>
          </div>
          {d.likelihood.basis && <p className="qd-decision__src">{d.likelihood.basis}</p>}
        </>
      )}
    </div>
  );
}
