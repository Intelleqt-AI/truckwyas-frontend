import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronLeft } from 'lucide-react';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import EconomicModelVisualization from '@/components/finance/EconomicModelVisualization';
import EconomicModelSidePanel from '@/components/finance/EconomicModelSidePanel';
import financeModelData from '@/mocks/finance-model-data.json';

interface Node {
  id: string;
  type: 'customer' | 'vehicle' | 'lane' | 'costCenter';
  label: string;
}

interface Link {
  source: string;
  target: string;
  value: number;
  marginPct?: number;
  type: 'revenue' | 'assignment' | 'cost';
}

export default function EconomicModel() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [scenarioMode, setScenarioMode] = useState(false);
  const [fuelPriceChange, setFuelPriceChange] = useState(0);
  const [globalKpis, setGlobalKpis] = useState(financeModelData.globalKpis);

  // Update KPIs based on scenario changes
  useEffect(() => {
    if (fuelPriceChange !== 0) {
      const fuelImpact = 1680000 * (fuelPriceChange / 100); // Total fuel costs from mock data
      const newTotalCosts = financeModelData.globalKpis.totalCosts + fuelImpact;
      const newNetMargin = ((financeModelData.globalKpis.totalRevenue - newTotalCosts) / financeModelData.globalKpis.totalRevenue) * 100;
      
      setGlobalKpis(prev => ({
        ...prev,
        totalCosts: newTotalCosts,
        netMargin: newNetMargin
      }));
    } else {
      setGlobalKpis(financeModelData.globalKpis);
    }
  }, [fuelPriceChange]);

  const handleNodeClick = (node: Node) => {
    setSelectedNode(node);
  };

  const handleNodeHover = (node: Node | null) => {
    setHoveredNode(node);
  };

  const handleScenarioModeToggle = (enabled: boolean) => {
    setScenarioMode(enabled);
    if (!enabled) {
      setFuelPriceChange(0);
    }
  };

  const handleResetScenario = () => {
    setFuelPriceChange(0);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-display-1 font-display-1 text-foreground">Economic model</h1>
              <p className="text-caption text-muted-foreground">Interactive fleet profitability visualization</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Last 90 days
            </Button>
            {scenarioMode && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                Scenario mode active
              </Badge>
            )}
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <Card className="bg-muted/20 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-heading text-muted-foreground">Total revenue</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="font-display-1 text-display-1 text-foreground text-tabular">
                {formatCurrency(globalKpis.totalRevenue)}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-caption text-success">+{globalKpis.changes.totalRevenue}%</div>
                <div className="h-6 w-16 opacity-60">
                  <svg width="100%" height="100%" viewBox="0 0 60 20">
                    <polyline
                      points="0,15 15,12 30,8 45,5 60,3"
                      fill="none"
                      stroke="hsl(var(--success-500))"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/20 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-heading text-muted-foreground">Total costs</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="font-display-1 text-display-1 text-foreground text-tabular">
                {formatCurrency(globalKpis.totalCosts)}
              </div>
              <div className="flex items-center justify-between">
                <div className={`text-caption ${fuelPriceChange > 0 ? 'text-danger' : 'text-warning'}`}>
                  +{fuelPriceChange > 0 ? (globalKpis.changes.totalCosts + fuelPriceChange * 0.4).toFixed(1) : globalKpis.changes.totalCosts}%
                </div>
                <div className="h-6 w-16 opacity-60">
                  <svg width="100%" height="100%" viewBox="0 0 60 20">
                    <polyline
                      points="0,10 15,11 30,13 45,14 60,16"
                      fill="none"
                      stroke="hsl(var(--warning-500))"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/20 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-heading text-muted-foreground">Net margin</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="font-display-1 text-display-1 text-foreground text-tabular">
                {formatPercentage(globalKpis.netMargin / 100)}
              </div>
              <div className="flex items-center justify-between">
                <div className={`text-caption ${globalKpis.netMargin < financeModelData.globalKpis.netMargin ? 'text-danger' : 'text-success'}`}>
                  {globalKpis.netMargin < financeModelData.globalKpis.netMargin ? '' : '+'}
                  {(globalKpis.netMargin - financeModelData.globalKpis.netMargin).toFixed(1)} pts
                </div>
                <div className="h-6 w-16 opacity-60">
                  <svg width="100%" viewBox="0 0 60 20">
                    <polyline
                      points={globalKpis.netMargin >= financeModelData.globalKpis.netMargin ? 
                        "0,15 15,12 30,10 45,7 60,5" : 
                        "0,5 15,8 30,12 45,15 60,17"}
                      fill="none"
                      stroke={globalKpis.netMargin >= financeModelData.globalKpis.netMargin ? 
                        "hsl(var(--success-500))" : 
                        "hsl(var(--danger-500))"}
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/20 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-heading text-muted-foreground">Cash on hand</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="font-display-1 text-display-1 text-foreground text-tabular">
                {formatCurrency(globalKpis.cashOnHand)}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-caption text-danger">{globalKpis.changes.cashOnHand}%</div>
                <div className="h-6 w-16 opacity-60">
                  <svg width="100%" height="100%" viewBox="0 0 60 20">
                    <polyline
                      points="0,8 15,10 30,13 45,15 60,17"
                      fill="none"
                      stroke="hsl(var(--danger-500))"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Visualization Area */}
        <div className="flex-1 p-6">
          <EconomicModelVisualization
            data={financeModelData as { nodes: Node[]; links: Link[] }}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            scenarioMode={scenarioMode}
            fuelPriceChange={fuelPriceChange}
          />
          
          {/* Hover tooltip */}
          {hoveredNode && (
            <div className="fixed top-4 right-4 bg-popover border border-border rounded-lg p-3 shadow-lg z-50">
              <div className="text-body font-body-medium text-foreground">{hoveredNode.label}</div>
              <div className="text-caption text-muted-foreground capitalize">{hoveredNode.type}</div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <EconomicModelSidePanel
          selectedNode={selectedNode}
          scenarioMode={scenarioMode}
          onScenarioModeToggle={handleScenarioModeToggle}
          fuelPriceChange={fuelPriceChange}
          onFuelPriceChange={setFuelPriceChange}
          onResetScenario={handleResetScenario}
        />
      </div>
    </div>
  );
}