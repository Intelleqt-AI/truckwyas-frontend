import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  X, 
  TrendingUp, 
  Database, 
  FileText, 
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  ExternalLink
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  title: string;
  what: string;
  why: string[];
  confidence: number;
  impactZAR: number;
}

interface DataInput {
  id: string;
  name: string;
  type: 'database' | 'file' | 'api' | 'calculation';
  value: string | number;
  lastUpdated: Date;
  source?: string;
}

interface FeatureAttribution {
  feature: string;
  importance: number;
  direction: 'positive' | 'negative';
  description: string;
}

interface LinkedDocument {
  id: string;
  title: string;
  type: 'policy' | 'contract' | 'report' | 'manual';
  url?: string;
  lastModified: Date;
}

export function EvidenceDrawer({
  isOpen,
  onClose,
  agentId,
  title,
  what,
  why,
  confidence,
  impactZAR
}: EvidenceDrawerProps) {
  // Mock data - in production this would come from props or API
  const dataInputs: DataInput[] = [
    {
      id: 'fuel-prices',
      name: 'Current Fuel Prices',
      type: 'api',
      value: 'R24.60/L',
      lastUpdated: new Date(Date.now() - 300000), // 5 mins ago
      source: 'Fleet Fuel API'
    },
    {
      id: 'route-distance',
      name: 'JHB-CT Route Distance',
      type: 'calculation',
      value: '1,398 km',
      lastUpdated: new Date(Date.now() - 3600000), // 1 hour ago
    },
    {
      id: 'load-factor',
      name: 'Average Load Factor',
      type: 'database',
      value: '78.5%',
      lastUpdated: new Date(Date.now() - 1800000), // 30 mins ago
      source: 'TMS Database'
    }
  ];

  const featureAttributions: FeatureAttribution[] = [
    {
      feature: 'Fuel consumption efficiency',
      importance: 0.34,
      direction: 'positive',
      description: 'Lower fuel consumption than industry average contributes positively to margin protection'
    },
    {
      feature: 'Route optimization score',
      importance: 0.28,
      direction: 'positive',
      description: 'Optimized routing reduces empty kilometres and improves profitability'
    },
    {
      feature: 'Market rate variance',
      importance: 0.22,
      direction: 'negative',
      description: 'Current market rates below optimal pricing threshold'
    },
    {
      feature: 'Load utilization',
      importance: 0.16,
      direction: 'positive',
      description: 'High load utilization improves revenue per kilometre'
    }
  ];

  const linkedDocuments: LinkedDocument[] = [
    {
      id: 'pricing-policy',
      title: 'Dynamic Pricing Policy v2.1',
      type: 'policy',
      url: '#',
      lastModified: new Date(Date.now() - 86400000 * 3) // 3 days ago
    },
    {
      id: 'fuel-surcharge',
      title: 'Fuel Surcharge Calculation Manual',
      type: 'manual',
      url: '#',
      lastModified: new Date(Date.now() - 86400000 * 7) // 1 week ago
    },
    {
      id: 'market-analysis',
      title: 'Q3 Route Profitability Report',
      type: 'report',
      url: '#',
      lastModified: new Date(Date.now() - 86400000 * 14) // 2 weeks ago
    }
  ];

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'text-success bg-success-light border-success/20';
    if (conf >= 0.6) return 'text-warning bg-warning-light border-warning/20';
    return 'text-danger bg-danger/10 border-danger/20';
  };

  const getDataTypeIcon = (type: DataInput['type']) => {
    switch (type) {
      case 'database':
        return <Database className="w-4 h-4" />;
      case 'file':
        return <FileText className="w-4 h-4" />;
      case 'api':
        return <BarChart3 className="w-4 h-4" />;
      case 'calculation':
        return <TrendingUp className="w-4 h-4" />;
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
    
    if (minutes < 1) return 'Just updated';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh] bg-background border border-border">
        <DrawerHeader className="border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DrawerTitle className="text-display-2 font-display-semibold text-foreground mb-2">
                Evidence Analysis
              </DrawerTitle>
              <DrawerDescription className="text-body text-muted-foreground">
                Detailed breakdown of inputs, feature importance, and supporting documentation
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="flex-shrink-0">
                <X className="w-4 h-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-6">
            {/* Agent Summary */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-heading font-body-medium text-card-foreground mb-2">
                      {title}
                    </CardTitle>
                    <p className="text-body text-card-foreground">{what}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge className={cn("text-xs", getConfidenceColor(confidence))}>
                      {(confidence * 100).toFixed(0)}% Confidence
                    </Badge>
                    {impactZAR !== 0 && (
                      <div className="text-right">
                        <div className="text-caption text-muted-foreground">Impact</div>
                        <div className="text-body-medium font-body-medium text-success">
                          {formatCurrency(Math.abs(impactZAR))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Data Inputs Used */}
            <div>
              <h3 className="text-heading font-body-medium text-foreground mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-brand-500" />
                Data Inputs Used
              </h3>
              <div className="grid gap-3">
                {dataInputs.map((input, index) => (
                  <motion.div
                    key={input.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="bg-card border-border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                              {getDataTypeIcon(input.type)}
                            </div>
                            <div>
                              <div className="text-body-medium font-body-medium text-card-foreground">
                                {input.name}
                              </div>
                              {input.source && (
                                <div className="text-caption text-muted-foreground">
                                  {input.source}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-body-medium font-body-medium text-card-foreground">
                              {input.value}
                            </div>
                            <div className="text-caption text-muted-foreground">
                              {getTimeAgo(input.lastUpdated)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Feature Attribution */}
            <div>
              <h3 className="text-heading font-body-medium text-foreground mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-brand-500" />
                Feature Importance
              </h3>
              <div className="space-y-3">
                {featureAttributions.map((attr, index) => (
                  <motion.div
                    key={attr.feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="bg-card border-border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {attr.direction === 'positive' ? (
                              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                            )}
                            <span className="text-body-medium font-body-medium text-card-foreground">
                              {attr.feature}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {(attr.importance * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        
                        <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                          <div 
                            className={cn(
                              "h-1.5 rounded-full transition-all duration-300",
                              attr.direction === 'positive' ? 'bg-success' : 'bg-warning'
                            )}
                            style={{ width: `${attr.importance * 100}%` }}
                          />
                        </div>
                        
                        <p className="text-caption text-muted-foreground">
                          {attr.description}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Evidence Points */}
            <div>
              <h3 className="text-heading font-body-medium text-foreground mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-500" />
                Evidence Points
              </h3>
              <div className="space-y-2">
                {why.map((reason, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <span className="w-6 h-6 bg-brand-100 text-brand-900 rounded-full flex items-center justify-center text-xs font-body-medium flex-shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <p className="text-body text-foreground">{reason}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Linked Documents */}
            <div>
              <h3 className="text-heading font-body-medium text-foreground mb-4 flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-brand-500" />
                Supporting Documents
              </h3>
              <div className="grid gap-3">
                {linkedDocuments.map((doc, index) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="bg-card border-border hover:shadow-glow transition-smooth cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-body-medium font-body-medium text-card-foreground">
                                {doc.title}
                              </div>
                              <div className="text-caption text-muted-foreground capitalize">
                                {doc.type} • Modified {getTimeAgo(doc.lastModified)}
                              </div>
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DrawerFooter className="border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-caption text-muted-foreground">
              Agent ID: {agentId} • Analysis generated {getTimeAgo(new Date())}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button>
                Export Analysis
              </Button>
            </div>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}