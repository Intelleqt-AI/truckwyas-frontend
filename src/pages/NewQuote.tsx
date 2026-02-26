import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { postData, fetchData } from "@/lib/Api";

export default function NewQuote() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customer: '',
    pickup_location: '',
    delivery_location: '',
    origin: '',
    destination: '',
    cargo_description: '',
    weight: '',
    distance: '',
    base_rate: '',
    fuel_surcharge: '',
    additional_charges: '',
    notes: '',
    confidence: 'MEDIUM',
    status: 'DRAFT',
  });
  const [error, setError] = useState('');

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetchData('api/customers/'),
  });
  const customers = customersData?.results || customersData || [];

  const total = (parseFloat(form.base_rate || '0') + parseFloat(form.fuel_surcharge || '0') + parseFloat(form.additional_charges || '0'));

  const mutation = useMutation({
    mutationFn: (data: any) => postData({ url: 'api/quotes/', data }),
    onSuccess: () => navigate('/quotes'),
    onError: (e: any) => setError(e?.message || 'Failed to create quote'),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer || !form.pickup_location || !form.delivery_location) {
      setError('Customer, pickup and delivery are required');
      return;
    }
    mutation.mutate({ ...form, total_amount: total });
  };

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

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/quotes')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← BACK</button>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Operations</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>New Quote</div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          {/* Main form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Customer */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Customer</div>
              <select value={form.customer} onChange={set('customer')} style={{ ...inputStyle }}>
                <option value="">Select customer...</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Route */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Route</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Pickup Location', key: 'pickup_location', placeholder: 'e.g. Johannesburg Depot' },
                  { label: 'Delivery Location', key: 'delivery_location', placeholder: 'e.g. Cape Town Warehouse' },
                  { label: 'Origin City', key: 'origin', placeholder: 'e.g. JHB' },
                  { label: 'Destination City', key: 'destination', placeholder: 'e.g. CPT' },
                ].map(f => (
                  <div key={f.key}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>{f.label.toUpperCase()}</div>
                    <input type="text" placeholder={f.placeholder} value={(form as any)[f.key]} onChange={set(f.key)} style={inputStyle} />
                  </div>
                ))}
              </div>
            </div>

            {/* Cargo */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Cargo</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Cargo Description', key: 'cargo_description', placeholder: 'e.g. General Freight' },
                  { label: 'Weight (kg)', key: 'weight', placeholder: '15000' },
                  { label: 'Distance (km)', key: 'distance', placeholder: '1400' },
                ].map(f => (
                  <div key={f.key}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>{f.label.toUpperCase()}</div>
                    <input type="text" placeholder={f.placeholder} value={(form as any)[f.key]} onChange={set(f.key)} style={inputStyle} />
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Notes</div>
              <textarea value={form.notes} onChange={set('notes')} placeholder="Additional notes..." rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
          </div>

          {/* Sidebar — pricing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Pricing</div>
              {[
                { label: 'Base Rate (R)', key: 'base_rate', placeholder: '28000' },
                { label: 'Fuel Surcharge (R)', key: 'fuel_surcharge', placeholder: '2800' },
                { label: 'Additional Charges (R)', key: 'additional_charges', placeholder: '0' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>{f.label.toUpperCase()}</div>
                  <input type="number" placeholder={f.placeholder} value={(form as any)[f.key]} onChange={set(f.key)} style={inputStyle} />
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--accent-primary)' }}>R {total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Settings</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>STATUS</div>
                <select value={form.status} onChange={set('status')} style={inputStyle}>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Send to Customer</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>CONFIDENCE</div>
                <select value={form.confidence} onChange={set('confidence')} style={inputStyle}>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>

            {error && <div style={{ fontSize: 12, color: 'var(--status-danger)', padding: '10px 12px', background: 'var(--status-danger-bg)', borderRadius: 2 }}>{error}</div>}

            <button type="submit" className="btn-action" style={{ width: '100%', padding: '12px 16px', fontSize: 12 }} disabled={mutation.isPending}>
              {mutation.isPending ? 'CREATING...' : 'CREATE QUOTE'}
            </button>
            <button type="button" onClick={() => navigate('/quotes')} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', width: '100%' }}>
              CANCEL
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
