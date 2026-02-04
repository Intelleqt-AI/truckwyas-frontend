import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AccessibleChartProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  summaryData?: Array<{
    label: string;
    value: string | number;
    change?: string;
  }>;
  className?: string;
}

export function AccessibleChart({ 
  title, 
  description, 
  children, 
  summaryData = [],
  className 
}: AccessibleChartProps) {
  const [showSummary, setShowSummary] = useState(false);

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-heading font-body-medium text-card-foreground">
              {title}
            </CardTitle>
            {description && (
              <p className="text-caption text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          {summaryData.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSummary(!showSummary)}
              className="text-xs"
            >
              {showSummary ? (
                <>
                  <EyeOff className="w-3 h-3 mr-1" />
                  Hide Summary
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3 mr-1" />
                  Show Summary
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showSummary ? (
          <div className="space-y-3">
            <h4 className="text-body-medium font-body-medium text-foreground">
              Accessible Data Summary
            </h4>
            <div className="grid gap-2">
              {summaryData.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                  <span className="text-body text-foreground">{item.label}</span>
                  <div className="text-right">
                    <span className="text-body-medium font-body-medium text-foreground text-tabular">
                      {item.value}
                    </span>
                    {item.change && (
                      <div className="text-caption text-muted-foreground">
                        {item.change}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative">
            {children}
            {/* Screen reader accessible description */}
            <div className="sr-only" aria-live="polite">
              Chart showing {title}. {description}
              {summaryData.length > 0 && (
                <>
                  {" "}Key data points: {summaryData.map(item => `${item.label}: ${item.value}`).join(", ")}
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}