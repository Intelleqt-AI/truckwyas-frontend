import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CostBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CostBreakdownModal({ isOpen, onClose }: CostBreakdownModalProps) {
  const costBreakdown = [
    { category: "Fuel", amount: 1044000, percentage: 45, color: "bg-brand-500" },
    { category: "Labor", amount: 696000, percentage: 30, color: "bg-brand-300" },
    { category: "Maintenance", amount: 348000, percentage: 15, color: "bg-warning" },
    { category: "Hidden Costs", amount: 232000, percentage: 10, color: "bg-destructive" }
  ];

  const hiddenCosts = [
    { item: "Idle time fuel burn", amount: 89000 },
    { item: "Unrecovered detention charges", amount: 67000 },
    { item: "Duplicate toll charges", amount: 43000 },
    { item: "Empty return legs", amount: 33000 }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fleet Cost Breakdown</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Cost Categories */}
          <div className="space-y-3">
            {costBreakdown.map((cost, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-caption text-foreground">{cost.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-body font-body-medium text-foreground text-tabular">{formatCurrency(cost.amount)}</span>
                    <span className="text-caption text-muted-foreground w-12 text-right">{cost.percentage}%</span>
                  </div>
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${cost.color}`}
                    style={{ width: `${cost.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Hidden Costs Detail */}
          <Card className="bg-danger-500/10 border-danger-500/20">
            <CardContent className="pt-6 space-y-3">
              <h4 className="text-body font-body-medium text-foreground mb-3">Hidden Cost Breakdown</h4>
              {hiddenCosts.map((cost, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-background/50 rounded-lg border border-border">
                  <span className="text-caption text-foreground">{cost.item}</span>
                  <span className="text-body font-body-medium text-danger-500 text-tabular">{formatCurrency(cost.amount)}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-danger-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-body font-body-medium text-foreground">Total Hidden Costs</span>
                  <span className="text-body-medium font-body-medium text-danger-500 text-tabular">{formatCurrency(232000)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Recommendation */}
          <Card className="bg-success-500/10 border-success-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-success-500 mt-1" />
                <div className="flex-1">
                  <h4 className="text-body font-body-medium text-foreground mb-2">AI Recommendation</h4>
                  <p className="text-caption text-muted-foreground mb-3">
                    {formatCurrency(89000)}/month is saveable through:
                  </p>
                  <ul className="space-y-1 text-caption text-muted-foreground">
                    <li>• Route optimization to reduce idle time</li>
                    <li>• Automated toll charge auditing</li>
                    <li>• Better load matching for return legs</li>
                  </ul>
                  <Button size="sm" className="mt-4">Apply Optimization</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
