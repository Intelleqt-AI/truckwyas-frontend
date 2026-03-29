import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfitRevenueTrendChart } from "@/components/charts/ProfitRevenueTrendChart";
import { TrendingUp, Wallet, Truck, DollarSign } from "lucide-react";

interface HealthMetric {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'neutral';
}

export function BusinessHealthSummary() {
  const healthMetrics: HealthMetric[] = [
    {
      label: "Total Revenue (YTD)",
      value: "R 28.4M",
      subtitle: "+12.4% vs last year",
      icon: TrendingUp,
      status: 'good',
      trend: 'up'
    },
    {
      label: "Net Profit Margin % (YTD)",
      value: "18.7%",
      subtitle: "+2.3% vs last year",
      icon: DollarSign,
      status: 'good',
      trend: 'up'
    },
    {
      label: "Cash on Hand",
      value: "R 847K",
      subtitle: "~45 days runway",
      icon: Wallet,
      status: 'warning',
      trend: 'down'
    },
    {
      label: "Fleet Utilisation %",
      value: "87.4%",
      subtitle: "Target: 85%",
      icon: Truck,
      status: 'good',
      trend: 'up'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'var(--status-success)';
      case 'warning': return 'var(--status-warning)';
      case 'critical': return 'var(--status-danger)';
      default: return 'var(--text-tertiary)';
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return '▲';
    if (trend === 'down') return '▼';
    return '●';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[40%_1fr] gap-6">
      {/* Left Container - Business Health KPIs */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-6">
          <CardTitle className="text-body-large font-body-medium">
            Business Health at a Glance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {healthMetrics.map((metric, index) => {
              const Icon = metric.icon;
              const statusColor = getStatusColor(metric.status);
              const trendIcon = getTrendIcon(metric.trend);

              return (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    {/* Status Dot */}
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: statusColor,
                        flexShrink: 0
                      }}
                    />
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-caption text-muted-foreground mb-0.5">
                        {metric.label}
                      </p>
                      <div className="text-body-large font-body-medium text-foreground text-tabular flex items-center gap-2">
                        {metric.value}
                        {/* Trend Arrow */}
                        <span
                          style={{
                            fontSize: '14px',
                            color: metric.trend === 'up' ? 'var(--status-success)' : metric.trend === 'down' ? 'var(--status-danger)' : 'var(--text-tertiary)'
                          }}
                        >
                          {trendIcon}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-caption text-muted-foreground text-right whitespace-nowrap ml-4">
                    {metric.subtitle}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Right Container - Revenue & Profit Trends */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-6">
          <CardTitle className="text-body-large font-body-medium">
            Revenue & Profit Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="min-h-[400px]">
            <ProfitRevenueTrendChart />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
