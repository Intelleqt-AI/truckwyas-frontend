import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { motion } from "framer-motion";

export type CentralQuoteCardProps = {
  quoteId: string;
  customer: string;
  lane: { origin: string; destination: string };
  slaHours: number;
  price: number;
  marginPct: number;
  guardrail: 'Within' | 'Near' | 'Below';
  expiresAt: string;
  onEdit?: () => void;
};

export function CentralQuoteCard({
  quoteId,
  customer,
  lane,
  slaHours,
  price,
  marginPct,
  guardrail,
  expiresAt
}: CentralQuoteCardProps) {
  const getGuardrailBadge = () => {
    switch (guardrail) {
      case 'Within':
        return { 
          icon: CheckCircle, 
          label: 'Within Policy', 
          variant: 'default' as const, 
          color: 'text-success' 
        };
      case 'Near':
        return { 
          icon: AlertCircle, 
          label: 'Near Floor', 
          variant: 'secondary' as const, 
          color: 'text-warning' 
        };
      case 'Below':
        return { 
          icon: AlertTriangle, 
          label: 'Below Floor', 
          variant: 'destructive' as const, 
          color: 'text-destructive' 
        };
    }
  };

  const guardrailBadge = getGuardrailBadge();
  const GuardrailIcon = guardrailBadge.icon;
  
  const expiryDate = new Date(expiresAt);
  const timeToExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60));
  const isExpiringSoon = timeToExpiry <= 24;

  return (
    <Card className="sticky top-6 bg-card border-border">
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-caption text-muted-foreground">{quoteId}</div>
            <div className="text-body-medium font-body-medium text-foreground">{customer}</div>
          </div>
          <div className="text-right">
            <div className="text-caption text-muted-foreground">Expires in</div>
            <div className={`text-body-medium font-body-medium ${isExpiringSoon ? 'text-warning' : 'text-foreground'}`}>
              {timeToExpiry}h
            </div>
          </div>
        </div>

        {/* Lane & SLA */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-body text-foreground">
              {lane.origin} → {lane.destination}
            </span>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {slaHours}h SLA
          </Badge>
          <Badge 
            variant={guardrailBadge.variant} 
            className={`flex items-center gap-1 ${guardrailBadge.color}`}
          >
            <GuardrailIcon className="w-3 h-3" />
            {guardrailBadge.label}
          </Badge>
        </div>

        {/* Price & Margin */}
        <div className="text-center py-4 space-y-2">
          <motion.div 
            key={price}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 0.3 }}
            className="text-display-h1 font-display-bold text-foreground text-tabular"
          >
            {formatCurrency(price)}
          </motion.div>
          <motion.div
            key={marginPct}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className={`text-body font-body-medium ${
              marginPct >= 15 ? 'text-success' : 
              marginPct >= 12 ? 'text-warning' : 
              'text-destructive'
            }`}
          >
            {marginPct.toFixed(1)}% margin
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}