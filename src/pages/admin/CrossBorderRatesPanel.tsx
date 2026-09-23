import '@/pages/admin/admin-brand.css';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, postData, patchData, deleteData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { Loader } from '@/components/Loader';
import { ConfirmModal } from '@/components/ConfirmModal';

// Platform-wide cross-border pricing reference data — feeds the "Border
// fees", "Weighbridge" and "Non-SA tolls" line items on every cross-tenant
// quote (core/services/cross_border.py). Previously only editable via Django
// admin or a management command + code deploy — see
// core/migrations/0110_fix_zw_border_fee.py for the data-quality pass this
// page was built for (Zimbabwe's fee was priced well below the real
// Zimborders bridge toll). An edit here applies to every company's quotes
// immediately, same reasoning as the Truck Types page.

const cardStyle: React.CSSProperties = { padding: 20, marginBottom: 20 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 4 };
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', fontSize: 13, lineHeight: '20px', fontWeight: 500,
  fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border-subtle)',
};
const tdStyle: React.CSSProperties = {
  padding: '12px', fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-row)',
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 12px', minHeight: 40, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
  borderRadius: 6, fontSize: 14, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, lineHeight: '20px', fontWeight: 500,
  fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  padding: '8px 12px', borderRadius: 6, minHeight: 40, fontSize: 14, lineHeight: '20px',
  fontFamily: 'var(--font-sans)', width: '100%', boxSizing: 'border-box',
};

interface BorderFee {
  id: number; from_country: string; to_country: string; fee_zar: string | number; notes: string; is_active: boolean;
}
interface TransitRate {
  id: number; country_code: string; country_name: string;
  weighbridge_fee_zar: string | number; toll_rate_per_km: string | number; sa_border_distance_km: string | number;
  is_active: boolean;
}

const feeForm0 = { from_country: '', to_country: '', fee_zar: '', notes: '', is_active: true };
const rateForm0 = { country_code: '', country_name: '', weighbridge_fee_zar: '', toll_rate_per_km: '', sa_border_distance_km: '', is_active: true };

const fmtRand = (v: any) => (v || v === 0) ? `R${parseFloat(v).toFixed(2)}` : '—';

