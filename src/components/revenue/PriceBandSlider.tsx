import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

export function PriceBandSlider() {
  const [margin, setMargin] = useState([18]);
  const basePrice = 45000;
  
  const getMarginColor = (marginValue: number) => {
    if (marginValue < 12) return "text-destructive";
    if (marginValue < 16) return "text-warning";
    return "text-success";
  };

  const getMarginBadge = (marginValue: number) => {
    if (marginValue < 12) return { icon: TrendingDown, label: "Below Target", variant: "destructive" as const };
    if (marginValue < 16) return { icon: Minus, label: "Market Rate", variant: "secondary" as const };
    return { icon: TrendingUp, label: "Premium", variant: "default" as const };
  };

  const currentMargin = margin[0];
  const quotedPrice = Math.round(basePrice * (1 + currentMargin / 100));
  const badge = getMarginBadge(currentMargin);
  const IconComponent = badge.icon;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-caption text-muted-foreground flex items-center justify-between">
          <span>Price band optimizer</span>
          <Badge variant={badge.variant} className="flex items-center gap-1">
            <IconComponent className="w-3 h-3" />
            {badge.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Quote Display */}
        <div className="text-center space-y-2">
          <div className="text-caption text-muted-foreground">Quoted price</div>
          <div className="text-body font-body-medium text-foreground text-tabular">
            {formatCurrency(quotedPrice)}
          </div>
          <div className={`text-body-medium font-body-medium ${getMarginColor(currentMargin)}`}>
            {formatPercentage(currentMargin / 100)} margin
          </div>
        </div>

        {/* Margin Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted-foreground">Margin %</span>
            <span className="text-caption font-body-medium text-foreground text-tabular">{currentMargin}%</span>
          </div>
          
          <Slider
            value={margin}
            onValueChange={setMargin}
            min={8}
            max={25}
            step={0.5}
            className="w-full"
          />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>8%</span>
            <span>Market: 15%</span>
            <span>25%</span>
          </div>
        </div>

        {/* Market Positioning */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-destructive/5 rounded-lg text-center">
            <div className="text-body-medium font-body-medium text-destructive text-tabular">
              {formatCurrency(Math.round(basePrice * 1.10))}
            </div>
            <div className="text-caption text-muted-foreground">Low (10%)</div>
          </div>
          <div className="p-3 bg-muted/20 rounded-lg text-center">
            <div className="text-body-medium font-body-medium text-foreground text-tabular">
              {formatCurrency(Math.round(basePrice * 1.15))}
            </div>
            <div className="text-caption text-muted-foreground">Market (15%)</div>
          </div>
          <div className="p-3 bg-success/5 rounded-lg text-center">
            <div className="text-body-medium font-body-medium text-success text-tabular">
              {formatCurrency(Math.round(basePrice * 1.22))}
            </div>
            <div className="text-caption text-muted-foreground">High (22%)</div>
          </div>
        </div>

        {/* Win Probability */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted-foreground">Win Probability</span>
            <span className="text-caption font-body-medium text-foreground">
              {Math.max(10, Math.round(95 - (currentMargin - 10) * 3))}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${Math.max(10, Math.round(95 - (currentMargin - 10) * 3))}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}