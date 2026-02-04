import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Zap, 
  Clock,
  DollarSign,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProfitDelta {
  amount: number;
  percentage: number;
  source: string;
  timestamp: Date;
}

interface RoiHudProps {
  className?: string;
}

export function RoiHud({ className }: RoiHudProps) {
  const [todaysCapture, setTodaysCapture] = useState(0);
  const [baseline, setBaseline] = useState(45200); // Daily baseline in ZAR
  const [recentDeltas, setRecentDeltas] = useState<ProfitDelta[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  // Mock daily target and progress
  const dailyTarget = 52000; // ZAR
  const currentTotal = baseline + todaysCapture;
  const targetProgress = (currentTotal / dailyTarget) * 100;
  const capturePercentage = (todaysCapture / baseline) * 100;

  // Mock recent profit deltas
  const mockDeltas: ProfitDelta[] = [
    {
      amount: 2840,
      percentage: 6.3,
      source: 'Route Optimization - JHB-CT',
      timestamp: new Date(Date.now() - 300000) // 5 mins ago
    },
    {
      amount: 1620,
      percentage: 3.6,
      source: 'Pricing Optimization - CT-PE',
      timestamp: new Date(Date.now() - 720000) // 12 mins ago
    },
    {
      amount: 3240,
      percentage: 7.2,
      source: 'Load Consolidation - DBN-JHB',
      timestamp: new Date(Date.now() - 1080000) // 18 mins ago
    }
  ];

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      // Random chance of new profit capture
      if (Math.random() > 0.7) {
        const newDelta: ProfitDelta = {
          amount: Math.floor(Math.random() * 2000) + 500,
          percentage: Math.random() * 5 + 1,
          source: [
            'Route Optimization',
            'Dynamic Pricing',
            'Load Planning',
            'Fuel Management',
            'Capacity Utilization'
          ][Math.floor(Math.random() * 5)],
          timestamp: new Date()
        };
        
        setRecentDeltas(prev => [newDelta, ...prev.slice(0, 4)]);
        setTodaysCapture(prev => prev + newDelta.amount);
        setIsAnimating(true);
        
        setTimeout(() => setIsAnimating(false), 1000);
      }
    }, 15000); // Check every 15 seconds

    // Initialize with mock data
    setRecentDeltas(mockDeltas);
    setTodaysCapture(mockDeltas.reduce((sum, delta) => sum + delta.amount, 0));

    return () => clearInterval(interval);
  }, []);

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
    return 'Earlier today';
  };

  return (
    <TooltipProvider>
      <Card className={cn("bg-card border-border", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-primary rounded-lg">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-heading font-body-medium text-card-foreground">
                ProfitPulse
              </CardTitle>
            </div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Real-time profit capture vs daily baseline</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Today's Capture - Main Metric */}
          <div className="text-center">
            <div className="relative">
              <motion.div
                animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5 }}
                className="text-2xl font-display-bold text-foreground mb-1"
              >
                {formatCurrency(todaysCapture)}
              </motion.div>
              
              {isAnimating && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute -top-2 -right-4"
                >
                  <Badge className="bg-success text-success-foreground text-xs animate-pulse-glow">
                    +{formatCurrency(recentDeltas[0]?.amount || 0)}
                  </Badge>
                </motion.div>
              )}
            </div>
            
            <div className="text-caption text-muted-foreground">Today's Captured Profit</div>
            
            <div className="flex items-center justify-center gap-1 mt-2">
              {capturePercentage > 0 ? (
                <TrendingUp className="w-4 h-4 text-success" />
              ) : (
                <TrendingDown className="w-4 h-4 text-destructive" />
              )}
              <span className={cn(
                "text-body-medium font-body-medium",
                capturePercentage > 0 ? "text-success" : "text-destructive"
              )}>
                +{capturePercentage.toFixed(1)}%
              </span>
              <span className="text-caption text-muted-foreground">vs baseline</span>
            </div>
          </div>

          {/* Progress to Daily Target */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-caption">
              <span className="text-muted-foreground">Daily Target Progress</span>
              <span className="font-body-medium text-foreground">
                {targetProgress.toFixed(0)}%
              </span>
            </div>
            
            <Progress 
              value={targetProgress} 
              className="h-2"
            />
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {formatCurrency(currentTotal)}
              </span>
              <span className="text-muted-foreground">
                {formatCurrency(dailyTarget)}
              </span>
            </div>
          </div>

          {/* Recent Captures */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-500" />
              <span className="text-body-medium font-body-medium text-foreground">
                Recent Captures
              </span>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {recentDeltas.slice(0, 5).map((delta, index) => (
                  <motion.div
                    key={`${delta.timestamp.getTime()}-${index}`}
                    initial={{ opacity: 0, x: 20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, x: -20, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg transition-smooth",
                      index === 0 && isAnimating ? "bg-success-light/20" : "bg-muted/30"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-caption font-body-medium text-foreground truncate">
                        {delta.source}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getTimeAgo(delta.timestamp)}
                      </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <div className="text-caption font-body-medium text-success">
                        +{formatCurrency(delta.amount)}
                      </div>
                      <div className="text-xs text-success">
                        +{delta.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            {recentDeltas.length === 0 && (
              <div className="text-center py-4">
                <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-caption text-muted-foreground">
                  Waiting for profit captures...
                </p>
              </div>
            )}
          </div>

          {/* Daily Summary Stats */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
            <div className="text-center">
              <div className="text-body-medium font-body-medium text-foreground">
                {recentDeltas.length}
              </div>
              <div className="text-xs text-muted-foreground">Optimizations</div>
            </div>
            
            <div className="text-center">
              <div className="text-body-medium font-body-medium text-foreground">
                {formatCurrency(baseline)}
              </div>
              <div className="text-xs text-muted-foreground">Baseline</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}