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
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import { usePost } from "@/hooks/usePost";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.string().min(1, "Please select a role"),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteUserModal({ isOpen, onClose }: InviteUserModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "OPERATOR",
    },
  });

  const { mutate: inviteUser, isPending } = usePost({
    onSuccess: () => {
      toast.success("Invitation sent successfully");
      queryClient.invalidateQueries({ queryKey: ["api/users/"] });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to send invitation");
    },
  });

  const onSubmit = (data: InviteFormValues) => {
    inviteUser({ url: "api/users/invite/", data });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation email to a new team member. They will receive a temporary password to log in.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. sarah@truckwys.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background border-border">
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="OPERATOR">Operator</SelectItem>
                      <SelectItem value="DISPATCHER">Dispatcher</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
