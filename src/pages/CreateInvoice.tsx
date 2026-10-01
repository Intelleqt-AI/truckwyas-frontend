import './quote-invoice-roles.css';
import './finance-brand.css';
import { formatCurrency } from '@/lib/formatters';
import SectionHeader from '@/components/layout/SectionHeader';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { postData, fetchData } from "@/lib/Api";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoTip } from '@/components/ui/InfoTip';

/** "INV-20260929-4821": the INV-YYYYMMDD-n format the rest of TruckWys
 *  uses (INV-20260405-1029), dated today. Only a suggestion; editable. */
function suggestNumber(now = new Date()) {
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `INV-${ymd}-${(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) % 9000 + 1000}`;
}

export default function CreateInvoice() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    customer: '',
    // Same shape as every other invoice number: INV-<issue date>-<n>.
    invoice_number: suggestNumber(),
    amount: '',
    due_date: '',
    description: '',
    status: 'DRAFT',
  });
  const [error, setError] = useState('');

  const { data: customersData } = useQuery({ queryKey: ['customers'], queryFn: () => fetchData('api/v1/customers/') });
  const customers = customersData?.results || customersData || [];

  const mutation = useMutation({
    mutationFn: (data: any) => postData({ url: 'api/v1/invoices/', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices-page'] });
      navigate('/finance/invoices');
    },
    onError: (e: any) => setError(e?.message || 'Failed to create invoice'),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // A due date is normally in the future (payment terms). It used to be capped
  // at today, which made every hand-made invoice overdue on creation.
  const dueDateValid = (() => {
    if (!form.due_date) return false;
    const d = new Date(form.due_date);
    return !isNaN(d.getTime());
  })();

  const canSubmit = !!form.customer && !!form.amount && parseFloat(form.amount) > 0 && dueDateValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const subtotal = parseFloat(form.amount) || 0;
    mutation.mutate({
      ...form,
      subtotal: subtotal.toFixed(2),
      total_amount: subtotal.toFixed(2),
      balance: subtotal.toFixed(2),
    });
  };

  // The API stores the amount as the subtotal and adds VAT at 15% when it
  // saves (Invoice.calculate_vat), so the preview shows the same split.
  const subtotalPreview = parseFloat(form.amount || '0') || 0;
  const vatPreview = Math.round(subtotalPreview * 0.15 * 100) / 100;
  const totalPreview = subtotalPreview + vatPreview;
  const selectedCustomer = customers.find((c: any) => String(c.id) === form.customer);

  return (
    <div className="fin-page">
      <SectionHeader
        title="New invoice"
        back={{ to: '/finance/invoices', label: 'Invoices' }}
        description="One-off charges. Loads bill themselves."
        actions={
          // Phones: the rail (and its button) is below the form, so the one
          // primary also sits on the title row. Wider screens use the rail.
          <button type="submit" form="create-invoice-form" className="tw-btn tw-btn--primary fin-phone-only" disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create invoice'}
          </button>
        }
      />

      <form id="create-invoice-form" onSubmit={handleSubmit}>
        <div className="fin-create-grid">
          <section className="card" aria-labelledby="create-invoice-details">
            <div className="fin-panel-head">
              <div className="fin-panel-head__text">
                <h2 id="create-invoice-details" className="fin-panel-title">Details</h2>
              </div>
            </div>
            {/* Paired rows keep the form short, so it ends near the summary rail. */}
            <div className="fin-form">
              <div className="fin-form__row">
                <div>
                  <label id="create-invoice-customer-label" htmlFor="create-invoice-customer" className="fin-label">Customer</label>
                  <Select value={form.customer} onValueChange={val => setForm(f => ({ ...f, customer: val }))}>
                    <SelectTrigger id="create-invoice-customer" aria-labelledby="create-invoice-customer-label">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="create-invoice-invoice_number" className="fin-label">
                    Invoice number <span className="fin-label__hint">Suggested, you can change it</span>
                  </label>
                  <input id="create-invoice-invoice_number" className="fin-control qi-input" type="text" value={form.invoice_number} onChange={set('invoice_number')} />
                </div>
              </div>
              {/* Amount, due date, "Save as" and the description: three across
                  with the description below when the card is wide, else two
                  across ("Save as" beside the description), so the form ends
                  level with the summary rail at every two-column width. */}
              <div className="fin-form__row fin-form__row--3">
                <div>
                  <label htmlFor="create-invoice-amount" className="fin-label">Amount excl. VAT (ZAR)</label>
                  <input id="create-invoice-amount" className="fin-control qi-input" type="number" inputMode="decimal" step="0.01" placeholder="0,00" value={form.amount} onChange={set('amount')} style={{ fontVariantNumeric: 'tabular-nums' }} />
                </div>
                <div className="fin-date-field">
                  {/* Bound to the picker's text input, as every other field here is. */}
                  <label htmlFor="create-invoice-due-date" className="fin-label">Due date</label>
                  <DatePicker id="create-invoice-due-date" value={form.due_date} onChange={val => setForm(f => ({ ...f, due_date: val }))} />
                </div>
                <div>
                  <label id="create-invoice-status-label" htmlFor="create-invoice-status" className="fin-label">Save as</label>
                  <Select value={form.status} onValueChange={val => setForm(f => ({ ...f, status: val }))}>
                    <SelectTrigger id="create-invoice-status" aria-labelledby="create-invoice-status-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft, to send later</SelectItem>
                      <SelectItem value="SENT">Sent, already with the customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="fin-form__wide">
                  <label htmlFor="create-invoice-description" className="fin-label">Description</label>
                  <textarea id="create-invoice-description" className="fin-control qi-input" value={form.description} onChange={set('description')} rows={2} placeholder="e.g. Standby charge, 2 days at Durban port" />
                </div>
              </div>
            </div>
          </section>

          {/* Summary rail: sticky, one card with the total and the actions. */}
          <aside className="fin-rail" aria-label="Invoice summary">
            <section className="card" aria-labelledby="create-invoice-total">
              <p id="create-invoice-total" className="fin-summary-card__label">
                Total incl. VAT
                <InfoTip>The amount is saved as the subtotal and VAT at 15% is added when the invoice is saved.</InfoTip>
              </p>
              <p className="fin-summary-card__figure">{formatCurrency(totalPreview)}</p>
              <dl className="fin-dl fin-summary-card__split">
                <div className="fin-dl__row"><dt>Amount excl. VAT</dt><dd>{formatCurrency(subtotalPreview)}</dd></div>
                <div className="fin-dl__row"><dt>VAT at 15%</dt><dd>{formatCurrency(vatPreview)}</dd></div>
                <div className="fin-dl__row"><dt>Customer</dt><dd>{selectedCustomer ? selectedCustomer.name : 'Not selected'}</dd></div>
              </dl>

              {error && <div className="fin-inset fin-text-danger" role="alert" style={{ fontSize: 13, lineHeight: '20px', marginTop: 12 }}>{error}</div>}

              <div className="fin-summary-card__actions">
                {/* Phones: the head carries "Create invoice", so it shows once. */}
                <button type="submit" className="tw-btn tw-btn--primary fin-rail-btn fin-hide-phone-create" style={{ width: '100%' }} disabled={!canSubmit || mutation.isPending}>
                  {mutation.isPending ? 'Creating…' : 'Create invoice'}
                </button>
                <button type="button" className="tw-btn tw-btn--ghost fin-rail-btn" style={{ width: '100%' }} onClick={() => navigate('/finance/invoices')}>
                  Cancel
                </button>
                {!canSubmit && (
                  <p className="fin-help" style={{ margin: 0 }}>Needs a customer, an amount and a due date.</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </form>
    </div>
  );
}
