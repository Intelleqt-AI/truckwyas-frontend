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
    padding: '10px 12px',
    color: 'var(--text-primary)',
    borderRadius: 2,
    fontSize: 13,
    outline: 'none',
    width: '100%',
    fontFamily: 'var(--font-sans)',
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
        <button onClick={() => navigate('/finance/invoices')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← BACK</button>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 4 }}>Finance</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>New Invoice</div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Invoice Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Invoice Number', key: 'invoice_number', type: 'text' },
                ].map(f => (
                  <div key={f.key}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>{f.label.toUpperCase()}</div>
                    <input type={f.type} value={(form as any)[f.key]} onChange={set(f.key)} style={inputStyle} />
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>CUSTOMER</div>
                  <Select value={form.customer} onValueChange={val => setForm(f => ({ ...f, customer: val }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>AMOUNT (R)</div>
                    <input type="number" placeholder="0.00" value={form.amount} onChange={set('amount')} style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>DUE DATE</div>
                    <DatePicker value={form.due_date} onChange={val => setForm(f => ({ ...f, due_date: val }))} maxDate={today} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>DESCRIPTION</div>
                  <textarea value={form.description} onChange={set('description')} rows={3} placeholder="Invoice description..." style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Status</div>
              <Select value={form.status} onValueChange={val => setForm(f => ({ ...f, status: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SENT">Send to Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: 'var(--accent-primary)' }}>
                  R {parseFloat(form.amount || '0').toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {error && <div style={{ fontSize: 12, color: 'var(--status-danger)', padding: '12px 16px', background: 'var(--status-danger-bg)', borderRadius: 2 }}>{error}</div>}

            <button type="submit" className="btn-action" style={{ width: '100%', padding: '12px', fontSize: 12, opacity: (!canSubmit || mutation.isPending) ? 0.45 : 1, cursor: (!canSubmit || mutation.isPending) ? 'not-allowed' : 'pointer' }} disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? 'CREATING...' : 'CREATE INVOICE'}
            </button>
            <button type="button" onClick={() => navigate('/finance/invoices')} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '10px', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', width: '100%' }}>
              CANCEL
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
