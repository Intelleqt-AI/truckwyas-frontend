import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Bot, 
  Filter, 
  RefreshCw, 
  Clock,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AgentCard, AgentCardProps } from "./AgentCard";

interface AgentFeedProps {
  className?: string;
}

export function AgentFeed({ className }: AgentFeedProps) {
  const [agents, setAgents] = useState<AgentCardProps[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'high-impact'>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Mock agent data - in production this would come from an API
  const mockAgents: AgentCardProps[] = [
    {
      id: 'agent-001',
      title: 'Route Optimization Alert',
      what: 'JHB-CT route showing 15% higher fuel consumption than optimal. Recommend alternative routing via N1 coastal route.',
      impactZAR: 2840,
      confidence: 0.87,
      why: [
        'Current route averages 38.2L/100km vs optimal 33.1L/100km',
        'Traffic congestion detected on N12 increasing journey time by 2.3 hours',
        'Alternative route shows 12% fuel savings based on historical data'
      ],
      actions: [
        { id: 'adopt', label: 'Adopt Route', type: 'primary' as const },
        { id: 'review', label: 'Review', type: 'secondary' as const },
        { id: 'dismiss', label: 'Dismiss', type: 'destructive' as const }
      ],
      timestamp: new Date(Date.now() - 300000), // 5 mins ago
      status: 'active' as const
    },
    {
      id: 'agent-002',
      title: 'Pricing Optimization',
      what: 'CT-PE lane pricing 8% below market rate. Increase quote by R2,800 to match competitor pricing while maintaining 95% win probability.',
      impactZAR: 1620,
      confidence: 0.74,
      why: [
        'Market analysis shows competitors pricing 8-12% higher for similar service levels',
        'Historical win rate at +R2,800 pricing remains at 94.7%',
        'Customer payment history shows low price sensitivity on this route'
      ],
      actions: [
        { id: 'update-pricing', label: 'Update Pricing', type: 'primary' as const },
        { id: 'scenario', label: 'View Scenario', type: 'secondary' as const }
      ],
      timestamp: new Date(Date.now() - 720000), // 12 mins ago
      status: 'active' as const
    },
    {
      id: 'agent-003',
      title: 'Load Consolidation Opportunity',
      what: 'Two partial loads DBN→JHB can be consolidated into single full load, eliminating empty return journey.',
      impactZAR: 3240,
      confidence: 0.92,
      why: [
        'Load 1: 18 tonnes general freight, departure flexible ±4 hours',
        'Load 2: 14 tonnes automotive parts, compatible loading requirements',
        'Consolidation saves 1,200km empty running, reduces CO2 by 2.1 tonnes'
      ],
      actions: [
        { id: 'consolidate', label: 'Consolidate', type: 'primary' as const },
        { id: 'notify-ops', label: 'Notify Ops', type: 'secondary' as const }
      ],
      timestamp: new Date(Date.now() - 1080000), // 18 mins ago
      status: 'active' as const
    },
    {
      id: 'agent-004',
      title: 'Fuel Surcharge Update',
      what: 'Fuel prices increased 4.2% this week. Update surcharge mechanism to maintain margin protection across all active quotes.',
      impactZAR: 890,
      confidence: 0.68,
      why: [
        'Average fuel price increased from R24.60 to R24.80 per litre',
        '47 active quotes not yet adjusted for new fuel pricing',
        'Margin impact estimated at R28.90 per 1,000km without adjustment'
      ],
      actions: [
        { id: 'update-surcharge', label: 'Update Surcharge', type: 'primary' as const },
        { id: 'review-quotes', label: 'Review Quotes', type: 'secondary' as const }
      ],
      timestamp: new Date(Date.now() - 1800000), // 30 mins ago
      status: 'completed' as const
    }
  ];

  useEffect(() => {
    // Simulate loading agents
    setIsLoading(true);
    setTimeout(() => {
      setAgents(mockAgents);
      setIsLoading(false);
    }, 1000);
  }, []);

  const filteredAgents = agents.filter((agent) => {
    switch (filter) {
      case 'active':
        return agent.status === 'active';
      case 'high-impact':
        return agent.impactZAR > 2000;
      default:
        return true;
    }
  });

  const totalImpact = filteredAgents.reduce((sum, agent) => sum + agent.impactZAR, 0);
  const activeAgents = agents.filter(agent => agent.status === 'active').length;

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 800);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className={`h-full bg-card border-border ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-brand-500" />
            <CardTitle className="text-heading font-body-medium text-card-foreground">
              Agent Feed
            </CardTitle>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 px-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 mt-3">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'high-impact', label: 'High Impact' }
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={filter === key ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs font-body-regular"
              onClick={() => setFilter(key as typeof filter)}
            >
              {label}
            </Button>
          ))}
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-body-medium font-body-medium text-foreground">
              {activeAgents}
            </div>
            <div className="text-caption text-muted-foreground">Active Agents</div>
          </div>
          <div className="text-center p-3 bg-success-light/50 rounded-lg">
            <div className="text-body-medium font-body-medium text-success">
              {formatCurrency(totalImpact)}
            </div>
            <div className="text-caption text-muted-foreground">Total Impact</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1">
        <ScrollArea className="h-[calc(100vh-24rem)] px-6">
          <div className="space-y-4 pb-6">
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                // Loading skeletons
                Array.from({ length: 3 }).map((_, i) => (
                  <motion.div
                    key={`skeleton-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-32 bg-muted/50 rounded-xl animate-pulse"
                  />
                ))
              ) : filteredAgents.length > 0 ? (
                filteredAgents.map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ 
                      duration: 0.2, 
                      delay: index * 0.05,
                      ease: "easeOut" 
                    }}
                  >
                    <AgentCard {...agent} />
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-body text-muted-foreground">
                    No agents match the current filter
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setFilter('all')}
                  >
                    Show All Agents
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Load More */}
            {!isLoading && filteredAgents.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center pt-4"
              >
                <Button variant="ghost" className="text-xs text-muted-foreground">
                  Load Earlier Agents
                </Button>
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}