export default function CrossBorderRatesPanel() {
  const qc = useQueryClient();

  // --- Border crossing fees ---
  const feesKey = ['admin-border-fees'];
  const { data: feesData, isLoading: feesLoading } = useQuery({ queryKey: feesKey, queryFn: () => fetchData('api/v1/admin/border-fees/') });
  const fees: BorderFee[] = feesData?.results || [];

  const [showAddFee, setShowAddFee] = useState(false);
  const [feeForm, setFeeForm] = useState(feeForm0);
  const [feeErr, setFeeErr] = useState('');
  const [feeSaving, setFeeSaving] = useState(false);
  const [editFee, setEditFee] = useState<BorderFee | null>(null);
  const [editFeeForm, setEditFeeForm] = useState(feeForm0);
  const [deleteFee, setDeleteFee] = useState<BorderFee | null>(null);
  const [feePending, setFeePending] = useState<number | null>(null);

  const refreshFees = () => qc.invalidateQueries({ queryKey: feesKey });

  const handleAddFee = async () => {
    if (!feeForm.from_country.trim() || !feeForm.to_country.trim()) { setFeeErr('From/To country are required'); return; }
    setFeeSaving(true);
    setFeeErr('');
    try {
      await postData({ url: 'api/v1/admin/border-fees/', data: {
        from_country: feeForm.from_country.trim(), to_country: feeForm.to_country.trim(),
        fee_zar: feeForm.fee_zar === '' ? 0 : Number(feeForm.fee_zar), notes: feeForm.notes.trim(), is_active: feeForm.is_active,
      }});
      toast.success('Border fee added');
      setFeeForm(feeForm0);
      setShowAddFee(false);
      refreshFees();
    } catch (e: any) {
      setFeeErr(e?.message || 'Failed to add border fee');
    } finally {
      setFeeSaving(false);
    }
  };

  const openEditFee = (f: BorderFee) => {
    setEditFee(f);
    setEditFeeForm({ from_country: f.from_country, to_country: f.to_country, fee_zar: String(f.fee_zar), notes: f.notes || '', is_active: f.is_active });
    setFeeErr('');
  };

  const handleEditFeeSave = async () => {
    if (!editFee) return;
    setFeeSaving(true);
    setFeeErr('');
    try {
      await patchData({ url: `api/v1/admin/border-fees/${editFee.id}/`, data: {
        fee_zar: editFeeForm.fee_zar === '' ? 0 : Number(editFeeForm.fee_zar), notes: editFeeForm.notes.trim(), is_active: editFeeForm.is_active,
      }});
      toast.success('Saved — every company sees the update immediately');
      setEditFee(null);
      refreshFees();
    } catch (e: any) {
      setFeeErr(e?.message || 'Failed to update border fee');
    } finally {
      setFeeSaving(false);
    }
  };

  const toggleFeeActive = async (f: BorderFee) => {
    setFeePending(f.id);
    try {
      await patchData({ url: `api/v1/admin/border-fees/${f.id}/`, data: { is_active: !f.is_active } });
      qc.setQueryData(feesKey, (old: any) => old?.results ? { ...old, results: old.results.map((r: BorderFee) => r.id === f.id ? { ...r, is_active: !f.is_active } : r) } : old);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    } finally {
      setFeePending(null);
    }
  };

  const handleDeleteFee = async () => {
    if (!deleteFee) return;
    setFeePending(deleteFee.id);
    try {
      await deleteData({ url: `api/v1/admin/border-fees/${deleteFee.id}/` });
      toast.success('Border fee deleted');
      setDeleteFee(null);
      refreshFees();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    } finally {
      setFeePending(null);
    }
  };

  // --- Country transit rates ---
  const ratesKey = ['admin-transit-rates'];
  const { data: ratesData, isLoading: ratesLoading } = useQuery({ queryKey: ratesKey, queryFn: () => fetchData('api/v1/admin/transit-rates/') });
  const rates: TransitRate[] = ratesData?.results || [];

  const [showAddRate, setShowAddRate] = useState(false);
  const [rateForm, setRateForm] = useState(rateForm0);
  const [rateErr, setRateErr] = useState('');
  const [rateSaving, setRateSaving] = useState(false);
  const [editRate, setEditRate] = useState<TransitRate | null>(null);
  const [editRateForm, setEditRateForm] = useState(rateForm0);
  const [deleteRate, setDeleteRate] = useState<TransitRate | null>(null);
  const [ratePending, setRatePending] = useState<number | null>(null);

  const refreshRates = () => qc.invalidateQueries({ queryKey: ratesKey });

  const rateToPayload = (f: typeof rateForm0) => ({
    country_name: f.country_name.trim(),
    weighbridge_fee_zar: f.weighbridge_fee_zar === '' ? 0 : Number(f.weighbridge_fee_zar),
    toll_rate_per_km: f.toll_rate_per_km === '' ? 0 : Number(f.toll_rate_per_km),
    sa_border_distance_km: f.sa_border_distance_km === '' ? 0 : Number(f.sa_border_distance_km),
    is_active: f.is_active,
  });

  const handleAddRate = async () => {
    if (!rateForm.country_code.trim() || !rateForm.country_name.trim()) { setRateErr('Country code and name are required'); return; }
    setRateSaving(true);
    setRateErr('');
    try {
      await postData({ url: 'api/v1/admin/transit-rates/', data: { country_code: rateForm.country_code.trim(), ...rateToPayload(rateForm) } });
      toast.success('Transit rate added');
      setRateForm(rateForm0);
      setShowAddRate(false);
      refreshRates();
    } catch (e: any) {
      setRateErr(e?.message || 'Failed to add transit rate');
    } finally {
      setRateSaving(false);
    }
  };

  const openEditRate = (r: TransitRate) => {
    setEditRate(r);
    setEditRateForm({
      country_code: r.country_code, country_name: r.country_name,
      weighbridge_fee_zar: String(r.weighbridge_fee_zar), toll_rate_per_km: String(r.toll_rate_per_km),
      sa_border_distance_km: String(r.sa_border_distance_km), is_active: r.is_active,
    });
    setRateErr('');
  };

  const handleEditRateSave = async () => {
    if (!editRate) return;
    setRateSaving(true);
    setRateErr('');
    try {
      await patchData({ url: `api/v1/admin/transit-rates/${editRate.id}/`, data: rateToPayload(editRateForm) });
      toast.success('Saved — every company sees the update immediately');
      setEditRate(null);
      refreshRates();
    } catch (e: any) {
      setRateErr(e?.message || 'Failed to update transit rate');
    } finally {
      setRateSaving(false);
    }
  };

  const toggleRateActive = async (r: TransitRate) => {
    setRatePending(r.id);
    try {
      await patchData({ url: `api/v1/admin/transit-rates/${r.id}/`, data: { is_active: !r.is_active } });
      qc.setQueryData(ratesKey, (old: any) => old?.results ? { ...old, results: old.results.map((x: TransitRate) => x.id === r.id ? { ...x, is_active: !r.is_active } : x) } : old);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    } finally {
      setRatePending(null);
    }
  };

  const handleDeleteRate = async () => {
    if (!deleteRate) return;
    setRatePending(deleteRate.id);
    try {
      await deleteData({ url: `api/v1/admin/transit-rates/${deleteRate.id}/` });
      toast.success('Transit rate deleted');
      setDeleteRate(null);
      refreshRates();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    } finally {
      setRatePending(null);
    }
  };

  return (
    <div>
      <div className="card" style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ ...sectionTitleStyle, marginBottom: 0 }}>Border Crossing Fees {feesData ? `(${fees.length})` : ''}</div>
          <button className="btn-action" style={{ fontSize: 11 }} onClick={() => { setShowAddFee(s => !s); setFeeErr(''); }}>
            {showAddFee ? 'Cancel' : '+ Add Fee'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
          One-way fee per country pair — feeds the "Border fees" line item on every quote.
        </div>

        {showAddFee && (
          <div style={{ padding: 16, marginBottom: 16, background: 'var(--bg-surface-hover, var(--bg-surface))', border: '1px solid var(--border-subtle)', borderRadius: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {feeErr && <div style={{ gridColumn: '1 / -1', padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', borderRadius: 2, fontSize: 12 }}>{feeErr}</div>}
            <div><label style={labelStyle}>From Country</label><input style={inputStyle} value={feeForm.from_country} onChange={e => setFeeForm(p => ({ ...p, from_country: e.target.value.toUpperCase() }))} placeholder="SA" /></div>
            <div><label style={labelStyle}>To Country</label><input style={inputStyle} value={feeForm.to_country} onChange={e => setFeeForm(p => ({ ...p, to_country: e.target.value.toUpperCase() }))} placeholder="ZW" /></div>
            <div><label style={labelStyle}>Fee (R)</label><input type="number" style={inputStyle} value={feeForm.fee_zar} onChange={e => setFeeForm(p => ({ ...p, fee_zar: e.target.value }))} /></div>
            <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Notes</label><input style={inputStyle} value={feeForm.notes} onChange={e => setFeeForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div style={{ gridColumn: '1 / -1' }}><button className="btn-action" style={{ fontSize: 11 }} disabled={feeSaving} onClick={handleAddFee}>{feeSaving ? 'Saving…' : 'Save Fee'}</button></div>
          </div>
        )}

        {feesLoading ? <Loader size={24} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thStyle}>From</th><th style={thStyle}>To</th><th style={thStyle}>Fee</th><th style={thStyle}>Notes</th><th style={thStyle}>Status</th><th style={thStyle}>Actions</th></tr></thead>
              <tbody>
                {fees.map(f => (
                  <tr key={f.id} style={{ opacity: f.is_active ? 1 : 0.55 }}>
                    <td style={tdStyle}>{f.from_country}</td>
                    <td style={tdStyle}>{f.to_country}</td>
                    <td style={tdStyle}>{fmtRand(f.fee_zar)}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 320 }}>{f.notes || '—'}</td>
                    <td style={tdStyle}><span className={`status-badge ${f.is_active ? 'active' : 'delayed'}`}>{f.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button style={secondaryBtnStyle} disabled={feePending === f.id} onClick={() => openEditFee(f)}>Edit</button>
                        <button style={secondaryBtnStyle} disabled={feePending === f.id} onClick={() => toggleFeeActive(f)}>{f.is_active ? 'Deactivate' : 'Activate'}</button>
                        <button style={{ ...secondaryBtnStyle, color: 'var(--status-danger)', borderColor: 'var(--status-danger)' }} disabled={feePending === f.id} onClick={() => setDeleteFee(f)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {fees.length === 0 && <tr><td style={tdStyle} colSpan={6}>No border fees configured.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ ...sectionTitleStyle, marginBottom: 0 }}>Country Transit Rates {ratesData ? `(${rates.length})` : ''}</div>
          <button className="btn-action" style={{ fontSize: 11 }} onClick={() => { setShowAddRate(s => !s); setRateErr(''); }}>
            {showAddRate ? 'Cancel' : '+ Add Country'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
          Per-country weighbridge fee and in-country toll rate — feeds "Weighbridge" and "Non-SA tolls" line items.
        </div>

        {showAddRate && (
          <div style={{ padding: 16, marginBottom: 16, background: 'var(--bg-surface-hover, var(--bg-surface))', border: '1px solid var(--border-subtle)', borderRadius: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {rateErr && <div style={{ gridColumn: '1 / -1', padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', borderRadius: 2, fontSize: 12 }}>{rateErr}</div>}
            <div><label style={labelStyle}>Country Code</label><input style={inputStyle} value={rateForm.country_code} onChange={e => setRateForm(p => ({ ...p, country_code: e.target.value.toUpperCase() }))} placeholder="ZW" /></div>
            <div><label style={labelStyle}>Country Name</label><input style={inputStyle} value={rateForm.country_name} onChange={e => setRateForm(p => ({ ...p, country_name: e.target.value }))} placeholder="Zimbabwe" /></div>
            <div><label style={labelStyle}>Weighbridge (R)</label><input type="number" style={inputStyle} value={rateForm.weighbridge_fee_zar} onChange={e => setRateForm(p => ({ ...p, weighbridge_fee_zar: e.target.value }))} /></div>
            <div><label style={labelStyle}>Toll Rate (R/km)</label><input type="number" style={inputStyle} value={rateForm.toll_rate_per_km} onChange={e => setRateForm(p => ({ ...p, toll_rate_per_km: e.target.value }))} /></div>
            <div><label style={labelStyle}>Border Distance (km)</label><input type="number" style={inputStyle} value={rateForm.sa_border_distance_km} onChange={e => setRateForm(p => ({ ...p, sa_border_distance_km: e.target.value }))} /></div>
            <div style={{ gridColumn: '1 / -1' }}><button className="btn-action" style={{ fontSize: 11 }} disabled={rateSaving} onClick={handleAddRate}>{rateSaving ? 'Saving…' : 'Save Country'}</button></div>
          </div>
        )}

        {ratesLoading ? <Loader size={24} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thStyle}>Country</th><th style={thStyle}>Weighbridge</th><th style={thStyle}>Toll/km</th><th style={thStyle}>Border Dist.</th><th style={thStyle}>Status</th><th style={thStyle}>Actions</th></tr></thead>
              <tbody>
                {rates.map(r => (
                  <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.55 }}>
                    <td style={tdStyle}>{r.country_name} <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>({r.country_code})</span></td>
                    <td style={tdStyle}>{fmtRand(r.weighbridge_fee_zar)}</td>
                    <td style={tdStyle}>{fmtRand(r.toll_rate_per_km)}/km</td>
                    <td style={tdStyle}>{r.sa_border_distance_km}km</td>
                    <td style={tdStyle}><span className={`status-badge ${r.is_active ? 'active' : 'delayed'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button style={secondaryBtnStyle} disabled={ratePending === r.id} onClick={() => openEditRate(r)}>Edit</button>
                        <button style={secondaryBtnStyle} disabled={ratePending === r.id} onClick={() => toggleRateActive(r)}>{r.is_active ? 'Deactivate' : 'Activate'}</button>
                        <button style={{ ...secondaryBtnStyle, color: 'var(--status-danger)', borderColor: 'var(--status-danger)' }} disabled={ratePending === r.id} onClick={() => setDeleteRate(r)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rates.length === 0 && <tr><td style={tdStyle} colSpan={6}>No transit rates configured.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editFee && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setEditFee(null)} />
          <div style={{ position: 'relative', width: 420, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Edit {editFee.from_country} → {editFee.to_country} Fee</div>
              <button onClick={() => setEditFee(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            {feeErr && <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', borderRadius: 2, marginBottom: 16, fontSize: 12 }}>{feeErr}</div>}
            <div style={{ marginBottom: 14 }}><label style={labelStyle}>Fee (R)</label><input type="number" style={inputStyle} value={editFeeForm.fee_zar} onChange={e => setEditFeeForm(p => ({ ...p, fee_zar: e.target.value }))} /></div>
            <div style={{ marginBottom: 14 }}><label style={labelStyle}>Notes</label><input style={inputStyle} value={editFeeForm.notes} onChange={e => setEditFeeForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button disabled={feeSaving} onClick={handleEditFeeSave} style={{ flex: 1, padding: '8px 0', minHeight: 40, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', background: 'var(--accent-primary)', color: 'var(--btn-action-color, var(--bg-deep))', border: 'none', borderRadius: 6, cursor: feeSaving ? 'wait' : 'pointer', fontWeight: 500 }}>{feeSaving ? 'Saving…' : 'Save changes'}</button>
              <button onClick={() => setEditFee(null)} style={{ padding: '8px 20px', minHeight: 40, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editRate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setEditRate(null)} />
          <div style={{ position: 'relative', width: 420, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Edit {editRate.country_name}</div>
              <button onClick={() => setEditRate(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            {rateErr && <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', borderRadius: 2, marginBottom: 16, fontSize: 12 }}>{rateErr}</div>}
            <div style={{ marginBottom: 14 }}><label style={labelStyle}>Country Name</label><input style={inputStyle} value={editRateForm.country_name} onChange={e => setEditRateForm(p => ({ ...p, country_name: e.target.value }))} /></div>
            <div style={{ marginBottom: 14 }}><label style={labelStyle}>Weighbridge (R)</label><input type="number" style={inputStyle} value={editRateForm.weighbridge_fee_zar} onChange={e => setEditRateForm(p => ({ ...p, weighbridge_fee_zar: e.target.value }))} /></div>
            <div style={{ marginBottom: 14 }}><label style={labelStyle}>Toll Rate (R/km)</label><input type="number" style={inputStyle} value={editRateForm.toll_rate_per_km} onChange={e => setEditRateForm(p => ({ ...p, toll_rate_per_km: e.target.value }))} /></div>
            <div style={{ marginBottom: 14 }}><label style={labelStyle}>Border Distance (km)</label><input type="number" style={inputStyle} value={editRateForm.sa_border_distance_km} onChange={e => setEditRateForm(p => ({ ...p, sa_border_distance_km: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button disabled={rateSaving} onClick={handleEditRateSave} style={{ flex: 1, padding: '8px 0', minHeight: 40, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', background: 'var(--accent-primary)', color: 'var(--btn-action-color, var(--bg-deep))', border: 'none', borderRadius: 6, cursor: rateSaving ? 'wait' : 'pointer', fontWeight: 500 }}>{rateSaving ? 'Saving…' : 'Save changes'}</button>
              <button onClick={() => setEditRate(null)} style={{ padding: '8px 20px', minHeight: 40, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', fontWeight: 500, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {deleteFee && (
        <ConfirmModal
          title="Delete border fee"
          message={`Delete the ${deleteFee.from_country} → ${deleteFee.to_country} fee? Every company's quotes for this corridor will stop including it.`}
          confirmLabel="Delete" danger
          onConfirm={handleDeleteFee}
          onCancel={() => setDeleteFee(null)}
        />
      )}

      {deleteRate && (
        <ConfirmModal
          title="Delete transit rate"
          message={`Delete the transit rate for ${deleteRate.country_name}? Quotes crossing into it will fall back to a generic default until a new rate is added.`}
          confirmLabel="Delete" danger
          onConfirm={handleDeleteRate}
          onCancel={() => setDeleteRate(null)}
        />
      )}
    </div>
  );
}
