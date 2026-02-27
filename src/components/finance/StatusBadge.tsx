import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    // Invoice statuses
    DRAFT: { label: "Draft", color: "bg-muted-foreground text-white" },
    SENT: { label: "Sent", color: "bg-primary text-white" },
    PAID: { label: "Paid", color: "bg-success text-white" },
    OVERDUE: { label: "Overdue", color: "bg-destructive text-white" },
    PARTIALLY_PAID: { label: "Partially Paid", color: "bg-warning text-white" },
    CANCELLED: { label: "Cancelled", color: "bg-muted-foreground text-white" },

    // Expense statuses
    PENDING: { label: "Pending", color: "bg-warning text-white" },
    APPROVED: { label: "Approved", color: "bg-success text-white" },
    REJECTED: { label: "Rejected", color: "bg-destructive text-white" },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    color: "bg-muted-foreground text-white",
  };

  return (
    <Badge className={cn("border-0 font-medium px-2.5 py-0.5", config.color, className)}>
      {config.label}
    </Badge>
  );
}
