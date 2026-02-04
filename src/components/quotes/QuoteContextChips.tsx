import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, MapPin, Clock, Truck, Package, User } from "lucide-react";

interface Quote {
  customer: string;
  origin: string;
  destination: string;
  vehicleClass: string;
  weightTons: number;
  slaHours: number;
}

interface QuoteContextChipsProps {
  quote: Quote;
}

export function QuoteContextChips({ quote }: QuoteContextChipsProps) {
  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-caption text-muted-foreground">Parsed Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Building className="w-3 h-3" />
            {quote.customer}
          </Badge>
          
          <Badge variant="outline" className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {quote.origin} → {quote.destination}
          </Badge>
          
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {quote.slaHours}h SLA
          </Badge>
          
          <Badge variant="outline" className="flex items-center gap-1">
            <Truck className="w-3 h-3" />
            {quote.vehicleClass}
          </Badge>
          
          <Badge variant="outline" className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            {quote.weightTons}t
          </Badge>
        </div>
        
        <div className="text-caption text-muted-foreground">
          AI extracted {5} context elements from your input
        </div>
      </CardContent>
    </Card>
  );
}