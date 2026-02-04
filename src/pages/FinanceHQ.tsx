import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, DollarSign, TrendingDown, AlertCircle, Zap, TrendingUp, ChevronDown, Sparkles, Clock } from "lucide-react";
import { CashCalendarChart } from "@/components/charts/CashCalendarChart";
import { ScenarioCanvas } from "@/components/canvas/ScenarioCanvas";
import { ChartSkeleton, KpiSkeleton } from "@/components/ui/loading-states";
import { MODULE_HEADINGS } from "@/lib/copy";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import { RevenueDrilldownModal } from "@/components/finance/RevenueDrilldownModal";
import { MarginDrilldownModal } from "@/components/finance/MarginDrilldownModal";
import { CostBreakdownModal } from "@/components/finance/CostBreakdownModal";
import { DSODrilldownModal } from "@/components/finance/DSODrilldownModal";
import { MoneyLeakDetector } from "@/components/finance/MoneyLeakDetector";
import { CustomerTruthScore } from "@/components/finance/CustomerTruthScore";
import { WhatIfSimulator } from "@/components/finance/WhatIfSimulator";
import { AIAssistantButton } from "@/components/finance/AIAssistantButton";
import { FinanceSummaryCard } from "@/components/finance/FinanceSummaryCard";
import { CashflowHeatmap } from "@/components/finance/CashflowHeatmap";
import { CapitalAccessSnapshot } from "@/components/finance/CapitalAccessSnapshot";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function FinanceHQ() {
  const [loading, setLoading] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const [showRevenueDrill, setShowRevenueDrill] = useState(false);
  const [showMarginDrill, setShowMarginDrill] = useState(false);
  const [showCostDrill, setShowCostDrill] = useState(false);
  const [showDSODrill, setShowDSODrill] = useState(false);
  const [selectedAgingPeriod, setSelectedAgingPeriod] = useState<string | null>(null);

  const summaryCards = [
    {
      title: "Total Revenue (MTD)",
      value: formatCurrency(2850000),
      subtitle: "+8.2% vs last month",
      trend: { value: 8.2, isPositive: true },
      sparklineData: [2.1, 2.3, 2.4, 2.6, 2.8, 2.85],
      icon: DollarSign,
      onClick: () => setShowRevenueDrill(true)
    },
    {
      title: "Net Margin %",
      value: "18.7%",
      subtitle: "Target: 20.0%",
      trend: { value: 1.3, isPositive: false },
      sparklineData: [20.1, 19.8, 19.5, 19.2, 18.9, 18.7],
      icon: TrendingUp,
      onClick: () => setShowMarginDrill(true)
    },
    {
      title: "Total Fleet Cost",
      value: formatCurrency(2320000),
      subtitle: "Fuel, tolls, maintenance",
      trend: { value: 2.1, isPositive: false },
      sparklineData: [2.1, 2.15, 2.2, 2.25, 2.3, 2.32],
      icon: AlertCircle,
      onClick: () => setShowCostDrill(true)
    },
    {
      title: "Cashflow Forecast (30d)",
      value: formatCurrency(3120000),
      subtitle: "Projected closing balance",
      sparklineData: [2.8, 2.9, 3.0, 3.05, 3.1, 3.12],
      icon: Building2
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
          <h1 className="text-body-medium font-body-medium text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Finance HQ
          </h1>
          <p className="text-caption text-muted-foreground">
            {MODULE_HEADINGS.financeHQ}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
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
      <div>
        <h1 className="text-display-1 font-display-semibold text-foreground">
          Finance HQ
        </h1>
        <p className="text-body text-muted-foreground mt-0.5">
          {MODULE_HEADINGS.financeHQ}
        </p>
      </div>

      {/* AI Summary Sentence */}
      <Card className="bg-gradient-to-r from-brand-500/5 to-brand-300/5 border-brand-500/20">
        <CardContent className="p-3 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
          <p className="text-body text-foreground">
            Net margin improved 1.3% this month due to lower maintenance costs and early invoice collections. Fuel spend remains 6% above forecast.
          </p>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => (
          <FinanceSummaryCard key={index} {...card} />
        ))}
      </div>

      {/* DSO Days - Separate Mini Card */}
      <Card className="bg-card border-border hover-lift transition-smooth">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" />
            <div>
              <div className="text-caption text-muted-foreground">DSO Days</div>
              <div className="text-body-large font-body-medium text-foreground text-tabular">28.5</div>
            </div>
          </div>
          <div className="text-caption text-muted-foreground">Target: 25.0 days</div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CashCalendarChart />
        
        {/* Invoice Aging Card - Interactive */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground">Receivables Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Total Outstanding Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <div className="text-display-2 font-display-semibold text-foreground text-tabular">
                  {formatCurrency(1875000)}
                </div>
                <div className="text-caption text-muted-foreground">Total Outstanding</div>
              </div>
              <div>
                <div className="text-body-large font-body-medium text-destructive text-tabular">4.8%</div>
                <div className="text-caption text-muted-foreground">Overdue Rate</div>
              </div>
            </div>

            <div className="space-y-2">
              <div 
                className="flex items-center justify-between py-2.5 px-3 bg-success/10 rounded-lg border border-success/20 cursor-pointer hover:bg-success/15 transition-smooth"
                onClick={() => setSelectedAgingPeriod('0-30')}
              >
                <span className="text-caption text-foreground font-body-medium">0-30 days</span>
                <span className="text-body font-body-medium text-success text-tabular">{formatCurrency(1590000)}</span>
              </div>
              <div 
                className="flex items-center justify-between py-2.5 px-3 bg-warning/10 rounded-lg border border-warning/20 cursor-pointer hover:bg-warning/15 transition-smooth"
                onClick={() => setSelectedAgingPeriod('31-60')}
              >
                <span className="text-caption text-foreground font-body-medium">31-60 days</span>
                <div className="flex items-center gap-2">
                  <span className="text-body font-body-medium text-warning text-tabular">{formatCurrency(195000)}</span>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs border-brand-500/30 text-brand-500 hover:bg-brand-500/10">
                    Factor These
                  </Button>
                </div>
              </div>
              <div 
                className="flex items-center justify-between py-2.5 px-3 bg-destructive/10 rounded-lg border border-destructive/20 cursor-pointer hover:bg-destructive/15 transition-smooth"
                onClick={() => setSelectedAgingPeriod('60+')}
              >
                <span className="text-caption text-foreground font-body-medium">60+ days</span>
                <span className="text-body font-body-medium text-destructive text-tabular">{formatCurrency(90000)}</span>
              </div>
            </div>
            
            {/* AI Prediction */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-2.5 bg-warning/10 rounded-lg border border-warning/20 cursor-help">
                    <p className="text-caption text-warning flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5" />
                      AI Prediction: {formatCurrency(45000)} likely to slip to 60+ days
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">
                    This prediction is based on historical payment patterns and customer risk scores
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>

      {/* Cashflow Heatmap */}
      <CashflowHeatmap />

      {/* AI Insight Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <MoneyLeakDetector />
        <CustomerTruthScore />
        <WhatIfSimulator />
        <CapitalAccessSnapshot />
      </div>

      {/* Modals */}
      <RevenueDrilldownModal isOpen={showRevenueDrill} onClose={() => setShowRevenueDrill(false)} />
      <MarginDrilldownModal isOpen={showMarginDrill} onClose={() => setShowMarginDrill(false)} />
      <CostBreakdownModal isOpen={showCostDrill} onClose={() => setShowCostDrill(false)} />
      <DSODrilldownModal isOpen={showDSODrill} onClose={() => setShowDSODrill(false)} />

      {/* Scenario Canvas */}
      <ScenarioCanvas
        isOpen={showScenarios}
        onClose={() => setShowScenarios(false)}
        title="Cash Flow Optimization Scenarios"
        description="Compare payment terms and advance strategies to optimize working capital"
      />

      {/* Floating AI Assistant */}
      <AIAssistantButton />
    </div>
  );
}