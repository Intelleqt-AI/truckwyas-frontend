import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MapPin, 
  Clock, 
  Truck, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Quote {
  id: string;
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

interface QuoteDetailsRowProps {
  quote: Quote;
  isExpanded: boolean;
  onToggle: () => void;
  onSave: (updatedQuote: Quote) => void;
}

export function QuoteDetailsRow({ 
  quote, 
  isExpanded, 
  onToggle, 
  onSave 
}: QuoteDetailsRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuote, setEditedQuote] = useState<Quote>(quote);

  const handleSave = () => {
    onSave(editedQuote);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedQuote(quote);
    setIsEditing(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Draft": return { variant: "subtle" as const, className: "bg-muted/50 text-muted-foreground border-0" };
      case "Sent": return { variant: "outline" as const, className: "bg-brand-500/5 text-brand-500 border-brand-500/20" };
      case "Accepted": return { variant: "outline" as const, className: "bg-success-500/5 text-success-500 border-success-500/20" };
      case "Expired": return { variant: "outline" as const, className: "bg-danger-500/5 text-danger-500 border-danger-500/20" };
      default: return { variant: "subtle" as const, className: "bg-muted/50 text-muted-foreground border-0" };
    }
  };

  const statusBadge = getStatusBadge(editedQuote.status);
  const expiryDate = new Date(editedQuote.expiresAt);
  const timeToExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60));

  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.tr
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <td colSpan={10} className="p-0 border-0">
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <Card className="m-4 bg-card border-border shadow-lg z-50">
                <CardContent className="p-6">
                  {/* Header with Edit Toggle */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-foreground">{editedQuote.id} Details</h3>
                      <Badge variant={statusBadge.variant} className={statusBadge.className}>
                        {editedQuote.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggle}
                        className="gap-2"
                      >
                        <ChevronUp className="w-4 h-4" />
                        Close
                      </Button>
                      {!isEditing ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setIsEditing(true)}
                          className="gap-2"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleCancel}
                            className="gap-2"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={handleSave}
                            className="gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Save
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Customer & Route */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Customer & Route</h4>
                      
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Customer</Label>
                          {isEditing ? (
                            <Input
                              value={editedQuote.customer}
                              onChange={(e) => setEditedQuote({...editedQuote, customer: e.target.value})}
                              className="bg-background"
                            />
                          ) : (
                            <p className="text-foreground font-medium">{editedQuote.customer}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              Origin
                            </Label>
                            {isEditing ? (
                              <Input
                                value={editedQuote.origin}
                                onChange={(e) => setEditedQuote({...editedQuote, origin: e.target.value})}
                                className="bg-background"
                              />
                            ) : (
                              <p className="text-foreground">{editedQuote.origin}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              Destination
                            </Label>
                            {isEditing ? (
                              <Input
                                value={editedQuote.destination}
                                onChange={(e) => setEditedQuote({...editedQuote, destination: e.target.value})}
                                className="bg-background"
                              />
                            ) : (
                              <p className="text-foreground">{editedQuote.destination}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              SLA Hours
                            </Label>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editedQuote.slaHours}
                                onChange={(e) => setEditedQuote({...editedQuote, slaHours: Number(e.target.value)})}
                                className="bg-background"
                              />
                            ) : (
                              <p className="text-foreground">{editedQuote.slaHours}h</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Expires
                            </Label>
                            <p className={`text-sm ${timeToExpiry <= 24 ? 'text-danger-500' : 'text-muted-foreground'}`}>
                              {timeToExpiry > 0 ? `in ${timeToExpiry}h` : 'Expired'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Pricing</h4>
                      
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            Quote Price
                          </Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editedQuote.price}
                              onChange={(e) => setEditedQuote({...editedQuote, price: Number(e.target.value)})}
                              className="bg-background"
                            />
                          ) : (
                            <p className="text-foreground text-xl font-bold">{formatCurrency(editedQuote.price)}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Margin %
                          </Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.1"
                              value={editedQuote.marginPct}
                              onChange={(e) => setEditedQuote({...editedQuote, marginPct: Number(e.target.value)})}
                              className="bg-background"
                            />
                          ) : (
                            <p className={`text-xl font-bold ${
                              editedQuote.marginPct >= 15 ? 'text-success-500' : 
                              editedQuote.marginPct >= 12 ? 'text-warn-500' : 
                              'text-danger-500'
                            }`}>
                              {editedQuote.marginPct.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Vehicle & Load */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Vehicle & Load</h4>
                      
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            Vehicle Type
                          </Label>
                          {isEditing ? (
                            <Select value={editedQuote.vehicle} onValueChange={(value) => setEditedQuote({...editedQuote, vehicle: value})}>
                              <SelectTrigger className="bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-border shadow-lg z-[60]">
                                <SelectItem value="Curtain Side 34t">Curtain Side 34t</SelectItem>
                                <SelectItem value="Rigid Truck 8t">Rigid Truck 8t</SelectItem>
                                <SelectItem value="Articulated 56t">Articulated 56t</SelectItem>
                                <SelectItem value="Interlink 68t">Interlink 68t</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-foreground">{editedQuote.vehicle}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Weight (tons)</Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editedQuote.weightTons}
                              onChange={(e) => setEditedQuote({...editedQuote, weightTons: Number(e.target.value)})}
                              className="bg-background"
                            />
                          ) : (
                            <p className="text-foreground">{editedQuote.weightTons}t</p>
                          )}
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <Label className="text-xs text-muted-foreground">Distance</Label>
                            <p className="text-foreground font-medium">{editedQuote.distanceKm}km</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Est. Fuel</Label>
                            <p className="text-foreground font-medium">{editedQuote.estimatedFuelL}L</p>
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs text-muted-foreground">Tolls</Label>
                            <p className="text-foreground font-medium">{formatCurrency(editedQuote.tollsZar)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </td>
        </motion.tr>
      )}
    </AnimatePresence>
  );
}