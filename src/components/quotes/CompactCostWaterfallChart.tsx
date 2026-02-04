import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { Calculator, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const waterfallData = [
  { name: "Revenue", value: 57000, type: "positive", cumulative: 57000 },
  { name: "Fuel", value: -12500, type: "negative", cumulative: 44500 },
  { name: "Driver", value: -8200, type: "negative", cumulative: 36300 },
  { name: "Maintenance", value: -4800, type: "negative", cumulative: 31500 },
  { name: "Insurance", value: -2200, type: "negative", cumulative: 29300 },
  { name: "Tolls", value: -2500, type: "negative", cumulative: 26800 },
  { name: "Admin", value: -1800, type: "negative", cumulative: 25000 },
  { name: "Net Margin", value: 25000, type: "margin", cumulative: 25000 },
];

interface Quote {
  id: string;
  price: number;
}

interface CompactCostWaterfallChartProps {
  quote: Quote;
}

export function CompactCostWaterfallChart({ quote }: CompactCostWaterfallChartProps) {
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
  const netMargin = totalRevenue - totalCosts;
  const marginPercentage = (netMargin / totalRevenue) * 100;

  // Use absolute values for a horizontal bar view and hide Net Margin as a bar
  const chartData = waterfallData
    .filter((d) => d.name !== "Net Margin")
    .map((d) => ({ ...d, displayValue: Math.abs(d.value) }));

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Horizontal Bar Chart */}
      <div className="flex-1 min-h-[120px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 16, left: 80, bottom: 0 }}
          >
            <XAxis 
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `R${Math.round(value / 1000)}k`}
              domain={[0, 'dataMax']}
            />
            <YAxis 
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              width={72}
            />
            <Bar dataKey="displayValue" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.type)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-3 gap-1">
        <div className="p-1.5 bg-success/5 rounded text-center">
          <div className="text-xs font-semibold text-success text-tabular">
            {formatCurrency(totalRevenue)}
          </div>
          <div className="text-xs text-muted-foreground">Total Revenue</div>
        </div>
        <div className="p-1.5 bg-destructive/5 rounded text-center">
          <div className="text-xs font-semibold text-destructive text-tabular">
            {formatCurrency(totalCosts)}
          </div>
          <div className="text-xs text-muted-foreground">Total Costs</div>
        </div>
        <div className="p-1.5 bg-primary/5 rounded text-center">
          <div className="text-xs font-semibold text-primary text-tabular">
            {formatCurrency(netMargin)}
          </div>
          <div className="text-xs text-muted-foreground">Net Margin</div>
        </div>
      </div>

      {/* Compact Net Margin strip */}
      <div className="flex items-center gap-3 p-2 bg-primary/5 rounded border border-primary/15">
        <span className="text-xs text-muted-foreground">Net Margin</span>
        <div className="flex-1 h-1.5 bg-muted/20 rounded-full">
          <div 
            className="bg-primary h-1.5 rounded-full transition-all duration-300" 
            style={{ width: `${Math.min(100, marginPercentage)}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-primary text-tabular">
          {marginPercentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}