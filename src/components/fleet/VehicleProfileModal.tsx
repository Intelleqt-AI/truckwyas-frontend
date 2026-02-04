import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { Wrench, TrendingUp, MapPin, Clock, AlertTriangle } from "lucide-react";

interface VehicleProfileModalProps {
  vehicleId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function VehicleProfileModal({ vehicleId, isOpen, onClose }: VehicleProfileModalProps) {
  // Mock vehicle data
  const vehicleData = {
    id: vehicleId,
    driver: "John Smith",
    status: "En Route",
    costPerKm: 4.25,
    avgMargin: 22500,
    fuelEfficiency: 6.8,
    uptime: 94.2,
  };

  // Spider chart data comparing vehicle vs fleet average
  const spiderData = [
    {
      metric: "Fuel Efficiency",
      vehicle: 92,
      fleetAvg: 85,
    },
    {
      metric: "Uptime",
      vehicle: 94,
      fleetAvg: 88,
    },
    {
      metric: "Margin",
      vehicle: 88,
      fleetAvg: 82,
    },
    {
      metric: "Compliance",
      vehicle: 98,
      fleetAvg: 95,
    },
    {
      metric: "On-Time",
      vehicle: 91,
      fleetAvg: 87,
    },
  ];

  // Best/worst lanes
  const laneAnalysis = [
    { lane: "JHB-CPT", trips: 24, avgMargin: 28500, status: "best" },
    { lane: "DBN-PE", trips: 18, avgMargin: 24200, status: "best" },
    { lane: "JHB-DBN", trips: 15, avgMargin: 18900, status: "average" },
    { lane: "CPT-PE", trips: 12, avgMargin: 14200, status: "worst" },
  ];

  // Maintenance predictions
  const maintenancePredictions = [
    {
      component: "Brake Pads",
      daysUntilService: 12,
      confidence: 94,
      costImpact: 4500,
      severity: "medium",
    },
    {
      component: "Oil Change",
      daysUntilService: 8,
      confidence: 98,
      costImpact: 1200,
      severity: "low",
    },
    {
      component: "Tire Replacement",
      daysUntilService: 45,
      confidence: 87,
      costImpact: 18000,
      severity: "high",
    },
  ];

  // Trip DNA (last 5 trips)
  const tripDNA = [
    {
      id: "TRIP-1234",
      route: "JHB-CPT",
      date: "2025-03-28",
      duration: "14.5h",
      delays: [
        { type: "Border Hold", duration: "2.3h", location: "Beitbridge" },
        { type: "Traffic", duration: "0.8h", location: "N1 Beaufort West" },
      ],
      idleTime: "1.2h",
      status: "completed",
    },
    {
      id: "TRIP-1201",
      route: "CPT-JHB",
      date: "2025-03-26",
      duration: "13.8h",
      delays: [{ type: "Loading Delay", duration: "1.5h", location: "Cape Town Depot" }],
      idleTime: "0.5h",
      status: "completed",
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-display-2 font-display-semibold text-foreground flex items-center gap-3">
            {vehicleId} Digital Twin
          </DialogTitle>
          <p className="text-caption text-muted-foreground">
            Performance analysis and predictive insights
          </p>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="profitability">Profitability</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="trips">Trip DNA</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Spider Chart */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-caption text-muted-foreground">
                    Performance vs Fleet Average
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={spiderData}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis
                          dataKey="metric"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Radar
                          name={vehicleId}
                          dataKey="vehicle"
                          stroke="hsl(var(--brand-500))"
                          fill="hsl(var(--brand-500))"
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
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
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
                      <span className="text-caption text-muted-foreground">Driver</span>
                      <span className="text-body font-body-medium text-foreground">
                        {vehicleData.driver}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-caption text-muted-foreground">Status</span>
                      <Badge
                        variant="outline"
                        className="bg-success/10 text-success border-success/20"
                      >
                        {vehicleData.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-caption text-muted-foreground">
                      Performance Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-caption text-muted-foreground">Cost per KM</span>
                      <span className="text-body font-body-medium text-foreground text-tabular">
                        R {vehicleData.costPerKm.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-caption text-muted-foreground">Avg. Margin</span>
                      <span className="text-body font-body-medium text-success text-tabular">
                        {formatCurrency(vehicleData.avgMargin)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-caption text-muted-foreground">Fuel Efficiency</span>
                      <span className="text-body font-body-medium text-foreground text-tabular">
                        {vehicleData.fuelEfficiency}L/100km
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-caption text-muted-foreground">Uptime</span>
                      <span className="text-body font-body-medium text-success text-tabular">
                        {vehicleData.uptime}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Profitability Tab */}
          <TabsContent value="profitability" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Lane Performance Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {laneAnalysis.map((lane, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:shadow-glow transition-smooth"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="text-body font-body-medium text-foreground">
                            {lane.lane}
                          </div>
                          <div className="text-caption text-muted-foreground">
                            {lane.trips} trips
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-body font-body-medium text-tabular text-foreground">
                            {formatCurrency(lane.avgMargin)}
                          </div>
                          <div className="text-caption text-muted-foreground">avg margin</div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            lane.status === "best"
                              ? "bg-success/10 text-success border-success/20"
                              : lane.status === "worst"
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : "bg-muted text-muted-foreground border-muted"
                          }
                        >
                          {lane.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-muted-foreground flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  AI Maintenance Predictor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {maintenancePredictions.map((pred, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between p-4 rounded-lg border border-border hover:shadow-glow transition-smooth"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <AlertTriangle
                          className={`w-5 h-5 mt-0.5 ${
                            pred.severity === "high"
                              ? "text-destructive"
                              : pred.severity === "medium"
                              ? "text-warning"
                              : "text-muted-foreground"
                          }`}
                        />
                        <div className="flex-1">
                          <div className="text-body font-body-medium text-foreground">
                            {pred.component}
                          </div>
                          <div className="text-caption text-muted-foreground">
                            Service due in {pred.daysUntilService} days
                          </div>
                          <Badge
                            variant="outline"
                            className="mt-2 bg-brand-500/10 text-brand-500 border-brand-500/20"
                          >
                            {pred.confidence}% confident
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-body font-body-medium text-destructive text-tabular">
                          {formatCurrency(pred.costImpact)}
                        </div>
                        <div className="text-caption text-muted-foreground">est. cost</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trip DNA Tab */}
          <TabsContent value="trips" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Trip History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tripDNA.map((trip, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg border border-border space-y-3 hover:shadow-glow transition-smooth"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-body font-body-medium text-foreground font-mono">
                            {trip.id}
                          </div>
                          <div className="text-caption text-muted-foreground">{trip.route}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-body font-body-medium text-foreground">
                            {trip.duration}
                          </div>
                          <div className="text-caption text-muted-foreground">{trip.date}</div>
                        </div>
                      </div>

                      {trip.delays.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-caption text-muted-foreground font-body-medium">
                            Delays:
                          </div>
                          {trip.delays.map((delay, delayIdx) => (
                            <div
                              key={delayIdx}
                              className="flex items-center justify-between p-2 rounded bg-warning/5 border border-warning/20"
                            >
                              <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3 text-warning" />
                                <span className="text-caption text-foreground">
                                  {delay.type}
                                </span>
                                <span className="text-caption text-muted-foreground">
                                  at {delay.location}
                                </span>
                              </div>
                              <span className="text-caption font-body-medium text-warning">
                                {delay.duration}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="text-caption text-muted-foreground">
                          Idle time: <span className="text-foreground">{trip.idleTime}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-success/10 text-success border-success/20"
                        >
                          {trip.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
