import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DriverAICopilot } from "@/components/fleet/DriverAICopilot";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  FileText,
  CalendarDays,
  Target,
  DollarSign,
  TrendingDown,
  Sparkles,
  ArrowUpRight,
  Activity,
  PieChart,
} from "lucide-react";

export default function DriverProfile() {
  const { driverId } = useParams();

  // Mock driver data
  const driverData = {
    id: driverId,
    name: "John Smith",
    vehicle: "TRK-001",
    onTimePercent: 96.5,
    safetyScore: 94,
    fuelScore: 92,
    avgMargin: 22500,
    status: "Active",
    roiScore: 88,
  };

  // Business impact cards
  const businessImpacts = [
    {
      type: "cost",
      title: "Extra Fuel from Idling",
      amount: 1200,
      period: "month",
      description: "Driver costs R1,200/month in extra fuel due to high idling at border crossings.",
      evidence: "45 min avg idling per crossing • 8 crossings/month",
      action: "Train engine-off protocol",
    },
    {
      type: "saving",
      title: "Above-Average Performance",
      amount: 4300,
      period: "month",
      description: "Saves R4,300/month vs peers on DBN–PE route through consistent speed and low harsh braking.",
      evidence: "98% on-time • 5% better fuel efficiency",
      action: "Share best practices",
    },
  ];

  // Predictive alerts
  const predictiveAlerts = [
    {
      alert: "Potential Fatigue Pattern Detected",
      risk: "medium",
      description: "Analysis shows declining performance after 10+ consecutive days. Consider rest rotation.",
      impact: "R2,400/week potential margin loss",
      probability: 68,
    },
    {
      alert: "Route Optimization Opportunity",
      risk: "low",
      description: "Driver performance is 15% better on coastal routes vs inland routes.",
      impact: "+R6,000/month if reassigned",
      probability: 82,
    },
  ];

  // Profit opportunities
  const profitOpportunities = [
    {
      opportunity: "Reassign to Durban Routes This Week",
      uplift: 6000,
      confidence: 85,
      reasoning: "Driver's coastal route performance is 15% above fleet average. Current DBN demand is +22%.",
    },
    {
      opportunity: "Cruise Control Training Program",
      uplift: 14400,
      confidence: 72,
      reasoning: "Speed variance reduction could save R1,200/month in fuel. 12-month projected savings.",
    },
  ];

  // Spider chart data
  const spiderData = [
    {
      metric: "Fuel Efficiency",
      driver: 92,
      fleetAvg: 85,
      laneAvg: 88,
    },
    {
      metric: "Safety",
      driver: 94,
      fleetAvg: 87,
      laneAvg: 89,
    },
    {
      metric: "On-Time",
      driver: 96,
      fleetAvg: 90,
      laneAvg: 92,
    },
    {
      metric: "Margin Impact",
      driver: 88,
      fleetAvg: 82,
      laneAvg: 85,
    },
    {
      metric: "Compliance",
      driver: 98,
      fleetAvg: 95,
      laneAvg: 96,
    },
  ];

  // Coaching insights
  const coachingInsights = [
    {
      id: 1,
      issue: "Harsh Braking Events",
      location: "N3 Durban Approach",
      frequency: "12 events/week",
      impact: 800,
      severity: "medium",
      recommendation:
        "Driver exhibits frequent harsh braking on N3 approaching Durban. Early speed reduction coaching could save R800/month in fuel and brake wear.",
    },
    {
      id: 2,
      issue: "Idling Time",
      location: "Border Crossings",
      frequency: "45 min/crossing avg",
      impact: 450,
      severity: "low",
      recommendation:
        "Excessive idling at border crossings. Engine-off protocol training could save R450/month.",
    },
    {
      id: 3,
      issue: "Speed Variance",
      location: "N1 Cape Town-JHB",
      frequency: "High variance",
      impact: 1200,
      severity: "high",
      recommendation:
        "Inconsistent speed management on long hauls. Cruise control training could save R1,200/month in fuel.",
    },
  ];

  // Compliance tracking
  const complianceItems = [
    {
      type: "Driver's License",
      expiryDate: "2025-11-15",
      daysUntilExpiry: 230,
      status: "valid",
    },
    {
      type: "PrDP Certificate",
      expiryDate: "2025-05-22",
      daysUntilExpiry: 53,
      status: "expiring",
    },
    {
      type: "Medical Certificate",
      expiryDate: "2026-01-10",
      daysUntilExpiry: 285,
      status: "valid",
    },
  ];

  // Performance activity heatmap data
  const generateActivityData = () => {
    const weeks = 52;
    const data = [];
    for (let week = 0; week < weeks; week++) {
      for (let day = 0; day < 7; day++) {
        const date = new Date();
        date.setDate(date.getDate() - (weeks - week) * 7 - (7 - day));
        const value = Math.floor(Math.random() * 100);
        data.push({
          date: date.toISOString().split("T")[0],
          value,
          week,
          day,
        });
      }
    }
    return data;
  };

  const activityData = generateActivityData();

  const getActivityColor = (value: number) => {
    if (value === 0) return "bg-muted";
    if (value < 25) return "bg-success/20";
    if (value < 50) return "bg-success/40";
    if (value < 75) return "bg-success/60";
    return "bg-success";
  };

  // Lane-specific benchmarking
  const laneBenchmarks = [
    {
      lane: "JHB-CPT",
      trips: 45,
      rank: 2,
      totalDrivers: 12,
      avgMargin: 24500,
      fleetAvgMargin: 21200,
    },
    {
      lane: "DBN-PE",
      trips: 28,
      rank: 1,
      totalDrivers: 8,
      avgMargin: 23800,
      fleetAvgMargin: 19500,
    },
    {
      lane: "JHB-DBN",
      trips: 32,
      rank: 3,
      totalDrivers: 15,
      avgMargin: 21200,
      fleetAvgMargin: 20100,
    },
  ];

  const pnlData = {
    totalRevenue: 485000,
    costs: {
      fuel: 145000,
      maintenance: 32000,
      tolls: 18500,
      salary: 45000,
      other: 22000,
    },
    netContribution: 222500,
  };

  // Monthly revenue vs cost data (last 12 months)
  const monthlyRevenueData = [
    { month: "Jan", revenue: 38000, cost: 21000 },
    { month: "Feb", revenue: 42000, cost: 22500 },
    { month: "Mar", revenue: 39500, cost: 20800 },
    { month: "Apr", revenue: 44000, cost: 23200 },
    { month: "May", revenue: 41500, cost: 21900 },
    { month: "Jun", revenue: 40000, cost: 21500 },
    { month: "Jul", revenue: 43000, cost: 22800 },
    { month: "Aug", revenue: 38500, cost: 20500 },
    { month: "Sep", revenue: 42500, cost: 22200 },
    { month: "Oct", revenue: 41000, cost: 21800 },
    { month: "Nov", revenue: 37500, cost: 20300 },
    { month: "Dec", revenue: 37500, cost: 20000 },
  ];

  // Fuel efficiency trend (last 12 months)
  const fuelTrendData = [
    { month: "Jan", efficiency: 89 },
    { month: "Feb", efficiency: 90 },
    { month: "Mar", efficiency: 88 },
    { month: "Apr", efficiency: 91 },
    { month: "May", efficiency: 92 },
    { month: "Jun", efficiency: 91 },
    { month: "Jul", efficiency: 93 },
    { month: "Aug", efficiency: 92 },
    { month: "Sep", efficiency: 94 },
    { month: "Oct", efficiency: 93 },
    { month: "Nov", efficiency: 92 },
    { month: "Dec", efficiency: 92 },
  ];

  // Safety score trend (last 12 months)
  const safetyTrendData = [
    { month: "Jan", score: 91 },
    { month: "Feb", score: 92 },
    { month: "Mar", score: 90 },
    { month: "Apr", score: 93 },
    { month: "May", score: 94 },
    { month: "Jun", score: 93 },
    { month: "Jul", score: 95 },
    { month: "Aug", score: 94 },
    { month: "Sep", score: 96 },
    { month: "Oct", score: 95 },
    { month: "Nov", score: 94 },
    { month: "Dec", score: 94 },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to="/fleet/drivers" className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              Drivers
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{driverData.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Header with ROI Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-2 font-display-semibold text-foreground">
            {driverData.name}
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            Driver Digital Twin — performance, profit, and behaviour insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-success/10 text-success border-success/20 px-3 py-1">
            {driverData.status}
          </Badge>
          <Badge className="bg-gradient-to-r from-brand-500 to-brand-300 text-white border-0 px-4 py-2 text-body font-body-medium">
            Driver ROI Score: {driverData.roiScore}
          </Badge>
        </div>
      </div>

      {/* Tabbed Interface */}
      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="summary" className="gap-2">
            <Activity className="w-4 h-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="profitability" className="gap-2">
            <DollarSign className="w-4 h-4" />
            Profitability
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="coaching" className="gap-2">
            <Target className="w-4 h-4" />
            Coaching
          </TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spider Chart */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-caption text-muted-foreground">
                  Performance vs Benchmarks
                </CardTitle>
                <p className="text-caption text-muted-foreground mt-1">
                  Comparing driver performance against lane and fleet averages
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={spiderData}>
                      <PolarGrid 
                        stroke="hsl(var(--border))" 
                        strokeWidth={1}
                        strokeDasharray="3 3"
                      />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{ 
                          fill: "hsl(var(--foreground))", 
                          fontSize: 13,
                          fontWeight: 500 
                        }}
                      />
                      <PolarRadiusAxis 
                        angle={90} 
                        domain={[0, 100]} 
                        tick={{ 
                          fill: "hsl(var(--muted-foreground))", 
                          fontSize: 11 
                        }}
                        tickCount={6}
                      />
                      <Radar
                        name="Driver"
                        dataKey="driver"
                        stroke="hsl(var(--brand-500))"
                        fill="hsl(var(--brand-500))"
                        fillOpacity={0.5}
                        strokeWidth={3}
                      />
                      <Radar
                        name="Lane Avg"
                        dataKey="laneAvg"
                        stroke="hsl(var(--success))"
                        fill="hsl(var(--success))"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                      <Radar
                        name="Fleet Avg"
                        dataKey="fleetAvg"
                        stroke="hsl(var(--muted-foreground))"
                        fill="hsl(var(--muted-foreground))"
                        fillOpacity={0.1}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: "20px" }}
                        iconType="line"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          padding: "12px",
                        }}
                        labelStyle={{
                          color: "hsl(var(--foreground))",
                          fontWeight: 600,
                          marginBottom: "4px"
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Key Metrics */}
            <div className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-caption text-muted-foreground">
                    Current Assignment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-caption text-muted-foreground">Driver ID</span>
                    <span className="text-body font-body-medium text-foreground font-mono">
                      {driverData.id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-caption text-muted-foreground">Vehicle</span>
                    <span className="text-body font-body-medium text-foreground font-mono">
                      {driverData.vehicle}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-caption text-muted-foreground">Status</span>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                      {driverData.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-caption text-muted-foreground">
                    Key Performance Scores
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-caption text-muted-foreground">On-Time %</span>
                    <span className="text-body font-body-medium text-success text-tabular">
                      {driverData.onTimePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-caption text-muted-foreground">Safety Score</span>
                    <span className="text-body font-body-medium text-success text-tabular">
                      {driverData.safetyScore}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-caption text-muted-foreground">Fuel Efficiency</span>
                    <span className="text-body font-body-medium text-success text-tabular">
                      {driverData.fuelScore}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-caption text-muted-foreground">Avg. Margin</span>
                    <span className="text-body font-body-medium text-success text-tabular">
                      {formatCurrency(driverData.avgMargin)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* AI Summary Card */}
          <Card className="bg-gradient-to-r from-brand-500/10 to-brand-300/10 border-brand-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="bg-brand-500/20 p-2 rounded-lg">
                  <Sparkles className="w-4 h-4 text-brand-500" />
                </div>
                <div className="flex-1">
                  <div className="text-body font-body-medium text-foreground mb-2">AI Performance Summary</div>
                  <p className="text-caption text-foreground">
                    Driver performing <span className="font-body-medium text-success">8% above fleet average</span> on margin impact. 
                    Risk flagged: slightly rising idle time on N3 route (<span className="text-warning font-body-medium">+6%</span> vs last week).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profitability Tab */}
        <TabsContent value="profitability" className="space-y-6">
          {/* P&L Statement */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-muted-foreground flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Driver Profit & Loss (Last 12 Months)
              </CardTitle>
              <p className="text-caption text-muted-foreground mt-1">
                Total revenue generated vs costs attributed
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Total Revenue */}
                <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                  <div className="flex justify-between items-center">
                    <span className="text-body text-muted-foreground">Total Revenue Generated</span>
                    <span className="text-display-2 font-display-semibold text-success text-tabular">
                      {formatCurrency(pnlData.totalRevenue)}
                    </span>
                  </div>
                </div>

                {/* Costs Breakdown */}
                <div className="p-4 rounded-lg border border-border space-y-3">
                  <div className="text-body font-body-medium text-foreground mb-3">
                    Costs Attributed
                  </div>
                  {Object.entries(pnlData.costs).map(([category, amount]) => (
                    <div key={category} className="flex justify-between items-center">
                      <span className="text-caption text-muted-foreground capitalize">
                        {category}
                      </span>
                      <span className="text-body text-foreground text-tabular">
                        -{formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-border flex justify-between items-center">
                    <span className="text-body font-body-medium text-foreground">
                      Total Costs
                    </span>
                    <span className="text-body font-body-medium text-destructive text-tabular">
                      -{formatCurrency(Object.values(pnlData.costs).reduce((a, b) => a + b, 0))}
                    </span>
                  </div>
                </div>

                {/* Net Contribution */}
                <div className="p-4 rounded-lg bg-brand-500/10 border-2 border-brand-500/20">
                  <div className="flex justify-between items-center">
                    <span className="text-body font-body-medium text-foreground">Net Contribution</span>
                    <span className="text-display font-display-bold text-brand-500 text-tabular">
                      {formatCurrency(pnlData.netContribution)}
                    </span>
                  </div>
                  <p className="text-caption text-muted-foreground mt-2">
                    Profit margin: {((pnlData.netContribution / pnlData.totalRevenue) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue vs Cost Trend */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-muted-foreground flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Revenue vs Cost (Monthly Trend)
              </CardTitle>
              <p className="text-caption text-muted-foreground mt-1">
                12-month revenue generation and cost attribution
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                      tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: any) => [formatCurrency(value), ""]}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="cost" name="Cost" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* AI Margin Insight */}
              <Card className="mt-6 bg-gradient-to-r from-brand-500/10 to-brand-300/10 border-brand-500/20">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-brand-500/20 p-2 rounded-lg">
                      <Sparkles className="w-4 h-4 text-brand-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-body font-body-medium text-foreground mb-2">AI Margin Insight</div>
                      <p className="text-caption text-foreground">
                        Fuel costs are <span className="font-body-medium text-success">18% below lane average</span> — consistent eco-driving pattern. 
                        Estimated annual saving: <span className="font-body-medium text-success">{formatCurrency(14200)}</span>.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Profitability by Lane & Customer */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Profitability by Lane & Customer
              </CardTitle>
              <p className="text-caption text-muted-foreground mt-1">
                Where this driver generates the most margin
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={laneBenchmarks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="lane" 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                      tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: any) => [formatCurrency(value), "Avg Margin"]}
                    />
                    <Legend />
                    <Bar dataKey="avgMargin" name="Driver Avg Margin" radius={[8, 8, 0, 0]}>
                      {laneBenchmarks.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.avgMargin > entry.fleetAvgMargin ? "hsl(var(--success))" : "hsl(var(--warning))"}
                        />
                      ))}
                    </Bar>
                    <Bar 
                      dataKey="fleetAvgMargin" 
                      name="Fleet Avg" 
                      fill="hsl(var(--muted-foreground))"
                      fillOpacity={0.3}
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Lane performance grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {laneBenchmarks.map((lane, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-border hover:shadow-glow transition-smooth"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="text-body font-body-medium text-foreground">
                          {lane.lane}
                        </div>
                        <div className="text-caption text-muted-foreground">
                          {lane.trips} trips
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          lane.rank === 1
                            ? "bg-success/10 text-success border-success/20 text-xs"
                            : lane.rank <= 3
                            ? "bg-brand-500/10 text-brand-500 border-brand-500/20 text-xs"
                            : "bg-muted text-muted-foreground border-muted text-xs"
                        }
                      >
                        #{lane.rank}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-caption text-muted-foreground">Driver Avg</div>
                        <div className="text-body font-body-medium text-success text-tabular">
                          {formatCurrency(lane.avgMargin)}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <div className="text-caption text-success">
                          +{formatCurrency(lane.avgMargin - lane.fleetAvgMargin)}
                        </div>
                        <div className="text-xs text-muted-foreground">vs lane avg</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Performance Summary */}
          <Card className="bg-gradient-to-r from-brand-500/10 to-brand-300/10 border-brand-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="bg-brand-500/20 p-2 rounded-lg">
                  <Sparkles className="w-4 h-4 text-brand-500" />
                </div>
                <div className="flex-1">
                  <div className="text-body font-body-medium text-foreground mb-2">AI Performance Summary</div>
                  <p className="text-caption text-foreground">
                    Driver shows steady <span className="font-body-medium text-success">4-month improvement</span> in safety. 
                    Minor regression in July tied to route congestion on DBN–JHB corridor.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          {/* Performance Activity Heatmap */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-muted-foreground flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Performance Activity (Last 12 Months)
              </CardTitle>
              <p className="text-caption text-muted-foreground mt-1">
                Daily performance score - Darker green indicates better performance
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Month Labels */}
                <div className="flex justify-between text-xs text-muted-foreground pl-16">
                  {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, idx) => (
                    <span key={idx} className="w-[7.5%] text-center">{month}</span>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  {/* Day Labels */}
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground pt-1">
                    {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((day, idx) => (
                      <div key={idx} className="h-3 flex items-center">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Heatmap Grid */}
                  <div className="flex-1 overflow-x-auto pb-2">
                    <div className="inline-flex gap-1">
                      {Array.from({ length: 52 }, (_, weekIndex) => (
                        <div key={weekIndex} className="flex flex-col gap-1">
                          {Array.from({ length: 7 }, (_, dayIndex) => {
                            const dataPoint = activityData.find(
                              (d) => d.week === weekIndex && d.day === dayIndex
                            );
                            const date = new Date(dataPoint?.date || "");
                            return (
                              <div
                                key={`${weekIndex}-${dayIndex}`}
                                className={`w-3 h-3 rounded-sm ${getActivityColor(
                                  dataPoint?.value || 0
                                )} hover:ring-2 hover:ring-brand-500 transition-all cursor-pointer group relative`}
                                title={`${date.toLocaleDateString()}: ${dataPoint?.value}% performance`}
                              >
                                <div className="hidden group-hover:block absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-modal whitespace-nowrap">
                                  <div className="text-xs font-medium text-foreground">
                                    {date.toLocaleDateString("en-US", { 
                                      weekday: "short", 
                                      month: "short", 
                                      day: "numeric" 
                                    })}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Performance: {dataPoint?.value}%
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Less</span>
                    <div className="flex gap-1">
                      <div className="w-3 h-3 rounded-sm bg-muted" />
                      <div className="w-3 h-3 rounded-sm bg-success/20" />
                      <div className="w-3 h-3 rounded-sm bg-success/40" />
                      <div className="w-3 h-3 rounded-sm bg-success/60" />
                      <div className="w-3 h-3 rounded-sm bg-success" />
                    </div>
                    <span>More</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total trips: {activityData.filter(d => d.value > 0).length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trend Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fuel Efficiency Trend */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-caption text-muted-foreground">
                  Fuel Efficiency Over Time
                </CardTitle>
                <p className="text-caption text-muted-foreground mt-1">
                  Monthly fuel efficiency score trend
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fuelTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                        domain={[80, 100]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="efficiency" 
                        stroke="hsl(var(--brand-500))" 
                        strokeWidth={3}
                        dot={{ fill: "hsl(var(--brand-500))", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Safety Score Trend */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-caption text-muted-foreground">
                  Safety Score Over Time
                </CardTitle>
                <p className="text-caption text-muted-foreground mt-1">
                  Monthly safety score trend
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={safetyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                        domain={[80, 100]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="hsl(var(--success))" 
                        strokeWidth={3}
                        dot={{ fill: "hsl(var(--success))", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Coaching Tab */}
        <TabsContent value="coaching" className="space-y-6">
          {/* Business Impact Cards */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-muted-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Business Impact Analysis
              </CardTitle>
              <p className="text-caption text-muted-foreground mt-1">
                AI-generated insights showing direct cost and savings impact
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {businessImpacts.map((impact, idx) => (
                  <div
                    key={idx}
                    className={`p-6 rounded-lg border-2 ${
                      impact.type === "cost"
                        ? "border-destructive/20 bg-destructive/5"
                        : "border-success/20 bg-success/5"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="text-body font-body-medium text-foreground mb-1">
                          {impact.title}
                        </div>
                        <div
                          className={`text-display font-display-bold text-tabular ${
                            impact.type === "cost" ? "text-destructive" : "text-success"
                          }`}
                        >
                          {impact.type === "cost" ? "-" : "+"}
                          {formatCurrency(impact.amount)}
                          <span className="text-caption text-muted-foreground ml-1">
                            /{impact.period}
                          </span>
                        </div>
                      </div>
                      {impact.type === "cost" ? (
                        <TrendingDown className="w-6 h-6 text-destructive" />
                      ) : (
                        <TrendingUp className="w-6 h-6 text-success" />
                      )}
                    </div>
                    <p className="text-caption text-foreground mb-3">{impact.description}</p>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border mb-3">
                      <div className="text-xs text-muted-foreground">Evidence</div>
                      <div className="text-caption text-foreground mt-1">{impact.evidence}</div>
                    </div>
                    <Button
                      size="sm"
                      variant={impact.type === "cost" ? "destructive" : "default"}
                      className="w-full"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {impact.action}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Predictive Alerts */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Predictive Alerts
              </CardTitle>
              <p className="text-caption text-muted-foreground mt-1">
                AI forecasting of performance trends and optimization opportunities
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {predictiveAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 ${
                      alert.risk === "high"
                        ? "border-destructive/20 bg-destructive/5"
                        : alert.risk === "medium"
                        ? "border-warning/20 bg-warning/5"
                        : "border-brand-500/20 bg-brand-500/5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                          alert.risk === "high"
                            ? "text-destructive"
                            : alert.risk === "medium"
                            ? "text-warning"
                            : "text-brand-500"
                        }`}
                      />
                      <div className="flex-1 space-y-2">
                        <div>
                          <div className="text-body font-body-medium text-foreground">
                            {alert.alert}
                          </div>
                          <div className="text-caption text-muted-foreground mt-1">
                            {alert.description}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-caption text-foreground">{alert.impact}</div>
                          <Badge
                            variant="outline"
                            className="bg-muted/50 text-muted-foreground border-border"
                          >
                            {alert.probability}% confidence
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Profit Opportunity Feed */}
          <Card className="bg-gradient-to-br from-success/10 to-brand-500/10 border-success/20">
            <CardHeader>
              <CardTitle className="text-success flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4" />
                Profit Opportunities
              </CardTitle>
              <p className="text-caption text-muted-foreground mt-1">
                AI-suggested actions to maximize this driver's contribution
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {profitOpportunities.map((opp, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-border bg-card hover:shadow-glow transition-smooth"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="text-body font-body-medium text-foreground">
                          {opp.opportunity}
                        </div>
                        <div className="text-display-2 font-display-semibold text-success text-tabular mt-1">
                          +{formatCurrency(opp.uplift)}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-success/10 text-success border-success/20"
                      >
                        {opp.confidence}% confidence
                      </Badge>
                    </div>
                    <p className="text-caption text-muted-foreground">{opp.reasoning}</p>
                    <Button size="sm" className="w-full mt-3 bg-brand-500 hover:bg-brand-700">
                      <Target className="w-4 h-4 mr-2" />
                      Take Action
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Coaching Opportunities */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4" />
                AI Coaching Opportunities
              </CardTitle>
              <p className="text-caption text-muted-foreground mt-1">
                Detailed coaching recommendations with savings potential
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {coachingInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="p-4 rounded-lg border border-border space-y-3 hover:shadow-glow transition-smooth"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <AlertTriangle
                          className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                            insight.severity === "high"
                              ? "text-destructive"
                              : insight.severity === "medium"
                              ? "text-warning"
                              : "text-muted-foreground"
                          }`}
                        />
                        <div className="flex-1">
                          <div className="text-body font-body-medium text-foreground">
                            {insight.issue}
                          </div>
                          <div className="text-caption text-muted-foreground">
                            {insight.location} • {insight.frequency}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-body font-body-medium text-success text-tabular">
                          {formatCurrency(insight.impact)}
                        </div>
                        <div className="text-caption text-muted-foreground">
                          savings
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-caption text-foreground line-clamp-2">{insight.recommendation}</p>
                    </div>
                    <Button size="sm" className="w-full bg-brand-500 hover:bg-brand-700">
                      <FileText className="w-4 h-4 mr-2" />
                      Generate Report
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* AI Copilot */}
      <DriverAICopilot />
    </div>
  );
}
