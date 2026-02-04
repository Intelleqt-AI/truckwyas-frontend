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
import { Building, Plus, Search, MoreVertical, CheckCircle, Clock, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import useFetch from "@/hooks/useFetch";
import { AddCustomerModal } from "@/components/customers/AddCustomerModal";
import { DeleteDialog } from "@/components/DeleteDialog";
import { useDelete } from "@/hooks/useDelete";
import { useQueryClient } from "@tanstack/react-query";

interface Customer {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  billing_address: string;
  payment_terms: string;
  credit_limit: string;
  total_revenue?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success border-success/20",
  INACTIVE: "bg-destructive/10 text-destructive border-destructive/20",
  PENDING: "bg-warning/10 text-warning border-warning/20"
};

export function CustomersDirectory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: customersData, isLoading: customersLoading, refetch } = useFetch("api/customers/");

  const customers: Customer[] = customersData?.results || [];

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { mutate: deleteCustomer } = useDelete({
    onSuccess: () => {
      toast.success("Customer deleted successfully");
      queryClient.refetchQueries({ queryKey: ["api/customers/"] });
      setIsDeleteDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to delete customer");
    },
  });

  const handleConfirmDelete = async () => {
    if (deletingCustomerId) {
      deleteCustomer({ url: `api/customers/${deletingCustomerId}/` });
    }
  };

  const handleCustomerAction = (action: string, customerId: number) => {
    if (action === "edit") {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setEditingCustomer(customer);
        setIsEditModalOpen(true);
      }
      return;
    }
    if (action === "delete") {
      setDeletingCustomerId(customerId);
      setIsDeleteDialogOpen(true);
      return;
    }
    toast.success(`Customer ${action} successfully`);
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-foreground">Customers</h1>
          <p className="text-caption text-muted-foreground">
            Manage your customer database and information
          </p>
        </div>
        <AddCustomerModal onSuccess={() => refetch()} />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">{customers.length}</p>
                <p className="text-caption text-muted-foreground">Total Customers</p>
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
                  {customers.filter(c => c.status === 'ACTIVE').length}
                </p>
                <p className="text-caption text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">
                  {customers.filter(c => c.status === 'PENDING').length}
                </p>
                <p className="text-caption text-muted-foreground">Pending</p>
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
                  {customers.filter(c => c.status === 'INACTIVE').length}
                </p>
                <p className="text-caption text-muted-foreground">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-body-medium">Customer Directory</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
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
                <TableHead className="text-caption">Customer</TableHead>
                <TableHead className="text-caption">Contact</TableHead>
                <TableHead className="text-caption">Location</TableHead>
                <TableHead className="text-caption">Status</TableHead>
                <TableHead className="text-caption">Revenue</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customersLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading customers...
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No customers found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Building className="w-3 h-3 text-primary" />
                        </div>
                        <div>
                          <p className="text-body">{customer.company || customer.name}</p>
                          <p className="text-caption text-muted-foreground">ID: {customer.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-body">{customer.name}</p>
                        <p className="text-caption text-muted-foreground">{customer.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-body">{customer.state}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[customer.status] || "bg-muted/10 text-muted-foreground border-muted/20"}
                      >
                        {customer.status.charAt(0).toUpperCase() + customer.status.slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-body text-tabular">
                        {customer.total_revenue ? formatCurrency(parseFloat(customer.total_revenue)) : "-"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background border-border">
                          <DropdownMenuItem onClick={() => handleCustomerAction('edit', customer.id)}>
                            Edit Customer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCustomerAction('viewed', customer.id)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCustomerAction('exported', customer.id)}>
                            Export Data
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleCustomerAction('delete', customer.id)}
                          >
                            Delete Customer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddCustomerModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        customer={editingCustomer}
        onSuccess={() => refetch()}
        trigger={<div className="hidden" />}
      />

      <DeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Customer"
        description="Are you sure you want to delete this customer? This action cannot be undone and will remove all associated records."
        confirmText="Delete Customer"
        requireConfirmation={false}
        isArchive={false}
      />
    </div>
  );
}