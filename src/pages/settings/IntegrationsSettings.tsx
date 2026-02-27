import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchData, postData, deleteData, patchData } from "@/lib/Api";

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

interface Webhook {
  id: number;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  failure_count: number;
  last_fired_at: string | null;
  created_at: string;
}

const EVENT_OPTIONS = [
  { value: 'load.created', label: 'Load Created' },
  { value: 'load.updated', label: 'Load Updated' },
  { value: 'load.status_changed', label: 'Load Status Changed' },
  { value: 'invoice.created', label: 'Invoice Created' },
  { value: 'invoice.paid', label: 'Invoice Paid' },
  { value: 'advance.approved', label: 'Advance Approved' },
  { value: 'advance.disbursed', label: 'Advance Disbursed' },
];

export function IntegrationsSettings() {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [connecting, setConnecting] = useState<string | null>(null);

  // Webhook state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<number | null>(null);

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      const data = await fetchData('api/v1/webhooks/');
      const list = Array.isArray(data) ? data : (data?.results || []);
      setWebhooks(list);
    } catch (err) {
      console.error('Failed to load webhooks:', err);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl || selectedEvents.length === 0) {
      alert('Please enter a URL and select at least one event');
      return;
    }
    try {
      const created = await postData({
        url: 'api/v1/webhooks/',
        data: { url: newWebhookUrl, events: selectedEvents },
      });
      setCreatedSecret(created.secret);
      setNewWebhookUrl('');
      setSelectedEvents([]);
      setShowAddWebhook(false);
      await loadWebhooks();
    } catch (err) {
      console.error('Failed to create webhook:', err);
      alert('Failed to create webhook');
    }
  };

  const handleTestWebhook = async (id: number) => {
    setTestingWebhook(id);
    try {
      await postData({ url: `api/v1/webhooks/${id}/test/`, data: {} });
      alert('Test ping sent successfully');
    } catch (err) {
      console.error('Failed to test webhook:', err);
      alert('Failed to send test ping');
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleToggleWebhook = async (id: number, currentActive: boolean) => {
    try {
      await patchData({ url: `api/v1/webhooks/${id}/`, data: { is_active: !currentActive } });
      await loadWebhooks();
    } catch (err) {
      console.error('Failed to toggle webhook:', err);
      alert('Failed to toggle webhook status');
    }
  };

  const handleDeleteWebhook = async (id: number) => {
    if (!confirm('Delete this webhook? This cannot be undone.')) return;
    try {
      await deleteData({ url: `api/v1/webhooks/${id}/` });
      await loadWebhooks();
    } catch (err) {
      console.error('Failed to delete webhook:', err);
      alert('Failed to delete webhook');
    }
  };

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

      {/* Webhooks Section */}
      <div style={sectionStyle}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={sectionTitleStyle}>Webhooks</span>
          <button
            onClick={() => setShowAddWebhook(!showAddWebhook)}
            style={{
              background: 'var(--accent-primary)',
              border: 'none',
              color: 'var(--btn-action-color)',
              padding: '4px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              borderRadius: 2,
              cursor: 'pointer',
              letterSpacing: '0.06em',
            }}
          >
            + ADD WEBHOOK
          </button>
        </div>

        {/* Add Webhook Form */}
        {showAddWebhook && (
          <div style={{ padding: 20, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-hover)' }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, letterSpacing: '0.06em' }}>WEBHOOK URL</label>
              <input
                type="url"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://your-app.com/webhooks/truckwys"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 2,
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, letterSpacing: '0.06em' }}>EVENTS</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {EVENT_OPTIONS.map((event) => (
                  <label key={event.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEvents([...selectedEvents, event.value]);
                        } else {
                          setSelectedEvents(selectedEvents.filter((ev) => ev !== event.value));
                        }
                      }}
                    />
                    {event.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleCreateWebhook}
                style={{
                  background: 'var(--accent-primary)',
                  border: 'none',
                  color: 'var(--btn-action-color)',
                  padding: '8px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              >
                CREATE
              </button>
              <button
                onClick={() => setShowAddWebhook(false)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '8px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* Secret Display Modal */}
        {createdSecret && (
          <div style={{ padding: 20, borderBottom: '1px solid var(--border-subtle)', background: 'var(--status-success-bg)' }}>
            <div style={{ fontSize: 11, color: 'var(--status-success)', fontWeight: 600, marginBottom: 8 }}>✓ Webhook Created</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>Copy this secret now — it won't be shown again:</div>
            <div style={{ padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 2, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
              {createdSecret}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(createdSecret); setCreatedSecret(null); }}
              style={{
                marginTop: 8,
                background: 'var(--accent-primary)',
                border: 'none',
                color: 'var(--btn-action-color)',
                padding: '6px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                borderRadius: 2,
                cursor: 'pointer',
              }}
            >
              COPY & CLOSE
            </button>
          </div>
        )}

        {/* Webhooks List */}
        {loadingWebhooks ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>Loading webhooks...</div>
        ) : webhooks.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
            No webhooks configured. Add one to receive real-time event notifications.
          </div>
        ) : (
          webhooks.map((webhook, idx) => (
            <div
              key={webhook.id}
              style={{
                padding: '16px 20px',
                borderBottom: idx < webhooks.length - 1 ? '1px solid var(--border-row)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>
                    {webhook.url.length > 50 ? webhook.url.substring(0, 50) + '...' : webhook.url}
                  </span>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: webhook.active ? 'var(--status-success)' : 'var(--status-danger)',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {webhook.events.map((ev) => (
                    <span
                      key={ev}
                      style={{
                        fontSize: 9,
                        fontFamily: 'var(--font-mono)',
                        padding: '2px 6px',
                        background: 'var(--bg-surface-hover)',
                        color: 'var(--text-secondary)',
                        borderRadius: 2,
                      }}
                    >
                      {ev}
                    </span>
                  ))}
                </div>
                {webhook.last_fired_at && (
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Last fired: {new Date(webhook.last_fired_at).toLocaleString()}
                  </div>
                )}
                {webhook.failure_count > 0 && (
                  <div style={{ fontSize: 9, color: 'var(--status-danger)', marginTop: 2 }}>
                    {webhook.failure_count} consecutive failures
                  </div>
                )}
              </div>
              <button
                onClick={() => handleToggleWebhook(webhook.id, webhook.active)}
                style={{
                  background: 'none',
                  border: `1px solid ${webhook.active ? 'var(--status-warning)' : 'var(--status-success)'}`,
                  color: webhook.active ? 'var(--status-warning)' : 'var(--status-success)',
                  padding: '4px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              >
                {webhook.active ? 'DISABLE' : 'ENABLE'}
              </button>
              <button
                onClick={() => handleTestWebhook(webhook.id)}
                disabled={testingWebhook === webhook.id}
                style={{
                  background: 'none',
                  border: '1px solid var(--accent-primary)',
                  color: 'var(--accent-primary)',
                  padding: '4px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  borderRadius: 2,
                  cursor: 'pointer',
                  opacity: testingWebhook === webhook.id ? 0.6 : 1,
                }}
              >
                {testingWebhook === webhook.id ? '...' : 'TEST'}
              </button>
              <button
                onClick={() => handleDeleteWebhook(webhook.id)}
                style={{
                  background: 'none',
                  border: '1px solid var(--status-danger)',
                  color: 'var(--status-danger)',
                  padding: '4px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              >
                DELETE
              </button>
            </div>
          ))
        )}
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
