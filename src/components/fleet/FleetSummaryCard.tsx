import { Card } from "@/components/ui/card";
import { SparklineChart } from "@/components/finance/SparklineChart";
import { ArrowUp, ArrowDown } from "lucide-react";

interface FleetSummaryCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend: number;
  sparklineData: number[];
  isPercentage?: boolean;
}

export function FleetSummaryCard({
  title,
  value,
  subtitle,
  trend,
  sparklineData,
  isPercentage = false
}: FleetSummaryCardProps) {
  const isPositive = trend >= 0;
  
  return (
    <Card className="bg-card border-border hover-lift transition-smooth p-4">
      <div className="space-y-2.5">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5 flex-1">
            <h3 className="text-caption text-muted-foreground font-body">
              {title}
            </h3>
            <div className="text-display-2 font-display-semibold text-foreground text-tabular leading-tight">
              {value}
            </div>
            <p className="text-caption text-muted-foreground leading-tight">
              {subtitle}
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-1.5">
            <div className={`flex items-center gap-1 text-body font-body-medium ${
              isPositive ? 'text-success' : 'text-destructive'
            }`}>
              {isPositive ? (
                <ArrowUp className="w-3.5 h-3.5" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5" />
              )}
              <span className="text-sm">{Math.abs(trend)}{isPercentage ? '%' : ''}</span>
            </div>
            <SparklineChart 
              data={sparklineData} 
              color={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
