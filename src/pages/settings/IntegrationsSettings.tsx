import { useState, useEffect } from "react";
import { fetchData, postData, deleteData, patchData } from "@/lib/Api";
import { toast } from "@/lib/toast";

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
  marginBottom: 16,
  padding: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  marginBottom: 16,
};

interface XeroStatus {
  connected: boolean;
  tenant_name?: string;
  last_sync?: string;
}

interface APIKey {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used?: string;
}

interface Webhook {
  id: number;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

const EVENT_OPTIONS = [
  'booking.created', 'booking.updated', 'booking.completed',
  'invoice.created', 'invoice.paid', 'payment.received'
];

export function IntegrationsSettings() {
  // Xero state
  const [xeroStatus, setXeroStatus] = useState<XeroStatus | null>(null);
  const [loadingXero, setLoadingXero] = useState(true);
  const [syncingInvoices, setSyncingInvoices] = useState(false);
  const [syncingPayments, setSyncingPayments] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [showAddKey, setShowAddKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  useEffect(() => {
    loadXeroStatus();
    loadAPIKeys();
    loadWebhooks();
  }, []);

  const loadXeroStatus = () => {
    fetchData('api/v1/integrations/xero/status/')
      .then((data) => setXeroStatus(data))
      .catch(() => setXeroStatus({ connected: false }))
      .finally(() => setLoadingXero(false));
  };

  const handleXeroConnect = async () => {
    // Fetch the Xero OAuth authorization URL (authenticated GET — axios injects the
    // token and builds a clean URL), then redirect the whole tab into the flow.
    try {
      const data = await fetchData('api/v1/integrations/xero/connect/');
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      } else {
        toast.error('Could not start Xero connection.');
      }
    } catch (err: any) {
      toast.error(
        err?.status === 503
          ? "Xero isn't configured on the server yet."
          : 'Could not start Xero connection.'
      );
    }
  };

  const handleXeroDisconnect = async () => {
    try {
      await postData({ url: 'api/v1/integrations/xero/disconnect/', data: {} });
      toast.success('Xero disconnected');
      loadXeroStatus();
    } catch {
      toast.error('Failed to disconnect Xero');
    }
  };

  const handleSyncInvoices = async () => {
    setSyncingInvoices(true);
    try {
      await postData({ url: 'api/v1/integrations/xero/sync-invoices/', data: {} });
      toast.success('Invoices synced successfully');
      loadXeroStatus();
    } catch {
      toast.error('Failed to sync invoices');
    } finally {
      setSyncingInvoices(false);
    }
  };

  const handleSyncPayments = async () => {
    setSyncingPayments(true);
    try {
      await postData({ url: 'api/v1/integrations/xero/sync-payments/', data: {} });
      toast.success('Payments synced successfully');
      loadXeroStatus();
    } catch {
      toast.error('Failed to sync payments');
    } finally {
      setSyncingPayments(false);
    }
  };

  const loadAPIKeys = () => {
    fetchData('api/v1/integrations/api-keys/')
      .then((data) => {
        const arr = Array.isArray(data) ? data : (data?.results || []);
        setApiKeys(arr);
      })
      .catch(() => setApiKeys([]))
      .finally(() => setLoadingKeys(false));
  };

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a key name');
      return;
    }
    try {
      const result = await postData({
        url: 'api/v1/integrations/api-keys/',
        data: { name: newKeyName },
      });
      setGeneratedKey(result.key);
      setNewKeyName('');
      setShowAddKey(false);
      loadAPIKeys();
      toast.success('API key generated');
    } catch {
      toast.error('Failed to generate key');
    }
  };

  const handleRevokeKey = async (id: number) => {
    try {
      await deleteData({ url: `api/v1/integrations/api-keys/${id}/` });
      toast.success('API key revoked');
      loadAPIKeys();
    } catch {
      toast.error('Failed to revoke key');
    }
  };

  const loadWebhooks = () => {
    fetchData('api/v1/webhooks/')
      .then((data) => {
        const arr = Array.isArray(data) ? data : (data?.results || []);
        setWebhooks(arr);
      })
      .catch(() => setWebhooks([]))
      .finally(() => setLoadingWebhooks(false));
  };

  const handleAddWebhook = async () => {
    if (!newWebhookUrl || selectedEvents.length === 0) {
      toast.error('Please enter URL and select events');
      return;
    }
    try {
      await postData({
        url: 'api/v1/webhooks/',
        data: { url: newWebhookUrl, events: selectedEvents },
      });
      toast.success('Webhook created');
      setNewWebhookUrl('');
      setSelectedEvents([]);
      setShowAddWebhook(false);
      loadWebhooks();
    } catch {
      toast.error('Failed to create webhook');
    }
  };

  const handleTestWebhook = async (id: number) => {
    try {
      await postData({ url: `api/v1/webhooks/${id}/test/`, data: {} });
      toast.success('Test webhook fired');
    } catch {
      toast.error('Failed to test webhook');
    }
  };

  const handleDeleteWebhook = async (id: number) => {
    try {
      await deleteData({ url: `api/v1/webhooks/${id}/` });
      toast.success('Webhook deleted');
      loadWebhooks();
    } catch {
      toast.error('Failed to delete webhook');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
          Integrations
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Connect Truckwys to your existing tools
        </div>
      </div>

      {/* Xero Integration Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 4,
            background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)',
          }}>
            XR
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              Xero
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Sync invoices and payments with Xero accounting
            </div>
          </div>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: xeroStatus?.connected ? 'var(--status-success)' : 'var(--status-danger)',
          }} />
        </div>

        {loadingXero ? (
          <div style={{ height: 32, background: 'var(--bg-deep)', borderRadius: 4, marginBottom: 12 }} />
        ) : xeroStatus?.connected ? (
          <>
            <div style={{
              padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
              borderRadius: 4, marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)',
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>Connected:</strong> {xeroStatus.tenant_name || 'Xero Account'}
              {xeroStatus.last_sync && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Last sync: {new Date(xeroStatus.last_sync).toLocaleString()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={handleSyncInvoices} disabled={syncingInvoices} className="btn-action" style={{ fontSize: 10 }}>
                {syncingInvoices ? 'SYNCING...' : 'SYNC INVOICES'}
              </button>
              <button onClick={handleSyncPayments} disabled={syncingPayments} className="btn-action" style={{ fontSize: 10 }}>
                {syncingPayments ? 'SYNCING...' : 'SYNC PAYMENTS'}
              </button>
              <button onClick={handleXeroDisconnect} style={{
                background: 'none', border: '1px solid var(--border-subtle)',
                color: 'var(--text-tertiary)', padding: '6px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
              }}>
                DISCONNECT
              </button>
            </div>
          </>
        ) : (
          <button onClick={handleXeroConnect} className="btn-action">
            CONNECT XERO
          </button>
        )}
      </div>

      {/* ControlFleet Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 4,
            background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)',
          }}>
            CF
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              ControlFleet
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Fleet management and telematics integration
            </div>
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 8px',
            background: 'var(--bg-surface-hover)', color: 'var(--status-warning)',
            borderRadius: 2, letterSpacing: '0.08em',
          }}>
            In Development
          </span>
        </div>
        <div style={{
          padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
          borderRadius: 4, marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6 }}>
            WEBHOOK URL
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 2, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)',
          }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {import.meta.env.VITE_API_URL}/api/v1/fleet/webhooks/controlfleet/
            </span>
            <button
              onClick={() => copyToClipboard(`${import.meta.env.VITE_API_URL}/api/v1/fleet/webhooks/controlfleet/`)}
              style={{
                background: 'none', border: '1px solid var(--border-subtle)',
                color: 'var(--text-tertiary)', padding: '4px 8px',
                fontFamily: 'var(--font-mono)', fontSize: 9, borderRadius: 2, cursor: 'pointer',
              }}
            >
              COPY
            </button>
          </div>
        </div>
      </div>

      {/* Partner API Keys Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={sectionTitleStyle}>Partner API Keys</div>
          <button onClick={() => setShowAddKey(!showAddKey)} className="btn-action" style={{ fontSize: 9, padding: '4px 10px' }}>
            + NEW KEY
          </button>
        </div>

        {showAddKey && (
          <div style={{
            padding: 12, marginBottom: 12, background: 'var(--bg-deep)',
            border: '1px solid var(--border-subtle)', borderRadius: 4,
          }}>
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g., Production Server)"
              style={{
                width: '100%', marginBottom: 8, padding: '8px 12px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleGenerateKey} className="btn-action" style={{ fontSize: 10 }}>
                GENERATE
              </button>
              <button onClick={() => setShowAddKey(false)} style={{
                background: 'none', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', padding: '6px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
              }}>
                CANCEL
              </button>
            </div>
          </div>
        )}

        {loadingKeys ? (
          <div style={{ height: 32, background: 'var(--bg-deep)', borderRadius: 4 }} />
        ) : apiKeys.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
            No API keys yet. Generate one to enable programmatic access.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {apiKeys.map((key) => (
              <div key={key.id} style={{
                padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
                borderRadius: 4, display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {key.name}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    {key.prefix}... • Created {new Date(key.created_at).toLocaleDateString()}
                    {key.last_used && ` • Last used ${new Date(key.last_used).toLocaleDateString()}`}
                  </div>
                </div>
                <button onClick={() => handleRevokeKey(key.id)} style={{
                  background: 'none', border: '1px solid var(--status-danger)',
                  color: 'var(--status-danger)', padding: '4px 10px',
                  fontFamily: 'var(--font-mono)', fontSize: 9, borderRadius: 2, cursor: 'pointer',
                }}>
                  REVOKE
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhook Manager Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={sectionTitleStyle}>Webhooks</div>
          <button onClick={() => setShowAddWebhook(!showAddWebhook)} className="btn-action" style={{ fontSize: 9, padding: '4px 10px' }}>
            + ADD WEBHOOK
          </button>
        </div>

        {showAddWebhook && (
          <div style={{
            padding: 12, marginBottom: 12, background: 'var(--bg-deep)',
            border: '1px solid var(--border-subtle)', borderRadius: 4,
          }}>
            <input
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              placeholder="https://your-app.com/webhooks/truckwys"
              style={{
                width: '100%', marginBottom: 8, padding: '8px 12px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, color: 'var(--text-primary)', fontSize: 12,
                fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
            <div style={{ marginBottom: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              SELECT EVENTS:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
              {EVENT_OPTIONS.map((evt) => (
                <label key={evt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(evt)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEvents([...selectedEvents, evt]);
                      } else {
                        setSelectedEvents(selectedEvents.filter((ev) => ev !== evt));
                      }
                    }}
                  />
                  {evt}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAddWebhook} className="btn-action" style={{ fontSize: 10 }}>
                CREATE
              </button>
              <button onClick={() => setShowAddWebhook(false)} style={{
                background: 'none', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', padding: '6px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
              }}>
                CANCEL
              </button>
            </div>
          </div>
        )}

        {loadingWebhooks ? (
          <div style={{ height: 32, background: 'var(--bg-deep)', borderRadius: 4 }} />
        ) : webhooks.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
            No webhooks configured. Add one to receive real-time event notifications.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {webhooks.map((webhook) => (
              <div key={webhook.id} style={{
                padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
                borderRadius: 4, display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: 4 }}>
                    {webhook.url}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {webhook.events.map((evt) => (
                      <span key={evt} style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 6px',
                        background: 'var(--bg-surface)', color: 'var(--text-tertiary)', borderRadius: 2,
                      }}>
                        {evt}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => handleTestWebhook(webhook.id)} style={{
                  background: 'none', border: '1px solid var(--accent-primary)',
                  color: 'var(--accent-primary)', padding: '4px 10px',
                  fontFamily: 'var(--font-mono)', fontSize: 9, borderRadius: 2, cursor: 'pointer',
                }}>
                  TEST
                </button>
                <button onClick={() => handleDeleteWebhook(webhook.id)} style={{
                  background: 'none', border: '1px solid var(--status-danger)',
                  color: 'var(--status-danger)', padding: '4px 10px',
                  fontFamily: 'var(--font-mono)', fontSize: 9, borderRadius: 2, cursor: 'pointer',
                }}>
                  DELETE
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generated Key Modal */}
      {generatedKey && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setGeneratedKey(null)}>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--card-radius)', padding: 32, maxWidth: 500,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              API Key Generated
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
              Copy this key now — it will only be shown once:
            </div>
            <div style={{
              padding: 16, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
              borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)',
              wordBreak: 'break-all', marginBottom: 16,
            }}>
              {generatedKey}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { copyToClipboard(generatedKey); setGeneratedKey(null); }} className="btn-action">
                COPY & CLOSE
              </button>
              <button onClick={() => setGeneratedKey(null)} style={{
                background: 'none', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', padding: '7px 14px',
                fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
              }}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
