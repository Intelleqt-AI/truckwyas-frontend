import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import CustomerDrilldown from './CustomerDrilldown';
import VehicleDrilldown from './VehicleDrilldown';
import LaneDrilldown from './LaneDrilldown';

interface Node {
  id: string;
  type: 'customer' | 'vehicle' | 'lane' | 'costCenter';
  label: string;
}

interface SidePanelProps {
  selectedNode: Node | null;
  scenarioMode: boolean;
  onScenarioModeToggle: (enabled: boolean) => void;
  fuelPriceChange: number;
  onFuelPriceChange: (value: number) => void;
  onResetScenario: () => void;
}

const EconomicModelSidePanel: React.FC<SidePanelProps> = ({
  selectedNode,
  scenarioMode,
  onScenarioModeToggle,
  fuelPriceChange,
  onFuelPriceChange,
  onResetScenario
}) => {
  const renderNodeDrilldown = (node: Node) => {
    switch (node.type) {
      case 'customer':
        return <CustomerDrilldown customerId={node.id} customerName={node.label} />;
      case 'vehicle':
        return <VehicleDrilldown vehicleId={node.id} vehicleName={node.label} />;
      case 'lane':
        return <LaneDrilldown laneId={node.id} laneName={node.label} />;
      case 'costCenter':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-heading text-muted-foreground mb-2">{node.label} - Cost center analysis</h3>
              <p className="text-caption text-muted-foreground">
                Detailed breakdown and optimization opportunities
              </p>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg">
              <div className="text-body font-body-medium text-foreground">Cost Center: {node.label}</div>
              <div className="text-caption text-muted-foreground mt-1">
                Analysis and optimization recommendations will be displayed here
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderScenarioControls = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-heading text-muted-foreground mb-2">Scenario planner</h3>
        <p className="text-caption text-muted-foreground">Adjust parameters to see real-time impact on profitability</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-body font-body-medium text-foreground block mb-2">
            Fuel price change: {fuelPriceChange > 0 ? '+' : ''}{fuelPriceChange}%
          </label>
          <Slider
            value={[fuelPriceChange]}
            onValueChange={(value) => onFuelPriceChange(value[0])}
            max={25}
            min={-10}
            step={1}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-body font-body-medium text-foreground block mb-2">
            Toll increase: 0%
          </label>
          <Slider
            value={[0]}
            onValueChange={() => {}}
            max={20}
            min={0}
            step={1}
            className="w-full opacity-50"
            disabled
          />
        </div>

        <div>
          <label className="text-body font-body-medium text-foreground block mb-2">
            Driver wage change: 0%
          </label>
          <Slider
            value={[0]}
            onValueChange={() => {}}
            max={15}
            min={-5}
            step={1}
            className="w-full opacity-50"
            disabled
          />
        </div>
      </div>

      <Button onClick={onResetScenario} variant="outline" className="w-full">
        Reset scenario
      </Button>
    </div>
  );

  const renderDefaultContent = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-heading text-muted-foreground mb-2">Economic model explorer</h3>
        <p className="text-caption text-muted-foreground">
          Click on any node in the visualization to see detailed analysis
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
          <span className="text-body font-body-medium text-foreground">Active customers</span>
          <Badge variant="outline">3</Badge>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
          <span className="text-body font-body-medium text-foreground">Fleet vehicles</span>
          <Badge variant="outline">3</Badge>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
          <span className="text-body font-body-medium text-foreground">Active lanes</span>
          <Badge variant="outline">2</Badge>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-80 h-full bg-card border-l border-border p-4 overflow-y-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-body font-body-medium text-foreground">Scenario mode</span>
          <Switch
            checked={scenarioMode}
            onCheckedChange={onScenarioModeToggle}
          />
        </div>

        {scenarioMode ? (
          renderScenarioControls()
        ) : (
          <>
            {selectedNode ? renderNodeDrilldown(selectedNode) : renderDefaultContent()}
          </>
        )}
      </div>
    </div>
  );
};

export default EconomicModelSidePanel;