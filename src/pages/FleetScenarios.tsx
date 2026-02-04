import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, TrendingDown, Download, Check, X, Lightbulb } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";

interface Scenario {
  id: string;
  title: string;
  description: string;
  category: "fleet-composition" | "lane-expansion" | "optimization";
  impact: {
    revenue?: number;
    margin?: number;
    fuelEfficiency?: number;
    idleTime?: number;
    uptime?: number;
  };
  timeframe: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected";
  chartData?: any[];
}

const mockScenarios: Scenario[] = [
  {
    id: "scenario-1",
    title: "Replace 2 Oldest Trucks",
    description: "Replace TRK-089 and TRK-045 with new vehicles. Expected +12% fuel efficiency improvement.",
    category: "fleet-composition",
    impact: {
      fuelEfficiency: 12,
      margin: 45000,
      uptime: 8,
    },
    timeframe: "Annual",
    confidence: 94,
    status: "pending",
    chartData: [
      { name: "Current", fuelCost: 125000, maintenance: 45000 },
      { name: "Projected", fuelCost: 110000, maintenance: 28000 },
    ],
  },
  {
    id: "scenario-2",
    title: "Add PE-JHB Lane",
    description: "Expand operations to Port Elizabeth-Johannesburg route with 2 dedicated vehicles.",
    category: "lane-expansion",
    impact: {
      revenue: 230000,
      margin: 85000,
    },
    timeframe: "Annual",
    confidence: 87,
    status: "pending",
    chartData: [
      { month: "M1", revenue: 15000, cost: 9000 },
      { month: "M2", revenue: 18000, cost: 10000 },
      { month: "M3", revenue: 19500, cost: 10200 },
      { month: "M6", revenue: 22000, cost: 11000 },
      { month: "M12", revenue: 24000, cost: 11500 },
    ],
  },
  {
    id: "scenario-3",
    title: "Reduce Fleet by 3 Trucks",
    description: "Retire underperforming vehicles TRK-067, TRK-078, TRK-082. Optimize routes for remaining fleet.",
    category: "optimization",
    impact: {
      idleTime: -18,
      margin: 7,
      uptime: 12,
    },
    timeframe: "Annual",
    confidence: 91,
    status: "pending",
    chartData: [
      { metric: "Idle Time", current: 22, projected: 18 },
      { metric: "Utilization", current: 87, projected: 95 },
      { metric: "Cost/KM", current: 4.5, projected: 4.1 },
    ],
  },
  {
    id: "scenario-4",
    title: "Night Shift Operations",
    description: "Introduce night shift drivers on JHB-CPT route to reduce traffic delays and improve on-time delivery.",
    category: "optimization",
    impact: {
      margin: 62000,
      fuelEfficiency: 8,
    },
    timeframe: "Annual",
    confidence: 82,
    status: "pending",
    chartData: [
      { shift: "Day", avgTime: "14.5h", fuelL: "420", delays: 8 },
      { shift: "Night", avgTime: "12.8h", fuelL: "385", delays: 2 },
    ],
  },
];

// Benchmark data
const benchmarkData = [
  {
    metric: "Fleet Margin",
    value: 18.2,
    industry: 15.5,
    status: "above",
  },
  {
    metric: "Empty KM %",
    value: 18.3,
    industry: 22.0,
    status: "above",
  },
  {
    metric: "Fuel L/100km",
    value: 7.1,
    industry: 7.8,
    status: "above",
  },
  {
    metric: "Uptime %",
    value: 89.5,
    industry: 92.0,
    status: "below",
  },
];

// Heatmap data for fuel efficiency by region/time
const fuelHeatmapData = [
  { region: "JHB", morning: 6.8, midday: 7.5, evening: 7.2, night: 6.5 },
  { region: "CPT", morning: 6.9, midday: 7.8, evening: 7.4, night: 6.7 },
  { region: "DBN", morning: 7.1, midday: 8.0, evening: 7.6, night: 6.9 },
  { region: "PE", morning: 7.0, midday: 7.9, evening: 7.5, night: 6.8 },
];

