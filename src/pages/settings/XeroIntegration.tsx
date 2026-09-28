import { StatusChip } from '@/components/ui/StatusChip';
import { useEffect, useState } from "react";
import useFetch from "@/hooks/useFetch";
import { usePost } from "@/hooks/usePost";
import { fetchData } from "@/lib/Api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader } from "@/components/Loader";
import { useAuth } from "@/lib/AuthContext";
import { SettingsShell } from "./SettingsShell";
import {
  SettingsPageHeader,
  settingsCardStyle,
  settingsCardHeaderStyle,
  settingsCardTitleStyle,
  settingsCardBodyStyle,
  settingsDangerButtonStyle,
  settingsBadgeStyle,
} from "./settingsUi";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  LogOut,
  Clock,
  Building2,
} from "lucide-react";

interface XeroConnection {
  configured?: boolean;
  is_connected: boolean;
  tenant_name?: string;
  connected_since?: string;
  last_invoice_sync?: string;
  last_payment_sync?: string;
}

interface SyncLog {
  id: number;
  sync_type: "invoice" | "payment";
  status: "success" | "error";
  timestamp: string;
  records_synced: number;
  error_message?: string;
}

export default function XeroIntegration() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  // Shared public demo account — connect/disconnect and sync actions are
  // fixed off; viewing connection status and sync history stays fully live.
  const isDemo = !!authUser?.is_demo;
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  // Fetch connection status
  const { data: connection, isLoading } = useFetch<XeroConnection>(
    "/api/integrations/xero/status/"
  );

  // Fetch sync log
  const { data: syncLogs } = useFetch<SyncLog[]>(
    "/api/integrations/xero/sync-log/"
  );

  // After the OAuth round-trip, Xero sends the user back here with ?xero=connected|error.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("xero");
    if (!outcome) return;
    if (outcome === "connected") {
      toast.success("Xero connected successfully");
      queryClient.invalidateQueries({
        queryKey: ["/api/integrations/xero/status/"],
      });
    } else if (outcome === "error") {
      toast.error("Xero authorization failed. Please try again.");
    }
    // Strip the query param so a refresh doesn't re-fire the toast.
    window.history.replaceState({}, "", window.location.pathname);
  }, [queryClient]);

  // Connect to Xero — fetch the OAuth authorization URL (authenticated GET), then
  // redirect the whole tab into the flow. Xero bounces back via the backend callback.
  // (The connect endpoint is a GET, so we use fetchData, not a POST mutation.)

  // Disconnect from Xero
  const { mutate: disconnectXero } = usePost({
    onSuccess: () => {
      toast.success("Disconnected from Xero");
      queryClient.invalidateQueries({
        queryKey: ["/api/integrations/xero/status/"],
      });
    },
    onError: () => {
      toast.error("Failed to disconnect from Xero");
    },
  });

  // Sync invoices
  const { mutate: syncInvoices } = usePost({
    onSuccess: () => {
      toast.success("Invoice sync completed successfully");
      setIsSyncing(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/integrations/xero/status/"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/integrations/xero/sync-log/"],
      });
    },
    onError: () => {
      toast.error("Failed to sync invoices");
      setIsSyncing(null);
    },
  });

  // Sync payments
  const { mutate: syncPayments } = usePost({
    onSuccess: () => {
      toast.success("Payment sync completed successfully");
      setIsSyncing(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/integrations/xero/status/"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/integrations/xero/sync-log/"],
      });
    },
    onError: () => {
      toast.error("Failed to sync payments");
      setIsSyncing(null);
    },
  });

  const handleConnect = async () => {
    try {
      const data: any = await fetchData("api/v1/integrations/xero/connect/");
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      } else {
        toast.error("Could not start Xero connection.");
      }
    } catch (error: any) {
      if (error?.status === 503) {
        toast.error(
          "Xero isn't configured on the server yet. Add the Xero app credentials to enable it."
        );
      } else {
        toast.error("Failed to initiate Xero connection");
      }
    }
  };

  const handleDisconnect = () => {
    if (
      confirm(
        "Are you sure you want to disconnect from Xero? This will stop automatic syncing."
      )
    ) {
      disconnectXero({ url: "/api/integrations/xero/disconnect/", data: {} });
    }
  };

  const handleSyncInvoices = () => {
    setIsSyncing("invoices");
    syncInvoices({ url: "/api/integrations/xero/sync-invoices/", data: {} });
  };

  const handleSyncPayments = () => {
    setIsSyncing("payments");
    syncPayments({ url: "/api/integrations/xero/sync-payments/", data: {} });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
  const metaRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, lineHeight: '20px', flexWrap: 'wrap' };
  const iconMuted: React.CSSProperties = { width: 16, height: 16, color: 'var(--text-tertiary)', flexShrink: 0 };
  const divider: React.CSSProperties = { borderTop: '1px solid var(--border-subtle)', paddingTop: 24, marginTop: 24 };

  if (isLoading) {
    return (
      <SettingsShell activeId="integrations">
        <Loader fullScreen />
      </SettingsShell>
    );
  }

  return (
    <SettingsShell activeId="integrations">
    <div style={{ maxWidth: 720 }}>
      <SettingsPageHeader
        title="Xero integration"
        description="Connect your Xero account to automatically sync invoices and payments"
      />

      {/* Connection status */}
      <section style={settingsCardStyle} aria-labelledby="xero-status-title">
        <div style={{ ...settingsCardHeaderStyle, justifyContent: 'space-between' }}>
          <h2 id="xero-status-title" style={settingsCardTitleStyle}>Connection status</h2>
          {connection?.is_connected ? (
            <StatusChip status="CONNECTED" />
          ) : (
            <StatusChip status="DISCONNECTED" />
          )}
        </div>
        <div style={settingsCardBodyStyle}>
          {connection?.is_connected ? (
            <>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={metaRow}>
                  <Building2 aria-hidden="true" style={iconMuted} />
                  <span style={{ color: 'var(--text-secondary)' }}>Organisation:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {connection.tenant_name || "Unknown"}
                  </span>
                </div>
                <div style={metaRow}>
                  <Clock aria-hidden="true" style={iconMuted} />
                  <span style={{ color: 'var(--text-secondary)' }}>Connected since:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {formatDate(connection.connected_since)}
                  </span>
                </div>
              </div>

              <div style={divider}>
                <h3 style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                  Sync data
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                    <button
                      type="button"
                      className="btn-action settings-control"
                      onClick={handleSyncInvoices}
                      disabled={isSyncing === "invoices" || isDemo}
                      title={isDemo ? "Not available in the demo" : undefined}
                      style={{ ...primaryBtn, width: '100%' }}
                    >
                      <RefreshCw aria-hidden="true" className={isSyncing === "invoices" ? "animate-spin" : undefined} style={{ width: 16, height: 16 }} />
                      Sync invoices
                    </button>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>
                      Last synced: {formatDate(connection.last_invoice_sync)}
                    </p>
                  </div>
                  <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                    <button
                      type="button"
                      className="btn-action settings-control"
                      onClick={handleSyncPayments}
                      disabled={isSyncing === "payments" || isDemo}
                      title={isDemo ? "Not available in the demo" : undefined}
                      style={{ ...primaryBtn, width: '100%' }}
                    >
                      <RefreshCw aria-hidden="true" className={isSyncing === "payments" ? "animate-spin" : undefined} style={{ width: 16, height: 16 }} />
                      Sync payments
                    </button>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>
                      Last synced: {formatDate(connection.last_payment_sync)}
                    </p>
                  </div>
                </div>
              </div>

              <div style={divider}>
                <button
                  type="button"
                  className="settings-control"
                  onClick={handleDisconnect}
                  disabled={isDemo}
                  title={isDemo ? "Not available in the demo" : undefined}
                  style={{ ...settingsDangerButtonStyle, opacity: isDemo ? 0.6 : 1, cursor: isDemo ? 'not-allowed' : 'pointer' }}
                >
                  <LogOut aria-hidden="true" style={{ width: 16, height: 16 }} />
                  Disconnect from Xero
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-dim)', color: 'var(--accent-primary)',
              }}>
                <Building2 aria-hidden="true" style={{ width: 24, height: 24 }} />
              </div>
              <h3 style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                Connect to Xero
              </h3>
              <p style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', margin: '0 auto 16px', maxWidth: 440 }}>
                Link your Xero account to automatically sync invoices and
                payments between TruckWys and Xero.
              </p>
              {connection?.configured === false && (
                <p style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', margin: '0 auto 16px', maxWidth: 440 }}>
                  Xero isn't configured on this server yet. Add your Xero app's
                  client ID and secret to the backend environment to enable the
                  connection.
                </p>
              )}
              <button
                type="button"
                className="btn-action settings-control"
                onClick={handleConnect}
                disabled={connection?.configured === false || isDemo}
                title={isDemo ? "Not available in the demo" : undefined}
                style={primaryBtn}
              >
                Connect to Xero
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Sync log */}
      {connection?.is_connected && syncLogs && syncLogs.length > 0 && (
        <section style={settingsCardStyle} aria-labelledby="xero-log-title">
          <div style={settingsCardHeaderStyle}>
            <h2 id="xero-log-title" style={settingsCardTitleStyle}>Recent sync activity</h2>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
            {syncLogs.map((log, i) => (
              <li
                key={log.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
                  padding: '12px 24px',
                  borderBottom: i < syncLogs.length - 1 ? '1px solid var(--border-row)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  {log.status === "success" ? (
                    <CheckCircle2 aria-hidden="true" style={{ width: 20, height: 20, flexShrink: 0, color: 'var(--status-success-text)' }} />
                  ) : (
                    <XCircle aria-hidden="true" style={{ width: 20, height: 20, flexShrink: 0, color: 'var(--status-danger-text)' }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {log.sync_type === "invoice" ? "Invoice sync" : "Payment sync"}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: '20px', color: log.status === "success" ? 'var(--text-tertiary)' : 'var(--status-danger-text)' }}>
                      {log.status === "success"
                        ? `${log.records_synced} records synced`
                        : log.error_message || "Sync failed"}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  {formatDate(log.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
    </SettingsShell>
  );
}
