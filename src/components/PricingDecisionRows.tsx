import { InfoTip } from '@/components/ui/InfoTip';
import { formatRand, MARKET_RANGE_LABEL } from '@/lib/pricing';
import type { DecisionView } from '@/lib/pricingDecision';

/**
 * The price card's "How it was priced" rows. The cost floor is broken into
 * its parts and followed by price − floor = margin, so the margin can be
 * traced line by line.
 */
export default function PricingDecisionRows({ decision }: { decision: DecisionView }) {
  const d = decision;
  return (
    <div className="qd-price-rows qd-decision" aria-labelledby="qd-decision-title">
      <div className="qd-decision__head" id="qd-decision-title">How it was priced</div>
      {d.stale && (
        <p className="qd-decision__stale">
          Priced at {formatRand(d.finalPrice)} excl. VAT; the total has changed since. These figures are for that price.
        </p>
      )}
      {d.picked && (
        <div className="bk-kv"><span className="bk-kv__label">Price picked</span><span className="bk-kv__value">{d.picked}</span></div>
      )}
      {d.floor !== null && (
        <>
          <div className="bk-kv">
            <span className="bk-kv__label">Cost floor <InfoTip label="About the cost floor">The full cost of the trip when it was priced: fuel, tolls, driver allowance, border fees and operating costs per km (carried in the base rate).{d.floorLinesDerived ? ' Operating costs here are the floor less the lines above it.' : ''}</InfoTip></span>
            <span className="bk-kv__value">{formatRand(d.floor)}</span>
          </div>
          {d.floorLines && (
            <ul className="qd-decision__parts" aria-label="Cost floor parts">
              {d.floorLines.map((l) => (
                <li key={l.label}><span>{l.label}</span><span>{formatRand(l.amount)}</span></li>
              ))}
            </ul>
          )}
        </>
      )}
      {d.margin && (
        <div className="bk-kv">
          <span className="bk-kv__label">{d.stale ? `Margin at ${formatRand(d.finalPrice)}` : 'Margin'}</span>
          <span className={d.belowFloor ? 'bk-kv__value qd-decision__neg' : 'bk-kv__value'}>
            {formatRand(d.margin.amount)}{d.margin.pct !== null ? ` · ${d.margin.pct}%` : ''}
            <span className="bk-kv__note">
              {d.floor !== null ? `${formatRand(d.finalPrice)} price less ${formatRand(d.floor)} floor` : null}
              {d.belowFloor ? ', below the cost floor' : ''}
            </span>
          </span>
        </div>
      )}
      {d.market && (
        <div className="bk-kv">
          <span className="bk-kv__label">{MARKET_RANGE_LABEL}</span>
          <span className="bk-kv__value">
            {formatRand(d.market.low)} to {formatRand(d.market.high)}
            <span className="bk-kv__note">{d.market.label}</span>
          </span>
        </div>
      )}
      {d.likelihood && (
        <div className="bk-kv">
          <span className="bk-kv__label qd-decision__nowrap">Chance to win (when priced)</span>
          <span className="bk-kv__value">
            {d.likelihood.text}
            {d.likelihood.basis && <span className="bk-kv__note">{d.likelihood.basis}</span>}
          </span>
        </div>
      )}
    </div>
  );
}
