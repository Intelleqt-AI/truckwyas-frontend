import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Sparkles, 
  Timer, 
  Truck, 
  MapPin, 
  Landmark, 
  MoreVertical,
  Edit,
  Share,
  Archive,
  Fuel
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/formatters";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

interface QuoteCardProps {
  quote: Quote;
  onCardClick: (quoteId: string) => void;
  onAIClick: (e: React.MouseEvent, quoteId: string) => void;
}

export function QuoteCard({ quote, onCardClick, onAIClick }: QuoteCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: quote.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getMarginColor = (marginPct: number) => {
    if (marginPct >= 15) return "bg-success/10 text-success border-success/20";
    if (marginPct >= 12) return "bg-warning/10 text-warning border-warning/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const getExpiryColor = (expiresAt: string) => {
    const hoursLeft = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft <= 24) return "text-destructive";
    if (hoursLeft <= 48) return "text-warning";
    return "text-muted-foreground";
  };

  const formatExpiryTime = (expiresAt: string) => {
    const now = Date.now();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;
    
    if (diff <= 0) return "Expired";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const marginBadgeStyle = getMarginColor(quote.marginPct);
  const expiryColor = getExpiryColor(quote.expiresAt);

  const handleMenuAction = (action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: implement quote menu actions
  };

  // Mock assigned users for collaborative element
  const assignedUsers = [
    { id: 1, name: "Sarah Johnson", initials: "SJ", avatar: null },
    { id: 2, name: "Mike Chen", initials: "MC", avatar: null }
  ];

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`cursor-pointer transition-all ${isDragging ? 'opacity-50' : ''}`}
    >
      <Card 
        className="bg-card border-border hover:shadow-md transition-all duration-300 relative group overflow-hidden"
        onClick={() => onCardClick(quote.id)}
      >
        <CardContent className="p-4">
          {/* HEADER SECTION */}
          <div className="space-y-2">
            {/* Top Row: Quote ID + AI Button */}
            <div className="flex items-center justify-between">
              <span className="text-caption text-muted-foreground">{quote.id}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-primary hover:bg-primary/10 border border-primary/20 hover:border-primary/40"
                onClick={(e) => {
                  e.stopPropagation();
                  onAIClick(e, quote.id);
                }}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>

            {/* Customer Name - Most Prominent */}
            <h3 className="text-heading text-foreground">
              {quote.customer}
            </h3>
          </div>

          {/* Divider */}
          <div className="border-t border-border my-3"></div>

          {/* BODY SECTION */}
          <div className="space-y-2">
            {/* Lane Information */}
            <div className="text-body text-muted-foreground">
              {quote.origin} → {quote.destination}
            </div>

            {/* Financials */}
            <div className="space-y-2">
              {/* Price - Most Prominent Number */}
              <div className="text-body-medium text-foreground text-tabular">
                {formatCurrency(quote.price)}
              </div>
              
              {/* Margin Badge */}
              <Badge 
                variant="outline" 
                className={`text-xs ${marginBadgeStyle}`}
              >
                {quote.marginPct.toFixed(1)}% margin
              </Badge>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border my-3"></div>

          {/* FOOTER SECTION */}
          <div className="flex items-center justify-between">
            {/* Left: Expiry with Timer Icon */}
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className={`text-caption ${expiryColor}`}>
                {formatExpiryTime(quote.expiresAt)}
              </span>
            </div>

            {/* Right: User Avatars (Collaborative Element) */}
            <div className="flex items-center -space-x-2">
              {assignedUsers.map((user, index) => (
                <Avatar 
                  key={user.id} 
                  className="w-6 h-6 border-2 border-background hover:z-10 hover:scale-110 transition-transform cursor-pointer"
                  style={{ zIndex: assignedUsers.length - index }}
                >
                  <AvatarImage src={user.avatar || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
              ))}
              
              {/* Kebab Menu - Show on Hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 hover:bg-accent text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={(e) => handleMenuAction('edit', e)}>
                      <Edit className="w-3 h-3 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => handleMenuAction('share', e)}>
                      <Share className="w-3 h-3 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => handleMenuAction('archive', e)}>
                      <Archive className="w-3 h-3 mr-2" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Secondary Details - Revealed on Hover */}
          <div className="opacity-0 max-h-0 group-hover:opacity-100 group-hover:max-h-40 transition-all duration-300 overflow-hidden">
            <div className="pt-3 mt-3 border-t border-border space-y-2">
              <div className="text-caption text-muted-foreground uppercase tracking-wide mb-2">
                Additional Details
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-caption">
                {/* Vehicle Type */}
                <div className="flex items-center gap-2">
                  <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground truncate">
                    {quote.vehicle}
                  </span>
                </div>

                {/* Weight */}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {quote.weightTons}t
                  </span>
                </div>

                {/* Distance */}
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    {quote.distanceKm}km
                  </span>
                </div>

                {/* SLA */}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {quote.slaHours}h SLA
                  </span>
                </div>

                {/* Tolls */}
                <div className="flex items-center gap-2">
                  <Landmark className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    {formatCurrency(quote.tollsZar)}
                  </span>
                </div>

                {/* Fuel */}
                <div className="flex items-center gap-2">
                  <Fuel className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    {quote.estimatedFuelL}L
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}