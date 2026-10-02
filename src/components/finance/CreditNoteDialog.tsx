import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { postData } from '@/lib/Api';
import { localDateISO } from '@/lib/dates';
import { formatCurrency } from '@/lib/formatters';
import { DatePicker } from '@/components/ui/date-picker';
import { Segmented } from '@/components/ui/Segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinDialog } from './FinDialog';
import { TotalsBreakdown } from './TotalsBreakdown';
import {
  computeLine, formatQuantity, normaliseDecimalInput, subtractDecimals, sumLines, taxCodeShort, toNumber,
} from '@/lib/finance/tax';
import { FIN_URL, errorText, useTaxCodes } from '@/lib/finance/api';
import type { CreditNote, CreditNoteCreateInput, CreditNoteLineInput, Invoice, InvoiceLine, TaxCode } from '@/lib/finance/types';
import './finance-ledger.css';

type Mode = 'full' | 'pick' | 'custom';

interface Pick { on: boolean; qty: string }
interface Custom { key: number; description: string; amount: string; tax_code: TaxCode }

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Net (excl. VAT) still creditable on an invoice line. */
const lineRemaining = (l: InvoiceLine) => subtractDecimals(l.net_amount, l.credited_net_amount ?? '0');

/**
 * The credit line for part (or all) of an invoice line, always with the
 * line's own tax code and `invoice_line` (the server refuses another code).
 * Everything left on the line: the plain quantity × price when nothing was
 * discounted or credited yet, else one unit of the remaining net. Part of a
 * line: the effective price (net ÷ quantity), so a credit never gives back
 * more than was charged; the caller checks it against what is left.
 */
function creditFromLine(line: InvoiceLine, qtyText: string): CreditNoteLineInput | null {
  const qty = toNumber(normaliseDecimalInput(qtyText));
  const full = toNumber(line.quantity);
  if (!(qty > 0)) return null;
  const base = { tax_code: line.tax_code, invoice_line: line.id };
  const discounted = toNumber(line.discount_amount) > 0;
  const partlyCredited = toNumber(line.credited_net_amount) > 0;
  const all = Math.abs(qty - full) < 1e-9;
  if (all && (discounted || partlyCredited)) {
    return { ...base, description: `${line.description} (${partlyCredited ? 'remaining' : `${formatQuantity(full)} × after discount`})`, quantity: '1', unit_price: lineRemaining(line) };
  }
  if (!discounted) return { ...base, description: line.description, quantity: String(qty), unit_price: line.unit_price };
  const unit = round2(toNumber(line.net_amount) / full);
  return { ...base, description: line.description, quantity: String(qty), unit_price: unit.toFixed(2) };
}

