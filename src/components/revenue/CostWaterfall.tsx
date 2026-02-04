import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { Calculator, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const waterfallData = [
  { name: "Revenue", value: 57000, type: "positive", cumulative: 57000 },
  { name: "Fuel", value: -12500, type: "negative", cumulative: 44500 },
  { name: "Driver", value: -8200, type: "negative", cumulative: 36300 },
  { name: "Maintenance", value: -4800, type: "negative", cumulative: 31500 },
  { name: "Insurance", value: -2200, type: "negative", cumulative: 29300 },
  { name: "Admin", value: -1800, type: "negative", cumulative: 27500 },
  { name: "Net Margin", value: 27500, type: "margin", cumulative: 27500 },
];

export function CostWaterfall() {
  const getBarColor = (type: string) => {
    switch (type) {
      case "positive": return "hsl(var(--success))";
      case "negative": return "hsl(var(--destructive))";
      case "margin": return "hsl(var(--primary))";
      default: return "hsl(var(--muted))";
    }
  };

  const totalRevenue = waterfallData[0].value;
  const totalCosts = waterfallData.slice(1, -1).reduce((sum, item) => sum + Math.abs(item.value), 0);
  const netMargin = waterfallData[waterfallData.length - 1].value;
  const marginPercentage = (netMargin / totalRevenue) * 100;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-caption text-muted-foreground flex items-center gap-2">
          <Calculator className="w-4 h-4 text-muted-foreground" />
          Cost waterfall analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Waterfall Chart */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <XAxis 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `${value / 1000}k`}
              />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {waterfallData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.type)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-success/5 rounded-lg text-center">
            <div className="text-body-medium font-body-medium text-success text-tabular">
              {formatCurrency(totalRevenue)}
            </div>
            <div className="text-caption text-muted-foreground">Total Revenue</div>
          </div>
          <div className="p-3 bg-destructive/5 rounded-lg text-center">
            <div className="text-body-medium font-body-medium text-destructive text-tabular">
              {formatCurrency(totalCosts)}
            </div>
            <div className="text-caption text-muted-foreground">Total Costs</div>
          </div>
          <div className="p-3 bg-primary/5 rounded-lg text-center">
            <div className="text-body-medium font-body-medium text-primary text-tabular">
              {formatCurrency(netMargin)}
            </div>
            <div className="text-caption text-muted-foreground">Net Margin</div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="space-y-3">
          <div className="text-caption text-muted-foreground font-body-medium">Cost Breakdown</div>
          {waterfallData.slice(1, -1).map((item) => (
            <div key={item.name} className="flex items-center justify-between p-2 bg-muted/10 rounded">
              <div className="flex items-center gap-2">
                {item.value < 0 ? 
                  <TrendingDown className="w-3 h-3 text-destructive" /> : 
                  <TrendingUp className="w-3 h-3 text-success" />
                }
                <span className="text-body text-foreground">{item.name}</span>
              </div>
              <div className="text-body-medium font-body-medium text-foreground text-tabular">
                {formatCurrency(Math.abs(item.value))}
              </div>
            </div>
          ))}
        </div>

        {/* Margin Analysis */}
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-muted-foreground">Net Margin %</span>
            <span className="text-caption text-muted-foreground font-body-medium text-primary text-tabular">
              {marginPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-muted/20 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(100, marginPercentage * 2)}%` }}
            />
          </div>
          <p className="text-caption text-muted-foreground mt-2">
            {marginPercentage > 25 ? "Excellent" : marginPercentage > 18 ? "Good" : marginPercentage > 12 ? "Fair" : "Below target"} margin for this route type
          </p>
        </div>
      </CardContent>
    </Card>
  );
}