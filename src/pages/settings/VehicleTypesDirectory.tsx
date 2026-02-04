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
import { Settings, Plus, Search, MoreVertical, Truck, CheckCircle, Package } from "lucide-react";
import { toast } from "sonner";
import useFetch from "@/hooks/useFetch";
import { useDelete } from "@/hooks/useDelete";
import { useQueryClient } from "@tanstack/react-query";
import { AddVehicleTypeModal } from "@/components/fleet/AddVehicleTypeModal";
import { DeleteDialog } from "@/components/DeleteDialog";

interface VehicleType {
  id: number;
  name: string;
  description: string;
  capacity: string;
  max_distance: string;
  base_rate: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function VehicleTypesDirectory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<VehicleType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { data: vehicleTypesData, isLoading: vehicleTypesLoading, refetch } = useFetch("api/vehicle-types/");
  const vehicleTypes: VehicleType[] = vehicleTypesData?.results || [];

  const { mutate: deleteVehicleType } = useDelete({
    onSuccess: () => {
      toast.success("Vehicle type deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["api/vehicle-types/"] });
      setIsDeleteDialogOpen(false);
      setDeletingTypeId(null);
    },
    onError: () => {
      toast.error("Failed to delete vehicle type");
    },
  });

  const filteredVehicleTypes = vehicleTypes.filter(type =>
    type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    type.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleVehicleTypeAction = (action: 'edit' | 'delete' | string, type: VehicleType) => {
    if (action === 'edit') {
      setEditingType(type);
      setIsEditModalOpen(true);
    } else if (action === 'delete') {
      setDeletingTypeId(type.id);
      setIsDeleteDialogOpen(true);
    } else {
      toast.success(`Vehicle type ${action} successfully`);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingTypeId) {
      deleteVehicleType({ url: `api/vehicle-types/${deletingTypeId}/` });
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-foreground">Vehicle Types</h1>
          <p className="text-caption text-muted-foreground">
            Configure vehicle type categories and specifications
          </p>
        </div>
        <AddVehicleTypeModal onSuccess={() => refetch()} />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Settings className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">{vehicleTypes.length}</p>
                <p className="text-caption text-muted-foreground">Total Types</p>
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
                  {vehicleTypes.filter(t => t.active).length}
                </p>
                <p className="text-caption text-muted-foreground">Active Types</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">
                  {vehicleTypes.reduce((sum, type) => sum + parseFloat(type.capacity), 0).toLocaleString()}
                </p>
                <p className="text-caption text-muted-foreground">Total Capacity (kg)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Types Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-body-medium">Vehicle Type Configuration</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search vehicle types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 h-8 text-caption"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <colgroup>
                <col style={{ width: 250 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 50 }} />
              </colgroup>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Capacity</TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Max Distance</TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Base Rate</TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</TableHead>
                  <TableHead className="px-4 py-3 text-right text-sm font-medium text-muted-foreground"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicleTypesLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading vehicle types...
                    </TableCell>
                  </TableRow>
                ) : filteredVehicleTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No vehicle types found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVehicleTypes.map((vehicleType) => (
                    <TableRow key={vehicleType.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Truck className="w-3 h-3 text-primary" />
                          </div>
                          <div>
                            <p className="text-body">{vehicleType.name}</p>
                            <p className="text-caption text-muted-foreground line-clamp-1">{vehicleType.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-body text-tabular">{parseFloat(vehicleType.capacity).toLocaleString()} kg</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-body text-tabular">{parseFloat(vehicleType.max_distance).toLocaleString()} km</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-body text-tabular">R {parseFloat(vehicleType.base_rate).toFixed(2)}/km</p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={vehicleType.active
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-muted text-muted-foreground border-border"
                          }
                        >
                          {vehicleType.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background border-border">
                            <DropdownMenuItem onClick={() => handleVehicleTypeAction('edit', vehicleType)}>
                              Edit Type
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleVehicleTypeAction('rates updated for', vehicleType)}>
                              Update Rates
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleVehicleTypeAction('duplicated', vehicleType)}>
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleVehicleTypeAction('delete', vehicleType)}
                            >
                              Delete Type
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddVehicleTypeModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        vehicleType={editingType}
        onSuccess={() => refetch()}
        trigger={<div className="hidden" />}
      />

      <DeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Vehicle Type"
        description="Are you sure you want to delete this vehicle type? This action cannot be undone."
      />
    </div>
  );
}