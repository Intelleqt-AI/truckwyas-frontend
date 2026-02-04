import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Users, Plus, Search, MoreVertical, Mail, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import useFetch from "@/hooks/useFetch";
import { usePatch } from "@/hooks/usePatch";
import { useDelete } from "@/hooks/useDelete";
import { useQueryClient } from "@tanstack/react-query";
import { InviteUserModal } from "@/components/settings/InviteUserModal";
import { DeleteDialog } from "@/components/DeleteDialog";
import { useEffect } from "react";

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
  job_title: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  phone: string;
  address: string;
  timezone: string;
  language: string;
  date_format: string;
  avatar: string | null;
  last_active: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Mock data removed as backend is now integrated

const roleColors: Record<string, string> = {
  ADMIN: "bg-destructive/10 text-destructive border-destructive/20",
  MANAGER: "bg-warning/10 text-warning border-warning/20",
  OPERATOR: "bg-primary/10 text-primary border-primary/20",
  VIEWER: "bg-muted text-muted-foreground border-border",
  DISPATCHER: "bg-info/10 text-info border-info/20"
};

const statusColors = {
  ACTIVE: "bg-success/10 text-success border-success/20",
  INACTIVE: "bg-muted text-muted-foreground border-border",
  PENDING: "bg-warning/10 text-warning border-warning/20"
};

export function UsersPermissions() {
  const queryClient = useQueryClient();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: usersData, isLoading: isFetching } = useFetch<PaginatedResponse<User>>("api/users/");
  const users = usersData?.results || [];

  const { mutate: updateUser } = usePatch({
    onSuccess: () => {
      toast.success("User updated successfully");
      queryClient.invalidateQueries({ queryKey: ["api/users/"] });
    },
    onError: () => {
      toast.error("Failed to update user");
    },
  });

  const { mutate: deleteUser } = useDelete({
    onSuccess: () => {
      toast.success("User removed successfully");
      queryClient.invalidateQueries({ queryKey: ["api/users/"] });
      setIsDeleteDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to remove user");
    },
  });

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserAction = (action: string, userId: number | string) => {
    switch (action) {
      case 'deactivate':
        updateUser({ url: `api/users/${userId}/`, data: { status: 'INACTIVE' } });
        break;
      case 'activate':
        updateUser({ url: `api/users/${userId}/`, data: { status: 'ACTIVE' } });
        break;
      case 'remove':
        setSelectedUserId(userId);
        setIsDeleteDialogOpen(true);
        break;
      case 'resend_invitation':
        // Assuming there's an endpoint for this
        toast.info("Resending invitation...");
        break;
      default:
        break;
    }
  };

  const handleConfirmDelete = () => {
    if (selectedUserId) {
      deleteUser({ url: `api/users/${selectedUserId}/` });
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-foreground">Users & Permissions</h1>
          <p className="text-caption text-muted-foreground">
            Manage team members and their access levels
          </p>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Invite User
        </Button>
      </div>

      {/* Stats Cards & Table Combined */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Stats Cards */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">{users?.length || 0}</p>
                <p className="text-caption text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">{users?.filter(u => u.status === 'ACTIVE').length || 0}</p>
                <p className="text-caption text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
                <Mail className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">{users?.filter(u => u.status === 'PENDING').length || 0}</p>
                <p className="text-caption text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">{users?.filter(u => u.role?.toLowerCase() === 'admin').length || 0}</p>
                <p className="text-caption text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Users Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-body-medium">Team Members</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
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
                  <TableHead className="text-caption">User</TableHead>
                  <TableHead className="text-caption">Role</TableHead>
                  <TableHead className="text-caption">Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading users...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="text-xs">
                              {user.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-body">{user.name}</p>
                            <p className="text-caption text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={roleColors[user.role?.toUpperCase()] || roleColors.VIEWER}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[user.status]}
                        >
                          {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
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
                            <DropdownMenuItem onClick={() => handleUserAction('edit', user.id)}>
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUserAction('permissions', user.id)}>
                              Change Permissions
                            </DropdownMenuItem>
                            {user.status === 'ACTIVE' ? (
                              <DropdownMenuItem onClick={() => handleUserAction('deactivate', user.id)}>
                                Deactivate
                              </DropdownMenuItem>
                            ) : user.status === 'INACTIVE' ? (
                              <DropdownMenuItem onClick={() => handleUserAction('activate', user.id)}>
                                Activate
                              </DropdownMenuItem>
                            ) : null}
                            {user.status === 'PENDING' && (
                              <DropdownMenuItem onClick={() => handleUserAction('resend_invitation', user.id)}>
                                Resend Invitation
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleUserAction('remove', user.id)}
                            >
                              Remove User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Role Permissions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-body-medium">Role Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Badge variant="outline" className={roleColors.admin}>Admin</Badge>
              <ul className="text-caption space-y-0.5 text-muted-foreground">
                <li>• Full system access</li>
                <li>• User management</li>
                <li>• Billing & settings</li>
                <li>• All integrations</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Badge variant="outline" className={roleColors.manager}>Manager</Badge>
              <ul className="text-caption space-y-0.5 text-muted-foreground">
                <li>• Quote management</li>
                <li>• Fleet operations</li>
                <li>• Financial reports</li>
                <li>• Team oversight</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Badge variant="outline" className={roleColors.operator}>Operator</Badge>
              <ul className="text-caption space-y-0.5 text-muted-foreground">
                <li>• Create & edit quotes</li>
                <li>• Manage bookings</li>
                <li>• Update deliveries</li>
                <li>• Basic reporting</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Badge variant="outline" className={roleColors.viewer}>Viewer</Badge>
              <ul className="text-caption space-y-0.5 text-muted-foreground">
                <li>• View-only access</li>
                <li>• Basic reports</li>
                <li>• Dashboard access</li>
                <li>• No edit permissions</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />

      <DeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Remove User"
        description="Are you sure you want to remove this user? This action cannot be undone."
      />
    </div>
  );
}