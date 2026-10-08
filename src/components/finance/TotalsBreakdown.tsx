import { formatCurrency } from '@/lib/formatters';
import { taxCodeShort, toNumber, type DocTotals } from '@/lib/finance/tax';
import './finance-ledger.css';

/**
 * Subtotal (excl. VAT), discount, VAT (split per tax code when the lines mix
 * codes) and the total. The same block in the invoice editor rail, the credit
 * note preview and on documents, so every place reads the figures one way.
 */
export function TotalsBreakdown({ totals, totalLabel = 'Total incl. VAT', className, extra }: {
  totals: DocTotals;
  totalLabel?: string;
  className?: string;
  /** Rows after the total (paid, credited, balance). */
  extra?: { label: string; value: number; negative?: boolean; strong?: boolean }[];
}) {
  const discount = toNumber(totals.discount);
  const mixed = totals.byCode.length > 1;
  const zeroOnly = totals.byCode.length > 0 && totals.byCode.every(b => b.code !== 'STANDARD');
  return (
    <dl className={`fin-dl fl-totals${className ? ` ${className}` : ''}`}>
      {/* The subtotal is after discount, so the discount reads as a step to it. */}
      {discount > 0 && (
        <>
          <div className="fin-dl__row"><dt>Before discount</dt><dd>{formatCurrency(toNumber(totals.subtotal) + discount)}</dd></div>
          <div className="fin-dl__row"><dt>Discount</dt><dd>−{formatCurrency(discount)}</dd></div>
        </>
      )}
      <div className="fin-dl__row"><dt>Subtotal excl. VAT</dt><dd>{formatCurrency(toNumber(totals.subtotal))}</dd></div>
      {mixed ? (
        <>
          <div className="fin-dl__row"><dt>VAT</dt><dd>{formatCurrency(toNumber(totals.vat))}</dd></div>
          {totals.byCode.map(b => (
            <div key={b.code} className="fin-dl__row fl-totals__sub">
              <dt>{taxCodeShort(b.code)} on {formatCurrency(toNumber(b.net))}</dt>
              <dd>{formatCurrency(toNumber(b.vat))}</dd>
            </div>
          ))}
        </>
      ) : (
        <div className="fin-dl__row">
          <dt>{zeroOnly ? `VAT (${taxCodeShort(totals.byCode[0].code).toLowerCase()})` : 'VAT 15%'}</dt>
          <dd>{formatCurrency(toNumber(totals.vat))}</dd>
        </div>
      )}
      <div className="fin-dl__row is-total"><dt>{totalLabel}</dt><dd>{formatCurrency(toNumber(totals.total))}</dd></div>
      {extra?.map(r => (
        <div key={r.label} className={`fin-dl__row${r.strong ? ' is-total' : ''}`}>
          <dt>{r.label}</dt>
          <dd>{r.negative && r.value > 0 ? '−' : ''}{formatCurrency(r.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default TotalsBreakdown;
