import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Fuel, CreditCard, Users } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export function WhatIfSimulator() {
  const scenarios = [
    { icon: Fuel, scenario: "Fuel +10%", impact: -127000 },
    { icon: CreditCard, scenario: "Factoring", impact: 45000 }
  ];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-brand-500" />
          <CardTitle className="text-caption font-body-medium text-foreground">Scenario Planner</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-2">
        <p className="text-xs text-muted-foreground">
          Quick impact analysis
        </p>

        <div className="space-y-1.5">
          {scenarios.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 bg-background/50 rounded border border-border hover:bg-muted/30 transition-smooth">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-caption text-foreground">{item.scenario}</span>
                </div>
                <span className={`text-caption font-body-medium text-tabular ${
                  item.impact > 0 ? 'text-success' : 'text-destructive'
                }`}>
                  {item.impact > 0 ? '+' : ''}{formatCurrency(item.impact)}
                </span>
              </div>
            );
          })}
        </div>

        <Button variant="outline" className="w-full h-7 text-xs mt-2" size="sm">
          Run Simulation
        </Button>
      </CardContent>
    </Card>
  );
}
