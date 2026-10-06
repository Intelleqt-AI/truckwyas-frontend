import { formatMoneyWhole } from '@/lib/formatters';
import type { DecisionView } from '@/lib/pricingDecision';
import { InfoTip } from '@/components/ui/InfoTip';

/** The price card's "How it was priced" rows. */
export default function PricingDecisionRows({ decision }: { decision: DecisionView }) {
  const d = decision;
  return (
    <div className="qd-price-rows qd-decision" aria-labelledby="qd-decision-title">
      <div className="qd-decision__head" id="qd-decision-title">How it was priced</div>
      {d.stale && (
        <p className="qd-decision__stale">
          Priced at {formatMoneyWhole(d.finalPrice)} excl. VAT; the total has changed since. These figures are for that price.
        </p>
      )}
      {d.picked && (
        <div className="bk-kv"><span className="bk-kv__label">Price picked</span><span className="bk-kv__value">{d.picked}</span></div>
      )}
      {d.floor !== null && (
        <div className="bk-kv">
          <span className="bk-kv__label">Cost floor <InfoTip label="About the cost floor">The full cost of the trip when it was priced: fuel, tolls, driver allowance, border fees and fixed cost per km.</InfoTip></span>
          <span className="bk-kv__value">{formatMoneyWhole(d.floor)}</span>
        </div>
      )}
      {/* The margin sits under the total; here only when the total has moved on. */}
      {d.margin && d.stale && (
        <div className="bk-kv">
          <span className="bk-kv__label">Margin at {formatMoneyWhole(d.finalPrice)}</span>
          <span className={d.belowFloor ? 'bk-kv__value qd-decision__neg' : 'bk-kv__value'}>
            {formatMoneyWhole(d.margin.amount)}{d.margin.pct !== null ? ` · ${d.margin.pct}%` : ''}
            {d.belowFloor && <span className="bk-kv__note">Below the cost floor</span>}
          </span>
        </div>
      )}
      {d.market && (
        <div className="bk-kv">
          <span className="bk-kv__label">Market range</span>
          <span className="bk-kv__value">
            {formatMoneyWhole(d.market.low)} to {formatMoneyWhole(d.market.high)}
            <span className="bk-kv__note">{d.market.label}</span>
          </span>
        </div>
      )}
      {d.likelihood && (
        <div className="bk-kv">
          <span className="bk-kv__label">Chance to win, when priced</span>
          <span className="bk-kv__value">
            {d.likelihood.text}
            {d.likelihood.basis && <span className="bk-kv__note">{d.likelihood.basis}</span>}
          </span>
        </div>
      )}
    </div>
  );
}
