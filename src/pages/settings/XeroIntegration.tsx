import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import useFetch from "@/hooks/useFetch";
import { usePost } from "@/hooks/usePost";
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

  // Connect to Xero
  const { mutate: connectXero } = usePost({
    onSuccess: (data: any) => {
      if (data.auth_url) {
        // Open OAuth flow in new window
        window.open(data.auth_url, "_blank", "width=600,height=700");
        toast.info("Please complete the Xero authorization in the new window");
      }
    },
    onError: () => {
      toast.error("Failed to initiate Xero connection");
    },
  });

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

  const handleConnect = () => {
    connectXero({ url: "/api/integrations/xero/connect/", data: {} });
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
        <div className="text-[#64748B]">Loading Xero integration status...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">
          Xero Integration
        </h2>
        <p className="text-sm text-[#64748B] mt-1">
          Connect your Xero account to automatically sync invoices and payments
        </p>
      </div>

      {/* Connection Status Card */}
      <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Connection Status</CardTitle>
            {connection?.is_connected ? (
              <Badge className="bg-[#10B981] text-white hover:bg-[#10B981]">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-[#E2E8F0] text-[#64748B]"
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
                  <Building2 className="w-4 h-4 text-[#64748B]" />
                  <span className="text-[#64748B]">Organization:</span>
                  <span className="font-medium text-[#0F172A]">
                    {connection.tenant_name || "Unknown"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-[#64748B]" />
                  <span className="text-[#64748B]">Connected since:</span>
                  <span className="font-medium text-[#0F172A]">
                    {formatDate(connection.connected_since)}
                  </span>
                </div>
              </div>

              {/* Sync Controls */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-[#0F172A] mb-4">
                  Sync Data
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Invoice Sync */}
                  <div className="space-y-2">
                    <Button
                      onClick={handleSyncInvoices}
                      disabled={isSyncing === "invoices"}
                      className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]"
                    >
                      <RefreshCw
                        className={`w-4 h-4 mr-2 ${
                          isSyncing === "invoices" ? "animate-spin" : ""
                        }`}
                      />
                      Sync Invoices
                    </Button>
                    <p className="text-xs text-[#64748B]">
                      Last synced: {formatDate(connection.last_invoice_sync)}
                    </p>
                  </div>

                  {/* Payment Sync */}
                  <div className="space-y-2">
                    <Button
                      onClick={handleSyncPayments}
                      disabled={isSyncing === "payments"}
                      className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]"
                    >
                      <RefreshCw
                        className={`w-4 h-4 mr-2 ${
                          isSyncing === "payments" ? "animate-spin" : ""
                        }`}
                      />
                      Sync Payments
                    </Button>
                    <p className="text-xs text-[#64748B]">
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
                  className="bg-[#EF4444] hover:bg-[#DC2626]"
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
                <div className="w-16 h-16 rounded-full bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-[#2563EB]" />
                </div>
                <h3 className="text-lg font-medium text-[#0F172A] mb-2">
                  Connect to Xero
                </h3>
                <p className="text-sm text-[#64748B] mb-6 max-w-md mx-auto">
                  Link your Xero account to automatically sync invoices and
                  payments between TruckWys and Xero.
                </p>
                <Button
                  onClick={handleConnect}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8]"
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
        <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
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
                      <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                    ) : (
                      <XCircle className="w-5 h-5 text-[#EF4444]" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">
                        {log.sync_type === "invoice"
                          ? "Invoice Sync"
                          : "Payment Sync"}
                      </p>
                      <p className="text-xs text-[#64748B]">
                        {log.status === "success"
                          ? `${log.records_synced} records synced`
                          : log.error_message || "Sync failed"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-[#64748B]">
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
