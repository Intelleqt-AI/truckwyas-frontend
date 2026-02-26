import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { postData, fetchData } from "@/lib/Api";

// SA toll + fuel constants
const FUEL_PRICE_PER_LITRE = 21.5; // ZAR
const AVG_LITRES_PER_100KM = 35;   // heavy truck
const SA_TOLL_RATE_PER_KM = 0.95;  // avg e-toll/N-road rate ZAR/km

// AI margin optimizer — suggests rate to hit target margin
function calcAIRate(distanceKm: number, weightKg: number, targetMargin: number) {
  const fuelCost = (distanceKm / 100) * AVG_LITRES_PER_100KM * FUEL_PRICE_PER_LITRE;
  const tollCost = distanceKm * SA_TOLL_RATE_PER_KM;
  const driverCost = distanceKm * 0.8;
  const otherCost = distanceKm * 0.5;
  const totalCost = fuelCost + tollCost + driverCost + otherCost;
  const rate = totalCost / (1 - targetMargin / 100);
  return { fuelCost, tollCost, driverCost, otherCost, totalCost, rate };
}

type QuoteMethod = 'manual' | 'per_km' | 'ai';

export default function NewQuote() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<QuoteMethod>('manual');
  const [targetMargin, setTargetMargin] = useState(25);
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
    toll_charges: '',
    driver_allowance: '',
    additional_charges: '',
    notes: '',
    confidence: 'MEDIUM',
    status: 'DRAFT',
  });
  const [error, setError] = useState('');

  const { data: customersData } = useQuery({ queryKey: ['customers'], queryFn: () => fetchData('api/customers/') });
  const customers = customersData?.results || customersData || [];

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const distKm = parseFloat(form.distance || '0');
  const weightKg = parseFloat(form.weight || '0');

  // Auto-calculate fuel + tolls when distance changes
  const autoCalc = () => {
    if (!distKm) return;
    const fuel = Math.round((distKm / 100) * AVG_LITRES_PER_100KM * FUEL_PRICE_PER_LITRE);
    const tolls = Math.round(distKm * SA_TOLL_RATE_PER_KM);
    setForm(f => ({ ...f, fuel_surcharge: String(fuel), toll_charges: String(tolls) }));
  };

  // Per-km method: auto-fill base_rate from rate/km input
  const [ratePerKm, setRatePerKm] = useState('');
  const handleRatePerKm = (v: string) => {
    setRatePerKm(v);
    const r = parseFloat(v || '0');
    if (r && distKm) setForm(f => ({ ...f, base_rate: String(Math.round(r * distKm)) }));
  };

  // AI method
  const aiResult = method === 'ai' && distKm ? calcAIRate(distKm, weightKg, targetMargin) : null;
  const applyAIRate = () => {
    if (!aiResult) return;
    setForm(f => ({
      ...f,
      base_rate: String(Math.round(aiResult.rate - aiResult.fuelCost - aiResult.tollCost - aiResult.driverCost - aiResult.otherCost)),
      fuel_surcharge: String(Math.round(aiResult.fuelCost)),
      toll_charges: String(Math.round(aiResult.tollCost)),
      driver_allowance: String(Math.round(aiResult.driverCost)),
    }));
    setMethod('manual');
  };

  const total = (
    parseFloat(form.base_rate || '0') +
    parseFloat(form.fuel_surcharge || '0') +
    parseFloat(form.toll_charges || '0') +
    parseFloat(form.driver_allowance || '0') +
    parseFloat(form.additional_charges || '0')
  );

  const impliedMargin = total > 0 && aiResult
    ? (((total - aiResult.totalCost) / total) * 100).toFixed(1)
    : null;

  const mutation = useMutation({
    mutationFn: (data: any) => postData({ url: 'api/quotes/', data }),
    onSuccess: () => navigate('/quotes'),
    onError: (e: any) => setError(e?.message || 'Failed to create quote'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer || !form.pickup_location || !form.delivery_location) {
      setError('Customer, pickup and delivery are required');
      return;
    }
    mutation.mutate({
      ...form,
      fuel_surcharge: parseFloat(form.fuel_surcharge || '0'),
      toll_charges: parseFloat(form.toll_charges || '0'),
      driver_allowance: parseFloat(form.driver_allowance || '0'),
      additional_charges: parseFloat(form.additional_charges || '0'),
      total_amount: total,
    });
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    padding: '10px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 13,
    outline: 'none', width: '100%', fontFamily: 'var(--font-sans)',
  };
  const label = (text: string) => (
    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>{text.toUpperCase()}</div>
  );

  const methodTab = (id: QuoteMethod, name: string) => (
    <button type="button" onClick={() => setMethod(id)} style={{
      background: method === id ? 'var(--accent-primary)' : 'var(--bg-surface)',
      border: `1px solid ${method === id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
      color: method === id ? '#fff' : 'var(--text-secondary)',
      padding: '8px 16px', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', flex: 1,
    }}>{name}</button>
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/quotes')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← BACK</button>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Operations</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>New Quote</div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          {/* LEFT — main form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Customer */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Customer</div>
              <select value={form.customer} onChange={set('customer')} style={inputStyle}>
                <option value="">Select customer...</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Route */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Route</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { l: 'Pickup Location', k: 'pickup_location', p: 'e.g. Johannesburg Depot' },
                  { l: 'Delivery Location', k: 'delivery_location', p: 'e.g. Cape Town Warehouse' },
                  { l: 'Origin City', k: 'origin', p: 'e.g. JHB' },
                  { l: 'Destination City', k: 'destination', p: 'e.g. CPT' },
                ].map(f => (
                  <div key={f.k}>{label(f.l)}<input type="text" placeholder={f.p} value={(form as any)[f.k]} onChange={set(f.k)} style={inputStyle} /></div>
                ))}
              </div>
            </div>

            {/* Cargo + distance */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Cargo & Distance</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>{label('Cargo Description')}<input type="text" placeholder="General Freight" value={form.cargo_description} onChange={set('cargo_description')} style={inputStyle} /></div>
                <div>{label('Weight (kg)')}<input type="number" placeholder="15000" value={form.weight} onChange={set('weight')} style={inputStyle} /></div>
                <div>
                  {label('Distance (km)')}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" placeholder="1400" value={form.distance} onChange={set('distance')} style={{ ...inputStyle, flex: 1 }} />
                    <button type="button" onClick={autoCalc} title="Auto-calculate fuel & tolls" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '0 12px', borderRadius: 2, fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', whiteSpace: 'nowrap' }}>AUTO-CALC ⚡</button>
                  </div>
                </div>
              </div>
              {distKm > 0 && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-surface-hover)', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', gap: 20 }}>
                  <span>Est. fuel: <span style={{ color: 'var(--text-primary)' }}>R {Math.round((distKm / 100) * AVG_LITRES_PER_100KM * FUEL_PRICE_PER_LITRE).toLocaleString()}</span></span>
                  <span>Est. tolls: <span style={{ color: 'var(--text-primary)' }}>R {Math.round(distKm * SA_TOLL_RATE_PER_KM).toLocaleString()}</span></span>
                  <span>Est. total cost: <span style={{ color: 'var(--text-primary)' }}>R {Math.round(distKm * (AVG_LITRES_PER_100KM / 100 * FUEL_PRICE_PER_LITRE + SA_TOLL_RATE_PER_KM + 0.8 + 0.5)).toLocaleString()}</span></span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Notes</div>
              <textarea value={form.notes} onChange={set('notes')} placeholder="Additional notes..." rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
          </div>

          {/* RIGHT — pricing sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Pricing method selector */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Pricing Method</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {methodTab('manual', 'Manual')}
                {methodTab('per_km', 'Per KM')}
                {methodTab('ai', 'AI Optimise')}
              </div>

              {/* Method: Manual */}
              {method === 'manual' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { l: 'Base Rate (R)', k: 'base_rate', p: '28000' },
                    { l: 'Fuel Surcharge (R)', k: 'fuel_surcharge', p: 'Auto-calc or manual' },
                    { l: 'Toll Charges (R)', k: 'toll_charges', p: 'Auto-calc or manual' },
                    { l: 'Driver Allowance (R)', k: 'driver_allowance', p: '0' },
                    { l: 'Additional Charges (R)', k: 'additional_charges', p: '0' },
                  ].map(f => (
                    <div key={f.k}>{label(f.l)}<input type="number" placeholder={f.p} value={(form as any)[f.k]} onChange={set(f.k)} style={inputStyle} /></div>
                  ))}
                </div>
              )}

              {/* Method: Per KM */}
              {method === 'per_km' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    {label('Rate per KM (R/km)')}
                    <input type="number" placeholder="e.g. 22.50" value={ratePerKm} onChange={e => handleRatePerKm(e.target.value)} style={inputStyle} />
                  </div>
                  {distKm > 0 && ratePerKm && (
                    <div style={{ padding: '10px 12px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                        {distKm} km × R {ratePerKm}/km
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--accent-primary)', marginTop: 4 }}>
                        = R {Math.round(parseFloat(ratePerKm) * distKm).toLocaleString()}
                      </div>
                    </div>
                  )}
                  <div>
                    {label('Fuel Surcharge (R)')}
                    <input type="number" placeholder="Auto-calc or manual" value={form.fuel_surcharge} onChange={set('fuel_surcharge')} style={inputStyle} />
                  </div>
                  <div>
                    {label('Toll Charges (R)')}
                    <input type="number" placeholder="Auto-calc or manual" value={form.toll_charges} onChange={set('toll_charges')} style={inputStyle} />
                  </div>
                  <div>
                    {label('Additional Charges (R)')}
                    <input type="number" placeholder="0" value={form.additional_charges} onChange={set('additional_charges')} style={inputStyle} />
                  </div>
                </div>
              )}

              {/* Method: AI Optimise */}
              {method === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    {label('Target Margin %')}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="range" min={5} max={50} value={targetMargin} onChange={e => setTargetMargin(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent-primary)' }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent-primary)', fontWeight: 700, minWidth: 36 }}>{targetMargin}%</span>
                    </div>
                  </div>
                  {!distKm && (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Enter distance to calculate</div>
                  )}
                  {aiResult && (
                    <div style={{ padding: 14, background: 'var(--bg-surface-hover)', borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>AI COST BREAKDOWN</div>
                      {[
                        { label: 'Fuel', value: aiResult.fuelCost },
                        { label: 'Tolls', value: aiResult.tollCost },
                        { label: 'Driver', value: aiResult.driverCost },
                        { label: 'Other', value: aiResult.otherCost },
                        { label: 'Total Cost', value: aiResult.totalCost },
                      ].map(r => (
                        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: r.label === 'Total Cost' ? 'var(--status-warning)' : 'var(--text-primary)' }}>R {Math.round(r.value).toLocaleString()}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>Recommended Rate</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--accent-primary)' }}>R {Math.round(aiResult.rate).toLocaleString()}</span>
                      </div>
                      <button type="button" onClick={applyAIRate} className="btn-action" style={{ width: '100%', marginTop: 4 }}>APPLY AI RATE</button>
                    </div>
                  )}
                </div>
              )}

              {/* Total */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Quote Total</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--accent-primary)' }}>R {total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
              </div>
              {impliedMargin && (
                <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: parseFloat(impliedMargin) >= targetMargin ? '#22c55e' : 'var(--status-danger)' }}>
                  Implied margin: {impliedMargin}% {parseFloat(impliedMargin) >= targetMargin ? '✓' : '↓ below target'}
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>Settings</div>
              <div style={{ marginBottom: 12 }}>
                {label('Status')}
                <select value={form.status} onChange={set('status')} style={inputStyle}>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Send to Customer</option>
                </select>
              </div>
              <div>
                {label('Confidence')}
                <select value={form.confidence} onChange={set('confidence')} style={inputStyle}>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--status-danger)', padding: '10px 12px', background: 'var(--status-danger-bg)', borderRadius: 2 }}>{error}</div>
            )}
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
