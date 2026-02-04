import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

const mockHistory = [
  {
    id: "Q-998",
    lane: "JHB-CPT",
    price: 20800,
    marginPct: 15.2,
    status: "Accepted",
    date: "2025-08-28"
  },
  {
    id: "Q-945",
    lane: "JHB-DBN",
    price: 16200,
    marginPct: 13.8,
    status: "Accepted",
    date: "2025-08-15"
  },
  {
    id: "Q-912",
    lane: "JHB-CPT",
    price: 21500,
    marginPct: 11.9,
    status: "Expired",
    date: "2025-07-22"
  }
];

interface QuoteHistoryProps {
  customerId: string;
}

export function QuoteHistory({ customerId }: QuoteHistoryProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Accepted": return { variant: "default" as const, color: "text-success" };
      case "Expired": return { variant: "secondary" as const, color: "text-muted-foreground" };
      case "Rejected": return { variant: "destructive" as const, color: "text-destructive" };
      default: return { variant: "outline" as const, color: "text-foreground" };
    }
  };

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-caption text-muted-foreground">Quote History</CardTitle>
        <div className="text-caption text-muted-foreground">Makana Foods</div>
      </CardHeader>
      <CardContent className="space-y-3">
        {mockHistory.map((quote) => {
          const badge = getStatusBadge(quote.status);
          
          return (
            <div 
              key={quote.id} 
              className="p-3 bg-muted/10 rounded border border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-body-medium font-body-medium text-foreground">
                  {quote.id}
                </div>
                <Badge variant={badge.variant} className={badge.color}>
                  {quote.status}
                </Badge>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-caption text-muted-foreground">{quote.lane}</span>
                  <span className="text-caption font-body-medium text-foreground text-tabular">
                    {formatCurrency(quote.price)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-caption text-muted-foreground">
                    {formatPercentage(quote.marginPct / 100)} margin
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {new Date(quote.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        
        <div className="text-caption text-muted-foreground text-center mt-4">
          Showing recent 3 of 12 quotes
        </div>
      </CardContent>
    </Card>
  );
}