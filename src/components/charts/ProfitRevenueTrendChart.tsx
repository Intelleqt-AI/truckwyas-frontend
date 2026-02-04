import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";

// Mock data for 12 months of profit & revenue
const mockData = [
  { month: 'Jan', revenue: 2850000, profit: 485000 },
  { month: 'Feb', revenue: 2920000, profit: 510000 },
  { month: 'Mar', revenue: 3100000, profit: 580000 },
  { month: 'Apr', revenue: 2980000, profit: 520000 },
  { month: 'May', revenue: 3250000, profit: 650000 },
  { month: 'Jun', revenue: 3180000, profit: 590000 },
  { month: 'Jul', revenue: 3400000, profit: 720000 },
  { month: 'Aug', revenue: 3350000, profit: 680000 },
  { month: 'Sep', revenue: 3200000, profit: 610000 },
  { month: 'Oct', revenue: 3450000, profit: 750000 },
  { month: 'Nov', revenue: 3380000, profit: 695000 },
  { month: 'Dec', revenue: 3520000, profit: 780000 }
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
        <p className="text-caption text-muted-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-caption" style={{ color: entry.color }}>
            {entry.name}: {new Intl.NumberFormat('en-ZA', { 
              style: 'currency', 
              currency: 'ZAR',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function ProfitRevenueTrendChart() {
  // Calculate trend percentages
  const currentRevenue = mockData[mockData.length - 1].revenue;
  const previousRevenue = mockData[mockData.length - 2].revenue;
  const revenueTrend = ((currentRevenue - previousRevenue) / previousRevenue * 100).toFixed(1);
  
  const currentProfit = mockData[mockData.length - 1].profit;
  const previousProfit = mockData[mockData.length - 2].profit;
  const profitTrend = ((currentProfit - previousProfit) / previousProfit * 100).toFixed(1);

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={mockData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `R${(value / 1000000).toFixed(1)}M`}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Revenue Bars */}
            <Bar
              dataKey="revenue"
              fill="hsl(var(--brand-300))"
              fillOpacity={0.3}
              radius={[4, 4, 0, 0]}
              name="Revenue"
            />
            
            {/* Profit Line */}
            <Line
              type="monotone"
              dataKey="profit"
              stroke="hsl(var(--success))"
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--success))', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, fill: 'hsl(var(--success))' }}
              name="Net Profit"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary Pills */}
      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
        <div className="space-y-1 text-center">
          <div className="text-caption text-muted-foreground">Current Month Revenue</div>
          <div className="text-body-large font-body-medium text-foreground text-tabular">
            {new Intl.NumberFormat('en-ZA', { 
              style: 'currency', 
              currency: 'ZAR',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(currentRevenue)}
          </div>
          <div className={`text-caption ${parseFloat(revenueTrend) >= 0 ? 'text-success' : 'text-danger'}`}>
            {parseFloat(revenueTrend) >= 0 ? '+' : ''}{revenueTrend}% vs last month
          </div>
        </div>
        
        <div className="space-y-1 text-center">
          <div className="text-caption text-muted-foreground">Current Month Profit</div>
          <div className="text-body-large font-body-medium text-foreground text-tabular">
            {new Intl.NumberFormat('en-ZA', { 
              style: 'currency', 
              currency: 'ZAR',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(currentProfit)}
          </div>
          <div className={`text-caption ${parseFloat(profitTrend) >= 0 ? 'text-success' : 'text-danger'}`}>
            {parseFloat(profitTrend) >= 0 ? '+' : ''}{profitTrend}% vs last month
          </div>
        </div>
      </div>
    </div>
  );
}