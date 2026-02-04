import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertTriangle,
  Clock,
  Zap,
  FileText,
  Activity,
  DollarSign,
  TrendingUp,
  Wrench,
  CheckCircle,
  Calendar,
  MapPin,
  Truck
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  Cell,
} from "recharts";
import useFetch from "@/hooks/useFetch";

export default function VehicleDigitalTwin() {
  const { id } = useParams<{ id: string }>();

  const { data: vehicleData, isLoading: vehicleLoading } = useFetch(`api/vehicles/${id}`, { enabled: !!id });

  // Mock vehicle data - in real app, fetch based on id
  // Use fetched data or fallback to defaults if loading/error
  const vehicle = {
    id: vehicleData?.plate || vehicleData?.vin || id || "Unknown",
    driver: "Unassigned", // API doesn't provide driver yet
    status: vehicleData?.status || "Unknown",
    costPerKm: parseFloat(vehicleData?.cost_per_km || "0"),
    marginPerKm: 0, // Not directly in API, maybe calculate or leave 0
    tripsThisMonth: 0, // Not in API
    activeDays: 0, // Not in API
    uptime: parseFloat(vehicleData?.uptime_percentage || "0"),
    avgMargin: parseFloat(vehicleData?.margin_per_trip || "0"),
    totalRevenue: 0, // Not in API
    totalCosts: 0, // Not in API
    netMargin: 0, // Not in API
    fuelEfficiency: vehicleData?.fuel_efficiency_score || 0,
    aiScore: vehicleData?.ai_health_score || 0,
    license: vehicleData?.registration_expiry || "N/A",
    cof: "N/A", // Not in API
    nextServiceDue: vehicleData?.next_maintenance_due || "N/A",
    nextServiceKm: 0, // Not in API
    lastServiceCost: 0, // Not in API
    insuranceExpiry: vehicleData?.insurance_expiry || "N/A",
  };

  // Performance radar chart data
  const radarData = [
    { metric: "Cost Efficiency", vehicle: 85, fleet: 70 },
    { metric: "Margin", vehicle: 92, fleet: 75 },
    { metric: "Fuel", vehicle: 78, fleet: 68 },
    { metric: "Uptime", vehicle: 94, fleet: 80 },
    { metric: "Safety", vehicle: 88, fleet: 82 },
    { metric: "Reliability", vehicle: 90, fleet: 77 },
  ];

  // Lane profitability data
  const laneProfitability = [
    { lane: "JHB-CPT", revenue: 125000, margin: 28000, marginPercent: 22.4 },
    { lane: "CPT-DBN", revenue: 98000, margin: 24500, marginPercent: 25.0 },
    { lane: "DBN-JHB", revenue: 87000, margin: 19140, marginPercent: 22.0 },
    { lane: "JHB-PLZ", revenue: 76000, margin: 15200, marginPercent: 20.0 },
    { lane: "PLZ-CPT", revenue: 64000, margin: 11520, marginPercent: 18.0 },
  ];

  // Fuel efficiency trend data (last 12 months)
  const fuelTrendData = [
    { month: "Feb '24", value: 7.2 },
    { month: "Mar '24", value: 7.1 },
    { month: "Apr '24", value: 6.9 },
    { month: "May '24", value: 7.0 },
    { month: "Jun '24", value: 6.8 },
    { month: "Jul '24", value: 6.7 },
    { month: "Aug '24", value: 6.9 },
    { month: "Sep '24", value: 6.8 },
    { month: "Oct '24", value: 6.7 },
    { month: "Nov '24", value: 6.8 },
    { month: "Dec '24", value: 6.9 },
    { month: "Jan '25", value: 6.8 },
  ];

  // Safety score trend data
  const safetyTrendData = [
    { month: "Feb '24", score: 82 },
    { month: "Mar '24", score: 84 },
    { month: "Apr '24", score: 85 },
    { month: "May '24", score: 87 },
    { month: "Jun '24", score: 86 },
    { month: "Jul '24", score: 88 },
    { month: "Aug '24", score: 87 },
    { month: "Sep '24", score: 89 },
    { month: "Oct '24", score: 88 },
    { month: "Nov '24", score: 90 },
    { month: "Dec '24", score: 89 },
    { month: "Jan '25", score: 88 },
  ];

  // Activity heatmap data (simplified as bar chart for activity levels)
  const activityData = [
    { month: "Feb", trips: 18, utilization: 85 },
    { month: "Mar", trips: 22, utilization: 92 },
    { month: "Apr", trips: 20, utilization: 88 },
    { month: "May", trips: 24, utilization: 95 },
    { month: "Jun", trips: 21, utilization: 90 },
    { month: "Jul", trips: 23, utilization: 94 },
    { month: "Aug", trips: 19, utilization: 87 },
    { month: "Sep", trips: 25, utilization: 96 },
    { month: "Oct", trips: 22, utilization: 91 },
    { month: "Nov", trips: 24, utilization: 93 },
    { month: "Dec", trips: 20, utilization: 89 },
    { month: "Jan", trips: 23, utilization: 94 },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "En Route":
        return "bg-success/10 text-success border-success/20";
      case "Loading":
        return "bg-warning/10 text-warning border-warning/20";
      case "Maintenance":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "Idle":
        return "bg-muted text-muted-foreground border-muted";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to="/fleet" className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Fleet
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink to="/fleet/vehicles">Vehicles</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{vehicle.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Header with Vehicle Details */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-display-2 font-display-semibold text-foreground">
            Vehicle {vehicle.id}
          </h1>
          <p className="text-body text-muted-foreground">
            Driven by {vehicle.driver}
          </p>
        </div>
        <Badge className="bg-gradient-to-r from-brand-500 to-brand-300 text-white border-0 px-4 py-2 text-body font-body-medium">
          <Zap className="w-4 h-4 mr-1" />
          AI Score: {vehicle.aiScore}/100
        </Badge>
      </div>

      {/* AI Summary Bar */}
      <Card className="bg-gradient-to-r from-brand-500/5 to-brand-300/5 border-brand-500/20">
        <CardContent className="p-3">
          <p className="text-body text-foreground">
            <span className="font-body-medium">This vehicle delivers +R 2,300/day net profit.</span> Efficiency 12% above fleet average.
            Strong performance on coastal routes.
          </p>
        </CardContent>
      </Card>

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
          <TabsTrigger value="maintenance" className="gap-2">
            <Wrench className="w-4 h-4" />
            Maintenance & Compliance
          </TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-6">
          {/* Mini KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="text-caption text-muted-foreground">Margin per KM</div>
                <div className="text-display-3 font-display-semibold text-success text-tabular">
                  R {vehicle.marginPerKm}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="text-caption text-muted-foreground">Trips This Month</div>
                <div className="text-display-3 font-display-semibold text-foreground text-tabular">
                  {vehicle.tripsThisMonth}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="text-caption text-muted-foreground">Active Days</div>
                <div className="text-display-3 font-display-semibold text-foreground text-tabular">
                  {vehicle.activeDays}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="text-caption text-muted-foreground">Uptime</div>
                <div className="text-display-3 font-display-semibold text-success text-tabular">
                  {vehicle.uptime}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profit vs Cost Breakdown */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-body font-body-medium text-foreground">
                Profit vs Cost Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Revenue</span>
                  <span className="text-body font-body-medium text-foreground text-tabular">
                    {formatCurrency(vehicle.totalRevenue)}
                  </span>
                </div>
                <div className="relative h-8 bg-muted rounded-lg overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-brand-500"
                    style={{ width: `${(vehicle.totalRevenue / vehicle.totalRevenue) * 100}%` }}
                  />
                  <div
                    className="absolute left-0 top-0 h-full bg-destructive/60"
                    style={{ width: `${(vehicle.totalCosts / vehicle.totalRevenue) * 100}%` }}
                  />
                  <div
                    className="absolute left-0 top-0 h-full bg-success"
                    style={{ width: `${(vehicle.netMargin / vehicle.totalRevenue) * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-caption text-muted-foreground">Revenue</div>
                    <div className="text-body font-body-medium text-brand-500 text-tabular">
                      {formatCurrency(vehicle.totalRevenue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-caption text-muted-foreground">Costs</div>
                    <div className="text-body font-body-medium text-destructive text-tabular">
                      {formatCurrency(vehicle.totalCosts)}
                    </div>
                  </div>
                  <div>
                    <div className="text-caption text-muted-foreground">Net Margin</div>
                    <div className="text-body font-body-medium text-success text-tabular">
                      {formatCurrency(vehicle.netMargin)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1">
              <FileText className="w-4 h-4 mr-2" />
              View Maintenance Log
            </Button>
            <Button variant="outline" className="flex-1">
              <MapPin className="w-4 h-4 mr-2" />
              View Trip History
            </Button>
          </div>

          {/* Performance vs Fleet */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-body font-body-medium text-foreground">
                Performance vs Fleet Average
              </CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Radar
                    name="This Vehicle"
                    dataKey="vehicle"
                    stroke="hsl(var(--brand-500))"
                    fill="hsl(var(--brand-500))"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name="Fleet Average"
                    dataKey="fleet"
                    stroke="hsl(var(--muted-foreground))"
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity={0.1}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profitability Tab */}
        <TabsContent value="profitability" className="space-y-6">
          {/* Revenue vs Cost Chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-body font-body-medium text-foreground">
                Revenue vs Cost (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fuelTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Daily Net Profit"
                    stroke="hsl(var(--brand-500))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--brand-500))", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Routes & Clients */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-body font-body-medium text-foreground">
                Top 5 Profitable Routes
              </CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={laneProfitability}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="lane"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    label={{ value: "Margin (R)", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`R ${value.toLocaleString()}`, "Margin"]}
                  />
                  <Bar dataKey="margin" radius={[4, 4, 0, 0]}>
                    {laneProfitability.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.marginPercent >= 22 ? "hsl(var(--success-500))" : "hsl(var(--warn-500))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* AI Margin Insight */}
          <Card className="bg-gradient-to-r from-brand-500/5 to-brand-300/5 border-brand-500/20">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Zap className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-body font-body-medium text-foreground mb-1">AI Margin Insight</h4>
                  <p className="text-body text-muted-foreground">
                    Higher margins on DBN → JHB lane (+R 1,200/trip). Underperforming on N4 Route (−R 850/trip).
                    <span className="text-brand-500 font-body-medium"> Suggest reassignment.</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          {/* Activity Heatmap */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-body font-body-medium text-foreground">
                Performance Activity (Last 12 Months)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    label={{ value: "Trips", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    label={{ value: "Utilization %", angle: 90, position: "insideRight", fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar yAxisId="left" dataKey="trips" fill="hsl(var(--brand-500))" radius={[4, 4, 0, 0]} name="Trips" />
                  <Bar yAxisId="right" dataKey="utilization" fill="hsl(var(--brand-300))" radius={[4, 4, 0, 0]} name="Utilization %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Trend Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-body font-body-medium text-foreground">
                  Fuel Efficiency Over Time
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fuelTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <YAxis
                      domain={[6.5, 7.5]}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      label={{ value: "L/100km", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)} L/100km`, "Fuel Efficiency"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--brand-500))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--brand-500))", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-body font-body-medium text-foreground">
                  Safety Score Over Time
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={safetyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <YAxis
                      domain={[75, 95]}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      label={{ value: "Safety Score", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [value, "Safety Score"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--success-500))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--success-500))", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Maintenance & Compliance Tab */}
        <TabsContent value="maintenance" className="space-y-6">
          {/* Service Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <Calendar className="w-5 h-5 text-warning" />
                </div>
                <div className="text-caption text-muted-foreground">Next Service Due</div>
                <div className="text-body-large font-body-medium text-foreground">
                  {vehicle.nextServiceDue}
                </div>
                <div className="text-caption text-muted-foreground mt-1">
                  {vehicle.nextServiceKm} km remaining
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <Wrench className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="text-caption text-muted-foreground">Last Service Cost</div>
                <div className="text-body-large font-body-medium text-foreground text-tabular">
                  {formatCurrency(vehicle.lastServiceCost)}
                </div>
                <div className="text-caption text-muted-foreground mt-1">
                  Brake Pads + Oil Change
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-brand-500/5 to-brand-300/5 border-brand-500/20">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <Zap className="w-5 h-5 text-brand-500" />
                </div>
                <div className="text-caption text-muted-foreground">Predictive AI</div>
                <div className="text-body font-body-medium text-foreground">
                  Early Service Saves
                </div>
                <div className="text-caption text-brand-500 mt-1 font-body-medium">
                  Prevent R 5,600 downtime
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Compliance Status */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-body font-body-medium text-foreground">
                Compliance Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <div className="text-body font-body-medium text-foreground">Certificate of Fitness (COF)</div>
                      <div className="text-caption text-muted-foreground">Valid until {vehicle.cof}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    Valid
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <div className="text-body font-body-medium text-foreground">License Disc</div>
                      <div className="text-caption text-muted-foreground">Valid until {vehicle.license}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    Valid
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    <div>
                      <div className="text-body font-body-medium text-foreground">Insurance</div>
                      <div className="text-caption text-muted-foreground">Expires {vehicle.insuranceExpiry}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                    Expiring Soon
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button variant="outline" className="h-auto p-4 flex-col items-start">
              <Calendar className="w-5 h-5 mb-2" />
              <span className="font-body-medium">Reschedule Service</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex-col items-start">
              <FileText className="w-5 h-5 mb-2" />
              <span className="font-body-medium">Upload Proof</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex-col items-start">
              <Activity className="w-5 h-5 mb-2" />
              <span className="font-body-medium">View History</span>
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Maintenance Section */}
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-body font-body-medium text-foreground flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Service History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { date: "2025-02-15", type: "Routine Service", cost: 4200 },
                      { date: "2024-11-20", type: "Brake Replacement", cost: 6500 },
                      { date: "2024-08-10", type: "Routine Service", cost: 3800 },
                    ].map((service, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <div className="text-body font-body-medium text-foreground">{service.type}</div>
                          <div className="text-caption text-muted-foreground">{service.date}</div>
                        </div>
                        <div className="text-body text-foreground text-tabular">
                          {formatCurrency(service.cost)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border border-warning/50">
                <CardHeader>
                  <CardTitle className="text-body font-body-medium text-warning flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    AI Predictive Maintenance Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 bg-warning/10 rounded-lg">
                      <div className="text-body font-body-medium text-foreground">Brake pad wear detected</div>
                      <div className="text-caption text-muted-foreground mt-1">
                        Predicted service needed in ~2,400km
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Compliance Section */}
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-body font-body-medium text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Compliance Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-body font-body-medium text-foreground">Vehicle License</div>
                        <Badge className="bg-success/10 text-success border-success/20">Valid</Badge>
                      </div>
                      <div className="text-caption text-muted-foreground">
                        Expires: {vehicle.license}
                      </div>
                      <div className="text-caption text-success mt-1">
                        <Clock className="h-3 w-3 inline mr-1" />
                        10 months remaining
                      </div>
                    </div>

                    <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-body font-body-medium text-foreground">Certificate of Fitness (COF)</div>
                        <Badge className="bg-success/10 text-success border-success/20">Valid</Badge>
                      </div>
                      <div className="text-caption text-muted-foreground">
                        Expires: {vehicle.cof}
                      </div>
                      <div className="text-caption text-success mt-1">
                        <Clock className="h-3 w-3 inline mr-1" />
                        4 months remaining
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
