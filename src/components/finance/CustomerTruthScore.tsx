import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function CustomerTruthScore() {
  const customers = [
    { name: "ABC Corp", trueValue: 1600000, trend: 1 },
    { name: "XYZ Ltd", trueValue: 1300000, trend: -1 }
  ];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-brand-500" />
          <CardTitle className="text-caption font-body-medium text-foreground">Customer Truth Score</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-2">
        <p className="text-xs text-muted-foreground">
          True profit after hidden costs
        </p>

        <div className="space-y-1.5">
          {customers.map((customer, i) => (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between py-1.5 px-2 bg-background/50 rounded border border-border hover:bg-muted/30 transition-smooth cursor-help">
                    <div className="flex items-center gap-1.5">
                      <span className="text-caption text-foreground">{customer.name}</span>
                      {customer.trend > 0 ? (
                        <TrendingUp className="w-3 h-3 text-success" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-destructive" />
                      )}
                    </div>
                    <span className="text-caption font-body-medium text-success text-tabular">
                      {formatCurrency(customer.trueValue)}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Includes driver, delay, and claims costs</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        <Button variant="outline" className="w-full h-7 text-xs mt-2" size="sm">
          View All
        </Button>
      </CardContent>
    </Card>
  );
}
