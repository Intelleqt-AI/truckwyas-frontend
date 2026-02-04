import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, MapPin, Package, Truck, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { motion } from "framer-motion";

export function QuoteBuilder() {
  const [formData, setFormData] = useState({
    origin: "Johannesburg",
    destination: "Cape Town", 
    weight: "28",
    distance: "1400",
    urgency: "standard"
  });

  const [quote, setQuote] = useState({
    baseRate: 45000,
    fuelSurcharge: 3500,
    margin: 8500,
    total: 57000
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Simulate quote recalculation
    const weight = parseFloat(field === 'weight' ? value : formData.weight) || 0;
    const distance = parseFloat(field === 'distance' ? value : formData.distance) || 0;
    const baseRate = Math.round(weight * distance * 1.15);
    const fuelSurcharge = Math.round(baseRate * 0.08);
    const margin = Math.round(baseRate * 0.19);
    
    setQuote({
      baseRate,
      fuelSurcharge,
      margin,
      total: baseRate + fuelSurcharge + margin
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-caption text-muted-foreground flex items-center gap-2">
          <Calculator className="w-4 h-4 text-muted-foreground" />
          AI quote builder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Route Input */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="origin" className="text-caption text-muted-foreground">Origin</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="origin"
                value={formData.origin}
                onChange={(e) => handleInputChange('origin', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="destination" className="text-caption text-muted-foreground">Destination</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="destination"
                value={formData.destination}
                onChange={(e) => handleInputChange('destination', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Load Details */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="weight" className="text-caption text-muted-foreground">Weight (tonnes)</Label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="weight"
                type="number"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="distance" className="text-caption text-muted-foreground">Distance (km)</Label>
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="distance"
                type="number"
                value={formData.distance}
                onChange={(e) => handleInputChange('distance', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-caption text-muted-foreground">Urgency</Label>
            <Select value={formData.urgency} onValueChange={(value) => handleInputChange('urgency', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="urgent">Urgent (+15%)</SelectItem>
                <SelectItem value="express">Express (+30%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quote Breakdown */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 p-4 bg-muted/20 rounded-lg"
        >
          <div className="flex items-center justify-between text-body">
            <span className="text-muted-foreground">Base Rate</span>
            <span className="text-foreground font-body-medium text-tabular">{formatCurrency(quote.baseRate)}</span>
          </div>
          <div className="flex items-center justify-between text-body">
            <span className="text-muted-foreground">Fuel Surcharge</span>
            <span className="text-foreground font-body-medium text-tabular">{formatCurrency(quote.fuelSurcharge)}</span>
          </div>
          <div className="flex items-center justify-between text-body">
            <span className="text-muted-foreground">Margin</span>
            <span className="text-foreground font-body-medium text-tabular">{formatCurrency(quote.margin)}</span>
          </div>
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="text-caption text-muted-foreground font-body-medium text-foreground">Total quote</span>
              <span className="text-body font-body-medium text-foreground text-tabular">{formatCurrency(quote.total)}</span>
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button className="flex-1 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Generate Quote
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            Save Draft
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}