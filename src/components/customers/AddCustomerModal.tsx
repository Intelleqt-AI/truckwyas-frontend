import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePost } from "@/hooks/usePost";
import { usePatch } from "@/hooks/usePatch";
import { useQueryClient } from "@tanstack/react-query";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().optional(),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip_code: z.string().min(1, "Zip code is required"),
  billing_address: z.string().optional(),
  payment_terms: z.string().optional(),
  credit_limit: z.coerce.number().min(0).nullable().optional(),
  status: z.string().default("ACTIVE"),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface AddCustomerModalProps {
  onSuccess?: () => void;
  customer?: any;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddCustomerModal({
  onSuccess,
  customer,
  trigger,
  open: externalOpen,
  onOpenChange: setExternalOpen,
}: AddCustomerModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isEdit = !!customer;

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = setExternalOpen !== undefined ? setExternalOpen : setInternalOpen;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      billing_address: "",
      payment_terms: "",
      credit_limit: 0,
      status: "ACTIVE",
    },
  });

  useEffect(() => {
    if (customer && open) {
      form.reset({
        name: customer.name || "",
        company: customer.company || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        zip_code: customer.zip_code || "",
        billing_address: customer.billing_address || "",
        payment_terms: customer.payment_terms || "",
        credit_limit: parseFloat(customer.credit_limit) || 0,
        status: customer.status || "ACTIVE",
      });
    } else if (!open) {
      form.reset({
        name: "",
        company: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zip_code: "",
        billing_address: "",
        payment_terms: "",
        credit_limit: 0,
        status: "ACTIVE",
      });
    }
  }, [customer, open, form]);

  const { mutate: addCustomer } = usePost({
    onSuccess: () => {
      toast.success("Customer added successfully");
      queryClient.refetchQueries({ queryKey: ["api/customers/"] });
      setIsSubmitting(false);
      setOpen(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error("Failed to add customer");
      setIsSubmitting(false);
    },
  });

  const { mutate: updateCustomer } = usePatch({
    onSuccess: () => {
      toast.success("Customer updated successfully");
      queryClient.refetchQueries({ queryKey: ["api/customers/"] });
      setIsSubmitting(false);
      setOpen(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error("Failed to update customer");
      setIsSubmitting(false);
    },
  });

  function onSubmit(values: CustomerFormValues) {
    setIsSubmitting(true);
    if (isEdit) {
      updateCustomer({ url: `api/customers/${customer.id}/`, data: values });
    } else {
      addCustomer({ url: "api/customers/", data: values });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{isEdit ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of the customer."
              : "Enter the details of the new customer to add them to your database."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <ScrollArea className="flex-1 p-6 pt-2 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Inc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 234 567 890" {...field} />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="INACTIVE">Inactive</SelectItem>
                          <SelectItem value="PENDING">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="credit_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit Limit</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payment_terms"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <Input placeholder="Net 30" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="123 Main St" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="NY" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zip_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip Code</FormLabel>
                      <FormControl>
                        <Input placeholder="10001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billing_address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Billing Address (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Same as address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>

            <DialogFooter className="px-6 py-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Update Customer" : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
