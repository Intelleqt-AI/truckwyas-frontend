import './quote-invoice-roles.css';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { postData, fetchData } from "@/lib/Api";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    padding: '9px 12px',
    color: 'var(--text-primary)',
    borderRadius: 6,
    fontSize: 14,
    lineHeight: '20px',
    minHeight: 40,
    width: '100%',
    fontFamily: 'var(--font-sans)',
  };

  // Label role: 13/20/500 sans, sentence case, 6px to its control.
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    lineHeight: '20px',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    color: 'var(--text-secondary)',
    marginBottom: 6,
  };

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

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <button className="qi-action" onClick={() => navigate('/finance/invoices')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', marginBottom: 8, padding: 0 }}>← Back</button>
        <div style={{ fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Finance</div>
        <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>New invoice</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 24, borderRadius: 8 }}>
              <h2 style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', margin: '0 0 16px' }}>Invoice details</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Invoice number', key: 'invoice_number', type: 'text' },
                ].map(f => (
                  <div key={f.key}>
                    <label htmlFor={`create-invoice-${f.key}`} style={labelStyle}>{f.label}</label>
                    <input id={`create-invoice-${f.key}`} className="qi-input" type={f.type} value={(form as any)[f.key]} onChange={set(f.key)} style={inputStyle} />
                  </div>
                ))}
                <div>
                  <label id="create-invoice-customer-label" htmlFor="create-invoice-customer" style={labelStyle}>Customer</label>
                  <Select value={form.customer} onValueChange={val => setForm(f => ({ ...f, customer: val }))}>
                    <SelectTrigger id="create-invoice-customer" aria-labelledby="create-invoice-customer-label">
                      <SelectValue placeholder="Select customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="create-invoice-amount" style={labelStyle}>Amount (R)</label>
                    <input id="create-invoice-amount" className="qi-input" type="number" placeholder="0.00" value={form.amount} onChange={set('amount')} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>Due date</div>
                    <DatePicker value={form.due_date} onChange={val => setForm(f => ({ ...f, due_date: val }))} maxDate={today} />
                  </div>
                </div>
                <div>
                  <label htmlFor="create-invoice-description" style={labelStyle}>Description</label>
                  <textarea id="create-invoice-description" className="qi-input" value={form.description} onChange={set('description')} rows={3} placeholder="Invoice description..." style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 24, borderRadius: 8 }}>
              <label id="create-invoice-status-label" htmlFor="create-invoice-status" style={{ ...labelStyle, marginBottom: 16 }}>Status</label>
              <Select value={form.status} onValueChange={val => setForm(f => ({ ...f, status: val }))}>
                <SelectTrigger id="create-invoice-status" aria-labelledby="create-invoice-status-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SENT">Send to customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="card" style={{ padding: 24, borderRadius: 8, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>Total</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: 28, lineHeight: '36px', fontWeight: 600, color: 'var(--accent-primary)', minWidth: 0, overflowWrap: 'anywhere' }}>
                  R {parseFloat(form.amount || '0').toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {error && <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--status-danger-text, var(--status-danger))', padding: '12px 16px', background: 'var(--status-danger-bg)', borderRadius: 6 }}>{error}</div>}

            <button type="submit" className="btn-action qi-action" style={{ width: '100%', padding: '10px 12px', minHeight: 40, opacity: (!canSubmit || mutation.isPending) ? 0.45 : 1, cursor: (!canSubmit || mutation.isPending) ? 'not-allowed' : 'pointer' }} disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create invoice'}
            </button>
            <button type="button" className="qi-action" onClick={() => navigate('/finance/invoices')} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '9px 12px', minHeight: 40, borderRadius: 6, fontSize: 14, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer', width: '100%' }}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
