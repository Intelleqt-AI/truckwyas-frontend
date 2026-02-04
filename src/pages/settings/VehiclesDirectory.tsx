import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Truck, Plus, Search, MoreVertical, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import useFetch from "@/hooks/useFetch";
import { AddVehicleModal } from "@/components/fleet/AddVehicleModal";
import { DeleteDialog } from "@/components/DeleteDialog";
import { useDelete } from "@/hooks/useDelete";
import { useQueryClient } from "@tanstack/react-query";

interface Vehicle {
  id: number;
  plate: string;
  make: string;
  model: string;
  type: string;
  status: string;
  driver_name?: string;
  vehicle_type_name?: string;
  last_maintenance_date: string;
}

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-success/10 text-success border-success/20",
  MAINTENANCE: "bg-warning/10 text-warning border-warning/20",
  IN_TRANSIT: "bg-primary/10 text-primary border-primary/20",
  OUT_OF_SERVICE: "bg-destructive/10 text-destructive border-destructive/20"
};

export function VehiclesDirectory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingVehicleId, setDeletingVehicleId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: vehiclesData, isLoading: vehiclesLoading, refetch } = useFetch("api/vehicles/");

  const vehicles: Vehicle[] = vehiclesData?.results || [];

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.assignedDriver?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { mutate: deleteVehicle } = useDelete({
    onSuccess: () => {
      toast.success("Vehicle deleted successfully");
      queryClient.refetchQueries({ queryKey: ["api/vehicles/"] });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to delete vehicle");
    },
  });

  const handleConfirmDelete = async () => {
    if (deletingVehicleId) {
      deleteVehicle({ url: `api/vehicles/${deletingVehicleId}/` });
    }
  };

  const handleVehicleAction = (action: string, vehicleId: number) => {
    if (action === 'edit') {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      setEditingVehicle(vehicle);
      setIsEditModalOpen(true);
      return;
    }
    if (action === 'delete') {
      setDeletingVehicleId(vehicleId);
      setIsDialogOpen(true);
      return;
    }
    toast.success(`Vehicle ${action} successfully`);
  };

  if (vehiclesLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading vehicles...</div>;
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-foreground">Vehicles</h1>
          <p className="text-caption text-muted-foreground">
            Manage your fleet vehicles and their information
          </p>
        </div>
        <AddVehicleModal onSuccess={() => refetch()} />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Truck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">{vehicles.length}</p>
                <p className="text-caption text-muted-foreground">Total Vehicles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">
                  {vehicles.filter(v => v.status === 'AVAILABLE').length}
                </p>
                <p className="text-caption text-muted-foreground">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">
                  {vehicles.filter(v => v.status === 'MAINTENANCE').length}
                </p>
                <p className="text-caption text-muted-foreground">Maintenance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center">
                <XCircle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">
                  {vehicles.filter(v => v.status === 'OUT_OF_SERVICE').length}
                </p>
                <p className="text-caption text-muted-foreground">Out of Service</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-body-medium">Fleet Directory</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search vehicles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 h-8 text-caption"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-caption">Vehicle</TableHead>
                <TableHead className="text-caption">Type</TableHead>
                <TableHead className="text-caption">Driver</TableHead>
                <TableHead className="text-caption">Status</TableHead>
                <TableHead className="text-caption">Last Service</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Truck className="w-3 h-3 text-primary" />
                      </div>
                      <div>
                        <p className="text-body">{vehicle.plate}</p>
                        <p className="text-caption text-muted-foreground">{vehicle.make} {vehicle.model}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-body">{vehicle?.vehicle_type_name || vehicle?.type}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-body">{vehicle?.driver_name || 'Unassigned'}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusColors[vehicle?.status] || "bg-muted/10 text-muted-foreground border-muted/20"}
                    >
                      {vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1).toLowerCase().replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-body">{vehicle.last_maintenance_date}</p>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background border-border">
                        <DropdownMenuItem onClick={() => handleVehicleAction('edit', vehicle.id)}>
                          Edit Vehicle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleVehicleAction('maintenance scheduled for', vehicle.id)}>
                          Schedule Maintenance
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleVehicleAction('viewed', vehicle.id)}>
                          View History
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleVehicleAction('deactivated', vehicle.id)}
                        >
                          Deactivate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleVehicleAction('delete', vehicle.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddVehicleModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        vehicle={editingVehicle}
        onSuccess={() => refetch()}
        trigger={<div className="hidden" />}
      />

      <DeleteDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Vehicle"
        description="Are you sure you want to delete this vehicle? This action cannot be undone and will remove all associated records."
        confirmText="Delete Vehicle"
        requireConfirmation={false}
        isArchive={false}
      />
    </div>
  );
}