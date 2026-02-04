import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface Quote {
  id: string;
  price: number;
}

interface CompactScenarioPlannerProps {
  quote: Quote;
  selectedScenario?: string;
  onScenarioChange?: (scenarioId: string) => void;
  onScenarioHover?: (scenarioId: string | null) => void;
}

const mockScenarios = [
  {
    id: "A",
    name: "Recommended",
    route: "N1 Direct",
    driver: "Johan (D-12)",
    vehicle: "Volvo FH16 (V-04)",
    eta: "22h 30min",
    fuel: "580L",
    risk: "Low",
    profitDelta: 0,
    riskColor: "text-success",
    isRecommended: true
  },
  {
    id: "B", 
    name: "Cost Optimized",
    route: "N3 via Durban",
    driver: "Pieter (D-08)",
    vehicle: "Mercedes Actros (V-11)",
    eta: "26h 15min",
    fuel: "490L",
    risk: "Medium",
    profitDelta: 750,
    riskColor: "text-warning",
    isRecommended: false
  },
  {
    id: "C",
    name: "Time Critical", 
    route: "Toll highways",
    driver: "Sarah (D-03)",
    vehicle: "Scania R500 (V-07)",
    eta: "19h 45min",
    fuel: "650L", 
    risk: "High",
    profitDelta: -320,
    riskColor: "text-destructive",
    isRecommended: false
  }
];

export function CompactScenarioPlanner({ 
  quote, 
  selectedScenario = "A", 
  onScenarioChange, 
  onScenarioHover 
}: CompactScenarioPlannerProps) {
  const [selectedPlan, setSelectedPlan] = useState(selectedScenario);

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    onScenarioChange?.(planId);
  };

  return (
    <div className="space-y-4">
      {/* Scenarios Grid - Full Width */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {mockScenarios.map((scenario) => (
          <div
            key={scenario.id}
            className={`p-3 rounded border cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
              selectedPlan === scenario.id
                ? 'border-primary bg-primary/5 shadow-sm ring-2 ring-primary/10'
                : 'border-border bg-muted/20 hover:bg-muted/30 hover:border-primary/30'
            }`}
            onClick={() => handlePlanSelect(scenario.id)}
            onMouseEnter={() => onScenarioHover?.(scenario.id)}
            onMouseLeave={() => onScenarioHover?.(null)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`font-medium text-xs ${
                scenario.isRecommended ? 'text-success' : 'text-foreground'
              }`}>
                {scenario.name}
              </span>
              {scenario.profitDelta !== 0 && (
                <Badge variant="outline" className={`text-xs px-2 py-0.5 ${
                  scenario.profitDelta > 0 
                    ? 'bg-success/5 text-success border-success/20' 
                    : 'bg-destructive/5 text-destructive border-destructive/20'
                }`}>
                  {scenario.profitDelta > 0 ? '+' : ''}R{Math.abs(scenario.profitDelta)}
                </Badge>
              )}
            </div>
            
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-medium text-muted-foreground/60 w-12 flex-shrink-0 mt-0.5">ROUTE:</span>
                <span className="flex-1 leading-tight">{scenario.route}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-medium text-muted-foreground/60 w-12 flex-shrink-0 mt-0.5">DRIVER:</span>
                <span className="flex-1 leading-tight">{scenario.driver}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-medium text-muted-foreground/60 w-12 flex-shrink-0 mt-0.5">TRUCK:</span>
                <span className="flex-1 leading-tight">{scenario.vehicle}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border/50 mt-2">
                <span>{scenario.eta}</span>
                <span>{scenario.fuel}</span>
                <span className={scenario.riskColor}>{scenario.risk}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}