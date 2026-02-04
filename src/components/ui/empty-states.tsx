import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FileText, 
  BarChart3, 
  Users, 
  Truck, 
  Target,
  Search,
  Plus,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
  };
  className?: string;
}

export function EmptyState({ 
  title, 
  description, 
  icon: Icon = FileText, 
  action,
  className 
}: EmptyStateProps) {
  return (
    <Card className={cn("text-center py-12", className)}>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <Icon className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-heading font-body-medium text-foreground">
              {title}
            </h3>
            <p className="text-body text-muted-foreground max-w-md">
              {description}
            </p>
          </div>
          {action && (
            <Button 
              variant={action.variant || "default"} 
              onClick={action.onClick}
              className="mt-4"
            >
              {action.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Specific empty states for common scenarios
export function NoQuotesEmpty({ onCreateQuote }: { onCreateQuote: () => void }) {
  return (
    <EmptyState
      title="No quotes yet"
      description="Create your first quote with Revenue Guard to start protecting your margins and optimizing pricing."
      icon={FileText}
      action={{
        label: "Create Quote",
        onClick: onCreateQuote
      }}
    />
  );
}

export function NoDataEmpty({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      title="No data available"
      description="There's no data to display at the moment. This could be because filters are too restrictive or data hasn't loaded yet."
      icon={BarChart3}
      action={onRefresh ? {
        label: "Refresh Data",
        onClick: onRefresh,
        variant: "outline" as const
      } : undefined}
    />
  );
}

export function NoResultsEmpty({ onClearFilters }: { onClearFilters?: () => void }) {
  return (
    <EmptyState
      title="No results found"
      description="We couldn't find any results matching your search criteria. Try adjusting your filters or search terms."
      icon={Search}
      action={onClearFilters ? {
        label: "Clear Filters",
        onClick: onClearFilters,
        variant: "outline" as const
      } : undefined}
    />
  );
}

export function NoLoadsEmpty({ onBrowseLoads }: { onBrowseLoads: () => void }) {
  return (
    <EmptyState
      title="No available loads"
      description="There are currently no loads matching your criteria. Check back soon or adjust your preferences."
      icon={Truck}
      action={{
        label: "Browse All Loads",
        onClick: onBrowseLoads,
        variant: "outline" as const
      }}
    />
  );
}

export function NoPlansEmpty({ onCreatePlan }: { onCreatePlan: () => void }) {
  return (
    <EmptyState
      title="No optimization plans"
      description="Generate your first optimization plan to compare scenarios and improve fleet efficiency."
      icon={Target}
      action={{
        label: "Generate Plan",
        onClick: onCreatePlan
      }}
    />
  );
}

export function MapUnavailableEmpty() {
  return (
    <Card className="h-64 flex items-center justify-center bg-muted/20">
      <CardContent>
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
            <BarChart3 className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h4 className="text-body-medium font-body-medium text-foreground">
              Map preview not available
            </h4>
            <p className="text-caption text-muted-foreground">
              Configure Mapbox API key to enable map visualization
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}