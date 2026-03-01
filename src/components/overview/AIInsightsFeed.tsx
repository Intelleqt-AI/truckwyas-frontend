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
      actionLink: '/bookings?lane=durban-jhb'
    },
    {
      id: '2',
      icon: 'Fuel',
      narrative: 'Fleet vehicle <strong>TRK-442</strong> showing <strong>18% higher fuel consumption</strong> than similar routes.',
      actionText: 'Investigate Vehicle',
      actionLink: '/fleet?vehicle=TRK-442'
    },
    {
      id: '3',
      icon: 'AlertTriangle',
      narrative: 'Customer <strong>Shoprite</strong> payment patterns suggest potential cash flow issues.',
      actionText: 'Review Account',
      actionLink: '/finance?customer=shoprite'
    },
    {
      id: '4',
      icon: 'Target',
      narrative: 'Opportunity: Consolidating <strong>3 CT → PE</strong> loads could increase margin by <strong>R 12,400</strong>.',
      actionText: 'Plan Route',
      actionLink: '/bookings?opportunity=ct-pe-consolidation'
    }
  ];

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
            
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-muted/20 rounded-lg p-4 hover-lift transition-smooth"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-0.5">
                    <IconComponent className="w-4 h-4 text-brand-500" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div 
                      className="text-body text-foreground"
                      dangerouslySetInnerHTML={{ __html: insight.narrative }}
                    />
                    
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