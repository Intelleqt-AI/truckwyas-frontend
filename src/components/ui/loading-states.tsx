import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Chart Loading Skeleton
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("animate-fade-in", className)}>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-64 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-48 w-full rounded-lg" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Table Loading Skeleton
export function TableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <Card className={cn("animate-fade-in", className)}>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex gap-4">
            <Skeleton className="h-4 w-24 flex-1" />
            <Skeleton className="h-4 w-20 flex-1" />
            <Skeleton className="h-4 w-16 flex-1" />
            <Skeleton className="h-4 w-20 flex-1" />
          </div>
          {/* Rows */}
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 w-24 flex-1" />
              <Skeleton className="h-4 w-20 flex-1" />
              <Skeleton className="h-4 w-16 flex-1" />
              <Skeleton className="h-4 w-20 flex-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// KPI Card Loading Skeleton
export function KpiSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("animate-fade-in", className)}>
      <CardContent className="p-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-full rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

// Agent Card Loading Skeleton
export function AgentCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("animate-fade-in", className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-7 w-20" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}