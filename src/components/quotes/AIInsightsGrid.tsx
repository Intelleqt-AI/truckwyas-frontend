import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ExternalLink, TrendingUp } from "lucide-react";
import { CompactWinCurve } from "./CompactWinCurve";
import { CompactCostWaterfallChart } from "./CompactCostWaterfallChart";
import { CompactScenarioPlanner } from "./CompactScenarioPlanner";
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
}

interface AIInsights {
  recommendation: {
    scenario: string;
    uplift: number;
    reason: string;
  };
  confidence: {
    level: string;
    percentage: number;
    estimatedUplift: number;
  };
}

interface AIInsightsGridProps {
  quoteId: string;
  insights: AIInsights;
  onApply: (patch: { price?: number; marginPct?: number; planId?: 'A'|'B'|'C' }) => void;
  onOpenCanvas?: () => void;
}

export function AIInsightsGrid({ 
  quoteId, 
  insights, 
  onApply, 
  onOpenCanvas 
}: AIInsightsGridProps) {
  const [selectedScenario, setSelectedScenario] = useState("A");
  const [hoveredScenario, setHoveredScenario] = useState<string | null>(null);

  // Mock quote data for the charts - in real app this would come from props
  const quote: Quote = {
    id: quoteId,
    customer: "Makana Foods",
    origin: "JHB", 
    destination: "CPT",
    slaHours: 48,
    price: 21500,
    marginPct: 12.4,
    confidence: "High",
    status: "Draft"
  };

  return (
    <div className="space-y-5">
      {/* AI Personality Banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">AI recommends:</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-foreground">{insights.recommendation.scenario}</span>
            <Badge variant="outline" className="bg-success/5 text-success border-success/20 px-2 py-0.5">
              +{formatCurrency(insights.recommendation.uplift)}
            </Badge>
            <span className="text-muted-foreground">{insights.recommendation.reason}</span>
          </div>
        </div>
      </div>

      {/* Top Row - Two Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Top Left - Cost Waterfall */}
        <Card className="bg-card/50 border-border min-h-[200px]">
          <CardHeader className="pb-3 px-4 pt-4">
            <CardTitle className="text-sm text-muted-foreground font-medium">Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 overflow-hidden h-64">
            <CompactCostWaterfallChart quote={quote} />
          </CardContent>
        </Card>

        {/* Top Right - Win Probability */}
        <Card className="bg-card/50 border-border min-h-[200px]">
          <CardHeader className="pb-3 px-4 pt-4">
            <CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              Win Probability
              {hoveredScenario && (
                <Badge variant="outline" className="text-xs animate-pulse bg-primary/5 text-primary border-primary/20">
                  Scenario {hoveredScenario}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 overflow-hidden h-64">
            <CompactWinCurve quote={quote} selectedScenario={selectedScenario} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom - Full Width Scenario Planner */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-3 px-4 pt-4">
          <CardTitle className="text-sm text-muted-foreground font-medium">Route & Resource Optimization</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <CompactScenarioPlanner 
            quote={quote}
            selectedScenario={selectedScenario}
            onScenarioChange={setSelectedScenario}
            onScenarioHover={setHoveredScenario}
          />
          
          {/* Confidence Info - White Container */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 border border-border rounded-md p-3 bg-card"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium text-foreground">
                    Confidence: {insights.confidence.level} ({insights.confidence.percentage}%)
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Estimated uplift {formatCurrency(insights.confidence.estimatedUplift)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="gap-2" onClick={onOpenCanvas}>
                  <ExternalLink className="w-4 h-4" />
                  Open Full Canvas
                </Button>
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => onApply({
                    price: quote.price + insights.confidence.estimatedUplift,
                    marginPct: quote.marginPct + 2,
                    planId: selectedScenario as 'A'|'B'|'C'
                  })}
                >
                  Apply Decision
                </Button>
              </div>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}