import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

const laneData = [
  { from: "Johannesburg", to: "Cape Town", volume: 45, margin: 18.5, revenue: 285000, trend: "up" },
  { from: "Johannesburg", to: "Durban", volume: 38, margin: 16.2, revenue: 198000, trend: "stable" },
  { from: "Cape Town", to: "Port Elizabeth", volume: 22, margin: 22.1, revenue: 145000, trend: "up" },
  { from: "Durban", to: "Johannesburg", volume: 34, margin: 15.8, revenue: 176000, trend: "down" },
  { from: "Pretoria", to: "Bloemfontein", volume: 18, margin: 19.4, revenue: 98000, trend: "stable" },
  { from: "Cape Town", to: "Johannesburg", volume: 41, margin: 17.9, revenue: 265000, trend: "up" },
  { from: "East London", to: "Durban", volume: 15, margin: 24.3, revenue: 87000, trend: "up" },
  { from: "Polokwane", to: "Johannesburg", volume: 12, margin: 21.2, revenue: 65000, trend: "stable" },
];

export function LanePnlHeatmap() {
  const getMarginColor = (margin: number) => {
    if (margin >= 20) return "bg-success text-success-foreground";
    if (margin >= 15) return "bg-warning text-warning-foreground"; 
    return "bg-destructive text-destructive-foreground";
  };

  const getMarginIntensity = (margin: number) => {
    if (margin >= 23) return "opacity-100";
    if (margin >= 20) return "opacity-80";
    if (margin >= 17) return "opacity-60";
    if (margin >= 15) return "opacity-40";
    return "opacity-20";
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUp className="w-3 h-3 text-success" />;
      case "down": return <TrendingDown className="w-3 h-3 text-destructive" />;
      default: return <div className="w-3 h-3 rounded-full bg-muted" />;
    }
  };

  const topLanes = [...laneData]
    .sort((a, b) => (b.margin * b.revenue) - (a.margin * a.revenue))
    .slice(0, 3);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-caption text-muted-foreground flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          Lane P&amp;L heatmap
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Heatmap Grid */}
        <div className="space-y-2">
          {laneData.map((lane, index) => (
            <div 
              key={`${lane.from}-${lane.to}`}
              className={`p-3 rounded-lg border transition-all duration-200 hover:scale-[1.02] hover:shadow-glow ${getMarginColor(lane.margin)} ${getMarginIntensity(lane.margin)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="font-body-medium text-sm truncate">
                    {lane.from} → {lane.to}
                  </div>
                  {getTrendIcon(lane.trend)}
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-xs opacity-80">{lane.volume} loads</div>
                    <div className="text-xs font-body-medium">{formatCurrency(lane.revenue)}</div>
                  </div>
                  <div className="text-lg font-display-semibold text-tabular">
                    {formatPercentage(lane.margin / 100)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-caption">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-success rounded" />
              <span className="text-muted-foreground">High Margin (20%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-warning rounded" />
              <span className="text-muted-foreground">Target (15-20%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-destructive rounded" />
              <span className="text-muted-foreground">Below Target (&lt;15%)</span>
            </div>
          </div>
        </div>

        {/* Top Performing Lanes */}
        <div className="space-y-3">
          <div className="text-caption text-muted-foreground font-body-medium">Top Performing Lanes</div>
          <div className="space-y-2">
            {topLanes.map((lane, index) => (
              <div key={`top-${index}`} className="flex items-center justify-between p-2 bg-muted/10 rounded">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                  <span className="text-body text-foreground">{lane.from} → {lane.to}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-caption text-muted-foreground">{formatPercentage(lane.margin / 100)}</span>
                  <span className="text-body-medium font-body-medium text-foreground text-tabular">
                    {formatCurrency(lane.revenue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}