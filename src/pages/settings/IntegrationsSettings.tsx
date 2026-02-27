import { useState } from "react";
import { useNavigate } from "react-router-dom";

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
  marginBottom: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'connected' | 'disconnected' | 'error';
  logo: string;
  xeroRoute?: boolean;
}

const INTEGRATIONS: Integration[] = [
  { id: 'xero', name: 'Xero', description: 'Sync invoices and payments with Xero accounting', category: 'Accounting', status: 'disconnected', logo: 'XR', xeroRoute: true },
  { id: 'stripe', name: 'Stripe', description: 'Accept online payments from customers', category: 'Payments', status: 'disconnected', logo: 'ST' },
  { id: 'tomtom', name: 'TomTom', description: 'Route optimisation and distance calculations', category: 'Maps', status: 'connected', logo: 'TT' },
  { id: 'sap', name: 'SAP', description: 'Enterprise resource planning integration', category: 'ERP', status: 'disconnected', logo: 'SA' },
  { id: 'slack', name: 'Slack', description: 'Team notifications and alerts via Slack', category: 'Notifications', status: 'disconnected', logo: 'SL' },
  { id: 'whatsapp', name: 'WhatsApp Business', description: 'Customer communication via WhatsApp', category: 'Communication', status: 'disconnected', logo: 'WA' },
];

const STATUS_COLOR: Record<string, string> = {
  connected: 'var(--accent-primary)',
  disconnected: 'var(--text-tertiary)',
  error: 'var(--status-danger)',
};

const STATUS_BG: Record<string, string> = {
  connected: 'var(--status-success-bg)',
  disconnected: 'var(--bg-surface-hover)',
  error: 'var(--status-danger-bg)',
};

export function IntegrationsSettings() {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = (id: string) => {
    const intg = integrations.find(i => i.id === id);
    if (intg?.xeroRoute) { navigate('/settings/xero'); return; }
    setConnecting(id);
    setTimeout(() => {
      setIntegrations(prev => prev.map(i =>
        i.id === id ? { ...i, status: i.status === 'connected' ? 'disconnected' : 'connected' } : i
      ));
      setConnecting(null);
    }, 800);
  };

  const categories = [...new Set(INTEGRATIONS.map(i => i.category))];

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Integrations</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Connect Truckwys to your existing tools and services</div>
      </div>

      {categories.map(cat => {
        const items = integrations.filter(i => i.category === cat);
        return (
          <div key={cat} style={sectionStyle}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={sectionTitleStyle}>{cat}</span>
            </div>
            {items.map((intg, idx) => (
              <div key={intg.id} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                borderBottom: idx < items.length - 1 ? '1px solid var(--border-row)' : 'none',
              }}>
                {/* Logo */}
                <div style={{
                  width: 40, height: 40, borderRadius: 2,
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)',
                  flexShrink: 0, fontWeight: 600,
                }}>
                  {intg.logo}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{intg.name}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px',
                      background: STATUS_BG[intg.status], color: STATUS_COLOR[intg.status],
                      borderRadius: 2, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                    }}>{intg.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{intg.description}</div>
                </div>

                {/* Action */}
                <button
                  onClick={() => handleConnect(intg.id)}
                  disabled={connecting === intg.id}
                  style={{
                    background: intg.status === 'connected' ? 'none' : 'var(--accent-primary)',
                    border: intg.status === 'connected' ? '1px solid var(--border-subtle)' : 'none',
                    color: intg.status === 'connected' ? 'var(--text-secondary)' : 'var(--btn-action-color)',
                    padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 10,
                    borderRadius: 2, cursor: 'pointer', letterSpacing: '0.05em',
                    opacity: connecting === intg.id ? 0.6 : 1,
                  }}
                >
                  {connecting === intg.id ? '...' : intg.status === 'connected' ? 'DISCONNECT' : 'CONNECT'}
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
