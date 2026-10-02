import { useState } from 'react';
import { patchData } from '@/lib/Api';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinDialog } from './FinDialog';
import { normaliseDecimalInput, toNumber } from '@/lib/finance/tax';
import { FIN_URL, errorText } from '@/lib/finance/api';
import type { Payment, PaymentUpdateInput } from '@/lib/finance/types';
import { PAYMENT_METHODS } from '@/lib/finance/payments';
import { isPaymentsManagedError } from '@/lib/accounting';

export function PaymentEditDialog({ payment, onClose, onSaved, onPaymentsManaged }: {
  payment: Payment;
  onClose: () => void;
  onSaved: () => void;
  /** The API refused because an accounting system owns payments (409). */
  onPaymentsManaged?: (error: unknown) => void;
}) {
  const [amount, setAmount] = useState(String(payment.amount ?? ''));
  const [date, setDate] = useState(String(payment.payment_date || '').slice(0, 10));
  const [method, setMethod] = useState(payment.payment_method || 'EFT');
  const [reference, setReference] = useState(payment.reference_number ?? payment.reference ?? '');
  const [notes, setNotes] = useState(payment.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const amountNorm = normaliseDecimalInput(amount);
  const valid = !!amountNorm && toNumber(amountNorm) > 0 && !!date;
  const methods = PAYMENT_METHODS.some(m => m.value === method) ? PAYMENT_METHODS : [...PAYMENT_METHODS, { value: method, label: method }];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setError('');
    const data: PaymentUpdateInput = { amount: amountNorm, payment_date: date, payment_method: method, reference_number: reference, notes };
    try {
      await patchData({ url: FIN_URL.payment(payment.id), data });
      onSaved();
    } catch (err) {
      if (onPaymentsManaged && isPaymentsManagedError(err)) { onPaymentsManaged(err); return; }
      setError(errorText(err, "Couldn't save the payment. Try again."));
      setBusy(false);
    }
  };

  return (
    <FinDialog title="Edit payment" description="The invoice balance is worked out again when you save." onClose={onClose} busy={busy}>
      <form className="fin-form" onSubmit={submit}>
        <div className="fin-form__row">
          <div>
            <label className="fin-label" htmlFor="pe-amount">Amount (ZAR)</label>
            <input id="pe-amount" className="fin-control" type="text" inputMode="decimal" value={amount} data-autofocus
              onChange={e => setAmount(e.target.value)} style={{ fontVariantNumeric: 'tabular-nums' }} />
          </div>
          <div className="fin-date-field">
            <label className="fin-label" htmlFor="pe-date">Payment date</label>
            <DatePicker id="pe-date" value={date} onChange={setDate} maxDate={new Date()} />
          </div>
        </div>
        <div className="fin-form__row">
          <div>
            <label className="fin-label" id="pe-method-label">Method</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger aria-labelledby="pe-method-label"><SelectValue /></SelectTrigger>
              <SelectContent>{methods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="fin-label" htmlFor="pe-ref">Reference</label>
            <input id="pe-ref" className="fin-control" type="text" value={reference} onChange={e => setReference(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="fin-label" htmlFor="pe-notes">Notes</label>
          <textarea id="pe-notes" className="fin-control" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        {error && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div className="fin-dialog__foot">
          <button type="button" className="tw-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="tw-btn tw-btn--primary" disabled={busy || !valid}>{busy ? 'Saving…' : 'Save payment'}</button>
        </div>
      </form>
    </FinDialog>
  );
}

export default PaymentEditDialog;
