import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, AlertTriangle, CheckCircle, Shield } from "lucide-react";
import { QuotePerformanceChart } from "@/components/charts/QuotePerformanceChart";
import { MarginByLaneChart } from "@/components/charts/MarginByLaneChart";
import { PipelineSummary } from "@/components/pipeline/PipelineSummary";
import { RecentActivityFeed } from "@/components/activity/RecentActivityFeed";
import { WinLossAnalysis } from "@/components/bookings/WinLossAnalysis";
import { ChartSkeleton, KpiSkeleton } from "@/components/ui/loading-states";
import bookingsOverviewData from "@/mocks/bookings-overview.json";

export default function Bookings() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const kpiData = [
    {
      title: "Total Quoted",
      value: bookingsOverviewData.kpiData.totalQuoted.value,
      subtitle: bookingsOverviewData.kpiData.totalQuoted.subtext,
      icon: TrendingUp,
      color: "text-brand-500",
      onClick: undefined
    },
    {
      title: "Acceptance Rate", 
      value: bookingsOverviewData.kpiData.acceptanceRate.value,
      subtitle: bookingsOverviewData.kpiData.acceptanceRate.subtext,
      icon: CheckCircle,
      color: "text-success-500",
      onClick: undefined
    },
    {
      title: "Average Margin",
      value: bookingsOverviewData.kpiData.averageMargin.value,
      subtitle: bookingsOverviewData.kpiData.averageMargin.subtext,
      icon: Shield,
      color: "text-warn-500",
      onClick: undefined
    },
    {
      title: "Price Alerts",
      value: bookingsOverviewData.kpiData.priceAlerts.value.toString(),
      subtitle: bookingsOverviewData.kpiData.priceAlerts.subtext,
      icon: AlertTriangle,
      color: "text-danger-500",
      onClick: () => navigate('/bookings/pipeline', { state: { filterStage: 'alerts' } })
    }
  ];

  const OverviewContent = () => {
    if (loading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChartSkeleton />
            </div>
            <div className="lg:col-span-1">
              <ChartSkeleton />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* KPI Cards - Top Row */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {kpiData.map((kpi, index) => (
            <Card 
              key={index} 
              className={`bg-card border-border hover:shadow-glow transition-smooth ${
                kpi.onClick ? 'cursor-pointer hover:shadow-md' : ''
              }`}
              onClick={kpi.onClick}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-caption text-muted-foreground">
                  {kpi.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-body font-body-medium text-foreground text-tabular">
                  {kpi.value}
                </div>
                <p className="text-caption text-muted-foreground mt-1">{kpi.subtitle}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Asymmetrical Layout - 65%/35% Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Charts (2 columns wide) */}
          <div className="lg:col-span-2 space-y-6">
            <QuotePerformanceChart />
            <MarginByLaneChart />
          </div>
          
          {/* Right Column - Sidebar (1 column wide) */}
          <div className="lg:col-span-1 space-y-6">
            <PipelineSummary />
            <RecentActivityFeed activities={bookingsOverviewData.activityFeedData} />
          </div>
        </div>

        {/* AI Diagnostics Section - Full Width */}
        <WinLossAnalysis />
      </div>
    );
  };

  return (
    <OverviewContent />
  );
}