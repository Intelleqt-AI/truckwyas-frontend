import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { TrendingUp, MapPin, Zap } from "lucide-react";

interface RevenueDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RevenueDrilldownModal({ isOpen, onClose }: RevenueDrilldownModalProps) {
  const topCustomers = [
    { name: "ABC Logistics", revenue: 845000, trend: "+12%" },
    { name: "XYZ Transport", revenue: 623000, trend: "+8%" },
    { name: "Global Freight", revenue: 512000, trend: "-3%" },
    { name: "Premier Shipping", revenue: 445000, trend: "+15%" },
    { name: "Rapid Delivery", revenue: 425000, trend: "+6%" }
  ];

  const topRoutes = [
    { route: "JHB → DBN", revenue: 680000, trips: 145 },
    { route: "JHB → CPT", revenue: 542000, trips: 98 },
    { route: "DBN → CPT", revenue: 395000, trips: 76 },
    { route: "JHB → PLZ", revenue: 287000, trips: 112 },
    { route: "CPT → PE", revenue: 246000, trips: 54 }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-500" />
            Revenue Breakdown
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Top Customers */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-body text-muted-foreground">Top 5 Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topCustomers.map((customer, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-background/50 rounded-lg border border-border">
                    <span className="text-caption text-foreground">{customer.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-body font-body-medium text-foreground text-tabular">{formatCurrency(customer.revenue)}</span>
                      <span className={`text-caption ${customer.trend.startsWith('+') ? 'text-success-500' : 'text-danger-500'}`}>
                        {customer.trend}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Routes */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-body text-muted-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Top 5 Routes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topRoutes.map((route, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-background/50 rounded-lg border border-border">
                    <div className="flex flex-col">
                      <span className="text-caption text-foreground font-medium">{route.route}</span>
                      <span className="text-caption text-muted-foreground">{route.trips} trips</span>
                    </div>
                    <span className="text-body font-body-medium text-foreground text-tabular">{formatCurrency(route.revenue)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Hidden Opportunity */}
          <Card className="bg-brand-500/10 border-brand-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-brand-500 mt-1" />
                <div>
                  <h4 className="text-body font-body-medium text-foreground mb-1">Hidden Opportunity</h4>
                  <p className="text-caption text-muted-foreground">
                    {formatCurrency(234000)} potential from underserved routes. 
                    Expand JHB → East London and DBN → Bloemfontein lanes.
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
