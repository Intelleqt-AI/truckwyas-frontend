import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  TrendingUp, 
  Eye, 
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EvidenceDrawer } from "./EvidenceDrawer";

export interface AgentCardProps {
  id: string;
  title: string;
  what: string;
  impactZAR: number;
  confidence: number;
  why: string[];
  actions: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary' | 'destructive';
    onClick?: () => void;
  }>;
  timestamp?: Date;
  status?: 'active' | 'completed' | 'dismissed' | 'pending';
  className?: string;
}

export function AgentCard({ 
  id,
  title, 
  what, 
  impactZAR, 
  confidence, 
  why, 
  actions,
  timestamp = new Date(),
  status = 'active',
  className 
}: AgentCardProps) {
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'text-muted-foreground bg-muted/20';
    if (conf >= 0.6) return 'text-muted-foreground bg-muted/20';
    return 'text-muted-foreground bg-muted/20';
  };
  
  const getConfidenceLabel = (conf: number) => {
    if (conf >= 0.8) return 'High';
    if (conf >= 0.6) return 'Medium';
    return 'Low';
  };
  
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-muted-foreground" />;
      case 'dismissed':
        return <XCircle className="w-4 h-4 text-muted-foreground" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn("group", className)}
      >
        <Card 
          className={cn(
            "border border-border bg-card hover:shadow-glow transition-smooth hover-lift-strong",
            "cursor-pointer group-hover:transform group-hover:-translate-y-0.5",
            status === 'dismissed' && "opacity-60",
            status === 'completed' && "border-success/20 bg-success-light/5"
          )}
          onClick={() => setIsEvidenceOpen(true)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                {getStatusIcon()}
                <h3 className="text-heading font-body-medium text-card-foreground line-clamp-2">
                  {title}
                </h3>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge 
                  variant="outline"
                  className={cn(
                    "text-xs font-body-regular",
                    getConfidenceColor(confidence)
                  )}
                >
                  {getConfidenceLabel(confidence)} ({(confidence * 100).toFixed(0)}%)
                </Badge>
                
                {impactZAR !== 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    <TrendingUp className="w-3 h-3 text-muted-foreground" />
                    <span className="font-body-medium text-foreground">
                      {formatCurrency(Math.abs(impactZAR))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            {/* What - Agent's finding/recommendation */}
            <p className="text-body text-card-foreground mb-4 line-clamp-3">
              {what}
            </p>
            
            {/* Why - Key evidence points */}
            {why.length > 0 && (
              <div className="mb-4">
                <div className="text-caption text-muted-foreground mb-2">Evidence:</div>
                <ul className="space-y-1">
                  {why.slice(0, 2).map((reason, index) => (
                    <li key={index} className="text-caption text-card-foreground flex items-start gap-2">
                      <span className="w-1 h-1 bg-brand-300 rounded-full mt-2 flex-shrink-0" />
                      <span className="line-clamp-2">{reason}</span>
                    </li>
                  ))}
                  {why.length > 2 && (
                    <li className="text-caption text-muted-foreground">
                      +{why.length - 2} more evidence points
                    </li>
                  )}
                </ul>
              </div>
            )}
            
            {/* Actions and Meta */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {actions.slice(0, 2).map((action) => (
                  <Button
                    key={action.id}
                    variant={action.type === 'primary' ? 'default' : action.type === 'destructive' ? 'destructive' : 'outline'}
                    size="sm"
                    className="text-xs font-body-regular h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick?.();
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
                
                {actions.length > 2 && (
                  <span className="text-xs text-muted-foreground">
                    +{actions.length - 2} more
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-body-regular">{getTimeAgo(timestamp)}</span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEvidenceOpen(true);
                  }}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  <span className="hidden group-hover:inline">View evidence</span>
                </Button>
                
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-smooth" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      
      <EvidenceDrawer
        isOpen={isEvidenceOpen}
        onClose={() => setIsEvidenceOpen(false)}
        agentId={id}
        title={title}
        what={what}
        why={why}
        confidence={confidence}
        impactZAR={impactZAR}
      />
    </>
  );
}