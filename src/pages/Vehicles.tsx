import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  ArrowUpDown,
  User,
  TrendingUp,
  TrendingDown,
  Zap,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";

import { AIOpportunitiesPanel } from "@/components/fleet/AIOpportunitiesPanel";
import { AICopilotButton } from "@/components/fleet/AICopilotButton";
import { AddVehicleModal } from "@/components/fleet/AddVehicleModal";
import useFetch from "@/hooks/useFetch";

interface Vehicle {
  id: number;
  vin: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  type: string;
  capacity: string;
  status: string;
  fuel_type: string;
  mileage: string;
  last_maintenance_date: string;
  next_maintenance_due: string;
  insurance_expiry: string;
  registration_expiry: string;
  ai_health_score: number;
  fuel_efficiency_score: number;
  uptime_score: number;
  maintenance_score: number;
  uptime_percentage: string;
  cost_per_km: string;
  margin_per_trip: string;
  driver_name?: string;
  vehicle_type_name?: string;
  created_at: string;
  updated_at: string;
}

const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case "AVAILABLE":
      return "bg-success/10 text-success border-success/20";
    case "MAINTENANCE":
      return "bg-warning/10 text-warning border-warning/20";
    case "IN_TRANSIT":
    case "EN ROUTE":
      return "bg-primary/10 text-primary border-primary/20";
    case "OUT_OF_SERVICE":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-muted";
  }
};

