import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, AlertTriangle, CheckCircle, Zap, Settings } from "lucide-react";
import { QuotePerformanceChart } from "@/components/charts/QuotePerformanceChart";
import { MarginByLaneChart } from "@/components/charts/MarginByLaneChart";
import { AgentCard } from "@/components/agent/AgentCard";
import { ScenarioCanvas } from "@/components/canvas/ScenarioCanvas";
import { ChartSkeleton, KpiSkeleton } from "@/components/ui/loading-states";
import { NoQuotesEmpty } from "@/components/ui/empty-states";
import { useAgents } from "@/hooks/useAgents";
import { MODULE_HEADINGS, PAGE_DESCRIPTIONS } from "@/lib/copy";
import { formatCurrency } from "@/lib/formatters";

export default function RevenueGuard() {
  const [loading, setLoading] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const agents = useAgents('revenue');

  const kpiData = [
    {
      title: "Total Quoted",
      value: formatCurrency(1420000),
      subtitle: "This month",
      icon: TrendingUp,
      color: "text-brand-500"
    },
    {
      title: "Acceptance Rate", 
      value: "73.2%",
      subtitle: "+5.1% vs last month",
      icon: CheckCircle,
      color: "text-success"
    },
    {
      title: "Average Margin",
      value: "15.8%",
      subtitle: "Target: 16.0%",
      icon: Shield,
      color: "text-warning"
    },
    {
      title: "Price Alerts",
      value: "7",
      subtitle: "Require attention",
      icon: AlertTriangle,
      color: "text-destructive"
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-1 font-display-semibold text-foreground flex items-center gap-3">
              <Shield className="h-8 w-8 text-brand-500" />
              Revenue Guard
            </h1>
            <p className="text-body text-muted-foreground">
              {MODULE_HEADINGS.revenueGuard}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-body-medium font-body-medium text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Revenue guard
          </h1>
          <p className="text-caption text-muted-foreground">
            {MODULE_HEADINGS.revenueGuard}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-success-light text-success border-success/20">
            AI Agent Active
          </Badge>
          <Button 
            variant="outline"
            onClick={() => setShowScenarios(true)}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Compare Scenarios
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {kpiData.map((kpi, index) => (
          <Card key={index} className="bg-card border-border hover:shadow-glow transition-smooth">
            <CardHeader className="pb-3">
              <CardTitle className="text-caption text-muted-foreground">
                {kpi.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className={`text-body font-body-medium text-foreground text-tabular`}>
                {kpi.value}
              </div>
              <p className="text-caption text-muted-foreground mt-1">{kpi.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuotePerformanceChart />
        <MarginByLaneChart />
      </div>

      {/* Agent Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-caption text-muted-foreground font-body-medium">AI recommendations</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Settings className="w-4 h-4 mr-2" />
            Configure agents
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {agents.slice(0, 4).map((agent, index) => (
            <AgentCard 
              key={agent.id} 
              {...agent}
              className="animate-fade-in"
            />
          ))}
        </div>
      </div>

      {/* Scenario Canvas */}
      <ScenarioCanvas
        isOpen={showScenarios}
        onClose={() => setShowScenarios(false)}
        title="Revenue Optimization Scenarios"
        description="Compare pricing strategies and route optimizations to maximize margin"
      />
    </div>
  );
}