export default function FleetScenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>(mockScenarios);

  const handleAccept = (scenarioId: string) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === scenarioId ? { ...s, status: "accepted" } : s))
    );
  };

  const handleReject = (scenarioId: string) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === scenarioId ? { ...s, status: "rejected" } : s))
    );
  };

  const getCategoryColor = (category: Scenario["category"]) => {
    switch (category) {
      case "fleet-composition":
        return "bg-brand-500/10 text-brand-500 border-brand-500/20";
      case "lane-expansion":
        return "bg-success/10 text-success border-success/20";
      case "optimization":
        return "bg-warning/10 text-warning border-warning/20";
    }
  };

  const getCategoryLabel = (category: Scenario["category"]) => {
    switch (category) {
      case "fleet-composition":
        return "Fleet Composition";
      case "lane-expansion":
        return "Lane Expansion";
      case "optimization":
        return "Optimization";
    }
  };

  const getHeatmapColor = (value: number) => {
    if (value < 7.0) return "bg-success";
    if (value < 7.5) return "bg-success/60";
    if (value < 8.0) return "bg-warning/60";
    return "bg-destructive/60";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-body-medium font-body-medium text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            Fleet Scenarios
          </h1>
          <p className="text-caption text-muted-foreground">
            Strategic sandbox - simulate fleet composition and operational changes
          </p>
        </div>
        <Badge className="bg-brand-500/10 text-brand-500 border-brand-500/20">
          <Lightbulb className="w-3 h-3 mr-1" />
          AI-Powered Insights
        </Badge>
      </div>

      {/* Benchmark Indicators */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-muted-foreground">Fleet vs Industry Benchmarks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {benchmarkData.map((benchmark, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg border border-border hover:shadow-glow transition-smooth"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-caption text-muted-foreground font-body-medium">{benchmark.metric}</span>
                  {benchmark.status === "above" ? (
                    <TrendingUp className="w-4 h-4 text-brand-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="text-display-2 font-display-semibold text-foreground text-tabular">
                  {benchmark.value}
                  {benchmark.metric.includes("%") ? "%" : ""}
                </div>
                <div className="text-caption text-muted-foreground mt-1">
                  Industry: {benchmark.industry}
                  {benchmark.metric.includes("%") ? "%" : ""}
                </div>
                <Badge
                  variant="outline"
                  className={
                    benchmark.status === "above"
                      ? "mt-2 bg-brand-500/10 text-brand-500 border-brand-500/20 text-xs"
                      : "mt-2 bg-muted text-muted-foreground border-muted text-xs"
                  }
                >
                  {benchmark.status === "above" ? "Above" : "Below"} baseline
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scenario Cards */}
      <div className="space-y-4">
        <h2 className="text-body-medium font-body-medium text-foreground">Active Scenarios</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {scenarios.map((scenario) => (
            <Card
              key={scenario.id}
              className={`bg-card border-border hover:shadow-glow transition-smooth ${
                scenario.status === "accepted"
                  ? "ring-2 ring-success"
                  : scenario.status === "rejected"
                  ? "opacity-60"
                  : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="outline" className={getCategoryColor(scenario.category)}>
                    {getCategoryLabel(scenario.category)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-brand-500/10 text-brand-500 border-brand-500/20"
                  >
                    {scenario.confidence}% confident
                  </Badge>
                </div>
                <CardTitle className="text-body font-body-medium text-foreground">
                  {scenario.title}
                </CardTitle>
                <p className="text-caption text-muted-foreground mt-1">{scenario.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Impact Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  {scenario.impact.revenue && (
                    <div className="p-3 rounded-lg bg-brand-500/5 border border-brand-500/20">
                      <div className="text-caption text-muted-foreground">Revenue Impact</div>
                      <div className="text-body font-body-medium text-brand-500 text-tabular">
                        +{formatCurrency(scenario.impact.revenue)}
                      </div>
                      <div className="text-xs text-muted-foreground">{scenario.timeframe}</div>
                    </div>
                  )}
                  {scenario.impact.margin !== undefined && (
                    <div className="p-3 rounded-lg bg-brand-500/5 border border-brand-500/20">
                      <div className="text-caption text-muted-foreground">
                        {typeof scenario.impact.margin === "number" && scenario.impact.margin > 100
                          ? "Margin Savings"
                          : "Margin Increase"}
                      </div>
                      <div className="text-body font-body-medium text-brand-500 text-tabular">
                        {typeof scenario.impact.margin === "number" &&
                        scenario.impact.margin > 100
                          ? `+${formatCurrency(scenario.impact.margin)}`
                          : `+${scenario.impact.margin}%`}
                      </div>
                      <div className="text-xs text-muted-foreground">{scenario.timeframe}</div>
                    </div>
                  )}
                  {scenario.impact.fuelEfficiency && (
                    <div className="p-3 rounded-lg bg-brand-500/5 border border-brand-500/20">
                      <div className="text-caption text-muted-foreground">Fuel Efficiency</div>
                      <div className="text-body font-body-medium text-brand-500 text-tabular">
                        +{scenario.impact.fuelEfficiency}%
                      </div>
                      <div className="text-xs text-muted-foreground">Improvement</div>
                    </div>
                  )}
                  {scenario.impact.idleTime && (
                    <div className="p-3 rounded-lg bg-brand-500/5 border border-brand-500/20">
                      <div className="text-caption text-muted-foreground">Idle Time</div>
                      <div className="text-body font-body-medium text-brand-500 text-tabular">
                        {scenario.impact.idleTime}%
                      </div>
                      <div className="text-xs text-muted-foreground">Reduction</div>
                    </div>
                  )}
                  {scenario.impact.uptime && (
                    <div className="p-3 rounded-lg bg-brand-500/5 border border-brand-500/20">
                      <div className="text-caption text-muted-foreground">Uptime</div>
                      <div className="text-body font-body-medium text-brand-500 text-tabular">
                        +{scenario.impact.uptime}%
                      </div>
                      <div className="text-xs text-muted-foreground">Improvement</div>
                    </div>
                  )}
                </div>

                {/* Scenario Chart */}
                {scenario.chartData && (
                  <div className="h-48 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      {scenario.id === "scenario-1" ? (
                        <BarChart data={scenario.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="name"
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          <Bar dataKey="fuelCost" fill="hsl(var(--warning))" name="Fuel Cost" />
                          <Bar
                            dataKey="maintenance"
                            fill="hsl(var(--brand-500))"
                            name="Maintenance"
                          />
                        </BarChart>
                      ) : scenario.id === "scenario-2" ? (
                        <LineChart data={scenario.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="month"
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="hsl(var(--success))"
                            strokeWidth={2}
                            name="Revenue"
                          />
                          <Line
                            type="monotone"
                            dataKey="cost"
                            stroke="hsl(var(--destructive))"
                            strokeWidth={2}
                            name="Cost"
                          />
                        </LineChart>
                      ) : (
                        <BarChart data={scenario.chartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            type="number"
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          />
                          <YAxis
                            type="category"
                            dataKey="metric"
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          <Bar dataKey="current" fill="hsl(var(--muted-foreground))" name="Current" />
                          <Bar dataKey="projected" fill="hsl(var(--success))" name="Projected" />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Action Buttons */}
                {scenario.status === "pending" && (
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <Button
                      className="flex-1 bg-brand-500 hover:bg-brand-700 text-white"
                      onClick={() => handleAccept(scenario.id)}
                      size="sm"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleReject(scenario.id)}
                      size="sm"
                      className="px-3"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="px-3">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {scenario.status === "accepted" && (
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <Badge
                      variant="outline"
                      className="bg-success/10 text-success border-success/20"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Accepted
                    </Badge>
                    <Button variant="outline" size="sm" className="ml-auto">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                )}
                {scenario.status === "rejected" && (
                  <div className="pt-3 border-t border-border">
                    <Badge
                      variant="outline"
                      className="bg-muted text-muted-foreground border-muted"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Rejected
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Fuel Efficiency Heatmap */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-muted-foreground">
            Fuel Efficiency by Region & Time of Day
          </CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Liters per 100km - Lower values indicate better efficiency
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {fuelHeatmapData.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-16 text-caption text-muted-foreground font-body-medium">
                  {row.region}
                </div>
                <div className="flex-1 grid grid-cols-4 gap-2">
                  {["morning", "midday", "evening", "night"].map((time) => (
                    <div
                      key={time}
                      className={`p-3 rounded-lg ${getHeatmapColor(
                        row[time as keyof typeof row] as number
                      )} text-white text-center transition-all hover:scale-105 cursor-pointer hover:ring-2 hover:ring-brand-500`}
                      title={`${row.region} ${time}: ${row[time as keyof typeof row]}L/100km`}
                    >
                      <div className="text-xs opacity-90 capitalize">{time}</div>
                      <div className="text-caption font-body-medium text-tabular">
                        {row[time as keyof typeof row]}L
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
            <span className="text-caption text-muted-foreground">Efficiency:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-success" />
              <span className="text-xs text-muted-foreground">Excellent (&lt;7.0)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-success/60" />
              <span className="text-xs text-muted-foreground">Good (7.0-7.5)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-warning/60" />
              <span className="text-xs text-muted-foreground">Fair (7.5-8.0)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-destructive/60" />
              <span className="text-xs text-muted-foreground">Poor (&gt;8.0)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
