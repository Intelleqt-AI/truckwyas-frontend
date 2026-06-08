import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Fuel, AlertTriangle, Target } from "lucide-react";
import { motion } from "framer-motion";

interface InsightItem {
  id: string;
  icon: 'TrendingUp' | 'Fuel' | 'AlertTriangle' | 'Target';
  narrative: string;
  actionText: string;
  actionLink: string;
  severity?: 'critical' | 'warning' | 'info';
  timestamp?: string;
}

const iconMap = {
  TrendingUp,
  Fuel,
  AlertTriangle,
  Target
};

export function AIInsightsFeed() {
  const insights: InsightItem[] = [
    {
      id: '1',
      icon: 'TrendingUp',
      narrative: 'Your <strong>Durban → JHB</strong> lane has dropped to <strong>9% margin</strong> this week, check pricing.',
      actionText: 'View Lane Analysis',
      actionLink: '/bookings?lane=durban-jhb',
      severity: 'warning',
      timestamp: '2h ago'
    },
    {
      id: '2',
      icon: 'Fuel',
      narrative: 'Fleet vehicle <strong>TRK-442</strong> showing <strong>18% higher fuel consumption</strong> than similar routes.',
      actionText: 'Investigate Vehicle',
      actionLink: '/fleet?vehicle=TRK-442',
      severity: 'critical',
      timestamp: '4h ago'
    },
    {
      id: '3',
      icon: 'AlertTriangle',
      narrative: 'Customer <strong>Shoprite</strong> payment patterns suggest potential cash flow issues.',
      actionText: 'Review Account',
      actionLink: '/finance?customer=shoprite',
      severity: 'warning',
      timestamp: '1d ago'
    },
    {
      id: '4',
      icon: 'Target',
      narrative: 'Opportunity: Consolidating <strong>3 CT → PE</strong> loads could increase margin by <strong>R 12,400</strong>.',
      actionText: 'Plan Route',
      actionLink: '/bookings?opportunity=ct-pe-consolidation',
      severity: 'info',
      timestamp: '2d ago'
    }
  ];

  const getSeverityStyles = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return { borderColor: '#ef4444', bgTint: 'rgba(239, 68, 68, 0.05)' };
      case 'warning':
        return { borderColor: '#f59e0b', bgTint: 'rgba(245, 158, 11, 0.05)' };
      case 'info':
        return { borderColor: '#22c55e', bgTint: 'rgba(34, 197, 94, 0.05)' };
      default:
        return { borderColor: '#888', bgTint: 'rgba(136, 136, 136, 0.05)' };
    }
  };

  return (
    <Card className="bg-card border border-border shadow-card h-[500px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-body-large font-body-medium text-foreground">
          AI-Generated Insights
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto">
        <div className="space-y-4 pr-2">
          {insights.map((insight, index) => {
            const IconComponent = iconMap[insight.icon];
            const styles = getSeverityStyles(insight.severity);

            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="rounded-lg p-4 hover-lift transition-smooth"
                style={{
                  background: styles.bgTint,
                  borderLeft: `3px solid ${styles.borderColor}`,
                  position: 'relative'
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-0.5">
                    <IconComponent className="w-4 h-4 text-brand-500" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="text-body text-foreground flex-1"
                        dangerouslySetInnerHTML={{ __html: insight.narrative }}
                      />
                      {insight.timestamp && (
                        <span
                          className="text-caption text-muted-foreground whitespace-nowrap"
                          style={{ fontSize: '10px', opacity: 0.7 }}
                        >
                          {insight.timestamp}
                        </span>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-brand-500 hover:text-brand-700"
                      onClick={() => {
                        // Navigation handled by parent component
                      }}
                    >
                      {insight.actionText} →
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}