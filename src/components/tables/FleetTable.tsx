import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Truck, ArrowUpDown, MapPin, TrendingUp, TrendingDown, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Vehicle {
  vehicleId: string;
  driver: string;
  status: 'En Route' | 'Loading' | 'Maintenance' | 'Available';
  currentLocation: string;
  destination: string;
  fuelLevel: number;
  fuelEfficiency: number;
  utilization: number;
}

interface FleetTableProps {
  data?: Vehicle[];
  maxRows?: number;
  className?: string;
}

export function FleetTable({ data, maxRows = 10, className }: FleetTableProps) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<keyof Vehicle>('vehicleId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Mock fleet data with fuel efficiency
  const defaultData: Vehicle[] = [
    { vehicleId: "TRK-001", driver: "S. Mthembu", status: "En Route", currentLocation: "JHB", destination: "CPT", fuelLevel: 78, fuelEfficiency: 32.1, utilization: 92 },
    { vehicleId: "TRK-002", driver: "K. van Zyl", status: "Loading", currentLocation: "DBN", destination: "PE", fuelLevel: 45, fuelEfficiency: 28.9, utilization: 87 },
    { vehicleId: "TRK-003", driver: "T. Ndaba", status: "En Route", currentLocation: "CPT", destination: "JHB", fuelLevel: 89, fuelEfficiency: 30.5, utilization: 94 },
    { vehicleId: "TRK-004", driver: "P. Botha", status: "Maintenance", currentLocation: "JHB", destination: "-", fuelLevel: 12, fuelEfficiency: 35.2, utilization: 0 },
    { vehicleId: "TRK-005", driver: "M. Dlamini", status: "En Route", currentLocation: "PE", destination: "DBN", fuelLevel: 67, fuelEfficiency: 31.8, utilization: 88 },
    { vehicleId: "TRK-006", driver: "J. Smith", status: "Available", currentLocation: "DBN", destination: "-", fuelLevel: 95, fuelEfficiency: 29.4, utilization: 0 },
    { vehicleId: "TRK-007", driver: "N. Khumalo", status: "En Route", currentLocation: "JHB", destination: "Rustenburg", fuelLevel: 73, fuelEfficiency: 33.7, utilization: 85 },
    { vehicleId: "TRK-008", driver: "R. Patel", status: "Loading", currentLocation: "CPT", destination: "George", fuelLevel: 58, fuelEfficiency: 30.1, utilization: 79 },
  ];

  const fleetAvgFuelEfficiency = 31.2;
  const fleetAvgUtilization = 78;

  const vehicles = (data || defaultData).slice(0, maxRows);

  const handleSort = (field: keyof Vehicle) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedVehicles = [...vehicles].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    const aStr = String(aValue);
    const bStr = String(bValue);
    return sortDirection === 'asc' 
      ? aStr.localeCompare(bStr) 
      : bStr.localeCompare(aStr);
  });

  const getStatusColor = (status: Vehicle['status']) => {
    switch (status) {
      case 'En Route': return 'bg-success/10 text-success border border-success/20';
      case 'Loading': return 'bg-warning/10 text-warning border border-warning/20';
      case 'Maintenance': return 'bg-muted/50 text-muted-foreground border border-border';
      case 'Available': return 'bg-brand-100/50 text-brand-700 border border-brand-500/20';
      default: return 'bg-muted text-muted-foreground border border-border';
    }
  };

  const getFuelColor = (level: number) => {
    if (level >= 70) return 'text-success';
    if (level >= 30) return 'text-warning';
    return 'text-destructive';
  };

  const getUtilizationColor = (util: number) => {
    if (util >= 80) return 'text-success';
    if (util >= 60) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getVarianceIcon = (value: number, average: number, lowerIsBetter = false) => {
    const isAboveAvg = value > average;
    const isGood = lowerIsBetter ? !isAboveAvg : isAboveAvg;
    return isGood ? (
      <TrendingUp className="w-3 h-3 text-success inline ml-1" />
    ) : (
      <TrendingDown className="w-3 h-3 text-destructive inline ml-1" />
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground">
          Active fleet status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('vehicleId')}>
                  <div className="flex items-center gap-1">
                    Vehicle
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('driver')}>
                  <div className="flex items-center gap-1">
                    Driver
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Route</TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => handleSort('fuelLevel')}>
                  <div className="flex items-center justify-center gap-1">
                    Fuel
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => handleSort('fuelEfficiency')}>
                  <div className="flex items-center justify-center gap-1">
                    Fuel Eff. (L/100km)
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => handleSort('utilization')}>
                  <div className="flex items-center justify-center gap-1">
                    Utilisation
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedVehicles.map((vehicle) => (
                <TableRow key={vehicle.vehicleId} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-body">{vehicle.vehicleId}</TableCell>
                  <TableCell className="text-body font-body-medium">{vehicle.driver}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-xs rounded-full px-3 py-1 ${getStatusColor(vehicle.status)}`}>
                      {vehicle.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-body text-muted-foreground">
                    {vehicle.currentLocation} → {vehicle.destination}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-body font-body-medium text-tabular ${getFuelColor(vehicle.fuelLevel)}`}>
                      {vehicle.fuelLevel}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-body font-body-medium text-tabular ${
                      vehicle.fuelEfficiency < fleetAvgFuelEfficiency ? 'text-success' : 'text-destructive'
                    }`}>
                      {vehicle.fuelEfficiency.toFixed(1)}
                      {getVarianceIcon(vehicle.fuelEfficiency, fleetAvgFuelEfficiency, true)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-body font-body-medium text-tabular ${getUtilizationColor(vehicle.utilization)}`}>
                      {vehicle.utilization}%
                      {vehicle.utilization > 0 && getVarianceIcon(vehicle.utilization, fleetAvgUtilization, false)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => navigate(`/fleet/vehicles/${vehicle.vehicleId}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}