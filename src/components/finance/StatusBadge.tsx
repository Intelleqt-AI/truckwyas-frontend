import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    // Invoice statuses
    DRAFT: { label: "Draft", color: "bg-[#94A3B8] text-white" },
    SENT: { label: "Sent", color: "bg-[#2563EB] text-white" },
    PAID: { label: "Paid", color: "bg-[#10B981] text-white" },
    OVERDUE: { label: "Overdue", color: "bg-[#EF4444] text-white" },
    PARTIALLY_PAID: { label: "Partially Paid", color: "bg-[#F59E0B] text-white" },
    CANCELLED: { label: "Cancelled", color: "bg-[#64748B] text-white" },

    // Expense statuses
    PENDING: { label: "Pending", color: "bg-[#F59E0B] text-white" },
    APPROVED: { label: "Approved", color: "bg-[#10B981] text-white" },
    REJECTED: { label: "Rejected", color: "bg-[#EF4444] text-white" },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    color: "bg-[#94A3B8] text-white",
  };

  return (
    <Badge className={cn("border-0 font-medium px-2.5 py-0.5", config.color, className)}>
      {config.label}
    </Badge>
  );
}
