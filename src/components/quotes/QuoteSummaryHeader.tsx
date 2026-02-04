import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { Clock, MapPin, Truck, Package, Fuel, DollarSign } from "lucide-react";

interface QuoteSummaryHeaderProps {
  quote: {
    id: string;
    customer: string;
    lane: { origin: string; destination: string };
    slaHours: number;
    expiresAt: string;
    price: number;
    marginPct: number;
    vehicle: string;
    weightTons: number;
    distanceKm?: number;
    estimatedFuelL?: number;
    tollsZar?: number;
  };
}

export function QuoteSummaryHeader({ quote }: QuoteSummaryHeaderProps) {
  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffHours = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 0) return "Expired";
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d ${diffHours % 24}h`;
  };

  return (
    <div className="space-y-3">
      {/* Main Quote Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-foreground font-medium">{quote.id}</span>
          <span>•</span>
          <span>{quote.customer}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {quote.lane.origin} → {quote.lane.destination}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {quote.slaHours}h SLA
          </span>
          <span>•</span>
          <span>expires in {formatTimeRemaining(quote.expiresAt)}</span>
        </div>
      </div>

      {/* Price & Margin */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Price:</span>
          <span className="text-lg font-medium text-foreground">{formatCurrency(quote.price)}</span>
        </div>
        <Badge variant="outline" className="bg-success/5 text-success border-success/20">
          {quote.marginPct.toFixed(1)}% margin
        </Badge>
      </div>

      {/* Detail Chips */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="flex items-center gap-1 text-xs">
          <Truck className="w-3 h-3" />
          {quote.vehicle}
        </Badge>
        
        <Badge variant="outline" className="flex items-center gap-1 text-xs">
          <Package className="w-3 h-3" />
          {quote.weightTons}t
        </Badge>
        
        {quote.distanceKm && (
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <MapPin className="w-3 h-3" />
            {quote.distanceKm}km
          </Badge>
        )}
        
        {quote.tollsZar && (
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <DollarSign className="w-3 h-3" />
            Tolls {formatCurrency(quote.tollsZar)}
          </Badge>
        )}
        
        {quote.estimatedFuelL && (
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <Fuel className="w-3 h-3" />
            Est. {quote.estimatedFuelL}L
          </Badge>
        )}
      </div>
    </div>
  );
}