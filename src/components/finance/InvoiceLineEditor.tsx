import { Plus, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Segmented } from '@/components/ui/Segmented';
import { formatCurrency } from '@/lib/formatters';
import { computeLine, toNumber, taxCodeShort, type DiscountMode, type LineDraft } from '@/lib/finance/tax';
import { blankLine, type EditorLine } from '@/lib/finance/lines';
import type { TaxCode, TaxCodeOption } from '@/lib/finance/types';
import './finance-ledger.css';

export function InvoiceLineEditor({ lines, onChange, codes, defaultCode, disabled }: {
  lines: EditorLine[];
  onChange: (lines: EditorLine[]) => void;
  codes: TaxCodeOption[];
  defaultCode: TaxCode;
  disabled?: boolean;
}) {
  const update = (key: string, patch: Partial<LineDraft>) =>
    onChange(lines.map(l => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => onChange(lines.length > 1 ? lines.filter(l => l.key !== key) : [blankLine(defaultCode)]);
  // A new line takes the tax code of the line above it (most invoices use one code).
  const add = () => onChange([...lines, blankLine(lines[lines.length - 1]?.tax_code ?? defaultCode)]);

  return (
    <div className="fl-lines">
      <table className="fl-lines__table">
        <thead>
          <tr>
            <th>Description</th>
            <th className="fl-col-qty num">Qty</th>
            <th className="fl-col-price num">Unit price</th>
            <th className="fl-col-disc">Discount</th>
            <th className="fl-col-tax">Tax</th>
            <th className="fl-col-amt num">Amount excl. VAT</th>
            <th className="fl-col-del"><span className="fl-label-sr">Remove</span></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const a = computeLine(l, codes);
            const n = i + 1;
            return (
              <tr key={l.key}>
                <td className="fl-cell-desc">
                  <label className="fl-mobile-label" htmlFor={`line-${l.key}-desc`}>Line {n}</label>
                  <input id={`line-${l.key}-desc`} className="fin-control qi-input" type="text" value={l.description} disabled={disabled}
                    aria-label={`Line ${n} description`} placeholder="e.g. Durban to Johannesburg, 34 t"
                    onChange={e => update(l.key, { description: e.target.value })} />
                </td>
                <td>
                  <span className="fl-mobile-label" aria-hidden="true">Qty</span>
                  <input className="fin-control qi-input fl-num" type="text" inputMode="decimal" value={l.quantity} disabled={disabled}
                    aria-label={`Line ${n} quantity`} onChange={e => update(l.key, { quantity: e.target.value })} />
                </td>
                <td>
                  <span className="fl-mobile-label" aria-hidden="true">Unit price (R, excl. VAT)</span>
                  <input className="fin-control qi-input fl-num" type="text" inputMode="decimal" value={l.unit_price} disabled={disabled}
                    aria-label={`Line ${n} unit price excl. VAT`} placeholder="0,00" onChange={e => update(l.key, { unit_price: e.target.value })} />
                </td>
                <td>
                  <span className="fl-mobile-label" aria-hidden="true">Discount</span>
                  <div className="fl-disc">
                    <input className="fin-control qi-input fl-num" type="text" inputMode="decimal" value={l.discount} disabled={disabled}
                      aria-label={`Line ${n} discount ${l.discount_mode === 'percent' ? 'percent' : 'in rand, excl. VAT'}`} placeholder="0"
                      onChange={e => update(l.key, { discount: e.target.value })} />
                    <Segmented size="sm" label={`Line ${n} discount type`} value={l.discount_mode}
                      onChange={(m: DiscountMode) => update(l.key, { discount_mode: m })}
                      options={[{ value: 'amount', label: 'R', ariaLabel: 'Rand', disabled }, { value: 'percent', label: '%', ariaLabel: 'Percent', disabled }]} />
                  </div>
                </td>
                <td>
                  <span className="fl-mobile-label" aria-hidden="true">Tax</span>
                  <Select value={l.tax_code} onValueChange={(v) => update(l.key, { tax_code: v as TaxCode })} disabled={disabled}>
                    <SelectTrigger aria-label={`Line ${n} tax code`}><SelectValue>{taxCodeShort(l.tax_code)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {codes.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="num fl-cell-amt">
                  <div className="fl-amt" aria-live="polite">
                    {formatCurrency(a.net)}
                    <span className="fl-amt__sub">
                      {toNumber(a.discount) > 0 ? `after −${formatCurrency(a.discount)} · ` : ''}VAT {formatCurrency(a.vat)}
                    </span>
                  </div>
                </td>
                <td className="fl-cell-del">
                  <button type="button" className="fl-del" onClick={() => remove(l.key)} disabled={disabled || (lines.length === 1 && !l.description && !l.unit_price)}
                    aria-label={`Remove line ${n}`} title="Remove line">
                    <X size={16} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="fl-lines__foot">
        <button type="button" className="tw-btn" onClick={add} disabled={disabled}>
          <Plus size={14} aria-hidden="true" /> Add line
        </button>
        <span className="fin-help" style={{ margin: 0 }}>Prices and discounts exclude VAT. VAT is worked out per line.</span>
      </div>
    </div>
  );
}

export default InvoiceLineEditor;
