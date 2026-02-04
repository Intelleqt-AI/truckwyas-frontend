import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { AlertTriangle } from "lucide-react";

interface MarginDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MarginDrilldownModal({ isOpen, onClose }: MarginDrilldownModalProps) {
  const customerMargins = [
    { name: "ABC Logistics", margin: 24.5, rating: "high" },
    { name: "Premier Shipping", margin: 22.1, rating: "high" },
    { name: "XYZ Transport", margin: 18.3, rating: "medium" },
    { name: "Global Freight", margin: 12.5, rating: "low" },
    { name: "Rapid Delivery", margin: 8.2, rating: "low" }
  ];

  const vehicleMargins = [
    { vehicle: "TRK-001", margin: 28.4, rating: "high" },
    { vehicle: "TRK-005", margin: 21.7, rating: "high" },
    { vehicle: "TRK-003", margin: 15.2, rating: "medium" },
    { vehicle: "TRK-004", margin: 9.8, rating: "low" },
    { vehicle: "TRK-002", margin: -2.3, rating: "critical" }
  ];

  const getMarginColor = (rating: string) => {
    switch (rating) {
      case "high": return "text-success-500";
      case "medium": return "text-warn-500";
      case "low": return "text-danger-500";
      case "critical": return "text-danger-500";
      default: return "text-foreground";
    }
  };

  const getMarginBg = (rating: string) => {
    switch (rating) {
      case "high": return "bg-success-500/10 border-success-500/20";
      case "medium": return "bg-warn-500/10 border-warn-500/20";
      case "low": return "bg-danger-500/10 border-danger-500/20";
      case "critical": return "bg-danger-500/20 border-danger-500/40";
      default: return "bg-background/50 border-border";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Margin Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Margins */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-body text-muted-foreground">Margin by Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {customerMargins.map((customer, i) => (
                  <div key={i} className={`flex items-center justify-between py-2 px-3 rounded-lg border ${getMarginBg(customer.rating)}`}>
                    <span className="text-caption text-foreground">{customer.name}</span>
                    <span className={`text-body font-body-medium text-tabular ${getMarginColor(customer.rating)}`}>
                      {customer.margin.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Margins */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-body text-muted-foreground">Margin by Vehicle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {vehicleMargins.map((vehicle, i) => (
                  <div key={i} className={`flex items-center justify-between py-2 px-3 rounded-lg border ${getMarginBg(vehicle.rating)}`}>
                    <span className="text-caption text-foreground">{vehicle.vehicle}</span>
                    <span className={`text-body font-body-medium text-tabular ${getMarginColor(vehicle.rating)}`}>
                      {vehicle.margin.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Insight */}
          <Card className="bg-warn-500/10 border-warn-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warn-500 mt-1" />
                <div>
                  <h4 className="text-body font-body-medium text-foreground mb-1">AI Insight</h4>
                  <p className="text-caption text-muted-foreground">
                    3 customers (Global Freight, Rapid Delivery, Budget Movers) are dragging margin down by 4%. 
                    Consider renegotiating rates or reducing service frequency.
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
