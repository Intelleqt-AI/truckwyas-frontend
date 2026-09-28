import './quote-invoice-roles.css';
import './finance-brand.css';
import { formatCurrency } from '@/lib/formatters';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { postData, fetchData } from "@/lib/Api";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinTile } from '@/components/finance/FinTile';

export default function CreateInvoice() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    customer: '',
    invoice_number: `INV-${Date.now().toString().slice(-6)}`,
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

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const dueDateValid = (() => {
    if (!form.due_date) return false;
    const d = new Date(form.due_date);
    return !isNaN(d.getTime()) && d <= today;
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
      <button type="button" className="fin-back" onClick={() => navigate('/finance/invoices')}>
        <span aria-hidden="true">←</span> Back to invoices
      </button>
      <header className="fin-detail-head">
        <div style={{ minWidth: 0 }}>
          <div className="fin-detail-head__eyebrow">Finance</div>
          <div className="fin-detail-head__title-row"><h1>New invoice</h1></div>
          <p className="fin-detail-head__sub">For one-off charges. Loads invoice themselves.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="fin-create-grid">
          <section className="card" aria-labelledby="create-invoice-details">
            <div className="fin-panel-head">
              <div className="fin-panel-head__text">
                <h2 id="create-invoice-details" className="fin-panel-title">Details</h2>
              </div>
            </div>
            <div className="fin-form">
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
              <div className="fin-form__row">
                <div>
                  <label htmlFor="create-invoice-amount" className="fin-label">Amount excl. VAT (ZAR)</label>
                  <input id="create-invoice-amount" className="fin-control qi-input" type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={form.amount} onChange={set('amount')} style={{ fontVariantNumeric: 'tabular-nums' }} />
                </div>
                <div>
                  <div className="fin-label">Due date</div>
                  <DatePicker value={form.due_date} onChange={val => setForm(f => ({ ...f, due_date: val }))} maxDate={today} />
                </div>
              </div>
              <div>
                <label htmlFor="create-invoice-invoice_number" className="fin-label">Invoice number</label>
                <input id="create-invoice-invoice_number" className="fin-control qi-input" type="text" value={form.invoice_number} onChange={set('invoice_number')} style={{ fontFamily: 'var(--font-mono)' }} />
                <p className="fin-help">Suggested. Change it if you use your own numbers.</p>
              </div>
              <div>
                <label htmlFor="create-invoice-description" className="fin-label">Description</label>
                <textarea id="create-invoice-description" className="fin-control qi-input" value={form.description} onChange={set('description')} rows={3} placeholder="e.g. Standby charge, 2 days at Durban port" />
              </div>
              <div>
                <label id="create-invoice-status-label" htmlFor="create-invoice-status" className="fin-label">When it is created</label>
                <Select value={form.status} onValueChange={val => setForm(f => ({ ...f, status: val }))}>
                  <SelectTrigger id="create-invoice-status" aria-labelledby="create-invoice-status-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Keep as draft</SelectItem>
                    <SelectItem value="SENT">Mark as sent to customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <aside className="fin-stack fin-stack--16" style={{ minWidth: 0 }}>
            <FinTile
              label="Total incl. VAT"
              info={<>The amount is saved as the subtotal and VAT at 15% is added when the invoice is saved.</>}
              value={formatCurrency(totalPreview)}
              sub={`${formatCurrency(subtotalPreview)} + ${formatCurrency(vatPreview)} VAT`}
            />
            <p className="fin-help" style={{ margin: '-4px 0 0' }}>{selectedCustomer ? `For ${selectedCustomer.name}` : 'No customer selected'}</p>

            {error && <div className="fin-inset fin-text-danger" role="alert" style={{ fontSize: 13, lineHeight: '20px' }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="submit" className="btn-action qi-action" style={{ width: '100%' }} disabled={!canSubmit || mutation.isPending}>
                {mutation.isPending ? 'Creating…' : 'Create invoice'}
              </button>
              <button type="button" className="btn-action fin-btn-secondary fin-btn-ghost qi-action" style={{ width: '100%' }} onClick={() => navigate('/finance/invoices')}>
                Cancel
              </button>
              {!canSubmit && (
                <p className="fin-help" style={{ margin: 0 }}>Needs a customer, an amount and a due date.</p>
              )}
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
