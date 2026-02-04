import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePost } from "@/hooks/usePost";
import { usePatch } from "@/hooks/usePatch";
import { useQueryClient } from "@tanstack/react-query";

const vehicleTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
  capacity: z.coerce.number().min(0, "Capacity must be positive"),
  max_distance: z.coerce.number().min(0, "Max distance must be positive"),
  base_rate: z.coerce.number().min(0, "Base rate must be positive"),
  active: z.boolean().default(true),
});

type VehicleTypeFormValues = z.infer<typeof vehicleTypeSchema>;

interface AddVehicleTypeModalProps {
  onSuccess?: () => void;
  vehicleType?: any;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddVehicleTypeModal({
  onSuccess,
  vehicleType,
  trigger,
  open: externalOpen,
  onOpenChange: setExternalOpen,
}: AddVehicleTypeModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isEdit = !!vehicleType;

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = setExternalOpen !== undefined ? setExternalOpen : setInternalOpen;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<VehicleTypeFormValues>({
    resolver: zodResolver(vehicleTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      capacity: 0,
      max_distance: 0,
      base_rate: 0,
      active: true,
    },
  });

  useEffect(() => {
    if (vehicleType && open) {
      form.reset({
        name: vehicleType.name || "",
        description: vehicleType.description || "",
        capacity: parseFloat(vehicleType.capacity) || 0,
        max_distance: parseFloat(vehicleType.max_distance) || 0,
        base_rate: parseFloat(vehicleType.base_rate) || 0,
        active: vehicleType.active ?? true,
      });
    } else if (!open) {
      form.reset({
        name: "",
        description: "",
        capacity: 0,
        max_distance: 0,
        base_rate: 0,
        active: true,
      });
    }
  }, [vehicleType, open, form]);

  const { mutate: addVehicleType } = usePost({
    onSuccess: () => {
      toast.success("Vehicle type added successfully");
      queryClient.invalidateQueries({ queryKey: ["api/vehicle-types/"] });
      setIsSubmitting(false);
      setOpen(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error("Failed to add vehicle type");
      setIsSubmitting(false);
    },
  });

  const { mutate: updateVehicleType } = usePatch({
    onSuccess: () => {
      toast.success("Vehicle type updated successfully");
      queryClient.invalidateQueries({ queryKey: ["api/vehicle-types/"] });
      setIsSubmitting(false);
      setOpen(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error("Failed to update vehicle type");
      setIsSubmitting(false);
    },
  });

  function onSubmit(values: VehicleTypeFormValues) {
    setIsSubmitting(true);
    if (isEdit) {
      updateVehicleType({
        url: `api/vehicle-types/${vehicleType.id}/`,
        data: values,
      });
    } else {
      addVehicleType({ url: "api/vehicle-types/", data: values });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{isEdit ? "Edit Vehicle Type" : "Add New Vehicle Type"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of the vehicle type."
              : "Enter the details of the new vehicle type category."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <ScrollArea className="flex-1 p-6 pt-2">
              <div className="space-y-4 pb-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Superlink 34t" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of this vehicle type"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacity (kg)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="max_distance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Distance (km)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="base_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Rate (per km)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Active</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          This vehicle type will be available for new vehicles and quotes.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>

            <DialogFooter className="px-6 py-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Update Type" : "Add Type"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
