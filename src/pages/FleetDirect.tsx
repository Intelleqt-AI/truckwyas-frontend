import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Fuel, Clock } from "lucide-react";

export default function FleetDirect() {
  return (
    <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <h1 className="text-body-medium font-body-medium text-foreground flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              Fleet direct
            </h1>
            <p className="text-caption text-muted-foreground">
              Direct fleet management and route optimisation
            </p>
          </div>
        <Badge className="bg-success-light text-success border-success/20">
          156 Vehicles Active
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-caption text-muted-foreground">
              Fleet size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-body font-body-medium text-foreground">156</div>
            <p className="text-xs text-muted-foreground">Total vehicles</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-caption text-muted-foreground">
              Utilisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-body font-body-medium text-foreground">87.3%</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-caption text-muted-foreground">
              Fuel efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-body font-body-medium text-foreground">7.2L</div>
            <p className="text-xs text-muted-foreground">Per 100km avg</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-caption text-muted-foreground">
              On-time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-body font-body-medium text-foreground">94.2%</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-caption text-muted-foreground">Vehicle status overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-success-light rounded-lg">
              <div className="text-body font-body-medium text-muted-foreground">142</div>
              <div className="text-sm text-success">En Route</div>
            </div>
            <div className="p-4 bg-warning-light rounded-lg">
              <div className="text-body font-body-medium text-muted-foreground">11</div>
              <div className="text-sm text-warning">Loading/Unloading</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-body font-body-medium text-muted-foreground">3</div>
              <div className="text-sm text-muted-foreground">Maintenance</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}