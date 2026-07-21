import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, postData, patchData } from "@/lib/Api";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--text-tertiary)',
  LOADING: 'var(--status-warning)',
  ASSIGNED: 'var(--status-warning)',
  IN_TRANSIT: 'var(--accent-primary)',
  DELIVERED: 'var(--status-success)',
  INVOICED: 'var(--accent-primary)',
  CANCELLED: 'var(--status-danger)',
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:    ['ASSIGNED', 'LOADING', 'CANCELLED'],
  LOADING:    ['ASSIGNED', 'IN_TRANSIT', 'CANCELLED'],
  ASSIGNED:   ['LOADING', 'IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED:  ['INVOICED'],
  INVOICED:   [],
  CANCELLED:  ['PENDING'],
};

const fmt = (dateStr?: string) =>
  dateStr ? new Date(dateStr).toLocaleDateString('en-ZA') : '—';

// Sentence-case a raw status token for display: "IN_TRANSIT" → "In transit".
const titleCase = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

export default function Bookings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [converting, setConverting] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [confirmOpts, setConfirmOpts] = useState<{
    title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);

  const { data: load, isLoading } = useQuery({
    queryKey: ['load', id],
    queryFn: () => fetchData(`api/v1/loads/${id}/`),
    enabled: !!id,
  });

  const updateStatus = async (newStatus: string) => {
    const currentStatus = load?.status;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      toast.error(`Cannot transition from ${currentStatus} to ${newStatus.replace('_', ' ')}`);
      return;
    }

    if (newStatus === 'CANCELLED' && !['PENDING', 'LOADING'].includes(currentStatus)) {
      setConfirmOpts({
        title: 'Cancel Load',
        message: `Cancel this load? The load is currently ${currentStatus.replace('_', ' ')}. This action is difficult to reverse.`,
        confirmLabel: 'Cancel Load',
        danger: true,
        onConfirm: async () => {
          try {
            await patchData({ url: `api/v1/loads/${id}/`, data: { status: newStatus } });
            qc.invalidateQueries({ queryKey: ['load', id] });
            toast.success('Load cancelled');
          } catch (e: any) {
            toast.error(e?.message || 'Failed to update status');
          }
        },
      });
      return;
    }

    try {
      await patchData({ url: `api/v1/loads/${id}/`, data: { status: newStatus } });
      qc.invalidateQueries({ queryKey: ['load', id] });
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    }
  };

  const convertToInvoice = async () => {
    setConverting(true);
    try {
      const result = await postData({ url: `api/v1/loads/${id}/convert_to_invoice/`, data: {} });
      setCreatedInvoiceId(result.invoice_id);
      qc.invalidateQueries({ queryKey: ['load', id] });
      toast.success(`Invoice ${result.invoice_number} created`);
    } catch (e: any) {
      const existingId = (e as any)?.data?.invoice_id;
      if (existingId) {
        setCreatedInvoiceId(existingId);
        toast.info('Invoice already exists for this load');
      } else {
        toast.error(e?.message || 'Failed to create invoice');
      }
    } finally {
      setConverting(false);
    }
  };

  const uploadPOD = async (file: File) => {
    toast.info('Uploading POD...');
    const formData = new FormData();
    formData.append('pod_document', file);
    try {
      const data = await postData({ url: `api/v1/loads/${id}/upload_pod/`, data: formData });
      qc.invalidateQueries({ queryKey: ['load', id] });
      toast.success(`POD uploaded: ${data.filename}`);
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    }
  };

  if (isLoading) return (
    <div style={{ padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading...</div>
  );

  if (!load) return (
    <div style={{ padding: 40 }}>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Load not found.</div>
      <button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate('/bookings')}>← Back</button>
    </div>
  );

  const hasPOD = !!(load.pod_signature || load.pod_received_by);
  const invoiceId = createdInvoiceId || load.invoice_id;
  const hasInvoice = !!invoiceId;
  const allowedNextStatuses = VALID_TRANSITIONS[load.status] || [];

  return (
    <>
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button onClick={() => navigate('/bookings')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}>← Back to loads</button>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Load Detail</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{load.load_number}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{load.customer_name}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Select value={load.status} onValueChange={updateStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={load.status}>{titleCase(load.status)}</SelectItem>
              {allowedNextStatuses.map(s => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status bar */}
      {(() => {
        const STEPS = ['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'INVOICED'];
        const currentIdx = STEPS.indexOf(load.status);
        return (
          <div className="card" style={{ padding: '12px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {STEPS.map((step, stepIdx) => {
                const isActive = stepIdx === currentIdx;
                const isPast   = stepIdx <= currentIdx;
                return (
                  <div key={step} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1, height: 3, background: isPast ? 'var(--accent-primary)' : 'var(--border-subtle)', transition: 'background 0.3s' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 8px' }}>
                      <div style={{
                        width: isActive ? 12 : 10,
                        height: isActive ? 12 : 10,
                        borderRadius: '50%',
                        background: isPast ? 'var(--accent-primary)' : 'var(--border-subtle)',
                        boxShadow: isActive ? '0 0 0 3px rgba(77,158,255,0.25)' : 'none',
                        transition: 'all 0.3s',
                      }} />
                      <div style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)',
                        color: isPast ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                        fontWeight: isActive ? 600 : 400,
                        whiteSpace: 'nowrap',
                      }}>
                        {step.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{fmt(load.pickup_date)}</div>
            </div>
            <div style={{ borderLeft: '2px dashed var(--border-subtle)', marginLeft: 8, paddingLeft: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{load.cargo_description}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 4 }}>DELIVERY</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{load.delivery_location}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{load.delivery_city}, {load.delivery_state}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{fmt(load.delivery_date)}</div>
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
            <div className="card-title" style={{ marginBottom: 16 }}>Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!hasInvoice ? (
                <button
                  className="btn-action"
                  style={{ width: '100%', opacity: converting ? 0.6 : 1 }}
                  onClick={convertToInvoice}
                  disabled={converting}
                >
                  {converting ? 'Creating invoice...' : '+ Create invoice'}
                </button>
              ) : (
                <button
                  className="btn-action"
                  style={{ width: '100%', background: 'var(--status-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={() => navigate(`/finance/invoices/${invoiceId}`)}
                >
                  <span>✓ Invoice created</span>
                  <span style={{ opacity: 0.7, fontSize: 10 }}>—</span>
                  <span>See invoice →</span>
                </button>
              )}

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
                  cursor: 'pointer',
                  borderRadius: 2,
                }}
              >
                {hasPOD ? `✓ POD: ${load.pod_received_by || 'Uploaded'}` : '↑ Upload POD'}
              </button>
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

    {confirmOpts && (
      <ConfirmModal
        title={confirmOpts.title}
        message={confirmOpts.message}
        confirmLabel={confirmOpts.confirmLabel}
        danger={confirmOpts.danger}
        onConfirm={confirmOpts.onConfirm}
        onCancel={() => setConfirmOpts(null)}
      />
    )}
    </>
  );
}
