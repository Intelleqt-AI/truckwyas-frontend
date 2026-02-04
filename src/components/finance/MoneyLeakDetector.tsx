import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export function MoneyLeakDetector() {
  const leaks = [
    { type: "Late payments", dailyLoss: 890 },
    { type: "Empty runs", dailyLoss: 780 },
    { type: "Fuel waste", dailyLoss: 630 }
  ];

  const totalDailyLoss = leaks.reduce((sum, leak) => sum + leak.dailyLoss, 0);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
          <CardTitle className="text-caption font-body-medium text-foreground">Margin Leak Analysis</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-2">
        <div className="flex items-baseline gap-1.5">
          <div className="text-body-large font-display-semibold text-destructive text-tabular">
            {formatCurrency(totalDailyLoss)}
          </div>
          <span className="text-caption text-muted-foreground">/day</span>
        </div>

        <div className="space-y-1">
          {leaks.map((leak, i) => (
            <div key={i} className="flex items-center justify-between text-caption">
              <span className="text-muted-foreground">{leak.type}</span>
              <span className="text-destructive text-tabular font-body-medium">
                {formatCurrency(leak.dailyLoss)}
              </span>
            </div>
          ))}
        </div>

        <Button variant="outline" className="w-full h-7 text-xs mt-2" size="sm">
          Review
        </Button>
      </CardContent>
    </Card>
  );
}