export function CreditNoteDialog({ invoice, onClose, onIssued }: {
  invoice: Invoice;
  onClose: () => void;
  onIssued: (note: CreditNote | undefined) => void;
}) {
  const { codes, defaultCode } = useTaxCodes();
  const allLines = useMemo(() => [...(invoice.lines ?? [])].sort((a, b) => a.position - b.position), [invoice.lines]);
  // Fully credited lines can't be credited again, so the picker leaves them out.
  const lines = useMemo(() => allLines.filter(l => toNumber(lineRemaining(l)) > 0.004), [allLines]);
  const [mode, setMode] = useState<Mode>('full');
  const [reason, setReason] = useState('');
  const [issueDate, setIssueDate] = useState(localDateISO());
  const [picks, setPicks] = useState<Record<number, Pick>>(() =>
    Object.fromEntries(lines.map(l => [l.id, { on: false, qty: formatQty(l.quantity) }])));
  const [custom, setCustom] = useState<Custom[]>([{ key: 1, description: '', amount: '', tax_code: defaultCode }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const total = toNumber(invoice.total_amount);
  const credited = toNumber(invoice.credited_amount);
  const paid = toNumber(invoice.paid_amount);
  const remaining = round2(total - credited);

  // The lines this credit note would carry (pick / custom modes).
  const creditLines: CreditNoteLineInput[] = mode === 'pick'
    ? lines.flatMap(l => (picks[l.id]?.on ? [creditFromLine(l, picks[l.id].qty)].filter((x): x is CreditNoteLineInput => !!x) : []))
    : mode === 'custom'
      ? custom.filter(c => c.description.trim() && toNumber(normaliseDecimalInput(c.amount)) > 0).map(c => ({
          description: c.description.trim(), quantity: '1', unit_price: normaliseDecimalInput(c.amount), tax_code: c.tax_code,
        }))
      : [];
  const preview = sumLines(creditLines.map(l => {
    const a = computeLine({ quantity: l.quantity, unit_price: l.unit_price, discount: '', discount_mode: 'amount', tax_code: l.tax_code }, codes);
    return { net: a.net, vat: a.vat, tax_code: l.tax_code };
  }));
  const creditTotal = mode === 'full' ? remaining : toNumber(preview.total);
  const overCredit = mode !== 'full' && creditTotal > remaining + 0.005;
  const pickProblems = mode === 'pick'
    ? lines.filter(l => picks[l.id]?.on).flatMap(l => {
        if (toNumber(normaliseDecimalInput(picks[l.id].qty)) > toNumber(l.quantity) + 1e-9) return [`"${l.description}": at most ${formatQuantity(l.quantity)}.`];
        const cl = creditFromLine(l, picks[l.id].qty);
        const net = cl ? toNumber(computeLine({ quantity: cl.quantity, unit_price: cl.unit_price, discount: '', discount_mode: 'amount', tax_code: cl.tax_code }, codes).net) : 0;
        return net > toNumber(lineRemaining(l)) + 0.004 ? [`"${l.description}": only ${formatCurrency(lineRemaining(l))} excl. VAT is left to credit.`] : [];
      })
    : [];

  const canSubmit = !!reason.trim() && !busy && !overCredit && pickProblems.length === 0
    && (mode === 'full' ? remaining > 0 : creditLines.length > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setError('');
    const body: CreditNoteCreateInput = mode === 'full'
      ? { invoice: invoice.id, reason: reason.trim(), issue_date: issueDate || undefined, full: true }
      : { invoice: invoice.id, reason: reason.trim(), issue_date: issueDate || undefined, lines: creditLines };
    try {
      const note = await postData({ url: FIN_URL.creditNotes, data: body });
      onIssued(note);
    } catch (err) {
      setError(errorText(err, "Couldn't issue the credit note. Try again."));
      setBusy(false);
    }
  };

  const balanceAfter = round2(total - paid - credited - creditTotal);

  return (
    <FinDialog
      title={`Credit note for ${invoice.invoice_number}`}
      description="A credit note reduces what the customer owes on this invoice. The invoice itself stays as it was sent."
      onClose={onClose}
      busy={busy}
      wide
    >
      <form className="fin-form" onSubmit={submit}>
        <div>
          <span className="fin-label" id="cn-mode-label">What to credit</span>
          <Segmented<Mode>
            label="What to credit"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'full', label: 'Everything left' },
              { value: 'pick', label: 'Some lines', disabled: lines.length === 0 },
              { value: 'custom', label: 'An amount' },
            ]}
          />
        </div>

        {mode === 'full' && (
          <div className="fin-inset">
            <p className="fin-note">
              <strong>Credits {formatCurrency(remaining)} incl. VAT</strong>
              {credited > 0
                ? `The invoice total less ${formatCurrency(credited)} already credited.`
                : 'The whole invoice, line by line.'}
            </p>
          </div>
        )}

        {mode === 'pick' && (
          <div className="fin-table-scroll">
            <table className="fl-credit-lines">
              <thead>
                <tr>
                  <th>Line</th>
                  <th className="num m-hide">Left to credit</th>
                  <th className="num">Credit qty</th>
                  <th className="num">Credit excl. VAT</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(l => {
                  const p = picks[l.id] ?? { on: false, qty: formatQty(l.quantity) };
                  const cl = p.on ? creditFromLine(l, p.qty) : null;
                  const a = cl ? computeLine({ quantity: cl.quantity, unit_price: cl.unit_price, discount: '', discount_mode: 'amount', tax_code: cl.tax_code }, codes) : null;
                  return (
                    <tr key={l.id} className={p.on ? undefined : 'is-off'}>
                      <td>
                        <label className="fl-check">
                          <input type="checkbox" checked={p.on} onChange={e => setPicks(s => ({ ...s, [l.id]: { ...p, on: e.target.checked } }))} />
                          <span>
                            {l.description}
                            <span className="fl-tax" style={{ display: 'block' }}>{formatQuantity(l.quantity)} × {formatCurrency(l.unit_price)} · {taxCodeShort(l.tax_code)}</span>
                          </span>
                        </label>
                      </td>
                      <td className="num m-hide" title={`Charged ${formatCurrency(l.net_amount)}`}>{formatCurrency(lineRemaining(l))}</td>
                      <td className="num">
                        <input className="fin-control" type="text" inputMode="decimal" value={p.qty} disabled={!p.on}
                          aria-label={`Quantity to credit for ${l.description}`}
                          onChange={e => setPicks(s => ({ ...s, [l.id]: { ...p, qty: e.target.value } }))} />
                      </td>
                      <td className="num">{a ? formatCurrency(a.net) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {mode === 'custom' && (
          <div className="fin-form" style={{ gap: 8 }}>
            {custom.map((c, i) => (
              <div key={c.key} className="fl-field-row">
                <input className="fin-control" type="text" value={c.description} placeholder="e.g. Rate correction, waiting time"
                  aria-label={`Credit line ${i + 1} description`}
                  onChange={e => setCustom(cs => cs.map(x => (x.key === c.key ? { ...x, description: e.target.value } : x)))} />
                <input className="fin-control" type="text" inputMode="decimal" value={c.amount} placeholder="R excl. VAT" style={{ width: 120, flex: 'none', textAlign: 'right' }}
                  aria-label={`Credit line ${i + 1} amount excl. VAT`}
                  onChange={e => setCustom(cs => cs.map(x => (x.key === c.key ? { ...x, amount: e.target.value } : x)))} />
                <div style={{ width: 128, flex: 'none' }}>
                  <Select value={c.tax_code} onValueChange={v => setCustom(cs => cs.map(x => (x.key === c.key ? { ...x, tax_code: v as TaxCode } : x)))}>
                    <SelectTrigger aria-label={`Credit line ${i + 1} tax code`}><SelectValue>{taxCodeShort(c.tax_code)}</SelectValue></SelectTrigger>
                    <SelectContent>{codes.map(o => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <button type="button" className="fl-del" aria-label={`Remove credit line ${i + 1}`} disabled={custom.length === 1}
                  onClick={() => setCustom(cs => cs.filter(x => x.key !== c.key))}><X size={16} aria-hidden="true" /></button>
              </div>
            ))}
            <div>
              <button type="button" className="tw-btn" onClick={() => setCustom(cs => [...cs, { key: Date.now(), description: '', amount: '', tax_code: cs[cs.length - 1]?.tax_code ?? defaultCode }])}>
                <Plus size={14} aria-hidden="true" /> Add line
              </button>
            </div>
          </div>
        )}

        <div className="fin-form__row">
          <div>
            <label className="fin-label" htmlFor="cn-reason">Reason <span className="fin-label__hint">Required, shown on the credit note</span></label>
            <textarea id="cn-reason" className="fin-control" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Rate agreed at R 18 500, invoiced at R 19 500" required />
          </div>
          <div className="fin-date-field">
            <label className="fin-label" htmlFor="cn-date">Credit note date</label>
            <DatePicker id="cn-date" value={issueDate} onChange={setIssueDate} />
          </div>
        </div>

        <div className="fin-inset">
          {mode !== 'full'
            ? <TotalsBreakdown totals={preview} totalLabel="Credit, incl. VAT" />
            : credited === 0 && lines.length > 0
              // Nothing credited yet: the credit mirrors the invoice line by line.
              ? <TotalsBreakdown totals={sumLines(allLines.map(l => ({ net: l.net_amount, vat: l.vat_amount, tax_code: l.tax_code })))} totalLabel="Credit, incl. VAT" />
              : (
                <dl className="fin-dl fl-totals">
                  <div className="fin-dl__row is-total"><dt>Credit, incl. VAT</dt><dd>{formatCurrency(remaining)}</dd></div>
                </dl>
              )}
          <dl className="fin-dl fl-totals" style={{ marginTop: 0 }}>
            <div className="fin-dl__row"><dt>Invoice balance after this credit</dt><dd>{formatCurrency(balanceAfter)}</dd></div>
          </dl>
          {balanceAfter < -0.005 && (
            <p className="fin-help" style={{ marginTop: 4 }}>The customer has paid more than the invoice will be worth: {formatCurrency(-balanceAfter)} becomes a credit in their favour.</p>
          )}
        </div>

        {overCredit && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0 }}>The credit is more than the {formatCurrency(remaining)} left to credit on this invoice.</p>}
        {pickProblems.map(p => <p key={p} className="fin-help fin-text-danger" style={{ margin: 0 }}>{p}</p>)}
        {error && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0 }}>{error}</p>}

        <div className="fin-dialog__foot">
          <button type="button" className="tw-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="tw-btn tw-btn--primary" disabled={!canSubmit}>
            {busy ? 'Issuing…' : `Issue credit note${creditTotal > 0 ? ` for ${formatCurrency(creditTotal)}` : ''}`}
          </button>
        </div>
      </form>
    </FinDialog>
  );
}

/** "2.000" → "2" for the quantity field. */
function formatQty(q: string) {
  return q.includes('.') ? q.replace(/0+$/, '').replace(/\.$/, '') : q;
}

export default CreditNoteDialog;
