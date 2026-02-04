import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePost } from "@/hooks/usePost";
import { usePatch } from "@/hooks/usePatch";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import useFetch from "@/hooks/useFetch";

const vehicleSchema = z.object({
  vin: z.string().min(1, "VIN is required"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
  plate: z.string().min(1, "Plate is required"),
  type: z.string().min(1, "Type is required"),
  capacity: z.coerce.number().min(0),
  status: z.string().default("AVAILABLE"),
  fuel_type: z.string().min(1, "Fuel type is required"),
  mileage: z.coerce.number().min(0).default(0),
  last_maintenance_date: z.string().optional().nullable(),
  next_maintenance_due: z.string().optional().nullable(),
  insurance_expiry: z.string().optional().nullable(),
  registration_expiry: z.string().optional().nullable(),
  // AI Health Score fields
  ai_health_score: z.coerce.number().int().min(0).max(100).default(0),
  fuel_efficiency_score: z.coerce.number().int().min(0).max(100).default(0),
  uptime_score: z.coerce.number().int().min(0).max(100).default(0),
  maintenance_score: z.coerce.number().int().min(0).max(100).default(0),
  uptime_percentage: z.coerce.number().min(0).max(100).default(0),
  cost_per_km: z.coerce.number().min(0).default(0),
  margin_per_trip: z.coerce.number().min(0).default(0),
  driver: z.string().optional().nullable(),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

interface AddVehicleModalProps {
  onSuccess?: () => void;
  vehicle?: any;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddVehicleModal({ onSuccess, vehicle, trigger, open: externalOpen, onOpenChange: setExternalOpen }: AddVehicleModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isEdit = !!vehicle;

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = setExternalOpen !== undefined ? setExternalOpen : setInternalOpen;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vin: "",
      make: "",
      model: "",
      year: new Date().getFullYear(),
      plate: "",
      type: "",
      capacity: 0,
      status: "AVAILABLE",
      fuel_type: "",
      mileage: 0,
      last_maintenance_date: "",
      next_maintenance_due: "",
      insurance_expiry: "",
      registration_expiry: "",
      ai_health_score: 0,
      fuel_efficiency_score: 0,
      uptime_score: 0,
      maintenance_score: 0,
      uptime_percentage: 0,
      cost_per_km: 0,
      margin_per_trip: 0,
      driver: "none",
    },
  });

  const { data: driversData } = useFetch("api/drivers/leaderboard/?filter=all");
  const { data: vehicleTypesData, isLoading: vehicleTypesLoading, refetch } = useFetch("api/vehicle-types/");
  const drivers = driversData?.data || [];
  const vehicleTypes = vehicleTypesData?.results || [];
  console.log(vehicleTypes)

  useEffect(() => {
    if (vehicle && open) {
      form.reset({
        vin: vehicle.vin || "",
        make: vehicle.make || "",
        model: vehicle.model || "",
        year: vehicle.year || new Date().getFullYear(),
        plate: vehicle.plate || "",
        type: vehicle.type?.toString() || "",
        capacity: parseFloat(vehicle.capacity) || 0,
        status: vehicle.status || "AVAILABLE",
        fuel_type: vehicle.fuel_type || "",
        mileage: parseFloat(vehicle.mileage) || 0,
        last_maintenance_date: vehicle.last_maintenance_date || "",
        next_maintenance_due: vehicle.next_maintenance_due || "",
        insurance_expiry: vehicle.insurance_expiry || "",
        registration_expiry: vehicle.registration_expiry || "",
        ai_health_score: vehicle.ai_health_score || 0,
        fuel_efficiency_score: vehicle.fuel_efficiency_score || 0,
        uptime_score: vehicle.uptime_score || 0,
        maintenance_score: vehicle.maintenance_score || 0,
        uptime_percentage: parseFloat(vehicle.uptime_percentage) || 0,
        cost_per_km: parseFloat(vehicle.cost_per_km) || 0,
        margin_per_trip: parseFloat(vehicle.margin_per_trip) || 0,
        driver: (vehicle.driver || vehicle.assigned_driver || vehicle.assignedDriver)?.toString() || "none",
      });
    } else if (!open) {
      form.reset({
        vin: "",
        make: "",
        model: "",
        year: new Date().getFullYear(),
        plate: "",
        type: "",
        capacity: 0,
        status: "AVAILABLE",
        fuel_type: "",
        mileage: 0,
        last_maintenance_date: "",
        next_maintenance_due: "",
        insurance_expiry: "",
        registration_expiry: "",
        ai_health_score: 0,
        fuel_efficiency_score: 0,
        uptime_score: 0,
        maintenance_score: 0,
        uptime_percentage: 0,
        cost_per_km: 0,
        margin_per_trip: 0,
        driver: "none",
      });
    }
  }, [vehicle, open, form]);

  const { mutate: addVehicle } = usePost({
    onSuccess: () => {
      toast.success('Vehicle added successfully');
      queryClient.refetchQueries({ queryKey: ['api/vehicles/'] });
      setIsSubmitting(false);
      setOpen(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error('Failed to add vehicle');
      setIsSubmitting(false);
    },
  });

  const { mutate: updateVehicle } = usePatch({
    onSuccess: () => {
      toast.success('Vehicle updated successfully');
      queryClient.refetchQueries({ queryKey: ['api/vehicles/'] });
      setIsSubmitting(false);
      setOpen(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error('Failed to update vehicle');
      setIsSubmitting(false);
    },
  });

  function onSubmit(values: VehicleFormValues) {
    setIsSubmitting(true);
    const submissionData = {
      ...values,
      driver: values.driver === "none" ? null : values.driver
    };
    if (isEdit) {
      updateVehicle({ url: `api/vehicles/${vehicle.id}/`, data: submissionData });
    } else {
      addVehicle({ url: "api/vehicles/", data: submissionData });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Vehicle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{isEdit ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the details of the vehicle." : "Enter the details of the new vehicle to add it to your fleet."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden ">
            <ScrollArea className="flex-1 p-6 pt-2 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                {/* Basic Info Section */}
                <div className="col-span-full">
                  <h3 className="text-sm font-medium mb-2 text-primary">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="vin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>VIN</FormLabel>
                          <FormControl>
                            <Input placeholder="Vehicle Identification Number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="plate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Plate</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC-1234" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="make"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Make</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Toyota, Volvo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Hilux, FH16" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select vehicle type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vehicleTypes.map((type: any) => (
                                <SelectItem key={type.id} value={type.id.toString()}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="driver"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned Driver</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "none"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select driver" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {drivers.map((driver: any) => (
                                <SelectItem key={driver.id} value={driver.id.toString()}>
                                  {driver.driver_name?.trim() || driver.driver_id || `Driver ${driver.id}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Technical Specs Section */}
                <div className="col-span-full mt-4">
                  <h3 className="text-sm font-medium mb-2 text-primary">Technical Specifications</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fuel_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fuel Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select fuel type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="DIESEL">Diesel</SelectItem>
                              <SelectItem value="PETROL">Petrol</SelectItem>
                              <SelectItem value="ELECTRIC">Electric</SelectItem>
                              <SelectItem value="HYBRID">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacity (Tons/m³)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mileage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Mileage (km)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="AVAILABLE">Available</SelectItem>
                              <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                              <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                              <SelectItem value="OUT_OF_SERVICE">Out of Service</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Dates Section */}
                <div className="col-span-full mt-4">
                  <h3 className="text-sm font-medium mb-2 text-primary">Compliance & Maintenance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="last_maintenance_date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Last Maintenance Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(new Date(field.value), "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value ? new Date(field.value) : undefined}
                                onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                disabled={(date) =>
                                  date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="next_maintenance_due"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Next Maintenance Due</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(new Date(field.value), "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value ? new Date(field.value) : undefined}
                                onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="insurance_expiry"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Insurance Expiry</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(new Date(field.value), "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value ? new Date(field.value) : undefined}
                                onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="registration_expiry"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Registration Expiry</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(new Date(field.value), "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value ? new Date(field.value) : undefined}
                                onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* AI Scores Section */}
                {/* <div className="col-span-full mt-4">
                  <h3 className="text-sm font-medium mb-2 text-primary">AI Performance Metrics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="ai_health_score"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Health Score (0-100)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fuel_efficiency_score"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fuel Efficiency (0-100)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uptime_score"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Uptime Score (0-100)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maintenance_score"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maintenance Score (0-100)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uptime_percentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Uptime %</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cost_per_km"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost per km</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="margin_per_trip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Margin per trip</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div> */}
              </div>
            </ScrollArea>

            <DialogFooter className="px-6 py-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Update Vehicle" : "Add Vehicle"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
