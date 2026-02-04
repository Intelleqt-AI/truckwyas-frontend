import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { AlertTriangle } from "lucide-react";

interface DSODrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DSODrilldownModal({ isOpen, onClose }: DSODrilldownModalProps) {
  const slowPayers = [
    { customer: "Global Freight", dso: 42.5, outstanding: 285000, status: "critical" },
    { customer: "Budget Movers", dso: 38.2, outstanding: 156000, status: "warning" },
    { customer: "Rapid Delivery", dso: 35.7, outstanding: 134000, status: "warning" },
    { customer: "XYZ Transport", dso: 28.1, outstanding: 298000, status: "ok" },
    { customer: "ABC Logistics", dso: 18.5, outstanding: 445000, status: "good" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical": return "text-danger-500";
      case "warning": return "text-warn-500";
      case "ok": return "text-foreground";
      case "good": return "text-success-500";
      default: return "text-foreground";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "critical": return "bg-danger-500/10 border-danger-500/20";
      case "warning": return "bg-warn-500/10 border-warn-500/20";
      case "ok": return "bg-background/50 border-border";
      case "good": return "bg-success-500/10 border-success-500/20";
      default: return "bg-background/50 border-border";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            DSO Analysis - Customer Payment Delays
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            {slowPayers.map((customer, i) => (
              <div key={i} className={`p-4 rounded-lg border ${getStatusBg(customer.status)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-body font-body-medium text-foreground">{customer.customer}</span>
                  <span className={`text-body-medium font-body-medium text-tabular ${getStatusColor(customer.status)}`}>
                    {customer.dso.toFixed(1)} days
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption">
                  <span className="text-muted-foreground">Outstanding balance</span>
                  <span className="text-foreground text-tabular">{formatCurrency(customer.outstanding)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Card */}
          <Card className="bg-warn-500/10 border-warn-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warn-500 mt-1" />
                <div>
                  <h4 className="text-body font-body-medium text-foreground mb-1">Action Required</h4>
                  <p className="text-caption text-muted-foreground">
                    Global Freight and Budget Movers are causing delays. 
                    Consider early-payment incentives or factoring their invoices to improve cash flow.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