export default function Vehicles() {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<keyof Vehicle | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"vehicle" | "driver">("vehicle");

  const { data: vehiclesData, isLoading: vehiclesLoading, refetch } = useFetch("api/vehicles/");

  const vehicles: Vehicle[] = vehiclesData?.results || [];

  const handleSort = (field: keyof Vehicle) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedVehicles = [...vehicles].sort((a, b) => {
    if (!sortField) return 0;
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal === bVal) return 0;
    // Handle null/undefined
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    const direction = sortDirection === "asc" ? 1 : -1;
    return aVal > bVal ? direction : -direction;
  });

  // Calculations based on available data
  const avgMargin =
    vehicles.length > 0
      ? vehicles.reduce((sum, v) => sum + parseFloat(v.margin_per_trip || "0"), 0) / vehicles.length
      : 0;
  const avgCostPerKm =
    vehicles.length > 0
      ? vehicles.reduce((sum, v) => sum + parseFloat(v.cost_per_km || "0"), 0) / vehicles.length
      : 0;
  const avgAiScore =
    vehicles.length > 0
      ? vehicles.reduce((sum, v) => sum + (v.ai_health_score || 0), 0) / vehicles.length
      : 0;

  const getAiScoreBadge = (score: number) => {
    if (score === undefined || score === null) return "bg-muted text-muted-foreground border-muted";
    if (score >= 85) return "bg-success/10 text-success border-success/20";
    if (score >= 70) return "bg-warning/10 text-warning border-warning/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-1 font-display-semibold text-foreground">
            Fleet Profitability Overview
          </h1>
          <p className="text-body text-muted-foreground mt-0.5">
            AI-driven vehicle performance, efficiency, and profitability
            insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AddVehicleModal onSuccess={() => refetch()} />
          <Badge className="bg-success/10 text-success border-success/20">
            {vehicles.length} Active Vehicles
          </Badge>
        </div>
      </div>

      {/* AI Summary Bar */}
      <Card className="bg-gradient-to-r from-brand-500/5 to-brand-300/5 border-brand-500/20">
        <CardContent className="p-3">
          <p className="text-body text-foreground">
            <span className="font-body-medium">
              Fleet margin up 2.3% this month
            </span>{" "}
            driven by improved route pairing and fewer idling hours. 4 vehicles
            flagged for maintenance risk.
          </p>
        </CardContent>
      </Card>

      {/* Fleet Profitability Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border hover-lift transition-smooth">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="space-y-1">
                <div className="text-caption text-muted-foreground">
                  Total Active Vehicles
                </div>
                <div className="text-display-2 font-display-semibold text-foreground text-tabular">
                  {vehicles.length}
                </div>
              </div>
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <p className="text-caption text-muted-foreground">
              +5 vs last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover-lift transition-smooth">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="space-y-1">
                <div className="text-caption text-muted-foreground">
                  Avg Margin per Vehicle (MTD)
                </div>
                <div className="text-display-2 font-display-semibold text-foreground text-tabular">
                  {formatCurrency(avgMargin)}
                </div>
              </div>
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <p className="text-caption text-success">+12% improvement</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover-lift transition-smooth">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="space-y-1">
                <div className="text-caption text-muted-foreground">
                  Fleet Cost per KM
                </div>
                <div className="text-display-2 font-display-semibold text-foreground text-tabular">
                  R {avgCostPerKm.toFixed(2)}
                </div>
              </div>
              <TrendingDown className="w-4 h-4 text-destructive" />
            </div>
            <p className="text-caption text-muted-foreground">
              vs Target R 20.0
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover-lift transition-smooth">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="space-y-1">
                <div className="text-caption text-muted-foreground">
                  AI Health Score
                </div>
                <div className="text-display-2 font-display-semibold text-brand-500 text-tabular">
                  {avgAiScore.toFixed(0)}/100
                </div>
              </div>
              <Zap className="w-4 h-4 text-brand-500" />
            </div>
            <p className="text-caption text-muted-foreground">
              Based on fuel, uptime, & maintenance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Insights Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-body-large font-body-medium text-foreground">
            Vehicle Insights
          </h2>
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1">
            <Button
              variant={viewMode === "vehicle" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("vehicle")}
              className="h-8 px-3 text-xs">
              <Truck className="w-3.5 h-3.5 mr-1.5" />
              By Vehicle
            </Button>
            <Button
              variant={viewMode === "driver" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("driver")}
              className="h-8 px-3 text-xs">
              <User className="w-3.5 h-3.5 mr-1.5" />
              By Driver
            </Button>
          </div>
        </div>

        <Card className="bg-card border-border overflow-hidden w-full">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full">
                {/* <colgroup>
                  <col style={{ width: 180 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 100 }} />
                </colgroup> */}
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-muted-foreground">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("plate")}
                        className="flex items-center gap-1 hover:text-foreground ">
                        Vehicle
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Driver
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="text-muted-foreground text-left">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("margin_per_trip")}
                        className="flex items-center gap-1 hover:text-foreground ml-auto">
                        Margin per Trip
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-muted-foreground text-left">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("cost_per_km")}
                        className="flex items-center gap-1 hover:text-foreground ml-auto">
                        Cost per KM
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-muted-foreground text-left">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("uptime_percentage")}
                        className="flex items-center gap-1 hover:text-foreground ml-auto">
                        Uptime
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-muted-foreground text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("ai_health_score")}
                        className="flex items-center gap-1 hover:text-foreground mx-auto">
                        AI Score
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehiclesLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        Loading vehicles...
                      </TableCell>
                    </TableRow>
                  ) : sortedVehicles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        No vehicles found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedVehicles.map((vehicle) => (
                      <TableRow
                        key={vehicle.id}
                        className="cursor-pointer hover:bg-muted/50 transition-smooth"
                        onClick={() => navigate(`/fleet/vehicles/${vehicle.id}`)}>
                        <TableCell className="font-mono text-foreground font-medium">
                          <div>
                            <p>{vehicle.plate || vehicle.vin || vehicle.id}</p>
                            <p className="text-caption text-muted-foreground font-sans">{vehicle.vehicle_type_name || vehicle.type}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">
                          {vehicle.driver_name || "Unassigned"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getStatusColor(vehicle.status)}>
                            {vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1).toLowerCase().replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left text-tabular">
                          <span
                            className={
                              parseFloat(vehicle.margin_per_trip) > avgMargin
                                ? "text-success font-body-medium pl-3"
                                : parseFloat(vehicle.margin_per_trip) < avgMargin * 0.8
                                  ? "text-destructive pl-3"
                                  : "text-foreground pl-3"
                            }>
                            {formatCurrency(parseFloat(vehicle.margin_per_trip))}
                          </span>
                        </TableCell>
                        <TableCell className="text-left text-tabular">
                          <span
                            className={
                              parseFloat(vehicle.cost_per_km) < avgCostPerKm
                                ? "text-success pl-3"
                                : parseFloat(vehicle.cost_per_km) > avgCostPerKm * 1.1
                                  ? "text-destructive pl-3"
                                  : "text-foreground pl-3"
                            }>
                            R {parseFloat(vehicle.cost_per_km).toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-left text-tabular">
                          <span
                            className={
                              parseFloat(vehicle.uptime_percentage) >= 90
                                ? "text-success pl-3"
                                : parseFloat(vehicle.uptime_percentage) >= 80
                                  ? "text-warning pl-3"
                                  : "text-destructive pl-3"
                            }>
                            {parseFloat(vehicle.uptime_percentage).toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={getAiScoreBadge(vehicle.ai_health_score)}>
                            {vehicle.ai_health_score}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30 border-border">
          <CardContent className="p-3">
            <p className="text-body text-muted-foreground">
              Top 3 vehicles generate 32% of fleet profit. 4 vehicles
              underperform with negative margins.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Opportunities & Risks */}
      <AIOpportunitiesPanel />

      {/* AI Copilot Button */}
      <AICopilotButton />
    </div>
  );
}
