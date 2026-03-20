import { useState } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  X,
  TrendingUp,
  TrendingDown,
  Truck,
  DollarSign,
  Zap,
  Clock,
  Wrench,
  AlertCircle,
  CheckCircle,
  Calendar,
  FileText,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Area,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";

interface VehicleDetailDrawerProps {
  vehicleId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function VehicleDetailDrawer({ vehicleId, isOpen, onClose }: VehicleDetailDrawerProps) {
  const [selectedTab, setSelectedTab] = useState("overview");

  if (!vehicleId) return null;

  // Mock data - would come from API
  const vehicleData = {
    id: vehicleId,
    driver: "S. Mthembu",
    status: "En Route",
    dailyProfit: 2300,
    marginPerKm: 15.4,
    tripsThisMonth: 18,
    activeDays: 24,
    uptime: 94.2,
    aiScore: 87,
    efficiencyVsFleet: 12,
  };

  // Revenue vs Cost data (last 30 days)
  const profitData = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    revenue: 8000 + Math.random() * 4000,
    cost: 4000 + Math.random() * 2000,
  }));

  // Top routes
  const topRoutes = [
    { route: "DBN → JHB", trips: 8, margin: 1200, avgMargin: 15.2 },
    { route: "JHB → CPT", trips: 5, margin: 1800, avgMargin: 18.5 },
    { route: "CPT → PLZ", trips: 3, margin: 950, avgMargin: 12.8 },
    { route: "JHB → DBN", trips: 2, margin: 1100, avgMargin: 14.1 },
  ];

  // Performance radar data
  const performanceData = [
    { metric: "Fuel Efficiency", value: 92, fleetAvg: 80 },
    { metric: "On-Time %", value: 95, fleetAvg: 88 },
    { metric: "Idle Time", value: 85, fleetAvg: 75 },
    { metric: "Safety Score", value: 88, fleetAvg: 82 },
    { metric: "Utilisation", value: 91, fleetAvg: 78 },
  ];

  // AI insights
  const aiInsights = [
    {
      icon: TrendingUp,
      text: "Driver S. Mthembu achieves 9% better fuel economy on this vehicle.",
      type: "positive",
    },
    {
      icon: AlertCircle,
      text: "Idle time increased +12 hours this week.",
      type: "warning",
    },
    {
      icon: Wrench,
      text: "Tyre pressure anomalies predicted to raise fuel cost +3%.",
      type: "alert",
    },
  ];

  const getScoreBadge = (score: number) => {
    if (score >= 85) return "bg-success/10 text-success border-success/20";
    if (score >= 70) return "bg-warning/10 text-warning border-warning/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90vh] max-w-4xl mx-auto">
        <DrawerHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DrawerTitle className="text-display-1 font-display-semibold text-foreground flex items-center gap-3">
                <Truck className="w-6 h-6 text-brand-500" />
                {vehicleId}
              </DrawerTitle>
              <DrawerDescription className="text-body text-muted-foreground">
                Assigned to {vehicleData.driver} • {vehicleData.status}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <X className="w-4 h-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-6 pb-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="profitability">Profitability</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            </TabsList>

            {/* Tab 1: Overview */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Mini KPI Row */}
              <div className="grid grid-cols-4 gap-3">
                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <div className="text-caption text-muted-foreground mb-1">Margin/KM</div>
                    <div className="text-body font-body-medium text-foreground text-tabular">
                      R {vehicleData.marginPerKm}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <div className="text-caption text-muted-foreground mb-1">Trips MTD</div>
                    <div className="text-body font-body-medium text-foreground text-tabular">
                      {vehicleData.tripsThisMonth}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <div className="text-caption text-muted-foreground mb-1">Active Days</div>
                    <div className="text-body font-body-medium text-foreground text-tabular">
                      {vehicleData.activeDays}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <div className="text-caption text-muted-foreground mb-1">Uptime</div>
                    <div className="text-body font-body-medium text-success text-tabular">
                      {vehicleData.uptime}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Summary */}
              <Card className="bg-gradient-to-r from-brand-500/5 to-brand-300/5 border-brand-500/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-brand-500 mt-0.5" />
                    <div>
                      <h3 className="text-body font-body-medium text-foreground mb-1">
                        AI Summary
                      </h3>
                      <p className="text-body text-muted-foreground">
                        This vehicle delivers +R {vehicleData.dailyProfit.toLocaleString()}/day net
                        profit. Efficiency {vehicleData.efficiencyVsFleet}% above fleet average.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profit Breakdown */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-body text-muted-foreground">
                    Profit vs Cost Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-caption">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="text-foreground font-body-medium">R 12,000</span>
                    </div>
                    <Progress value={100} className="h-2 bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-caption">
                      <span className="text-muted-foreground">Fuel Cost</span>
                      <span className="text-foreground font-body-medium">R 4,200</span>
                    </div>
                    <Progress value={35} className="h-2 bg-warning/20" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-caption">
                      <span className="text-muted-foreground">Maintenance</span>
                      <span className="text-foreground font-body-medium">R 1,500</span>
                    </div>
                    <Progress value={12.5} className="h-2 bg-warning/20" />
                  </div>
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between text-body">
                      <span className="text-foreground font-body-medium">Net Margin</span>
                      <span className="text-success font-body-medium">R 6,300</span>
                    </div>
                    <Progress value={52.5} className="h-2 bg-success/20" />
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <FileText className="w-4 h-4 mr-2" />
                  Maintenance Log
                </Button>
                <Button variant="outline" className="flex-1">
                  <Clock className="w-4 h-4 mr-2" />
                  Trip History
                </Button>
              </div>
            </TabsContent>

            {/* Tab 2: Profitability */}
            <TabsContent value="profitability" className="space-y-4 mt-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-body text-muted-foreground">
                    Revenue vs Cost (Last 30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={profitData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--grid-line))" />
                      <XAxis
                        dataKey="day"
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        fill="hsl(var(--success))"
                        fillOpacity={0.1}
                        stroke="hsl(var(--success))"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="cost"
                        stroke="hsl(var(--warning))"
                        strokeWidth={2}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top Routes */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-body text-muted-foreground">
                    Top 5 Profitable Routes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topRoutes.map((route, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                      >
                        <div>
                          <div className="text-body font-body-medium text-foreground">
                            {route.route}
                          </div>
                          <div className="text-caption text-muted-foreground">
                            {route.trips} trips • {route.avgMargin}% avg margin
                          </div>
                        </div>
                        <div className="text-body font-body-medium text-success text-tabular">
                          +{formatCurrency(route.margin)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI Margin Insight */}
              <Card className="bg-gradient-to-r from-brand-500/5 to-brand-300/5 border-brand-500/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-success mt-0.5" />
                    <div>
                      <h3 className="text-body font-body-medium text-foreground mb-1">
                        AI Margin Insight
                      </h3>
                      <p className="text-body text-muted-foreground mb-2">
                        Higher margins on DBN → JHB lane (+R 1,200/trip). Underperforming on N4
                        Route (−R 850/trip).
                      </p>
                      <p className="text-body text-brand-500">
                        Suggest reassignment to maximize profitability
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 3: Performance */}
            <TabsContent value="performance" className="space-y-4 mt-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-body text-muted-foreground">
                    Performance vs Fleet Average
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={performanceData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar
                        name="This Vehicle"
                        dataKey="value"
                        stroke="hsl(var(--success))"
                        fill="hsl(var(--success))"
                        fillOpacity={0.3}
                      />
                      <Radar
                        name="Fleet Avg"
                        dataKey="fleetAvg"
                        stroke="hsl(var(--muted-foreground))"
                        fill="hsl(var(--muted-foreground))"
                        fillOpacity={0.1}
                      />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* AI Insight Feed */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-body text-muted-foreground">AI Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {aiInsights.map((insight, idx) => {
                      const Icon = insight.icon;
                      const colorClass =
                        insight.type === "positive"
                          ? "text-success"
                          : insight.type === "warning"
                          ? "text-warning"
                          : "text-destructive";
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border"
                        >
                          <Icon className={`w-4 h-4 ${colorClass} mt-0.5`} />
                          <p className="text-body text-foreground flex-1">{insight.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 4: Maintenance */}
            <TabsContent value="maintenance" className="space-y-4 mt-4">
              {/* Service Status */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-warning" />
                      <div>
                        <div className="text-caption text-muted-foreground">Next Service Due</div>
                        <div className="text-body font-body-medium text-foreground">
                          1 Nov 2025
                        </div>
                        <div className="text-caption text-warning">320 km remaining</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-brand-500" />
                      <div>
                        <div className="text-caption text-muted-foreground">Last Service Cost</div>
                        <div className="text-body font-body-medium text-foreground">R 8,200</div>
                        <div className="text-caption text-muted-foreground">
                          Brake Pads + Oil Change
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Predictive Maintenance */}
              <Card className="bg-gradient-to-r from-brand-500/5 to-brand-300/5 border-brand-500/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Wrench className="w-5 h-5 text-brand-500 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-body font-body-medium text-foreground mb-1">
                        Predictive Maintenance AI
                      </h3>
                      <p className="text-body text-muted-foreground">
                        Early maintenance next week prevents R 5,600 downtime loss.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Compliance Status */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-body text-muted-foreground">
                    Compliance Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-success" />
                        <span className="text-body text-foreground">Certificate of Fitness</span>
                      </div>
                      <Badge className="bg-success/10 text-success border-success/20">Valid</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-success" />
                        <span className="text-body text-foreground">License</span>
                      </div>
                      <Badge className="bg-success/10 text-success border-success/20">Valid</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-4 h-4 text-warning" />
                        <span className="text-body text-foreground">Insurance</span>
                      </div>
                      <Badge className="bg-warning/10 text-warning border-warning/20">
                        Expires Soon
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  Reschedule Service
                </Button>
                <Button variant="outline" className="flex-1">
                  <FileText className="w-4 h-4 mr-2" />
                  View History
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
