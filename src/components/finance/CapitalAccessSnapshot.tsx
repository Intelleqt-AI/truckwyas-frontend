import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export function CapitalAccessSnapshot() {
  const availableAmount = 245000;
  const eligibleInvoices = 8;

  return (
    <Card className="bg-gradient-to-br from-brand-500/5 to-brand-300/5 border-brand-500/20">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5 text-brand-500" />
          <CardTitle className="text-caption font-body-medium text-foreground">Capital Access</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-2">
        <div className="flex items-baseline gap-1.5">
          <div className="text-body-large font-display-semibold text-brand-500 text-tabular">
            {formatCurrency(availableAmount)}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Available for same-day advance
        </p>

        <div className="flex items-center justify-between py-1.5 px-2 bg-background/50 rounded border border-border">
          <span className="text-caption text-muted-foreground">Eligible invoices</span>
          <span className="text-caption font-body-medium text-brand-500 text-tabular">
            {eligibleInvoices}
          </span>
        </div>

        <Button variant="outline" className="w-full h-7 text-xs mt-2" size="sm">
          View Invoices
        </Button>
      </CardContent>
    </Card>
  );
}
