import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Edit,
  Send,
  Share,
  X,
  MapPin,
  Truck,
  Clock,
  TrendingUp,
  Calendar,
  Fuel
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";

interface Quote {
  id: string;
  originalId: number;
  customer: string;
  origin: string;
  destination: string;
  slaHours: number;
  price: number;
  marginPct: number;
  confidence: string;
  status: string;
  updatedAt: string;
  expiresAt: string;
  vehicle: string;
  weightTons: number;
  distanceKm: number;
  estimatedFuelL: number;
  tollsZar: number;
}

interface QuoteDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote;
  onSave: (updatedQuote: Quote) => void;
}

// Detail Item Component for consistent styling
function DetailItem({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="space-y-2">
      <div className="text-caption text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        <span className="text-body-medium text-foreground">{value}</span>
      </div>
    </div>
  );
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Draft": return { variant: "subtle" as const, className: "bg-muted/50 text-muted-foreground border-0" };
    case "Sent": return { variant: "outline" as const, className: "bg-primary/5 text-primary border-primary/20" };
    case "Accepted": return { variant: "outline" as const, className: "bg-success/5 text-success border-success/20" };
    case "Expired": return { variant: "outline" as const, className: "bg-destructive/5 text-destructive border-destructive/20" };
    default: return { variant: "subtle" as const, className: "bg-muted/50 text-muted-foreground border-0" };
  }
};

const getMarginColor = (marginPct: number) => {
  if (marginPct >= 15) return "text-success";
  if (marginPct >= 12) return "text-warning";
  return "text-destructive";
};

export function QuoteDetailsModal({ isOpen, onClose, quote, onSave }: QuoteDetailsModalProps) {
  const statusBadge = getStatusBadge(quote.status);
  const marginColor = getMarginColor(quote.marginPct);

  const navigate = useNavigate();

  const handleShare = () => {
    console.log('Share quote:', quote.id);
  };

  const handleSend = () => {
    console.log('Send quote:', quote.id);
  };

  const handleEdit = () => {
    console.log('Edit quote:', quote?.originalId);
    navigate(`/bookings/pipeline/${quote?.originalId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-8">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between pb-6">
          {/* Left Side - Identifier */}
          <div className="flex items-center gap-3">
            <h2 className="text-display-2 text-foreground">Quote {quote.id}</h2>
            <Badge variant={statusBadge.variant} className={statusBadge.className}>
              {quote.status}
            </Badge>
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
              <Share className="w-4 h-4" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={handleSend} className="gap-2">
              <Send className="w-4 h-4" />
              Send
            </Button>
            <Button variant="default" size="sm" onClick={handleEdit} className="gap-2" >
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* KEY METRICS SECTION */}
          <div className="grid grid-cols-2 gap-8">
            {/* Left Column - The Price */}
            <div className="space-y-2">
              <div className="text-caption text-muted-foreground uppercase tracking-wide">QUOTE PRICE</div>
              <div className="text-display-1 text-foreground text-tabular">
                {formatCurrency(quote.price)}
              </div>
            </div>

            {/* Right Column - The Margin */}
            <div className="space-y-2">
              <div className="text-caption text-muted-foreground uppercase tracking-wide">MARGIN</div>
              <div className="flex items-center gap-2">
                <div className={`text-display-2 text-tabular ${marginColor}`}>
                  {quote.marginPct.toFixed(1)}%
                </div>
                <TrendingUp className={`w-5 h-5 ${marginColor}`} />
              </div>
            </div>
          </div>

          {/* Divider */}
          <hr className="border-border" />

          {/* DETAILS GRID */}
          <div className="grid grid-cols-3 gap-x-8 gap-y-6">
            {/* Column 1: Customer & Route */}
            <div className="space-y-4">
              <DetailItem label="CUSTOMER" value={quote.customer} />
              <DetailItem label="ORIGIN" value={quote.origin} icon={MapPin} />
              <DetailItem label="DESTINATION" value={quote.destination} icon={MapPin} />
              <DetailItem label="SLA HOURS" value={`${quote.slaHours}h`} icon={Clock} />
            </div>

            {/* Column 2: Vehicle & Logistics */}
            <div className="space-y-4">
              <DetailItem label="VEHICLE TYPE" value={quote.vehicle} icon={Truck} />
              <DetailItem label="WEIGHT" value={`${quote.weightTons}t`} />
              <DetailItem label="DISTANCE" value={`${quote.distanceKm}km`} />
            </div>

            {/* Column 3: Timeline */}
            <div className="space-y-4">
              <DetailItem
                label="LAST UPDATED"
                value={new Date(quote.updatedAt).toLocaleDateString('en-ZA', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
                icon={Calendar}
              />
              <DetailItem
                label="EXPIRES AT"
                value={`${new Date(quote.expiresAt).toLocaleDateString('en-ZA', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })} at ${new Date(quote.expiresAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}`}
                icon={Calendar}
              />
            </div>
          </div>

          {/* COST BREAKDOWN SECTION */}
          <div className="space-y-4">
            <h3 className="text-body-large text-foreground">Cost Estimates</h3>
            <div className="grid grid-cols-2 gap-8">
              <DetailItem label="TOLLS" value={formatCurrency(quote.tollsZar)} />
              <DetailItem label="EST. FUEL" value={`${quote.estimatedFuelL}L`} icon={Fuel} />
            </div>
          </div>

          {/* Accept & Create Booking */}
          {quote.status === "Sent" && (
            <div className="pt-6 border-t border-border">
              <Button className="w-full gap-2" size="lg">
                <TrendingUp className="w-4 h-4" />
                Accept & Create Booking
              </Button>
            </div>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}