import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

const BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/').replace(/\/$/, '');

const C = {
  bg:        '#f1f5f9',
  surface:   '#ffffff',
  border:    '#e2e8f0',
  text:      '#0f172a',
  muted:     '#64748b',
  faint:     '#94a3b8',
  navy:      '#1e3a8a',
  navyLight: '#dbeafe',
  success:   '#16a34a',
  successBg: '#f0fdf4',
  warning:   '#d97706',
  warningBg: '#fffbeb',
  danger:    '#dc2626',
  mono:      "'SF Mono','Monaco','Consolas',monospace",
  sans:      "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
};

function fmt(n: string | number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', minimumFractionDigits: 2,
  }).format(Number(n));
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });
}

function statusColor(s: string): { bg: string; color: string } {
  if (s === 'PAID') return { bg: C.successBg, color: C.success };
  if (s === 'OVERDUE') return { bg: '#fef2f2', color: C.danger };
  if (s === 'PARTIALLY_PAID') return { bg: C.warningBg, color: C.warning };
  return { bg: C.navyLight, color: C.navy };
}

export default function PublicInvoice() {
  const { id, token } = useParams<{ id: string; token: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-invoice', id, token],
    queryFn: async () => {
      if (!token) throw new Error('Missing token');
      const res = await fetch(`${BASE_URL}/api/v1/invoices/public/${id}/${token}/`);
      if (!res.ok) throw new Error('Invalid invoice link');
      return res.json();
    },
    retry: false,
    enabled: !!id,
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, overflowY: 'auto',
      background: C.bg, fontFamily: C.sans, color: C.text,
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px 64px' }}>

        {/* Header */}
        <div style={{
          background: C.navy, borderRadius: '10px 10px 0 0',
          padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: C.mono, color: '#93c5fd', letterSpacing: '0.12em', marginBottom: 4 }}>
              {data?.company_name ? `${data.company_name} · INVOICE` : 'INVOICE'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
              {isLoading ? 'Loading…' : data ? data.invoice_number : 'Invoice'}
            </div>
          </div>
          {data?.company_logo_url ? (
            <img
              src={data.company_logo_url}
              alt={data.company_name || 'Company logo'}
              style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain' }}
            />
          ) : (
            <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" fill="none" stroke="#93c5fd" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
          )}
        </div>

        {/* Body */}
        {isLoading && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 48, textAlign: 'center', color: C.muted }}>
            Loading invoice…
          </div>
        )}

        {isError && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Invalid or expired link</div>
            <div style={{ color: C.muted, fontSize: 14 }}>This invoice link is invalid or has expired. Please contact the sender.</div>
          </div>
        )}

        {data && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px' }}>

            {/* Status bar */}
            <div style={{
              padding: '10px 32px',
              background: statusColor(data.status).bg,
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                background: statusColor(data.status).color,
              }} />
              <span style={{ fontSize: 11, fontFamily: C.mono, letterSpacing: '0.1em', color: statusColor(data.status).color, fontWeight: 600 }}>
                {data.status.replace('_', ' ')}
              </span>
            </div>

            <div style={{ padding: '28px 32px' }}>

              {/* From / To */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: C.mono, color: C.faint, letterSpacing: '0.08em', marginBottom: 6 }}>From</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{data.company_name}</div>
                  {data.company_phone && <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{data.company_phone}</div>}
                  {data.company_email && <div style={{ color: C.muted, fontSize: 13 }}>{data.company_email}</div>}
                  {data.company_address && <div style={{ color: C.muted, fontSize: 13 }}>{data.company_address}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontFamily: C.mono, color: C.faint, letterSpacing: '0.08em', marginBottom: 6 }}>TO</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{data.customer_name}</div>
                </div>
              </div>

              {/* Invoice meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
                {[
                  { label: 'Issue Date', value: fmtDate(data.issue_date) },
                  { label: 'Due Date', value: fmtDate(data.due_date) },
                ].map(r => (
                  <div key={r.label} style={{ background: C.bg, borderRadius: 6, padding: '12px 16px' }}>
                    <div style={{ fontSize: 10, fontFamily: C.mono, color: C.faint, letterSpacing: '0.08em', marginBottom: 4 }}>{r.label.toUpperCase()}</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{r.value}</div>
                  </div>
                ))}
              </div>

              {/* Line items */}
              {data.line_items && data.line_items.length > 0 ? (
                <div style={{ marginBottom: 24 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: C.navy }}>
                        {['Description', 'Qty', 'Unit Price', 'Amount'].map((h, i) => (
                          <th key={h} style={{
                            padding: '10px 12px', fontSize: 11, fontFamily: C.mono, color: '#fff',
                            textAlign: i === 0 ? 'left' : 'right', letterSpacing: '0.06em',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.line_items.map((item: any, i: number) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 1 ? C.bg : C.surface }}>
                          <td style={{ padding: '10px 12px', fontSize: 13 }}>{item.description}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right', fontFamily: C.mono }}>{item.quantity ?? 1}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right', fontFamily: C.mono }}>{fmt(item.unit_price ?? item.amount)}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right', fontFamily: C.mono }}>{fmt(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : data.description ? (
                <div style={{ marginBottom: 24, background: C.bg, borderRadius: 6, padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, fontFamily: C.mono, color: C.faint, letterSpacing: '0.08em', marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 14, color: C.muted }}>{data.description}</div>
                </div>
              ) : null}

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
                <div style={{ width: 280 }}>
                  {[
                    { label: 'Subtotal', value: fmt(data.subtotal) },
                    { label: 'VAT (15%)', value: fmt(data.vat_amount) },
                    ...(Number(data.discount) > 0 ? [{ label: 'Discount', value: `− ${fmt(data.discount)}` }] : []),
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                      <span style={{ color: C.muted }}>{r.label}</span>
                      <span style={{ fontFamily: C.mono }}>{r.value}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 6px', borderTop: `2px solid ${C.navy}`, marginTop: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                    <span style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 18, color: C.navy }}>{fmt(data.total_amount)}</span>
                  </div>
                  {Number(data.paid_amount) > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                        <span style={{ color: C.success }}>Paid</span>
                        <span style={{ fontFamily: C.mono, color: C.success }}>− {fmt(data.paid_amount)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: `1px solid ${C.border}`, fontWeight: 700 }}>
                        <span>Balance Due</span>
                        <span style={{ fontFamily: C.mono, color: C.danger }}>{fmt(data.balance)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Notes */}
              {data.notes && (
                <div style={{ marginBottom: 24, background: C.navyLight, borderRadius: 6, padding: '14px 16px', borderLeft: `3px solid ${C.navy}` }}>
                  <div style={{ fontSize: 10, fontFamily: C.mono, color: C.navy, letterSpacing: '0.08em', marginBottom: 6 }}>Notes</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{data.notes}</div>
                </div>
              )}

              {/* Payment instructions */}
              {data.status !== 'PAID' && data.status !== 'CANCELLED' && (
                <div style={{ background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: 8, padding: '20px 24px' }}>
                  <div style={{ fontSize: 11, fontFamily: C.mono, color: C.navy, letterSpacing: '0.1em', marginBottom: 12, fontWeight: 600 }}>
                    PAYMENT INSTRUCTIONS
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
                    Please use EFT and include <strong style={{ color: C.text }}>{data.invoice_number}</strong> as your payment reference.<br />
                    Contact <strong style={{ color: C.text }}>{data.company_name}</strong> for banking details.
                  </div>
                </div>
              )}

              {data.status === 'PAID' && (
                <div style={{ background: C.successBg, border: `1px solid #bbf7d0`, borderRadius: 8, padding: '20px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                  <div style={{ fontWeight: 600, color: C.success, fontSize: 16 }}>Invoice Paid</div>
                  <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Thank you for your payment.</div>
                </div>
              )}
            </div>

            {/* Footer — platform attribution */}
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.faint, fontFamily: C.mono, letterSpacing: '0.06em' }}>
                Powered by TruckWys
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
