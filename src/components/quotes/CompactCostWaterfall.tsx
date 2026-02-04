import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Cell } from "recharts";

interface Quote {
  id: string;
  price: number;
}

interface CompactCostWaterfallProps {
  quote: Quote;
}

// Mock cost breakdown data  
const mockCostData = [
  { name: "Fuel", value: 8500, color: "hsl(var(--destructive))" },
  { name: "Driver", value: 3200, color: "hsl(var(--warning))" },
  { name: "Maint.", value: 1800, color: "hsl(var(--muted-foreground))" },
  { name: "Tolls", value: 2400, color: "hsl(var(--muted-foreground))" },
  { name: "Border", value: 800, color: "hsl(var(--muted-foreground))" },
  { name: "Margin", value: 2800, color: "hsl(var(--success))" }
];

export function CompactCostWaterfall({ quote }: CompactCostWaterfallProps) {
  const totalCosts = mockCostData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-3 h-full">
      {/* Total Breakdown */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">Total Costs</span>
        <span className="text-sm font-semibold text-foreground text-tabular">
          {new Intl.NumberFormat('en-ZA', {
            style: 'currency',
            currency: 'ZAR',
            minimumFractionDigits: 0
          }).format(totalCosts)}
        </span>
      </div>

      {/* Compact Bar Chart */}
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mockCostData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Bar dataKey="value" radius={2}>
              {mockCostData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Key Costs */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Fuel</span>
          <span className="text-destructive font-medium">R 8,500</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Driver</span>
          <span className="text-warning font-medium">R 3,200</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Margin</span>
          <span className="text-success font-medium">R 2,800</span>
        </div>
      </div>
    </div>
  );
}