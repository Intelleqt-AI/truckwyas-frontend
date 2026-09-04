import { useState, useEffect } from "react";
import { fetchData, postData, deleteData, patchData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { Loader } from "@/components/Loader";
import { useAuth } from "@/lib/AuthContext";

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
  textTransform: 'uppercase' as const,
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

interface CartrackStatus {
  configured: boolean;
  connected: boolean;
  base_url?: string;
  connected_at?: string;
  last_status_sync?: string;
}

interface CtrlFleetStatus {
  configured: boolean;
  connected: boolean;
  connected_at?: string;
  last_vehicle_sync?: string;
  matched_vehicles?: number;
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
  const { user: authUser } = useAuth();
  // Shared public demo account — every control that connects/disconnects an
  // integration, syncs data, links vehicles, or creates/revokes keys and
  // webhooks is fixed off; viewing status stays fully live.
  const isDemo = !!authUser?.is_demo;

  // Xero state
  const [xeroStatus, setXeroStatus] = useState<XeroStatus | null>(null);
  const [loadingXero, setLoadingXero] = useState(true);
  const [syncingInvoices, setSyncingInvoices] = useState(false);
  const [syncingPayments, setSyncingPayments] = useState(false);

  // Cartrack state
  const [cartrackStatus, setCartrackStatus] = useState<CartrackStatus | null>(null);
  const [loadingCartrack, setLoadingCartrack] = useState(true);
  const [showCartrackForm, setShowCartrackForm] = useState(false);
  const [cartrackUsername, setCartrackUsername] = useState('');
  const [cartrackPassword, setCartrackPassword] = useState('');
  const [cartrackBaseUrl, setCartrackBaseUrl] = useState('');
  const [connectingCartrack, setConnectingCartrack] = useState(false);

  // CtrlFleet state
  const [ctrlfleetStatus, setCtrlfleetStatus] = useState<CtrlFleetStatus | null>(null);
  const [loadingCtrlfleet, setLoadingCtrlfleet] = useState(true);
  const [showCtrlfleetForm, setShowCtrlfleetForm] = useState(false);
  const [ctrlfleetApiKey, setCtrlfleetApiKey] = useState('');
  const [connectingCtrlfleet, setConnectingCtrlfleet] = useState(false);
  const [disconnectingCtrlfleet, setDisconnectingCtrlfleet] = useState(false);
  const [showCtrlfleetVehicles, setShowCtrlfleetVehicles] = useState(false);
  const [loadingCtrlfleetVehicles, setLoadingCtrlfleetVehicles] = useState(false);
  const [ctrlfleetVehicles, setCtrlfleetVehicles] = useState<any[]>([]);
  const [truckwysVehicles, setTruckwysVehicles] = useState<any[]>([]);
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>({});
  const [linkingCode, setLinkingCode] = useState<string | null>(null);

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
    loadCartrackStatus();
    loadCtrlfleetStatus();
    loadAPIKeys();
    loadWebhooks();
  }, []);

  const loadXeroStatus = () => {
    fetchData('api/v1/integrations/xero/status/')
      .then((data) => setXeroStatus(data))
      .catch(() => setXeroStatus({ connected: false }))
      .finally(() => setLoadingXero(false));
  };

  const loadCartrackStatus = () => {
    fetchData('api/v1/integrations/cartrack/status/')
      .then((data) => setCartrackStatus(data))
      .catch(() => setCartrackStatus({ configured: false, connected: false }))
      .finally(() => setLoadingCartrack(false));
  };

  const handleCartrackConnect = async () => {
    if (!cartrackUsername.trim() || !cartrackPassword || !cartrackBaseUrl.trim()) {
      toast.error('Please enter username, password and base URL');
      return;
    }
    setConnectingCartrack(true);
    try {
      await postData({
        url: 'api/v1/integrations/cartrack/connect/',
        data: { username: cartrackUsername.trim(), password: cartrackPassword, base_url: cartrackBaseUrl.trim() },
      });
      toast.success('Cartrack connected');
      setCartrackUsername('');
      setCartrackPassword('');
      setCartrackBaseUrl('');
      setShowCartrackForm(false);
      loadCartrackStatus();
    } catch (err: any) {
      toast.error(err?.message || 'Could not connect to Cartrack — check your credentials and base URL');
    } finally {
      setConnectingCartrack(false);
    }
  };

  const loadCtrlfleetStatus = () => {
    fetchData('api/v1/integrations/ctrlfleet/status/')
      .then((data) => setCtrlfleetStatus(data))
      .catch(() => setCtrlfleetStatus({ configured: false, connected: false }))
      .finally(() => setLoadingCtrlfleet(false));
  };

  const handleCtrlfleetConnect = async () => {
    if (!ctrlfleetApiKey.trim()) {
      toast.error('Please enter your CtrlFleet API key');
      return;
    }
    setConnectingCtrlfleet(true);
    try {
      const result: any = await postData({
        url: 'api/v1/integrations/ctrlfleet/connect/',
        data: { api_key: ctrlfleetApiKey.trim() },
      });
      const matched = result?.sync?.matched ?? 0;
      const total = result?.sync?.total ?? 0;
      toast.success(`CtrlFleet connected — matched ${matched} of ${total} vehicles by plate`);
      setCtrlfleetApiKey('');
      setShowCtrlfleetForm(false);
      loadCtrlfleetStatus();
    } catch (err: any) {
      toast.error(err?.message || 'Could not connect to CtrlFleet — check your API key');
    } finally {
      setConnectingCtrlfleet(false);
    }
  };

  const handleCtrlfleetDisconnect = async () => {
    setDisconnectingCtrlfleet(true);
    try {
      await postData({ url: 'api/v1/integrations/ctrlfleet/disconnect/', data: {} });
      toast.success('CtrlFleet disconnected');
      loadCtrlfleetStatus();
      setShowCtrlfleetVehicles(false);
      setCtrlfleetVehicles([]);
    } catch (err: any) {
      toast.error(err?.message || 'Could not disconnect CtrlFleet');
    } finally {
      setDisconnectingCtrlfleet(false);
    }
  };

  const loadCtrlfleetVehicles = async () => {
    setLoadingCtrlfleetVehicles(true);
    try {
      const data: any = await fetchData('api/v1/integrations/ctrlfleet/vehicles/');
      setCtrlfleetVehicles(data?.ctrlfleet_vehicles || []);
      setTruckwysVehicles(data?.truckwys_vehicles || []);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load CtrlFleet vehicles');
    } finally {
      setLoadingCtrlfleetVehicles(false);
    }
  };

  const handleToggleCtrlfleetVehicles = () => {
    const next = !showCtrlfleetVehicles;
    setShowCtrlfleetVehicles(next);
    if (next) {
      loadCtrlfleetVehicles();
    }
  };

  const handleLinkVehicle = async (vehicleCode: string) => {
    const vehicleId = linkSelections[vehicleCode];
    if (!vehicleId) {
      toast.error('Select a vehicle to link first');
      return;
    }
    setLinkingCode(vehicleCode);
    try {
      await postData({
        url: 'api/v1/integrations/ctrlfleet/link-vehicle/',
        data: { vehicle_id: Number(vehicleId), ctrlfleet_vehicle_code: vehicleCode },
      });
      toast.success('Vehicle linked');
      loadCtrlfleetVehicles();
      loadCtrlfleetStatus();
    } catch (err: any) {
      toast.error(err?.message || 'Could not link vehicle');
    } finally {
      setLinkingCode(null);
    }
  };

  const handleUnlinkVehicle = async (vehicleId: number) => {
    try {
      await postData({
        url: 'api/v1/integrations/ctrlfleet/link-vehicle/',
        data: { vehicle_id: vehicleId, ctrlfleet_vehicle_code: null },
      });
      toast.success('Vehicle unlinked');
      loadCtrlfleetVehicles();
      loadCtrlfleetStatus();
    } catch (err: any) {
      toast.error(err?.message || 'Could not unlink vehicle');
    }
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
            overflow: 'hidden',
          }}>
            <img src="/Xero_logo.jpg" alt="Xero" style={{ width: 48, height: 48, objectFit: 'contain' }} />
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
          <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Loader size={20} /></div>
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
              <button
                onClick={handleSyncInvoices}
                disabled={syncingInvoices || isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                className="btn-action"
                style={{ fontSize: 10 }}
              >
                {syncingInvoices ? 'SYNCING...' : 'SYNC INVOICES'}
              </button>
              <button
                onClick={handleSyncPayments}
                disabled={syncingPayments || isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                className="btn-action"
                style={{ fontSize: 10 }}
              >
                {syncingPayments ? 'SYNCING...' : 'SYNC PAYMENTS'}
              </button>
              <button
                onClick={handleXeroDisconnect}
                disabled={isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                style={{
                  background: 'none', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-tertiary)', padding: '6px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2,
                  cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1,
                }}>
                DISCONNECT
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={handleXeroConnect}
            disabled={isDemo}
            title={isDemo ? 'Not available in the demo' : undefined}
            className="btn-action"
            style={isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            CONNECT XERO
          </button>
        )}
      </div>

      {/* Cartrack Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 4,
            background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img src="/cartract-logo.png" alt="Cartrack" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              Cartrack
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Live vehicle location, speed and ignition status
            </div>
          </div>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: cartrackStatus?.connected ? 'var(--status-success)' : 'var(--status-danger)',
          }} />
        </div>

        {loadingCartrack ? (
          <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Loader size={20} /></div>
        ) : cartrackStatus?.connected ? (
          <div style={{
            padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
            borderRadius: 4, fontSize: 12, color: 'var(--text-secondary)',
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>Connected:</strong> {cartrackStatus.base_url}
            {cartrackStatus.last_status_sync && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Last vehicle status sync: {new Date(cartrackStatus.last_status_sync).toLocaleString()}
              </div>
            )}
          </div>
        ) : showCartrackForm ? (
          <div style={{
            padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4,
          }}>
            <input
              value={cartrackUsername}
              onChange={(e) => setCartrackUsername(e.target.value)}
              placeholder="Cartrack username"
              style={{
                width: '100%', marginBottom: 8, padding: '8px 12px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
              }}
            />
            <input
              value={cartrackPassword}
              onChange={(e) => setCartrackPassword(e.target.value)}
              type="password"
              placeholder="Cartrack password"
              style={{
                width: '100%', marginBottom: 8, padding: '8px 12px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
              }}
            />
            <input
              value={cartrackBaseUrl}
              onChange={(e) => setCartrackBaseUrl(e.target.value)}
              placeholder="https://fleetapi-za.cartrack.com"
              style={{
                width: '100%', marginBottom: 8, padding: '8px 12px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, color: 'var(--text-primary)', fontSize: 12,
                fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 12 }}>
              Region-specific — get your base URL and credentials from Fleetweb &gt; Settings &gt; API Settings.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleCartrackConnect}
                disabled={connectingCartrack || isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                className="btn-action"
                style={{ fontSize: 10 }}
              >
                {connectingCartrack ? 'CONNECTING...' : 'CONNECT'}
              </button>
              <button onClick={() => setShowCartrackForm(false)} style={{
                background: 'none', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', padding: '6px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
              }}>
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCartrackForm(true)}
            disabled={isDemo}
            title={isDemo ? 'Not available in the demo' : undefined}
            className="btn-action"
            style={isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            CONNECT CARTRACK
          </button>
        )}
      </div>

      {/* CtrlFleet Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 4,
            background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img src="/cntrfleet-logo.png" alt="CtrlFleet" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              CtrlFleet
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Live vehicle location and points of interest
            </div>
          </div>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: ctrlfleetStatus?.connected ? 'var(--status-success)' : 'var(--status-danger)',
          }} />
        </div>

        {loadingCtrlfleet ? (
          <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Loader size={20} /></div>
        ) : ctrlfleetStatus?.connected ? (
          <>
            <div style={{
              padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
              borderRadius: 4, marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)',
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>Connected</strong>
              {typeof ctrlfleetStatus.matched_vehicles === 'number' && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {ctrlfleetStatus.matched_vehicles} vehicle{ctrlfleetStatus.matched_vehicles === 1 ? '' : 's'} matched by licence plate
                </div>
              )}
              {ctrlfleetStatus.last_vehicle_sync && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Last vehicle sync: {new Date(ctrlfleetStatus.last_vehicle_sync).toLocaleString()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  try {
                    const result: any = await postData({ url: 'api/v1/integrations/ctrlfleet/sync-vehicles/', data: {} });
                    toast.success(`Matched ${result?.sync?.matched ?? 0} of ${result?.sync?.total ?? 0} vehicles`);
                    loadCtrlfleetStatus();
                    if (showCtrlfleetVehicles) loadCtrlfleetVehicles();
                  } catch (err: any) {
                    toast.error(err?.message || 'Sync failed');
                  }
                }}
                disabled={isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                className="btn-action"
                style={{ fontSize: 10 }}
              >
                RE-SYNC VEHICLES
              </button>
              <button
                onClick={async () => {
                  try {
                    const result: any = await postData({ url: 'api/v1/integrations/ctrlfleet/sync-positions/', data: {} });
                    toast.success(`Updated position for ${result?.sync?.updated ?? 0} of ${result?.sync?.checked ?? 0} linked vehicles`);
                  } catch (err: any) {
                    toast.error(err?.message || 'Position sync failed');
                  }
                }}
                disabled={isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                style={{
                  background: 'none', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)', padding: '6px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2,
                  cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1,
                }}
              >
                SYNC POSITIONS
              </button>
              <button
                onClick={handleToggleCtrlfleetVehicles}
                style={{
                  background: 'none', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)', padding: '6px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
                }}
              >
                {showCtrlfleetVehicles ? 'HIDE VEHICLES' : 'VIEW VEHICLES'}
              </button>
              <button
                onClick={handleCtrlfleetDisconnect}
                disabled={disconnectingCtrlfleet || isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                style={{
                  background: 'none', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)', padding: '6px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2,
                  cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1,
                }}
              >
                {disconnectingCtrlfleet ? 'DISCONNECTING...' : 'DISCONNECT'}
              </button>
            </div>

            {showCtrlfleetVehicles && (
              <div style={{
                marginTop: 12, border: '1px solid var(--border-subtle)', borderRadius: 4,
                maxHeight: 320, overflowY: 'auto',
              }}>
                {loadingCtrlfleetVehicles ? (
                  <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}><Loader size={18} /></div>
                ) : ctrlfleetVehicles.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>No vehicles returned by CtrlFleet.</div>
                ) : (
                  ctrlfleetVehicles.map((cf, idx) => {
                    const unlinkedOptions = truckwysVehicles.filter((v) => !v.ctrlfleet_vehicle_code);
                    return (
                      <div key={cf.vehicle_code || idx} style={{
                        padding: '10px 12px', borderTop: idx === 0 ? 'none' : '1px solid var(--border-subtle)',
                        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                      }}>
                        <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                            {cf.licence_number || '(no plate)'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                            {cf.vehicle_code}{cf.type ? ` · ${cf.type}` : ''}
                          </div>
                        </div>
                        {cf.matched_vehicle_id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--status-success)',
                            }}>
                              LINKED → {cf.matched_vehicle_plate}
                            </span>
                            <button
                              onClick={() => handleUnlinkVehicle(cf.matched_vehicle_id)}
                              disabled={isDemo}
                              title={isDemo ? 'Not available in the demo' : undefined}
                              style={{
                                background: 'none', border: '1px solid var(--border-subtle)',
                                color: 'var(--text-tertiary)', padding: '3px 8px',
                                fontFamily: 'var(--font-mono)', fontSize: 9, borderRadius: 2,
                                cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1,
                              }}
                            >
                              UNLINK
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <select
                              value={linkSelections[cf.vehicle_code] || ''}
                              onChange={(e) => setLinkSelections({ ...linkSelections, [cf.vehicle_code]: e.target.value })}
                              style={{
                                padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                                borderRadius: 2, color: 'var(--text-primary)', fontSize: 11, outline: 'none',
                              }}
                            >
                              <option value="">Link to vehicle...</option>
                              {unlinkedOptions.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.plate} {v.make ? `— ${v.make} ${v.model}` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleLinkVehicle(cf.vehicle_code)}
                              disabled={linkingCode === cf.vehicle_code || isDemo}
                              title={isDemo ? 'Not available in the demo' : undefined}
                              className="btn-action"
                              style={{ fontSize: 9, padding: '4px 10px' }}
                            >
                              {linkingCode === cf.vehicle_code ? '...' : 'LINK'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        ) : showCtrlfleetForm ? (
          <div style={{
            padding: 12, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 4,
          }}>
            <input
              value={ctrlfleetApiKey}
              onChange={(e) => setCtrlfleetApiKey(e.target.value)}
              type="password"
              placeholder="CtrlFleet API key"
              style={{
                width: '100%', marginBottom: 8, padding: '8px 12px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 2, color: 'var(--text-primary)', fontSize: 12,
                fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 12 }}>
              Get your API key from your CtrlFleet account. Connecting matches your vehicles to CtrlFleet's by licence plate.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleCtrlfleetConnect}
                disabled={connectingCtrlfleet || isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                className="btn-action"
                style={{ fontSize: 10 }}
              >
                {connectingCtrlfleet ? 'CONNECTING...' : 'CONNECT'}
              </button>
              <button onClick={() => setShowCtrlfleetForm(false)} style={{
                background: 'none', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', padding: '6px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer',
              }}>
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCtrlfleetForm(true)}
            disabled={isDemo}
            title={isDemo ? 'Not available in the demo' : undefined}
            className="btn-action"
            style={isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            CONNECT CTRLFLEET
          </button>
        )}
      </div>

      {/* Partner API Keys Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={sectionTitleStyle}>Partner API Keys</div>
          <button
            onClick={() => setShowAddKey(!showAddKey)}
            disabled={isDemo}
            title={isDemo ? 'Not available in the demo' : undefined}
            className="btn-action"
            style={{ fontSize: 9, padding: '4px 10px', ...(isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
          >
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
              <button
                onClick={handleGenerateKey}
                disabled={isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                className="btn-action"
                style={{ fontSize: 10 }}
              >
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
          <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader size={20} /></div>
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
                <button
                  onClick={() => handleRevokeKey(key.id)}
                  disabled={isDemo}
                  title={isDemo ? 'Not available in the demo' : undefined}
                  style={{
                    background: 'none', border: '1px solid var(--status-danger)',
                    color: 'var(--status-danger)', padding: '4px 10px',
                    fontFamily: 'var(--font-mono)', fontSize: 9, borderRadius: 2,
                    cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1,
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
          <button
            onClick={() => setShowAddWebhook(!showAddWebhook)}
            disabled={isDemo}
            title={isDemo ? 'Not available in the demo' : undefined}
            className="btn-action"
            style={{ fontSize: 9, padding: '4px 10px', ...(isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
          >
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
              <button
                onClick={handleAddWebhook}
                disabled={isDemo}
                title={isDemo ? 'Not available in the demo' : undefined}
                className="btn-action"
                style={{ fontSize: 10 }}
              >
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
          <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader size={20} /></div>
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
                <button
                  onClick={() => handleTestWebhook(webhook.id)}
                  disabled={isDemo}
                  title={isDemo ? 'Not available in the demo' : undefined}
                  style={{
                    background: 'none', border: '1px solid var(--accent-primary)',
                    color: 'var(--accent-primary)', padding: '4px 10px',
                    fontFamily: 'var(--font-mono)', fontSize: 9, borderRadius: 2,
                    cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1,
                  }}>
                  TEST
                </button>
                <button
                  onClick={() => handleDeleteWebhook(webhook.id)}
                  disabled={isDemo}
                  title={isDemo ? 'Not available in the demo' : undefined}
                  style={{
                    background: 'none', border: '1px solid var(--status-danger)',
                    color: 'var(--status-danger)', padding: '4px 10px',
                    fontFamily: 'var(--font-mono)', fontSize: 9, borderRadius: 2,
                    cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1,
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
