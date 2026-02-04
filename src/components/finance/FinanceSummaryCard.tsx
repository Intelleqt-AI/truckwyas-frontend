import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SparklineChart } from "./SparklineChart";
import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";

interface FinanceSummaryCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  sparklineData?: number[];
  icon?: LucideIcon;
  onClick?: () => void;
}

export function FinanceSummaryCard({
  title,
  value,
  subtitle,
  trend,
  sparklineData,
  icon: Icon,
  onClick
}: FinanceSummaryCardProps) {
  return (
    <Card 
      className={`bg-card border-border hover-lift transition-smooth ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-caption text-muted-foreground flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-display-2 font-display-semibold text-foreground text-tabular">
            {value}
          </div>
          {sparklineData && (
            <SparklineChart 
              data={sparklineData} 
              color={trend?.isPositive ? 'hsl(var(--success))' : 'hsl(var(--warning))'} 
            />
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <p className={`text-caption ${trend?.isPositive ? 'text-success' : 'text-muted-foreground'}`}>
            {subtitle}
          </p>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-body-medium ${
              trend.isPositive ? 'text-success' : 'text-warning'
            }`}>
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
