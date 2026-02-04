import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/formatters";

interface Quote {
  id: string;
  price: number;
  marginPct: number;
}

interface CompactPriceOptimizerProps {
  quote: Quote;
}

export function CompactPriceOptimizer({ quote }: CompactPriceOptimizerProps) {
  const [currentMargin, setCurrentMargin] = useState(quote.marginPct);
  
  // Calculate price based on margin (simplified mock calculation)
  const basePrice = quote.price;
  const currentPrice = Math.round(basePrice * (1 + (currentMargin - quote.marginPct) * 0.01));

  const handlePresetClick = (preset: 'low' | 'market' | 'high') => {
    const presets = {
      low: 8,
      market: 12, 
      high: 16
    };
    setCurrentMargin(presets[preset]);
  };

  return (
    <div className="space-y-3">
      {/* Preset Buttons */}
      <div className="flex gap-1">
        <Button 
          size="sm" 
          variant="outline" 
          className="text-xs px-2 py-1 h-6"
          onClick={() => handlePresetClick('low')}
        >
          Low
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          className="text-xs px-2 py-1 h-6"
          onClick={() => handlePresetClick('market')}
        >
          Market
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          className="text-xs px-2 py-1 h-6"
          onClick={() => handlePresetClick('high')}
        >
          High
        </Button>
      </div>

      {/* Margin Slider */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Margin %</div>
        <Slider
          value={[currentMargin]}
          onValueChange={(value) => setCurrentMargin(value[0])}
          max={20}
          min={5}
          step={0.1}
          className="w-full"
        />
      </div>

      {/* Price & Margin Output */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Quoted Price</span>
          <span className="text-sm font-semibold text-foreground text-tabular">
            {formatCurrency(currentPrice)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Margin</span>
          <span className={`text-sm font-semibold text-tabular ${
            currentMargin >= 15 ? 'text-success' : 
            currentMargin >= 12 ? 'text-warning' : 'text-destructive'
          }`}>
            {currentMargin.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}