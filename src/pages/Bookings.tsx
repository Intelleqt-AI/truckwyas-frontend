import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchData, postData, patchData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--text-tertiary)',
  LOADING: 'var(--status-warning)',
  ASSIGNED: 'var(--status-warning)',
  IN_TRANSIT: 'var(--accent-primary)',
  DELIVERED: 'var(--status-success)',
  INVOICED: 'var(--accent-primary)',
  CANCELLED: 'var(--status-danger)',
};

const STATUS_CHOICES = ['PENDING', 'LOADING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'INVOICED', 'CANCELLED'];

export default function Bookings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [converting, setConverting] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [convertResult, setConvertResult] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const { data: load, isLoading } = useQuery({
    queryKey: ['load', id],
    queryFn: () => fetchData(`api/v1/loads/${id}/`),
    enabled: !!id,
  });

  const updateStatus = async (newStatus: string) => {
    setStatusMsg('');
    try {
      await patchData({ url: `api/v1/loads/${id}/`, data: { status: newStatus } });
      qc.invalidateQueries({ queryKey: ['load', id] });
      setStatusMsg(`Status updated to ${newStatus}`);
    } catch {
      setStatusMsg('Failed to update status');
    }
  };

  const convertToInvoice = async () => {
    setConverting(true);
    setConvertResult(null);
    try {
      const result = await postData({ url: `api/v1/loads/${id}/convert_to_invoice/`, data: {} });
      setConvertResult(result);
      qc.invalidateQueries({ queryKey: ['load', id] });
    } catch (e: any) {
      setConvertResult({ error: e?.message || 'Failed to create invoice' });
    } finally {
      setConverting(false);
    }
  };

  const uploadPOD = async (file: File) => {
    setUploadMsg('Uploading...');
    const formData = new FormData();
    formData.append('pod_document', file);
    try {
      const token = localStorage.getItem('access');
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3700';
      const res = await fetch(`${baseURL}/api/v1/loads/${id}/upload_pod/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg(`✅ POD uploaded: ${data.filename}`);
        qc.invalidateQueries({ queryKey: ['load', id] });
      } else {
        setUploadMsg(`❌ ${data.error || 'Upload failed'}`);
      }
    } catch {
      setUploadMsg('❌ Upload failed');
    }
  };

  if (isLoading) return (
    <div style={{ padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>
  );

  if (!load) return (
    <div style={{ padding: 40 }}>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Load not found.</div>
      <button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate('/bookings')}>← BACK</button>
    </div>
  );

  const hasPOD = !!(load.pod_signature || load.pod_received_by);
  const hasInvoice = !!(load.invoice_id || convertResult?.invoice_id);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button onClick={() => navigate('/bookings')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← BACK TO LOADS</button>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Load Detail</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{load.load_number}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{load.customer_name}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {/* Status dropdown */}
          <select
            value={load.status}
            onChange={e => updateStatus(e.target.value)}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: STATUS_COLOR[load.status] || 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 12px', borderRadius: 2, cursor: 'pointer' }}
          >
            {STATUS_CHOICES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      {statusMsg && <div style={{ marginBottom: 12, fontSize: 12, color: statusMsg.includes('Failed') ? 'var(--status-danger)' : 'var(--status-success)', fontFamily: 'var(--font-mono)' }}>{statusMsg}</div>}

      {/* Status bar */}
      <div className="card" style={{ padding: '12px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'INVOICED'].map((s, i) => {
            const statuses = ['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED'];
            const currentIdx = statuses.indexOf(load.status);
            const stepIdx = statuses.indexOf(s) !== -1 ? statuses.indexOf(s) : 4;
            const isInvoiced = s === 'INVOICED' && hasInvoice;
            const done = isInvoiced ? hasInvoice : stepIdx <= currentIdx;
            const active = !isInvoiced && s === load.status;
            return (
              <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, height: 3, background: done ? 'var(--accent-primary)' : 'var(--border-subtle)', transition: 'background 0.3s' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 8px' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: done ? 'var(--accent-primary)' : active ? 'var(--accent-primary)' : 'var(--border-subtle)', border: `2px solid ${active ? 'var(--accent-primary)' : 'transparent'}` }} />
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: done || active ? 'var(--accent-primary)' : 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{s.replace('_', ' ')}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Amount', value: formatCurrency(parseFloat(load.total_amount || '0')), color: 'var(--accent-primary)' },
          { label: 'Distance', value: `${parseFloat(load.distance || '0').toFixed(0)} km`, color: 'var(--text-primary)' },
          { label: 'Weight', value: `${parseFloat(load.weight || '0').toFixed(0)} kg`, color: 'var(--text-primary)' },
          { label: 'Rate/km', value: `R ${(parseFloat(load.rate || '0') / Math.max(parseFloat(load.distance || '1'), 1)).toFixed(2)}`, color: 'var(--text-primary)' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Route */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Route</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 4 }}>PICKUP</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{load.pickup_location}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{load.pickup_city}, {load.pickup_state}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{load.pickup_date?.slice(0, 10)}</div>
            </div>
            <div style={{ borderLeft: '2px dashed var(--border-subtle)', marginLeft: 8, paddingLeft: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{load.cargo_description}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 4 }}>DELIVERY</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{load.delivery_location}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{load.delivery_city}, {load.delivery_state}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{load.delivery_date?.slice(0, 10)}</div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Financials */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Financials</div>
            {[
              { label: 'Base Rate', value: formatCurrency(parseFloat(load.rate || '0')) },
              { label: 'Fuel Surcharge', value: formatCurrency(parseFloat(load.fuel_surcharge || '0')) },
              { label: 'Additional', value: formatCurrency(parseFloat(load.additional_charges || '0')) },
              { label: 'Total', value: formatCurrency(parseFloat(load.total_amount || '0')), highlight: true },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontSize: 12, color: r.highlight ? 'var(--accent-primary)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: r.highlight ? 600 : 400 }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Convert to Invoice */}
              {!hasInvoice ? (
                <button
                  className="btn-action"
                  style={{ width: '100%', opacity: converting ? 0.6 : 1 }}
                  onClick={convertToInvoice}
                  disabled={converting}
                >
                  {converting ? 'CREATING INVOICE...' : '+ CONVERT TO INVOICE'}
                </button>
              ) : (
                <button
                  className="btn-action"
                  style={{ width: '100%', background: 'var(--status-success)' }}
                  onClick={() => navigate(`/finance/invoices/${convertResult?.invoice_id || ''}`)}
                >
                  ✓ VIEW INVOICE
                </button>
              )}

              {convertResult && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 4,
                  background: convertResult.error ? 'var(--status-danger-dim)' : 'var(--status-success-dim)',
                  border: `1px solid ${convertResult.error ? 'var(--status-danger)' : 'var(--status-success)'}`,
                  fontSize: 12,
                  color: convertResult.error ? 'var(--status-danger)' : 'var(--status-success)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {convertResult.error ? `❌ ${convertResult.error}` : `✓ ${convertResult.invoice_number} — ${formatCurrency(convertResult.total_amount)}`}
                </div>
              )}

              {/* POD Upload */}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) uploadPOD(e.target.files[0]); }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: hasPOD ? 'var(--status-success-dim)' : 'var(--bg-surface)',
                  border: `1px solid ${hasPOD ? 'var(--status-success)' : 'var(--border-subtle)'}`,
                  color: hasPOD ? 'var(--status-success)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  borderRadius: 2,
                }}
              >
                {hasPOD ? `✓ POD: ${load.pod_received_by || 'Uploaded'}` : '↑ UPLOAD POD'}
              </button>
              {uploadMsg && (
                <div style={{ fontSize: 11, color: uploadMsg.startsWith('✅') ? 'var(--status-success)' : uploadMsg === 'Uploading...' ? 'var(--text-secondary)' : 'var(--status-danger)', fontFamily: 'var(--font-mono)' }}>
                  {uploadMsg}
                </div>
              )}
            </div>
          </div>

          {/* Assignment */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Assignment</div>
            {[
              { label: 'Driver', value: load.driver_name || '—' },
              { label: 'Vehicle', value: load.vehicle_info || '—' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
