import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Dot, Tooltip } from "recharts";
import { Target, TrendingUp } from "lucide-react";

// Realistic win curve dataset: revenue per deal increases with margin, win rate decreases
const basePrice = 20000;
const winCurveData = [
  { margin: 8, winRate: 95 },
  { margin: 10, winRate: 88 },
  { margin: 12, winRate: 78 },
  { margin: 14, winRate: 65 },
  { margin: 16, winRate: 52 },
  { margin: 18, winRate: 38 },
  { margin: 20, winRate: 25 },
  { margin: 22, winRate: 15 },
  { margin: 24, winRate: 8 },
];

interface Quote {
  id: string;
  price: number;
  marginPct: number;
}

interface CompactWinCurveProps {
  quote: Quote;
  selectedScenario?: string;
}

export function CompactWinCurve({ quote, selectedScenario = "A" }: CompactWinCurveProps) {

  // Adjust data based on selected scenario
  const adjustedData = winCurveData.map(point => {
    const revenuePerDeal = Math.round(basePrice * (1 + point.margin / 100));
    let adjustedWinRate = point.winRate;
    
    if (selectedScenario === "B") {
      // Cost optimized - slightly lower win rates
      adjustedWinRate *= 0.95;
    } else if (selectedScenario === "C") {
      // Time critical - higher win rates at lower margins
      if (point.margin < 16) {
        adjustedWinRate *= 1.1;
      }
    }
    
    const winRate = Math.min(100, Math.round(adjustedWinRate));
    const expectedRevenue = Math.round(revenuePerDeal * (winRate / 100));

    return {
      margin: point.margin,
      winRate,
      revenuePerDeal,
      expectedRevenue,
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const winRateData = payload.find((p: any) => p.dataKey === 'winRate');
      const revenuePerDealData = payload.find((p: any) => p.dataKey === 'revenuePerDeal');
      const entry = adjustedData.find((d) => d.margin === label);
      
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-xs font-medium text-foreground mb-2">
            Margin: {label}%
          </p>
          {winRateData && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Win Probability:</span>
              <span className="font-medium text-foreground">{winRateData.value}%</span>
            </div>
          )}
          {revenuePerDealData && (
            <div className="flex items-center gap-2 text-xs mt-1">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-muted-foreground">Revenue per deal:</span>
              <span className="font-medium text-foreground">R{revenuePerDealData.value.toLocaleString()}</span>
            </div>
          )}
          {entry && (
            <div className="flex items-center gap-2 text-xs mt-1">
              <div className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-muted-foreground">Expected revenue:</span>
              <span className="font-medium text-foreground">R{entry.expectedRevenue.toLocaleString()}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Chart */}
      <div className="flex-1 min-h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={adjustedData} margin={{ top: 2, right: 12, left: 8, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="margin" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis 
              yAxisId="winRate"
              orientation="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis 
              yAxisId="revenue"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              hide
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            {/* Win Rate Line */}
            <Line
              yAxisId="winRate"
              type="monotone"
              dataKey="winRate"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: "hsl(var(--primary))" }}
            />
            
            {/* Revenue Line */}
            <Line
              yAxisId="revenue"
              type="monotone"
              dataKey="revenuePerDeal"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 3, fill: "hsl(var(--success))" }}
            />

            {/* Optimal Point Marker - Adjust for selected scenario */}
            <Line
              yAxisId="winRate"
              type="monotone"
              dataKey={(entry) => {
                const newOptimal = adjustedData.reduce((max, current) => 
                  current.expectedRevenue > max.expectedRevenue ? current : max
                );
                return entry.margin === newOptimal.margin ? entry.winRate : null;
              }}
              stroke="hsl(var(--warning))"
              strokeWidth={0}
              dot={(props) => {
                const newOptimal = adjustedData.reduce((max, current) => 
                  current.expectedRevenue > max.expectedRevenue ? current : max
                );
                if (props.payload.margin === newOptimal.margin) {
                  return <Dot {...props} r={4} fill="hsl(var(--warning))" stroke="hsl(var(--background))" strokeWidth={2} />;
                }
                return null;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-auto space-y-1.5">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-primary" />
            <span className="text-muted-foreground">Win Rate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-success border-dashed" style={{ borderTop: '1px dashed' }} />
            <span className="text-muted-foreground">Revenue per deal</span>
          </div>
        </div>
        
        <div className="p-1.5 bg-warning/5 rounded border border-warning/20">
          <div className="flex items-center gap-1 text-warning mb-0.5">
            <TrendingUp className="w-3 h-3" />
            <span className="text-xs font-medium">
              Optimal Margin Point {selectedScenario !== "A" && `(Scenario ${selectedScenario})`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {(() => {
              const newOptimal = adjustedData.reduce((max, current) => 
                current.expectedRevenue > max.expectedRevenue ? current : max
              );
              return `${newOptimal.margin}% margin yields ${newOptimal.winRate}% win rate with maximum expected revenue`;
            })()}
          </p>
        </div>
      </div>
    </div>
  );
}