import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Fuel, Clock, MapPin, TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface ScenarioRoute {
  id: string;
  etaMin: number;
  risk: number;
  profitDelta: number;
  fuelLitres: number;
}

const mockRoutes: ScenarioRoute[] = [
  { id: "A", etaMin: 1260, risk: 0.21, profitDelta: 0, fuelLitres: 320 },
  { id: "B", etaMin: 1305, risk: 0.23, profitDelta: 550, fuelLitres: 310 },
  { id: "C", etaMin: 1210, risk: 0.30, profitDelta: -320, fuelLitres: 335 }
];

export function ScenarioCanvas() {
  const [selectedRoute, setSelectedRoute] = useState("A");
  const [fuelPriceChange, setFuelPriceChange] = useState([0]);
  const [borderDelay, setBorderDelay] = useState(false);
  const [backhaulAvailable, setBackhaulAvailable] = useState(false);

  const calculateAdjustedDelta = (route: ScenarioRoute) => {
    let adjustedDelta = route.profitDelta;
    
    // Fuel price impact
    const fuelImpact = -(route.fuelLitres * 15 * fuelPriceChange[0]) / 100;
    adjustedDelta += fuelImpact;
    
    // Border delay impact
    if (borderDelay) {
      adjustedDelta -= 800; // Fixed cost for delays
    }
    
    // Backhaul impact
    if (backhaulAvailable) {
      adjustedDelta += 1200; // Additional revenue from backhaul
    }
    
    return Math.round(adjustedDelta);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getRiskColor = (risk: number) => {
    if (risk < 0.2) return "text-success";
    if (risk < 0.25) return "text-warning";
    return "text-destructive";
  };

  const getRiskBadge = (risk: number) => {
    if (risk < 0.2) return { label: "Low", variant: "default" as const };
    if (risk < 0.25) return { label: "Medium", variant: "secondary" as const };
    return { label: "High", variant: "destructive" as const };
  };

  const resetScenario = () => {
    setFuelPriceChange([0]);
    setBorderDelay(false);
    setBackhaulAvailable(false);
    setSelectedRoute("A");
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-caption text-muted-foreground">Scenario Canvas</CardTitle>
          <Button variant="outline" size="sm" onClick={resetScenario}>
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Assumption Toggles */}
        <div className="space-y-4">
          <div className="text-body-medium font-body-medium text-foreground">Market Assumptions</div>
          
          {/* Fuel Price Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fuel className="w-4 h-4 text-muted-foreground" />
                <span className="text-body text-foreground">Fuel Price Change</span>
              </div>
              <span className="text-body-medium font-body-medium text-foreground text-tabular">
                {fuelPriceChange[0] > 0 ? '+' : ''}{fuelPriceChange[0]}%
              </span>
            </div>
            <Slider
              value={fuelPriceChange}
              onValueChange={setFuelPriceChange}
              min={-10}
              max={15}
              step={1}
              className="w-full"
            />
          </div>

          {/* Toggle Chips */}
          <div className="flex gap-2">
            <Button
              variant={borderDelay ? "default" : "outline"}
              size="sm"
              onClick={() => setBorderDelay(!borderDelay)}
            >
              Border Delay
            </Button>
            <Button
              variant={backhaulAvailable ? "default" : "outline"}
              size="sm"
              onClick={() => setBackhaulAvailable(!backhaulAvailable)}
            >
              Backhaul Available
            </Button>
          </div>
        </div>

        {/* Route Plans */}
        <div className="grid grid-cols-3 gap-3">
          {mockRoutes.map((route) => {
            const adjustedDelta = calculateAdjustedDelta(route);
            const isSelected = selectedRoute === route.id;
            const riskBadge = getRiskBadge(route.risk);
            
            return (
              <motion.div
                key={route.id}
                layout
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  className={`cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-primary bg-primary/5 shadow-md' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedRoute(route.id)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-body-medium font-body-medium text-foreground">
                        Plan {route.id}
                      </div>
                      <Badge variant={riskBadge.variant} className="text-xs">
                        {riskBadge.label} Risk
                      </Badge>
                    </div>
                    
                    {/* ETA */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-caption text-muted-foreground">
                        ETA: {formatTime(route.etaMin)}
                      </span>
                    </div>
                    
                    {/* Fuel */}
                    <div className="flex items-center gap-2">
                      <Fuel className="w-3 h-3 text-muted-foreground" />
                      <span className="text-caption text-muted-foreground">
                        {route.fuelLitres}L fuel
                      </span>
                    </div>
                    
                    {/* Profit Delta */}
                    <motion.div 
                      key={`${route.id}-${adjustedDelta}`}
                      initial={{ scale: 0.9, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center justify-center p-2 rounded bg-muted/20"
                    >
                      <div className="flex items-center gap-1">
                        {adjustedDelta > 0 ? (
                          <TrendingUp className="w-3 h-3 text-success" />
                        ) : adjustedDelta < 0 ? (
                          <TrendingDown className="w-3 h-3 text-destructive" />
                        ) : null}
                        <span className={`text-body-medium font-body-medium text-tabular ${
                          adjustedDelta > 0 ? 'text-success' : 
                          adjustedDelta < 0 ? 'text-destructive' : 'text-foreground'
                        }`}>
                          {adjustedDelta > 0 ? '+' : ''}{formatCurrency(adjustedDelta)}
                        </span>
                      </div>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Selected Route Details */}
        {selectedRoute && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-primary/5 border border-primary/20 rounded-lg"
          >
            <div className="text-body-medium font-body-medium text-foreground mb-2">
              Plan {selectedRoute} Selected
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-body-medium font-body-medium text-primary text-tabular">
                  {Math.round(mockRoutes.find(r => r.id === selectedRoute)?.risk! * 100)}%
                </div>
                <div className="text-caption text-muted-foreground">Risk Score</div>
              </div>
              <div>
                <div className="text-body-medium font-body-medium text-primary text-tabular">
                  {formatTime(mockRoutes.find(r => r.id === selectedRoute)?.etaMin!)}
                </div>
                <div className="text-caption text-muted-foreground">ETA</div>
              </div>
              <div>
                <div className="text-body-medium font-body-medium text-primary text-tabular">
                  {formatCurrency(calculateAdjustedDelta(mockRoutes.find(r => r.id === selectedRoute)!))}
                </div>
                <div className="text-caption text-muted-foreground">Profit Δ</div>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}