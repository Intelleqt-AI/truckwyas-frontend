import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowUpDown, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { DriverAICopilot } from "@/components/fleet/DriverAICopilot";
import useFetch from "@/hooks/useFetch";

interface Driver {
  id: number;
  driver_id: string;
  driver_name: string;
  vehicle: string;
  on_time_percentage: number;
  safety_score: number;
  fuel_efficiency: number;
  margin_per_trip: number;
  avoidable_cost: number;
  roi_score: number;
  driver_status: string;
  status: string;
}

export default function Drivers() {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<keyof Driver | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filterStatus, setFilterStatus] = useState<"all" | "top" | "coaching" | "inactive">("all");

  const { data: driversData, isLoading: driversLoading } = useFetch(`api/drivers/leaderboard/?filter=${filterStatus}`);

  const drivers: Driver[] = driversData?.data || [];

  const handleSort = (field: keyof Driver) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Client-side sorting for now
  const sortedDrivers = [...drivers].sort((a, b) => {
    if (!sortField) return 0;
    const aVal = a[sortField];
    const bVal = b[sortField];
    // Handle undefined/null
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    const direction = sortDirection === "asc" ? 1 : -1;
    return aVal > bVal ? direction : -direction;
  });

  const getROIColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 70) return "text-warning";
    return "text-destructive";
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return "bg-success/10 text-success border-success/20";
      case "OFF DUTY":
        return "bg-muted text-muted-foreground border-muted";
      case "ON LEAVE":
        return "bg-warning/10 text-warning border-warning/20";
      case "EXPIRING COMPLIANCE":
        return "bg-danger/10 text-danger border-danger/20";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-success";
    if (score >= 75) return "text-warning";
    return "text-destructive";
  };

  // Calculations based on fetched data
  const avgOnTime = drivers.length > 0 ? drivers.reduce((sum, d) => sum + (d.on_time_percentage || 0), 0) / drivers.length : 0;
  const avgSafety = drivers.length > 0 ? drivers.reduce((sum, d) => sum + (d.safety_score || 0), 0) / drivers.length : 0;
  const avgFuel = drivers.length > 0 ? drivers.reduce((sum, d) => sum + (d.fuel_efficiency || 0), 0) / drivers.length : 0;
  const avgMargin = drivers.length > 0 ? drivers.reduce((sum, d) => sum + (d.margin_per_trip || 0), 0) / drivers.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-2 font-display-semibold text-foreground">
            Driver Intelligence Hub
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            Profit impact, efficiency, and coaching insights
          </p>
        </div>
        <Badge className="bg-success/10 text-success border-success/20">
          {driversData?.total_count || 0} Active Drivers
        </Badge>
      </div>

      {/* Fleet KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border hover:shadow-glow transition-smooth">
          <CardHeader className="pb-3">
            <CardTitle className="text-caption text-muted-foreground">
              Fleet Avg. On-Time %
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-body font-body-medium text-foreground text-tabular">
              {avgOnTime.toFixed(1)}%
            </div>
            <p className="text-caption text-success mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +2.3% vs last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:shadow-glow transition-smooth">
          <CardHeader className="pb-3">
            <CardTitle className="text-caption text-muted-foreground">
              Fleet Avg. Safety
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-body font-body-medium text-foreground text-tabular">
              {avgSafety.toFixed(0)}
            </div>
            <p className="text-caption text-success mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +4 points vs baseline
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:shadow-glow transition-smooth">
          <CardHeader className="pb-3">
            <CardTitle className="text-caption text-muted-foreground">
              Fleet Avg. Fuel Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-body font-body-medium text-foreground text-tabular">
              {avgFuel.toFixed(0)}
            </div>
            <p className="text-caption text-muted-foreground mt-1">km/L efficiency score</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:shadow-glow transition-smooth">
          <CardHeader className="pb-3">
            <CardTitle className="text-caption text-muted-foreground">
              Fleet Avg. Margin
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-body font-body-medium text-foreground text-tabular">
              {formatCurrency(avgMargin)}
            </div>
            <p className="text-caption text-muted-foreground mt-1">per trip, last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Summary Banner */}
      <Card className="bg-gradient-to-r from-brand-500/10 to-brand-300/10 border-brand-500/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="bg-brand-500/20 p-2 rounded-lg">
              <Users className="w-4 h-4 text-brand-500" />
            </div>
            <div className="flex-1">
              <p className="text-body text-foreground">
                Fleet performance improved by <span className="font-body-medium text-success">+3.8% margin</span> this month.
                Top driver Mike Johnson saved <span className="font-body-medium text-success">{formatCurrency(4500)}</span> in fuel costs.
                <span className="text-warning font-body-medium"> 2 drivers flagged</span> for coaching due to idle time increase.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Performance Leaderboard
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={filterStatus === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("all")}
              >
                All Drivers
              </Button>
              <Button
                variant={filterStatus === "top" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("top")}
              >
                Top Performers
              </Button>
              <Button
                variant={filterStatus === "coaching" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("coaching")}
              >
                Needs Coaching
              </Button>
              <Button
                variant={filterStatus === "inactive" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("inactive")}
              >
                Inactive
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("id")}
                    className="flex items-center gap-1 hover:text-foreground h-7 px-2 text-xs"
                  >
                    ID
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-muted-foreground px-2 text-xs">Name</TableHead>
                <TableHead className="text-muted-foreground px-2 text-xs">Vehicle</TableHead>
                <TableHead className="text-muted-foreground text-right px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("on_time_percentage")}
                    className="flex items-center gap-1 hover:text-foreground ml-auto h-7 px-2 text-xs"
                  >
                    On-Time
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-muted-foreground text-right px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("safety_score")}
                    className="flex items-center gap-1 hover:text-foreground ml-auto h-7 px-2 text-xs"
                  >
                    Safety
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-muted-foreground text-right px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("fuel_efficiency")}
                    className="flex items-center gap-1 hover:text-foreground ml-auto h-7 px-2 text-xs"
                  >
                    Fuel
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-muted-foreground text-right px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("margin_per_trip")}
                    className="flex items-center gap-1 hover:text-foreground ml-auto h-7 px-2 text-xs"
                  >
                    Margin
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-muted-foreground text-right px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("avoidable_cost")}
                    className="flex items-center gap-1 hover:text-foreground ml-auto h-7 px-2 text-xs"
                  >
                    Avoidable Cost
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-muted-foreground text-right px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("roi_score")}
                    className="flex items-center gap-1 hover:text-foreground ml-auto h-7 px-2 text-xs"
                  >
                    ROI Score
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-muted-foreground px-2 text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {driversLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10">
                    Loading drivers...
                  </TableCell>
                </TableRow>
              ) : sortedDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10">
                    No drivers found.
                  </TableCell>
                </TableRow>
              ) : (
                sortedDrivers.map((driver) => (
                  <TableRow
                    key={driver.id}
                    className="cursor-pointer hover:bg-muted/50 transition-smooth"
                    onClick={() => navigate(`/fleet/drivers/${driver.id}`)}
                  >
                    <TableCell className="font-mono text-foreground font-medium px-2 py-3">
                      {driver.id}
                    </TableCell>
                    <TableCell className="text-foreground px-2 py-3">
                      {driver.driver_name.trim() || driver.driver_id}
                    </TableCell>
                    <TableCell className="font-mono text-foreground px-2 py-3">
                      {driver.vehicle || "-"}
                    </TableCell>
                    <TableCell className="text-right text-tabular px-2 py-3">
                      <span className={getScoreColor(driver.on_time_percentage || 0)}>
                        {driver.on_time_percentage ? `${driver.on_time_percentage.toFixed(1)}%` : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-tabular px-2 py-3">
                      <span className={getScoreColor(driver.safety_score || 0)}>
                        {driver.safety_score || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-tabular px-2 py-3">
                      <span className={getScoreColor(driver.fuel_efficiency || 0)}>
                        {driver.fuel_efficiency || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-tabular text-foreground px-2 py-3">
                      {driver.margin_per_trip ? formatCurrency(driver.margin_per_trip) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-tabular text-danger px-2 py-3">
                      {driver.avoidable_cost ? `${formatCurrency(driver.avoidable_cost)}/mo` : "-"}
                    </TableCell>
                    <TableCell className="text-right text-tabular px-2 py-3">
                      <span className={`font-body-medium ${getROIColor(driver.roi_score || 0)}`}>
                        {driver.roi_score || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <Badge variant="outline" className={getStatusColor(driver.status)}>
                        {driver.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* AI Copilot */}
      <DriverAICopilot />
    </div>
  );
}
