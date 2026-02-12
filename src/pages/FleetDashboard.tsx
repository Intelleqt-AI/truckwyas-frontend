import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, MapPin, Clock, AlertTriangle, Truck, Settings, Zap, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import { FleetUtilizationChart } from "@/components/charts/FleetUtilizationChart";
import { EmptyKmTrendChart } from "@/components/charts/EmptyKmTrendChart";
import { FleetTable } from "@/components/tables/FleetTable";
import { AgentCard } from "@/components/agent/AgentCard";
import { ScenarioCanvas } from "@/components/canvas/ScenarioCanvas";
import { MapUnavailableEmpty } from "@/components/ui/empty-states";
import { ChartSkeleton, KpiSkeleton } from "@/components/ui/loading-states";
import { useAgents } from "@/hooks/useAgents";
import { MODULE_HEADINGS } from "@/lib/copy";
import { ProfitVsDragQuadrant } from "@/components/charts/ProfitVsDragQuadrant";
import { FleetSummaryCard } from "@/components/fleet/FleetSummaryCard";
import quadrantData from "@/mocks/fleet-quadrant-data.json";
import useFetch from "@/hooks/useFetch";

export default function FleetDashboard() {
  const [loading, setLoading] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const [sortBy, setSortBy] = useState<'impact' | 'confidence' | 'date'>('impact');
  const [quadrantView, setQuadrantView] = useState<'vehicles' | 'drivers'>('vehicles');
  const agents = useAgents('control');

  const { data: fleetData, isLoading: fleetLoading } = useFetch("api/fleet/overview");
  const { data: fleetInsights, isLoading: fleetInsightsLoading } = useFetch("api/fleet/insights/");
  const { data: fleetIntelligence, isLoading: fleetIntelligenceLoading } = useFetch("api/fleet/intelligence/");

  // Fleet Summary sparkline data (7-day trends)
  const summaryData = [
    {
      title: "Fleet Profitability",
      value: "R 450 000",
      subtitle: "Net after fuel + maintenance",
      trend: 4.3,
      sparklineData: [420000, 435000, 428000, 445000, 438000, 452000, 450000],
      isPercentage: true
    },
    {
      title: "Fleet Utilisation",
      value: "91.8%",
      subtitle: "Active vs idle vehicles",
      trend: 2.1,
      sparklineData: [88.5, 89.2, 90.1, 89.8, 91.2, 90.9, 91.8],
      isPercentage: true
    },
    {
      title: "Empty KM Rate",
      value: "18.3%",
      subtitle: "Compared to last 30 days",
      trend: -2.1,
      sparklineData: [22.1, 21.5, 20.8, 19.9, 19.2, 18.7, 18.3],
      isPercentage: true
    },
    {
      title: "Avg Margin per Vehicle",
      value: "R 18 250",
      subtitle: "Weighted by trip mix",
      trend: 4.2,
      sparklineData: [17200, 17500, 17800, 18000, 18100, 18200, 18250],
      isPercentage: true
    }
  ];

  const kpiData = [
    {
      title: "Active Vehicles",
      value: "156",
      subtitle: "91% of fleet",
      icon: Truck,
      color: "text-brand-500"
    },
    {
      title: "On-Time Performance",
      value: "94.2%",
      subtitle: "Target: 95.0%",
      icon: Clock,
      color: "text-success"
    },
    {
      title: "Empty Kilometers",
      value: "18.3%",
      subtitle: "-2.1% vs last month",
      icon: MapPin,
      color: "text-warning"
    },
    {
      title: "Avg. Margin per Vehicle",
      value: "R 18,250",
      subtitle: "+4.2% vs last month",
      icon: Zap,
      color: "text-success"
    }
  ];

  const aiInsights = [
    {
      id: 1,
      title: "Fleet Utilisation Gap",
      description: "TRK-007 idle for 23 hours. Load match found on CPT-JHB route.",
      impact: "+R 5,400",
      impactLabel: "Revenue opportunity",
      confidence: 92,
      action: "Accept Load",
      category: "utilisation"
    },
    {
      id: 2,
      title: "Border Delay Prediction",
      description: "Beitbridge predicted 4.5h delay. Reroute via Lebombo saves 3.2 hours.",
      impact: "R 2,800",
      impactLabel: "Fuel & time savings",
      confidence: 87,
      action: "Reroute Now",
      category: "routing"
    },
    {
      id: 3,
      title: "Maintenance Optimisation",
      description: "TRK-012 service due Friday. Delaying 48h enables 2 additional trips.",
      impact: "+R 5,200",
      impactLabel: "Revenue gain",
      confidence: 94,
      action: "Reschedule",
      category: "maintenance"
    },
    {
      id: 4,
      title: "Fuel Efficiency Alert",
      description: "TRK-045 consuming 12% above fleet average. Driver coaching recommended.",
      impact: "R 1,250",
      impactLabel: "Monthly savings",
      confidence: 89,
      action: "Schedule Coaching",
      category: "fuel"
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-1 font-display-semibold text-foreground flex items-center gap-3">
              <Radio className="h-8 w-8 text-brand-500" />
              Dashboard
            </h1>
            <p className="text-body text-muted-foreground">
              {MODULE_HEADINGS.controlTower}
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-1 font-display-semibold text-foreground">
            Fleet Overview
          </h1>
          <p className="text-body text-muted-foreground mt-0.5">
            {MODULE_HEADINGS.controlTower}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-success-light text-success border-success/20">
            247 Active Loads
          </Badge>
          <Button
            variant="outline"
            onClick={() => setShowScenarios(true)}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Route Scenarios
          </Button>
        </div>
      </div>

      {/* AI Summary Sentence */}
      <Card className="bg-gradient-to-r from-brand-500/5 to-brand-300/5 border-brand-500/20">
        <CardContent className="p-3">
          <p className="text-body text-foreground">
            <span className="font-body-medium">{fleetData?.banner?.message || "Loading fleet insights..."}</span>
          </p>
        </CardContent>
      </Card>

      {/* Fleet Summary Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {fleetData?.kpi_cards?.map((card: any, index: number) => (
          <FleetSummaryCard
            key={index}
            title={card.title}
            value={card.value}
            subtitle={card.comparison?.label || card.detail || card.trend?.label}
            trend={card.trend?.value || 0}
            // Mock sparkline data as it's not in the API response yet
            sparklineData={[10, 12, 11, 13, 12, 14, 13]}
            isPercentage={card.id === "fleet_cost_per_km" || card.id === "ai_health_score" ? false : true}
          />
        ))}
      </div>

      {/* AI Profit Intelligence */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-body-large font-body-medium text-foreground">AI Profit Intelligence</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-caption text-muted-foreground">Sort by</span>
              <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
                <Button
                  variant={sortBy === 'impact' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSortBy('impact')}
                  className="h-7 px-3 text-xs"
                >
                  Impact
                </Button>
                <Button
                  variant={sortBy === 'confidence' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSortBy('confidence')}
                  className="h-7 px-3 text-xs"
                >
                  Confidence
                </Button>
                <Button
                  variant={sortBy === 'date' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSortBy('date')}
                  className="h-7 px-3 text-xs"
                >
                  Date
                </Button>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-8">
              <Settings className="w-4 h-4 mr-1.5" />
              <span className="text-xs">Configure</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {aiInsights.map((insight, index) => (
            <Card
              key={insight.id}
              className="bg-card border-border hover-lift transition-smooth p-3"
            >
              <div className="space-y-2">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="text-sm font-body-medium text-foreground mb-0.5">
                      {insight.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {insight.description}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[10px] px-1.5 py-0.5 bg-brand-500/10 text-brand-500 border-brand-500/20"
                  >
                    {insight.confidence}%
                  </Badge>
                </div>

                {/* Impact Row */}
                <div className="flex items-center justify-between py-1.5 px-2 rounded bg-success/5 border border-success/10">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-body-medium text-success text-tabular">
                      {insight.impact}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {insight.impactLabel}
                    </span>
                  </div>
                  <Zap className="w-3.5 h-3.5 text-success" />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    className="flex-1 bg-brand-500 hover:bg-brand-700 text-white h-7 text-xs"
                  >
                    {insight.action}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="px-3 h-7 text-xs"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Profit vs. Drag Quadrant */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-body-large font-body-medium text-foreground">Profit vs Drag Quadrant</h2>
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1">
            <Button
              variant={quadrantView === 'vehicles' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setQuadrantView('vehicles')}
              className="h-8 px-3 text-xs"
            >
              <Truck className="w-3.5 h-3.5 mr-1.5" />
              Vehicles
            </Button>
            <Button
              variant={quadrantView === 'drivers' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setQuadrantView('drivers')}
              className="h-8 px-3 text-xs"
            >
              Drivers
            </Button>
          </div>
        </div>

        <ProfitVsDragQuadrant
          data={quadrantData.vehicleData}
          avgRevenue={quadrantData.avgRevenue}
          avgMargin={quadrantData.avgMargin}
          viewType={quadrantView}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FleetUtilizationChart />
        <EmptyKmTrendChart />
      </div>

      {/* Fleet Table */}
      <FleetTable />

      {/* Scenario Canvas */}
      <ScenarioCanvas
        isOpen={showScenarios}
        onClose={() => setShowScenarios(false)}
        title="Route Optimization Scenarios"
        description="Compare route alternatives and fleet deployment strategies"
      />
    </div>
  );
}