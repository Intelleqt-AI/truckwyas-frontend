import { useState } from "react";

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
  marginBottom: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: '14px 20px',
  borderBottom: '1px solid var(--border-subtle)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

const PLAN = {
  name: 'Professional',
  price: 2499,
  billing: 'monthly',
  users: 15,
  maxUsers: 25,
  features: [
    'AI-powered quote optimisation',
    'Advanced analytics & reporting',
    'Fast Pay capital access',
    'Unlimited loads and invoices',
    'Fleet intelligence dashboard',
    'API access',
  ],
};

const INVOICES = [
  { id: 'INV-2025-001', date: '1 Jan 2025', amount: 2499, status: 'paid' },
  { id: 'INV-2024-012', date: '1 Dec 2024', amount: 2499, status: 'paid' },
  { id: 'INV-2024-011', date: '1 Nov 2024', amount: 2499, status: 'paid' },
];

export function BillingSettings() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const usagePct = Math.round((PLAN.users / PLAN.maxUsers) * 100);

  const handleDownload = (id: string) => {
    setDownloading(id);
    setTimeout(() => setDownloading(null), 1000);
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Billing</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Manage your subscription and payment history</div>
      </div>

      {/* Current Plan */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Current Plan</span></div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{PLAN.name}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px',
                  background: 'var(--status-success-bg)', color: 'var(--accent-primary)',
                  borderRadius: 2, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                }}>Active</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                R {PLAN.price.toLocaleString()} / {PLAN.billing}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{
                background: 'none', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', padding: '7px 14px',
                fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
              }}>CANCEL PLAN</button>
              <button className="btn-action">UPGRADE</button>
            </div>
          </div>

          {/* Usage bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Users</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>{PLAN.users} / {PLAN.maxUsers}</span>
            </div>
            <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${usagePct}%`, background: 'var(--accent-primary)', borderRadius: 2 }} />
            </div>
          </div>

          {/* Features */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {PLAN.features.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-primary)', fontSize: 14 }}>✓</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Payment Method</span></div>
        <div style={{ padding: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 16px', border: '1px solid var(--border-active)',
            borderRadius: 2, marginBottom: 12,
          }}>
            <div style={{
              width: 40, height: 26, background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-active)', borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)',
            }}>VISA</div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>•••• •••• •••• 4242</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Expires 12/2026</div>
            </div>
            <span style={{
              marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px',
              background: 'var(--status-success-bg)', color: 'var(--accent-primary)',
              borderRadius: 2, textTransform: 'uppercase' as const,
            }}>Default</span>
          </div>
          <button style={{
            background: 'none', border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)', padding: '7px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
          }}>+ ADD PAYMENT METHOD</button>
        </div>
      </div>

      {/* Billing History */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}><span style={sectionTitleStyle}>Billing History</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <thead>
            <tr>
              {['Invoice', 'Date', 'Amount', 'Status', ''].map(h => (
                <th key={h} style={{
                  padding: '10px 20px', textAlign: 'left' as const,
                  fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                  borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INVOICES.map((inv, i) => (
              <tr key={inv.id} style={{ borderBottom: i < INVOICES.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{inv.id}</td>
                <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>{inv.date}</td>
                <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                  R {inv.amount.toLocaleString()}
                </td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)',
                    textTransform: 'uppercase' as const,
                  }}>{inv.status}</span>
                </td>
                <td style={{ padding: '12px 20px', textAlign: 'right' as const }}>
                  <button
                    onClick={() => handleDownload(inv.id)}
                    style={{
                      background: 'none', border: '1px solid var(--border-subtle)',
                      color: 'var(--text-tertiary)', padding: '4px 10px',
                      fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                    }}
                  >{downloading === inv.id ? '↓...' : '↓ PDF'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
