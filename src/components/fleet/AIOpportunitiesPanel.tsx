import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertTriangle,
  Wrench,
  Zap,
  MapPin,
  DollarSign,
} from "lucide-react";

export function AIOpportunitiesPanel() {
  const [isOpen, setIsOpen] = useState(true);

  const opportunities = [
    {
      id: 1,
      type: "opportunity",
      icon: TrendingUp,
      title: "Optimise Fleet Mix",
      description:
        "Reassign TRK-008 from Durban lane to Cape Town lane for +R 15,000 monthly gain.",
      impact: "+R 15,000",
      impactLabel: "Monthly gain",
      category: "routing",
    },
    {
      id: 2,
      type: "risk",
      icon: AlertTriangle,
      title: "Predictive Maintenance Alert",
      description: "TRK-023 likely to fail fuel injector within 7 days.",
      impact: "R 8,500",
      impactLabel: "Downtime cost avoided",
      category: "maintenance",
    },
    {
      id: 3,
      type: "opportunity",
      icon: DollarSign,
      title: "Route Pairing Opportunity",
      description: "TRK-012 can pair JHB → CPT outbound with CPT → DBN return for +18% margin.",
      impact: "+R 3,200",
      impactLabel: "Per trip",
      category: "routing",
    },
    {
      id: 4,
      type: "risk",
      icon: Wrench,
      title: "Replace Underperforming Asset",
      description:
        "TRK-031 below 60% efficiency — consider lease review or replacement.",
      impact: "R 12,000",
      impactLabel: "Monthly loss",
      category: "fleet",
    },
  ];

  const getIconBg = (type: string) => {
    if (type === "opportunity") return "bg-success/10 text-success";
    return "bg-warning/10 text-warning";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-brand-500" />
          <h2 className="text-body-large font-body-medium text-foreground">
            Intelligence Feed — Opportunities & Risks
          </h2>
          <Badge className="bg-brand-500/10 text-brand-500 border-brand-500/20">
            {opportunities.length} Active
          </Badge>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            {isOpen ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span className="text-caption">Collapse</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span className="text-caption">Expand</span>
              </>
            )}
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {opportunities.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.id}
                className="bg-card border-border hover-lift transition-smooth"
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getIconBg(item.type)}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-body font-body-medium text-foreground mb-1">
                          {item.title}
                        </h3>
                        <p className="text-body text-muted-foreground leading-snug">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Impact Badge */}
                    <div
                      className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                        item.type === "opportunity"
                          ? "bg-success/5 border border-success/10"
                          : "bg-warning/5 border border-warning/10"
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-body font-body-medium text-tabular ${
                            item.type === "opportunity" ? "text-success" : "text-warning"
                          }`}
                        >
                          {item.impact}
                        </span>
                        <span className="text-caption text-muted-foreground">
                          {item.impactLabel}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-2 py-0.5 bg-muted/50 text-muted-foreground border-muted"
                      >
                        {item.category}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-brand-500 hover:bg-brand-700 text-white"
                      >
                        Apply Action
                      </Button>
                      <Button size="sm" variant="outline" className="px-4">
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
