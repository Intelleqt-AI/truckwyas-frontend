import { InfoTip } from '@/components/ui/InfoTip';
import { formatMoneyWhole } from '@/lib/formatters';
import { MARKET_RANGE_LABEL } from '@/lib/pricing';
import type { DecisionView } from '@/lib/pricingDecision';

// "R 34–46k": a rough estimate is shown as roughly as it is known.
const roughRange = (low: number, high: number) => `R ${Math.round(low / 1000)}–${Math.round(high / 1000)}k`;
// "TruckWys platform, 16 accepted quotes, last 180 days" -> "TruckWys platform · 16 accepted quotes · 180 days".
const sourceLine = (s: string) => s.split(/,\s*/).map((p) => p.replace(/^last\s+/i, '')).join(' · ');

/**
 * The price card's "How it was priced" block: the cost floor and its parts
 * (each cost appears once on the card, here), price less floor = margin, the
 * market at the time and the chance to win, as stored with the quote.
 * Money is whole rand here; only VAT and the total incl. VAT carry cents.
 */
export default function PricingDecisionRows({ decision }: { decision: DecisionView }) {
  const d = decision;
  const money = formatMoneyWhole;
  return (
    <div className="qd-price-rows qd-decision" aria-labelledby="qd-decision-title">
      <div className="qd-decision__head" id="qd-decision-title">How it was priced</div>
      {d.stale && (
        <p className="qd-decision__stale">
          Priced at {money(d.finalPrice)} excl. VAT; the total has changed since. These figures are for that price.
        </p>
      )}
      {d.picked && (
        <div className="bk-kv"><span className="bk-kv__label">Price picked</span><span className="bk-kv__value">{d.picked}</span></div>
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
                  {/* A cost with no figure on record reads "Not set", never "R 0". */}
                  <span>{l.missing ? 'Not set' : money(l.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {d.margin && (
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
              <span className="bk-kv__value">{money(d.market.low)} to {money(d.market.high)}</span>
            </div>
            <p className="qd-decision__src">{sourceLine(d.market.label)}</p>
          </>
        )
      )}
      {d.likelihood && (
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
