import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import useFetch from "@/hooks/useFetch";
import { usePost } from "@/hooks/usePost";
import { fetchData } from "@/lib/Api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

  if (isLoading) {
    return (
      <div className="p-6">
        <div style={{ color: 'var(--text-secondary)' }}>Loading Xero integration status...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Xero Integration
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your Xero account to automatically sync invoices and payments
        </p>
      </div>

      {/* Connection Status Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Connection Status</CardTitle>
            {connection?.is_connected ? (
              <Badge className="bg-success text-white hover:bg-success">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-muted text-muted-foreground"
              >
                <XCircle className="w-3 h-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {connection?.is_connected ? (
            <>
              {/* Connected Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Organization:</span>
                  <span className="font-medium text-foreground">
                    {connection.tenant_name || "Unknown"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Connected since:</span>
                  <span className="font-medium text-foreground">
                    {formatDate(connection.connected_since)}
                  </span>
                </div>
              </div>

              {/* Sync Controls */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-foreground mb-4">
                  Sync Data
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Invoice Sync */}
                  <div className="space-y-2">
                    <Button
                      onClick={handleSyncInvoices}
                      disabled={isSyncing === "invoices"}
                      className="w-full"
                    >
                      <RefreshCw
                        className={`w-4 h-4 mr-2 ${
                          isSyncing === "invoices" ? "animate-spin" : ""
                        }`}
                      />
                      Sync Invoices
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Last synced: {formatDate(connection.last_invoice_sync)}
                    </p>
                  </div>

                  {/* Payment Sync */}
                  <div className="space-y-2">
                    <Button
                      onClick={handleSyncPayments}
                      disabled={isSyncing === "payments"}
                      className="w-full"
                    >
                      <RefreshCw
                        className={`w-4 h-4 mr-2 ${
                          isSyncing === "payments" ? "animate-spin" : ""
                        }`}
                      />
                      Sync Payments
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Last synced: {formatDate(connection.last_payment_sync)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Disconnect Button */}
              <div className="border-t pt-6">
                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  className=""
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect from Xero
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Not Connected State */}
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Connect to Xero
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Link your Xero account to automatically sync invoices and
                  payments between TruckWys and Xero.
                </p>
                {connection?.configured === false && (
                  <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
                    Xero isn't configured on this server yet. Add your Xero app's
                    client ID and secret to the backend environment to enable the
                    connection.
                  </p>
                )}
                <Button
                  onClick={handleConnect}
                  disabled={connection?.configured === false}
                  className=""
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Connect to Xero
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sync Log */}
      {connection?.is_connected && syncLogs && syncLogs.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recent Sync Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {log.status === "success" ? (
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {log.sync_type === "invoice"
                          ? "Invoice Sync"
                          : "Payment Sync"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.status === "success"
                          ? `${log.records_synced} records synced`
                          : log.error_message || "Sync failed"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
