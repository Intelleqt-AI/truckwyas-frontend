import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Map,
  BarChart3,
  ArrowRight,
  Target,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Scenario {
  id: string;
  name: string;
  description: string;
  profitDelta: number;
  timeDelta: number; // in hours
  riskScore: number; // 0-1 scale
  confidence: number; // 0-1 scale
  keyMetrics: {
    fuelSavings: number;
    emptyKmReduction: number;
    utilizationImprovement: number;
    customerSatisfaction: number;
  };
  implementationEffort: 'low' | 'medium' | 'high';
  prerequisites: string[];
  risks: string[];
  benefits: string[];
}

interface ScenarioCanvasProps {
  scenarios?: Scenario[];
  title?: string;
  description?: string;
  isOpen?: boolean;
  onClose?: () => void;
  onAdoptScenario?: (scenarioId: string) => void;
}

export function ScenarioCanvas({ 
  scenarios,
  title = "Scenario Comparison",
  description = "Compare alternative approaches and select the optimal strategy",
  isOpen = false,
  onClose,
  onAdoptScenario
}: ScenarioCanvasProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');
  
  // Mock scenario data if none provided
  const defaultScenarios: Scenario[] = [
    {
      id: 'plan-a',
      name: 'Current Route Optimization',
      description: 'Maintain existing route but optimize load sequencing and timing to reduce fuel consumption',
      profitDelta: 2840,
      timeDelta: -0.5, // 30 minutes faster
      riskScore: 0.15, // Low risk
      confidence: 0.87,
      keyMetrics: {
        fuelSavings: 12.3,
        emptyKmReduction: 8.5,
        utilizationImprovement: 4.2,
        customerSatisfaction: 95.8
      },
      implementationEffort: 'low',
      prerequisites: ['Driver briefing on new sequence', 'Updated navigation system'],
      risks: ['Minor delivery window adjustments required'],
      benefits: [
        'Immediate fuel savings without route changes',
        'Minimal disruption to existing operations',
        'Quick implementation within 24 hours'
      ]
    },
    {
      id: 'plan-b', 
      name: 'Alternative Route via Coast',
      description: 'Switch to coastal N1 route with consolidated pickup points to avoid traffic congestion',
      profitDelta: 4120,
      timeDelta: 1.2, // 1.2 hours longer
      riskScore: 0.35, // Medium risk
      confidence: 0.74,
      keyMetrics: {
        fuelSavings: 18.7,
        emptyKmReduction: 22.3,
        utilizationImprovement: 15.6,
        customerSatisfaction: 92.4
      },
      implementationEffort: 'medium',
      prerequisites: ['Customer approval for timing changes', 'Coastal warehouse coordination'],
      risks: [
        'Weather dependency on coastal route',
        'Customer delivery window negotiations required',
        'Potential delays during peak season'
      ],
      benefits: [
        'Significant fuel and time savings long-term',
        'Reduced wear on vehicles from traffic',
        'Better load consolidation opportunities'
      ]
    },
    {
      id: 'plan-c',
      name: 'Multi-Modal Rail Integration',
      description: 'Combine road freight with rail transport for long-haul portion, reducing road kilometers by 60%',
      profitDelta: 6890,
      timeDelta: -2.5, // 2.5 hours faster overall
      riskScore: 0.55, // Higher risk
      confidence: 0.68,
      keyMetrics: {
        fuelSavings: 45.2,
        emptyKmReduction: 58.9,
        utilizationImprovement: 28.4,
        customerSatisfaction: 89.7
      },
      implementationEffort: 'high',
      prerequisites: [
        'Rail service provider contracts',
        'Intermodal terminal access agreements',
        'Loading equipment modifications'
      ],
      risks: [
        'Rail schedule dependency and reliability',
        'Complex coordination between transport modes',
        'Higher upfront investment in equipment',
        'Customer acceptance of new service model'
      ],
      benefits: [
        'Major carbon footprint reduction',
        'Highest profit margins long-term',
        'Scalable model for multiple routes',
        'Competitive advantage in sustainability'
      ]
    }
  ];

  const activeScenarios = scenarios || defaultScenarios;
  const selectedScenarioData = activeScenarios.find(s => s.id === selectedScenario);

  const getRiskColor = (risk: number) => {
    if (risk < 0.3) return 'text-success bg-success-light border-success/20';
    if (risk < 0.6) return 'text-warning bg-warning-light border-warning/20';
    return 'text-danger bg-danger/10 border-danger/20';
  };

  const getRiskLabel = (risk: number) => {
    if (risk < 0.3) return 'Low Risk';
    if (risk < 0.6) return 'Medium Risk';
    return 'High Risk';
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low':
        return 'text-success bg-success-light';
      case 'medium':
        return 'text-warning bg-warning-light';
      case 'high':
        return 'text-danger bg-danger/10';
      default:
        return 'text-muted bg-muted';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (hours: number) => {
    const absHours = Math.abs(hours);
    const sign = hours >= 0 ? '+' : '-';
    
    if (absHours >= 1) {
      return `${sign}${absHours.toFixed(1)}h`;
    } else {
      return `${sign}${Math.round(absHours * 60)}min`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="text-display-2 font-display-semibold text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-body text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="overview">Scenario Overview</TabsTrigger>
              <TabsTrigger value="comparison">Side-by-Side</TabsTrigger>
              <TabsTrigger value="details">Implementation Details</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="flex-1 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                {activeScenarios.map((scenario, index) => (
                  <motion.div
                    key={scenario.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card 
                      className={cn(
                        "h-full cursor-pointer transition-all duration-200 hover:shadow-glow",
                        selectedScenario === scenario.id ? "ring-2 ring-brand-500 shadow-glow" : "hover:shadow-md"
                      )}
                      onClick={() => setSelectedScenario(scenario.id)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-heading font-body-medium text-card-foreground mb-2">
                              {scenario.name}
                            </CardTitle>
                            <p className="text-caption text-muted-foreground">
                              {scenario.description}
                            </p>
                          </div>
                          <Badge className={cn("text-xs", getRiskColor(scenario.riskScore))}>
                            {getRiskLabel(scenario.riskScore)}
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <TrendingUp className="w-4 h-4 text-success" />
                              <span className="text-body-medium font-body-medium text-success">
                                {formatCurrency(scenario.profitDelta)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">Profit Impact</div>
                          </div>
                          
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <Clock className="w-4 h-4 text-brand-500" />
                              <span className={cn(
                                "text-body-medium font-body-medium",
                                scenario.timeDelta < 0 ? "text-success" : "text-warning"
                              )}>
                                {formatTime(scenario.timeDelta)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">Time Impact</div>
                          </div>
                        </div>

                        {/* Implementation Effort */}
                        <div className="flex items-center justify-between">
                          <span className="text-caption text-muted-foreground">Implementation:</span>
                          <Badge className={cn("text-xs capitalize", getEffortColor(scenario.implementationEffort))}>
                            {scenario.implementationEffort} effort
                          </Badge>
                        </div>

                        {/* Confidence */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-caption">
                            <span className="text-muted-foreground">Confidence</span>
                            <span className="font-body-medium text-foreground">
                              {(scenario.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div 
                              className="h-1.5 rounded-full bg-brand-500 transition-all duration-300"
                              style={{ width: `${scenario.confidence * 100}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* Comparison Tab */}
            <TabsContent value="comparison" className="flex-1 mt-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-caption text-muted-foreground font-body-medium">
                        Metric
                      </th>
                      {activeScenarios.map(scenario => (
                        <th key={scenario.id} className="text-center p-3">
                          <div className="text-body-medium font-body-medium text-foreground">
                            {scenario.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="p-3 text-body text-foreground">Profit Impact</td>
                      {activeScenarios.map(scenario => (
                        <td key={scenario.id} className="text-center p-3">
                          <span className="text-body-medium font-body-medium text-success">
                            {formatCurrency(scenario.profitDelta)}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-3 text-body text-foreground">Fuel Savings</td>
                      {activeScenarios.map(scenario => (
                        <td key={scenario.id} className="text-center p-3">
                          <span className="text-body-medium font-body-medium text-foreground">
                            {scenario.keyMetrics.fuelSavings.toFixed(1)}%
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-3 text-body text-foreground">Empty Km Reduction</td>
                      {activeScenarios.map(scenario => (
                        <td key={scenario.id} className="text-center p-3">
                          <span className="text-body-medium font-body-medium text-foreground">
                            {scenario.keyMetrics.emptyKmReduction.toFixed(1)}%
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-3 text-body text-foreground">Risk Level</td>
                      {activeScenarios.map(scenario => (
                        <td key={scenario.id} className="text-center p-3">
                          <Badge className={cn("text-xs", getRiskColor(scenario.riskScore))}>
                            {getRiskLabel(scenario.riskScore)}
                          </Badge>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Implementation Details Tab */}
            <TabsContent value="details" className="flex-1 mt-6">
              {selectedScenarioData ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-heading font-body-medium text-card-foreground flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-success" />
                        Benefits & Opportunities
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedScenarioData.benefits.map((benefit, index) => (
                          <li key={index} className="flex items-start gap-2 text-body text-card-foreground">
                            <span className="w-1 h-1 bg-success rounded-full mt-2 flex-shrink-0" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-heading font-body-medium text-card-foreground flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-warning" />
                        Risks & Considerations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedScenarioData.risks.map((risk, index) => (
                          <li key={index} className="flex items-start gap-2 text-body text-card-foreground">
                            <span className="w-1 h-1 bg-warning rounded-full mt-2 flex-shrink-0" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-body text-muted-foreground mb-2">
                    Select a scenario to view implementation details
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab('overview')}
                  >
                    View Scenarios
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="border-t border-border pt-6">
          <div className="flex items-center justify-between w-full">
            <div className="text-caption text-muted-foreground">
              {selectedScenarioData && (
                <span>
                  Selected: {selectedScenarioData.name} • 
                  Confidence: {(selectedScenarioData.confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              
              {selectedScenarioData && (
                <Button
                  onClick={() => {
                    onAdoptScenario?.(selectedScenario);
                    onClose?.();
                  }}
                  className="bg-brand-500 hover:bg-brand-500/90 text-white"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Adopt {selectedScenarioData.name}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}